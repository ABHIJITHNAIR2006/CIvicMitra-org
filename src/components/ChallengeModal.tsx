import { useState } from "react";
import { collection, doc, updateDoc, increment, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import { Challenge } from "../types";
import { motion } from "motion/react";
import { X, Upload, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "VERIFYING" | "SUCCESS" | "ERROR">("IDLE");
  const [reason, setReason] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const raw = reader.result as string;
        const compressed = await compressImagePayload(raw);
        setPreview(compressed);
      };
      reader.readAsDataURL(selected);
    }
  };

  const handleSubmit = async () => {
    if (!file || !auth.currentUser) return;
    setSubmitting(true);
    setStatus("VERIFYING");

    try {
      // 1. Upload to Firebase Storage (with graceful fallback to data URL if storage is unavailable)
      let downloadUrl = preview!;
      try {
        const storageRef = ref(storage, `completions/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(uploadResult.ref);
      } catch (storageErr) {
        console.warn("Firebase Storage upload failed or timed out; falling back to proof data URL:", storageErr);
        downloadUrl = preview!;
      }

      // 2. AI Verification
      const result = await verifyEcoProof(preview!, challenge.title, challenge.proofInstructions);
      
      // 3. Save Completion
      const completionData = {
        userId: auth.currentUser.uid,
        challengeId: challenge.challengeId,
        proofUrl: downloadUrl,
        proofType: "IMAGE",
        aiVerificationStatus: result.verified ? "VERIFIED" : "REJECTED",
        aiVerificationScore: result.score,
        pointsAwarded: result.verified ? challenge.points : 0,
        isStreakDay: result.verified,
        submittedAt: new Date().toISOString(),
        verifiedAt: result.verified ? new Date().toISOString() : null,
        caption: "",
        likesCount: 0,
        commentsCount: 0
      };

      await addDoc(collection(db, "completions"), completionData).catch(e => handleFirestoreError(e, OperationType.CREATE, "completions"));

      if (result.verified) {
        // 4. Update User Points & Streak
        const userRef = doc(db, "users", auth.currentUser.uid);
        
        const updateData = {
          points: increment(challenge.points),
          totalPoints: increment(challenge.points),
          currentStreak: increment(1),
          lastActivityDate: new Date().toISOString().split('T')[0]
        };

        await updateDoc(userRef, updateData).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${auth.currentUser?.uid}`));
        
        // Update badge stats
        updateStats({
          points: challenge.points,
          proofs_submitted: 1
        });

        setStatus("SUCCESS");
        toast.success(`Verified! +${challenge.points} points earned.`);
      } else {
        setStatus("ERROR");
        setReason(result.reason);
        toast.error("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("Submission error:", error);
      setStatus("ERROR");
      setReason("Something went wrong. Please try again.");
    } finally {
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
                    "border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center transition-all",
                    preview ? "border-primary bg-primary/5" : "hover:border-primary hover:bg-gray-50"
                  )}
                >
                  {preview ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden">
                      <img src={preview} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => {setFile(null); setPreview(null);}}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                      <p className="font-bold text-lg">Upload Proof</p>
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
                  disabled={!file || submitting}
                  onClick={handleSubmit}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg disabled:opacity-50"
                >
                  {submitting ? "Verifying..." : "Submit Proof"}
                </button>
              </div>
            )}

            {status === "VERIFYING" && (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xl font-bold">Verifying your proof...</p>
                <p className="text-text-secondary">Our AI is checking your submission. This usually takes 5-10 seconds.</p>
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
                <p className="text-2xl font-bold">Verification Failed</p>
                <p className="text-text-secondary">{reason || "We couldn't verify your proof. Please try again with a clearer image."}</p>
                <button onClick={() => setStatus("IDLE")} className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Try Again</button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
