import { useState, useRef, useEffect } from "react";
import { collection, doc, updateDoc, increment, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import { Challenge } from "../types";
import { motion } from "motion/react";
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { verifyEcoProof } from "../services/geminiService";
import { updateStats } from "../lib/badge-utils";
import { compressImagePayload } from "../lib/image-utils";
import { toast } from "react-hot-toast";

interface ChallengeModalProps {
  challenge: Challenge;
  onClose: () => void;
}

export default function ChallengeModal({ challenge, onClose }: ChallengeModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "VERIFYING" | "SUCCESS" | "ERROR">("IDLE");
  const [reason, setReason] = useState("");
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith("image/")) {
        toast.error("Please upload an image file (JPEG, PNG, WebP).");
        return;
      }
      setFile(selected);
      setPreview(null);
      setIsProcessingImage(true);

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const raw = reader.result as string;
          const compressed = await compressImagePayload(raw);
          setPreview(compressed);
        } catch (err) {
          console.error("Failed to compress image payload:", err);
          setPreview(reader.result as string);
        } finally {
          setIsProcessingImage(false);
        }
      };
      reader.onerror = () => {
        setIsProcessingImage(false);
        toast.error("Failed to read image file.");
      };
      reader.readAsDataURL(selected);
    }
  };

  const handleSubmit = async () => {
    if (!file || !preview || isProcessingImage || !auth.currentUser) {
      if (!preview && isProcessingImage) {
        toast.error("Please wait, image is still being optimized...");
      }
      return;
    }

    setSubmitting(true);
    setStatus("VERIFYING");

    // Outer 28-second fallback timeout guarantee
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      console.warn("[ChallengeModal] Outer safety timeout triggered (28s).");
      setStatus("ERROR");
      setReason("Verification is taking longer than expected. Please check your network and try again.");
      setSubmitting(false);
    }, 28000);

    try {
      // 1. Run AI Verification FIRST
      console.log(`[${new Date().toISOString()}] [ChallengeModal] Starting AI verification for "${challenge.title}"`);
      const result = await verifyEcoProof(preview, challenge.title, challenge.proofInstructions);
      console.log(`[${new Date().toISOString()}] [ChallengeModal] AI verification finished:`, result);

      if (!result.verified) {
        setStatus("ERROR");
        setReason(result.reason || "We couldn't verify your proof against the challenge criteria.");
        toast.error("Verification not approved.");
        return;
      }

      // 2. Proof Verified! Attempt Firebase Storage upload with a strict 4-second timeout
      let downloadUrl = preview;
      try {
        const uploadTask = async () => {
          const storageRef = ref(storage, `completions/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
          const uploadResult = await uploadBytes(storageRef, file);
          return await getDownloadURL(uploadResult.ref);
        };
        const storageTimeout = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Firebase Storage upload timed out")), 4000)
        );
        downloadUrl = await Promise.race([uploadTask(), storageTimeout]);
      } catch (storageErr) {
        console.warn("Storage upload skipped or timed out; using data URL fallback:", storageErr);
        downloadUrl = preview;
      }

      // 3. Save Completion record
      const completionData = {
        userId: auth.currentUser.uid,
        challengeId: challenge.challengeId,
        proofUrl: downloadUrl,
        proofType: "IMAGE",
        aiVerificationStatus: "VERIFIED",
        aiVerificationScore: result.score,
        pointsAwarded: challenge.points,
        isStreakDay: true,
        submittedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        caption: "",
        likesCount: 0,
        commentsCount: 0
      };

      await addDoc(collection(db, "completions"), completionData).catch(e => 
        handleFirestoreError(e, OperationType.CREATE, "completions")
      );

      // 4. Update User Points & Streak
      const userRef = doc(db, "users", auth.currentUser.uid);
      const updateData = {
        points: increment(challenge.points),
        totalPoints: increment(challenge.points),
        currentStreak: increment(1),
        lastActivityDate: new Date().toISOString().split('T')[0]
      };

      await updateDoc(userRef, updateData).catch(e => 
        handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser?.uid}`)
      );
      
      // Update badge stats
      updateStats({
        points: challenge.points,
        proofs_submitted: 1
      });

      setStatus("SUCCESS");
      toast.success(`Verified! +${challenge.points} points earned.`);
    } catch (error: any) {
      console.error("Submission error in ChallengeModal:", error);
      setStatus("ERROR");
      setReason(error?.message || "An unexpected error occurred during submission. Please try again.");
    } finally {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl bg-card rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="h-48 relative">
          <img src={challenge.bannerImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-card/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-card/40 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{challenge.iconEmoji}</span>
            <h2 className="text-3xl font-display text-text-primary">{challenge.title}</h2>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-text-secondary uppercase text-xs tracking-widest mb-2">Instructions</h4>
              <p className="text-text-secondary leading-relaxed">{challenge.description}</p>
            </div>

            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <h4 className="font-bold text-primary text-sm mb-1">Proof Required</h4>
              <p className="text-sm text-primary/80">{challenge.proofInstructions}</p>
            </div>

            {status === "IDLE" && (
              <div className="space-y-4">
                <div 
                  className={cn(
                    "border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center transition-all min-h-[180px] flex items-center justify-center",
                    preview ? "border-primary bg-primary/5" : "hover:border-primary hover:bg-gray-50"
                  )}
                >
                  {isProcessingImage ? (
                    <div className="py-8 space-y-3">
                      <Loader2 className="animate-spin mx-auto text-primary" size={36} />
                      <p className="text-sm font-semibold text-text-secondary">Optimizing image resolution...</p>
                    </div>
                  ) : preview ? (
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden">
                      <img src={preview} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                        title="Remove image"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full py-4">
                      <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                      <p className="font-bold text-lg text-text-primary">Upload Proof</p>
                      <p className="text-sm text-text-secondary">Click to browse or drag and drop</p>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                <button
                  disabled={!file || !preview || isProcessingImage || submitting}
                  onClick={handleSubmit}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? "Verifying with AI..."
                    : isProcessingImage
                    ? "Optimizing image..."
                    : "Submit Proof"}
                </button>
              </div>
            )}

            {status === "VERIFYING" && (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xl font-bold text-text-primary">Verifying your proof with Gemini AI...</p>
                <p className="text-text-secondary">Our AI is checking your submission against the challenge requirements.</p>
              </div>
            )}

            {status === "SUCCESS" && (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} />
                </div>
                <p className="text-2xl font-bold text-text-primary">Proof Verified! 🎉</p>
                <p className="text-text-secondary">You've earned +{challenge.points} points and kept your streak alive.</p>
                <button onClick={onClose} className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Back to Challenges</button>
              </div>
            )}

            {status === "ERROR" && (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={40} />
                </div>
                <p className="text-2xl font-bold text-text-primary">Verification Not Approved</p>
                <p className="text-text-secondary max-w-md mx-auto">{reason || "We couldn't verify your proof. Please try again with a clearer image."}</p>
                <button onClick={() => setStatus("IDLE")} className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Try Again</button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
