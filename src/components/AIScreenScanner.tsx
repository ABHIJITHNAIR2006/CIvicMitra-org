import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, Sparkles, X, Camera, Monitor, Upload, AlertCircle, CheckCircle2, 
  RotateCcw, Zap, Compass, ArrowRight, ShieldCheck, Clock, ExternalLink, Loader2 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment } from "firebase/firestore";
import { Challenge, Completion, ScreenScan, VerificationStatus } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import { 
  isScannerEnabled, MAX_SCANS_PER_DAY, getDailyScansUsed, recordDailyScan, 
  getCooldownRemainingSeconds, calculateImageHash 
} from "../lib/scan-utils";
import { scanScreenForCivicChallenge, ScanCandidateChallenge } from "../services/geminiService";
import { updateStats, getStats } from "../lib/badge-utils";
import { compressImagePayload } from "../lib/image-utils";
import { toast } from "react-hot-toast";

type ScannerMode = "CHOOSE" | "CAMERA" | "ANALYZING" | "RESULT";

export default function AIScreenScanner() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(() => isScannerEnabled());
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ScannerMode>("CHOOSE");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [dailyScans, setDailyScans] = useState(0);

  // Analysis state
  const [scanningMessage, setScanningMessage] = useState("Analyzing visual evidence...");
  const [analysisResult, setAnalysisResult] = useState<{
    verified: boolean;
    isCivicRelated: boolean;
    confidence: number;
    matchedChallenge?: Challenge | null;
    pointsAwarded: number;
    reason: string;
    isDuplicate?: boolean;
  } | null>(null);

  // Video streams
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Listen to toggle events from Settings
  useEffect(() => {
    const handleToggle = (e: any) => {
      if (typeof e.detail === "boolean") {
        setEnabled(e.detail);
      } else {
        setEnabled(isScannerEnabled());
      }
    };
    window.addEventListener("civicmitra:scanner-toggle", handleToggle);
    return () => window.removeEventListener("civicmitra:scanner-toggle", handleToggle);
  }, []);

  // Update daily scans count & cooldown timer
  useEffect(() => {
    if (!isOpen) return;
    const uid = auth.currentUser?.uid;
    setDailyScans(getDailyScansUsed(uid));
    setCooldown(getCooldownRemainingSeconds());

    const interval = setInterval(() => {
      const remaining = getCooldownRemainingSeconds();
      setCooldown(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Clean up camera stream on unmount or mode switch
  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Handle closing modal
  const handleClose = () => {
    stopCameraStream();
    setIsOpen(false);
    setMode("CHOOSE");
    setCapturedImage(null);
    setAnalysisResult(null);
  };

  // 1. Screen Capture via getDisplayMedia
  const handleScreenCapture = async () => {
    if (cooldown > 0) {
      toast.error(`Please wait ${cooldown}s before initiating another scan.`);
      return;
    }
    if (dailyScans >= MAX_SCANS_PER_DAY) {
      toast.error(`Daily limit reached (${MAX_SCANS_PER_DAY} scans per day). Resets tomorrow.`);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error("Screen capture is not supported on this browser or platform.");
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as any,
        audio: false
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Allow 300ms for video frame to paint
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      // Stop all screen capture tracks immediately
      stream.getTracks().forEach((t) => t.stop());

      setCapturedImage(dataUrl);
      processCapturedImage(dataUrl);
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        console.error("Screen capture error:", err);
        toast.error("Failed to capture screen: " + (err.message || "Unknown error"));
      }
    }
  };

  // 2. Camera Capture
  const handleStartCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera is not supported on this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      cameraStreamRef.current = stream;
      setMode("CAMERA");

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera: " + (err.message || "Permission denied"));
    }
  };

  const handleSnapCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    stopCameraStream();
    setCapturedImage(dataUrl);
    processCapturedImage(dataUrl);
  };

  // 3. File Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      processCapturedImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // AI Pipeline Execution
  const processCapturedImage = async (rawUrl: string) => {
    setMode("ANALYZING");
    setScanningMessage("Optimizing visual evidence...");
    const dataUrl = await compressImagePayload(rawUrl);
    setCapturedImage(dataUrl);
    setScanningMessage("Generating cryptographic fingerprint...");

    const uid = auth.currentUser?.uid;

    try {
      // Step A: Duplicate check via SHA-256 hash
      const imageHash = await calculateImageHash(dataUrl);

      if (uid) {
        try {
          const dupQuery = query(
            collection(db, "screenScans"),
            where("userId", "==", uid),
            where("imageHash", "==", imageHash)
          );
          const dupSnap = await getDocs(dupQuery);
          if (!dupSnap.empty) {
            setAnalysisResult({
              verified: false,
              isCivicRelated: false,
              confidence: 0,
              pointsAwarded: 0,
              reason: "This screenshot or photo was already submitted. Duplicate entries cannot be verified.",
              isDuplicate: true
            });
            setMode("RESULT");
            return;
          }
        } catch (dupErr) {
          console.warn("Duplicate query skipped/soft error:", dupErr);
        }
      }

      // Step B: Fetch active challenges from Firestore
      setScanningMessage("Matching with active civic challenges...");
      let activeChallenges: Challenge[] = [];
      try {
        const snap = await getDocs(collection(db, "challenges")).catch((e) =>
          handleFirestoreError(e, OperationType.LIST, "challenges")
        );
        if (snap && !snap.empty) {
          activeChallenges = snap.docs
            .map((d) => {
              const data = d.data();
              return {
                challengeId: data.challengeId || d.id,
                ...data
              } as Challenge;
            })
            .filter((c) => c.isActive !== false);
        }
      } catch (chErr) {
        console.error("Failed to load challenges for matching:", chErr);
      }

      if (activeChallenges.length === 0) {
        setAnalysisResult({
          verified: false,
          isCivicRelated: false,
          confidence: 0,
          pointsAwarded: 0,
          reason: "No active civic challenges are available to match at this time."
        });
        setMode("RESULT");
        return;
      }

      // Format candidates for AI verification
      setScanningMessage("Running Gemini vision evaluation...");
      const candidates: ScanCandidateChallenge[] = activeChallenges.map((c) => ({
        challengeId: c.challengeId,
        title: c.title,
        category: c.category,
        proofInstructions: c.proofInstructions || c.description,
        points: c.points
      }));

      // Step C: Call Gemini AI Verification
      const result = await scanScreenForCivicChallenge(dataUrl, candidates);

      // Record daily scan usage
      const newDailyCount = recordDailyScan(uid);
      setDailyScans(newDailyCount);
      setCooldown(getCooldownRemainingSeconds());

      let matchedChallenge: Challenge | null = null;
      let pointsAwarded = 0;

      if (result.matchedChallengeId) {
        matchedChallenge =
          activeChallenges.find((c) => c.challengeId === result.matchedChallengeId) || null;
      }

      if (result.verified && matchedChallenge) {
        pointsAwarded = matchedChallenge.points || 50;

        // Step D: Record completion and award points
        if (uid) {
          const compData: Omit<Completion, "id"> = {
            userId: uid,
            challengeId: matchedChallenge.challengeId,
            proofUrl: dataUrl,
            proofType: "SCREEN_SCAN",
            caption: `Automated AI Screen Verification: ${matchedChallenge.title}`,
            aiVerificationStatus: VerificationStatus.VERIFIED,
            aiVerificationScore: result.confidence,
            pointsAwarded,
            isStreakDay: true,
            submittedAt: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
            likesCount: 0,
            commentsCount: 0
          };

          await addDoc(collection(db, "completions"), compData).catch((e) =>
            handleFirestoreError(e, OperationType.CREATE, "completions")
          );

          // Update user points and completedChallenges in Firestore
          await updateDoc(doc(db, "users", uid), {
            points: increment(pointsAwarded),
            completedChallenges: increment(1)
          }).catch((e) =>
            handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`)
          );

          // Update local badge/stats
          const currentStats = getStats();
          updateStats({
            points: currentStats.points + pointsAwarded,
            proofs_submitted: currentStats.proofs_submitted + 1
          });
        }

        toast.success(`🎉 Verified! +${pointsAwarded} points awarded!`);
      } else {
        toast.error("Action could not be verified.");
      }

      // Step E: Save audit log to screenScans collection
      if (uid) {
        const scanRecord: Omit<ScreenScan, "id"> = {
          userId: uid,
          imageHash,
          matchedChallengeId: matchedChallenge?.challengeId || null,
          matchedChallengeTitle: matchedChallenge?.title || null,
          status: result.verified ? "VERIFIED" : "REJECTED",
          confidence: result.confidence,
          pointsAwarded,
          reason: result.reason,
          scannedAt: new Date().toISOString()
        };

        await addDoc(collection(db, "screenScans"), scanRecord).catch((e) =>
          handleFirestoreError(e, OperationType.CREATE, "screenScans")
        );
      }

      setAnalysisResult({
        verified: result.verified,
        isCivicRelated: result.isCivicRelated,
        confidence: result.confidence,
        matchedChallenge,
        pointsAwarded,
        reason: result.reason
      });

      setMode("RESULT");
    } catch (error: any) {
      console.error("AI scanning pipeline failed:", error);
      setAnalysisResult({
        verified: false,
        isCivicRelated: false,
        confidence: 0,
        pointsAwarded: 0,
        reason: error?.message || "An unexpected error occurred during AI analysis."
      });
      setMode("RESULT");
    }
  };

  if (!enabled) return null;

  return (
    <>
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Ambient Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          id="civic-ai-scanner-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all cursor-pointer font-medium text-sm"
          title="CivicMitra AI Screen Scanner"
        >
          {/* Subtle Radar Ripple */}
          <span className="absolute -inset-1 rounded-full bg-primary/30 animate-ping pointer-events-none opacity-60" />
          
          <div className="relative flex items-center justify-center">
            <Bot size={20} className="transition-transform group-hover:rotate-12" />
            <Sparkles size={11} className="absolute -top-1.5 -right-1.5 text-amber-300 animate-pulse" />
          </div>

          <span className="hidden sm:inline font-bold">AI Scanner</span>
          
          {cooldown > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-black/30 font-mono">
              {cooldown}s
            </span>
          )}
        </motion.button>
      </div>

      {/* Floating Scanner Modal Window */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-1.5">
                      Civic AI Screen Scanner
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">
                        Ambient
                      </span>
                    </h3>
                    <p className="text-xs text-text-secondary">
                      {MAX_SCANS_PER_DAY - dailyScans} of {MAX_SCANS_PER_DAY} scans remaining today
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-muted transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* MODE 1: CHOOSE ACTION */}
                {mode === "CHOOSE" && (
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      Capture proof directly from your browser, upload an image, or snap a photo. 
                      Gemini evaluates your action in real-time and matches it to an active civic challenge.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Option 1: Instant Screen Grab */}
                      <button
                        onClick={handleScreenCapture}
                        disabled={cooldown > 0}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all text-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Monitor size={22} />
                        </div>
                        <span className="font-bold text-sm text-text-primary">Screen Grab</span>
                        <span className="text-[11px] text-text-secondary">Single frame capture</span>
                      </button>

                      {/* Option 2: Live Camera */}
                      <button
                        onClick={handleStartCamera}
                        disabled={cooldown > 0}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all text-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Camera size={22} />
                        </div>
                        <span className="font-bold text-sm text-text-primary">Snap Photo</span>
                        <span className="text-[11px] text-text-secondary">Use webcam / device</span>
                      </button>

                      {/* Option 3: Upload File */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={cooldown > 0}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all text-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload size={22} />
                        </div>
                        <span className="font-bold text-sm text-text-primary">Upload Proof</span>
                        <span className="text-[11px] text-text-secondary">File or screenshot</span>
                      </button>
                    </div>

                    {cooldown > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
                        <Clock size={16} className="shrink-0" />
                        <span>Cooldown active: please wait <strong>{cooldown}s</strong> before scanning again.</span>
                      </div>
                    )}

                    <div className="p-3.5 rounded-2xl bg-muted/50 border border-border flex items-start gap-3">
                      <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="text-xs text-text-secondary space-y-1">
                        <span className="font-semibold text-text-primary block">Privacy & Anti-Cheat Guarantee</span>
                        <span>
                          Only a single frame is processed at the exact moment of capture. Stream is terminated immediately and frames are cryptographically hashed to prevent duplicate points.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 2: CAMERA LIVE VIEW */}
                {mode === "CAMERA" && (
                  <div className="space-y-4 text-center">
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handleSnapCamera}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                      >
                        <Camera size={16} />
                        <span>Capture Frame</span>
                      </button>
                      <button
                        onClick={() => {
                          stopCameraStream();
                          setMode("CHOOSE");
                        }}
                        className="px-4 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* MODE 3: ANALYZING STATE */}
                {mode === "ANALYZING" && (
                  <div className="space-y-4 text-center py-6">
                    <div className="relative w-full aspect-video max-h-48 rounded-2xl overflow-hidden border border-primary/20 bg-muted flex items-center justify-center mx-auto">
                      {capturedImage && (
                        <img
                          src={capturedImage}
                          alt="Captured preview"
                          className="w-full h-full object-cover opacity-70"
                        />
                      )}
                      {/* Scanning Beam Animation */}
                      <motion.div
                        animate={{ top: ["0%", "95%", "0%"] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                        className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_15px_3px_rgba(34,197,94,0.8)]"
                      />
                      <div className="absolute inset-0 bg-primary/5 backdrop-blur-[0.5px]" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary font-bold text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        <span>{scanningMessage}</span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Matching visual markers against active civic missions in CivicMitra...
                      </p>
                    </div>
                  </div>
                )}

                {/* MODE 4: RESULT STATE */}
                {mode === "RESULT" && analysisResult && (
                  <div className="space-y-4">
                    {/* Result Header Banner */}
                    <div
                      className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                        analysisResult.verified
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                          : "bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-100"
                      }`}
                    >
                      {analysisResult.verified ? (
                        <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={24} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-1">
                        <h4 className="font-bold text-sm">
                          {analysisResult.verified
                            ? "Civic Action Verified!"
                            : analysisResult.isDuplicate
                            ? "Duplicate Submission Detected"
                            : "Verification Inconclusive"}
                        </h4>
                        <p className="text-xs opacity-90 leading-relaxed">
                          {analysisResult.reason}
                        </p>
                      </div>
                    </div>

                    {/* Matched Challenge Card (if verified) */}
                    {analysisResult.verified && analysisResult.matchedChallenge && (
                      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            Matched Mission
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-black text-xs">
                            +{analysisResult.pointsAwarded} Eco-Points
                          </span>
                        </div>

                        <h5 className="font-bold text-base text-text-primary">
                          {analysisResult.matchedChallenge.title}
                        </h5>

                        <p className="text-xs text-text-secondary line-clamp-2">
                          {analysisResult.matchedChallenge.description}
                        </p>

                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-card border border-border font-medium text-text-secondary">
                            Category: {analysisResult.matchedChallenge.category}
                          </span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-card border border-border font-medium text-text-secondary">
                            Confidence: {Math.round(analysisResult.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        onClick={() => {
                          setMode("CHOOSE");
                          setCapturedImage(null);
                          setAnalysisResult(null);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                      >
                        <RotateCcw size={14} />
                        <span>Scan Another</span>
                      </button>

                      {analysisResult.verified ? (
                        <button
                          onClick={() => {
                            handleClose();
                            navigate("/feed");
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                          <span>View in Feed</span>
                          <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            handleClose();
                            navigate("/challenges");
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                          <span>Browse Challenges</span>
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Quick Nav Dock */}
              <div className="p-3 border-t border-border bg-muted/40 flex items-center justify-around gap-1">
                <button
                  onClick={() => {
                    handleClose();
                    navigate("/dashboard");
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card transition-colors cursor-pointer"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    handleClose();
                    navigate("/challenges");
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card transition-colors cursor-pointer"
                >
                  Challenges
                </button>
                <button
                  onClick={() => {
                    handleClose();
                    navigate("/leaderboard");
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card transition-colors cursor-pointer"
                >
                  Leaderboard
                </button>
                <button
                  onClick={() => {
                    handleClose();
                    navigate("/feed");
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card transition-colors cursor-pointer"
                >
                  Feed
                </button>
                <button
                  onClick={() => {
                    handleClose();
                    navigate("/profile");
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card transition-colors cursor-pointer"
                >
                  Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
