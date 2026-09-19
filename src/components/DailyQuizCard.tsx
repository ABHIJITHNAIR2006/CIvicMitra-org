import { useState, useEffect } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "motion/react";
import { Brain, CheckCircle2, Trophy, ArrowRight, Loader2 } from "lucide-react";
import QuizModal from "./QuizModal";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";

export default function DailyQuizCard() {
  const { user } = useAuth();
  const [hasAttempted, setHasAttempted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const checkAttempt = async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const q = query(
        collection(db, "quiz_attempts"),
        where("userId", "==", user.uid),
        where("date", "==", today),
        limit(1)
      );
      const snap = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, "quiz_attempts"));
      if (snap && !snap.empty) {
        setHasAttempted(true);
        setLastScore(snap.docs[0].data().score);
      } else {
        setHasAttempted(false);
      }
    } catch (error) {
      console.error("Error checking quiz attempt:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAttempt();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-[2rem] card-shadow animate-pulse h-48" />
    );
  }

  return (
    <>
      <motion.div 
        whileHover={{ y: -5 }}
        className="bg-card p-8 rounded-[2.5rem] card-shadow relative overflow-hidden group"
      >
        {/* Background Decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
        
        <div className="flex flex-col h-full justify-between space-y-6">
          <div className="flex justify-between items-start">
            <div className={`p-4 rounded-2xl ${hasAttempted ? 'bg-green-50 text-green-500' : 'bg-primary/10 text-primary'}`}>
              <Brain size={32} />
            </div>
            {hasAttempted && (
              <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 size={14} />
                COMPLETED
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-text-primary">Daily Eco-Quiz</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {hasAttempted 
                ? `You've earned ${lastScore} points today! Come back tomorrow for more.`
                : "Test your sustainability knowledge and earn up to 50 points daily (5 questions, 10 pts each)."}
            </p>
          </div>

          <div className="pt-2">
            {hasAttempted ? (
              <div className="flex items-center gap-2 text-primary font-bold">
                <Trophy size={20} />
                <span>Score: {lastScore}/50</span>
              </div>
            ) : (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
              >
                Start Quiz
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <QuizModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onComplete={() => {
          setHasAttempted(true);
          checkAttempt();
        }}
      />
    </>
  );
}
