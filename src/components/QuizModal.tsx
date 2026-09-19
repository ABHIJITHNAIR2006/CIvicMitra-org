import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, increment, query, where, getDoc, limit } from "firebase/firestore";
import { db } from "../firebase";
import { QuizQuestion, QuizAttempt } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2, AlertCircle, Trophy, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";

import { updateStats } from "../lib/badge-utils";

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function QuizModal({ isOpen, onClose, onComplete }: QuizModalProps) {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAndSetupQuiz();
    }
  }, [isOpen]);

  const fetchAndSetupQuiz = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "quiz_questions")).catch(e => handleFirestoreError(e, OperationType.LIST, "quiz_questions"));
      if (snap) {
        const allQuestions = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as QuizQuestion))
          .filter(q => q && q.question && q.options && q.difficulty);
        
        if (allQuestions.length === 0) {
          setQuestions([]);
          return;
        }

        // Try to get a mixed difficulty set (2 easy, 2 medium, 1 hard)
        const easy = allQuestions.filter(q => q.difficulty === 'easy').sort(() => 0.5 - Math.random());
        const medium = allQuestions.filter(q => q.difficulty === 'medium').sort(() => 0.5 - Math.random());
        const hard = allQuestions.filter(q => q.difficulty === 'hard').sort(() => 0.5 - Math.random());

        let selected: QuizQuestion[] = [];
        
        // Pick 2 easy
        selected.push(...easy.slice(0, 2));
        // Pick 2 medium
        selected.push(...medium.slice(0, 2));
        // Pick 1 hard
        selected.push(...hard.slice(0, 1));

        // If we don't have enough (e.g. no hard questions), fill with others
        const remainingNeeded = 5 - selected.length;
        if (remainingNeeded > 0) {
          const alreadySelectedIds = new Set(selected.map(s => s.id));
          const pool = allQuestions.filter(q => !alreadySelectedIds.has(q.id)).sort(() => 0.5 - Math.random());
          selected.push(...pool.slice(0, remainingNeeded));
        }

        // Final shuffle of the 5 selected
        setQuestions(selected.sort(() => 0.5 - Math.random()));
      }
    } catch (error) {
      toast.error("Failed to load quiz questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (index: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentStep] = index;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    // Ensure exactly 5 questions are counted, each 10 points
    let score = 0;
    const numQuestions = 5;
    
    questions.slice(0, numQuestions).forEach((q, i) => {
      if (selectedAnswers[i] === q.correctAnswer) {
        score += 10;
      }
    });

    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Double check if user already attempted today before saving
      const q = query(
        collection(db, "quiz_attempts"),
        where("userId", "==", user.uid),
        where("date", "==", today),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error("You have already completed today's quiz!");
        onClose();
        return;
      }

      const attempt: QuizAttempt = {
        userId: user.uid,
        date: today,
        score,
        answers: selectedAnswers,
        submittedAt: new Date().toISOString()
      };

      // 1. Save attempt
      await addDoc(collection(db, "quiz_attempts"), attempt).catch(e => handleFirestoreError(e, OperationType.CREATE, "quiz_attempts"));
      
      // 2. Update user points
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        points: increment(score),
        totalPoints: increment(score)
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));

      // Update badge stats
      updateStats({
        points: score,
        quizzes_completed: 1,
        perfect_quiz_scores: score === numQuestions * 10 ? 1 : 0
      });

      setResult({ score, total: numQuestions * 10 });
      toast.success(`Quiz completed! You earned ${score} points.`);
      onComplete();
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Failed to save quiz results");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-8 border-b border-primary/10 flex justify-between items-center bg-gradient-to-r from-primary/5 to-transparent">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Daily Eco-Quiz</h2>
            <p className="text-sm text-text-secondary">Test your knowledge & earn points</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="animate-spin text-primary" size={40} />
              <p className="text-text-secondary font-medium">Preparing your quiz...</p>
            </div>
          ) : result ? (
            <div className="text-center py-8 space-y-6">
              <div className="inline-flex p-6 bg-yellow-500/10 rounded-full text-yellow-500">
                <Trophy size={64} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold text-text-primary">Great Job!</h3>
                <p className="text-text-secondary">You've completed today's quiz.</p>
              </div>
              <div className="bg-primary/5 p-6 rounded-3xl inline-block min-w-[200px]">
                <div className="text-sm text-text-secondary uppercase font-bold tracking-wider mb-1">Your Score</div>
                <div className="text-5xl font-black text-primary">{result.score}<span className="text-2xl text-gray-300">/{result.total}</span></div>
              </div>
              <div className="pt-6">
                <button 
                  onClick={onClose}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <AlertCircle className="mx-auto text-red-500" size={48} />
              <p className="text-text-secondary font-medium">No questions available yet.</p>
              <p className="text-sm text-text-secondary">Please check back later or contact an administrator.</p>
              <button 
                onClick={onClose}
                className="mt-4 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Progress */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-primary/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-text-secondary">
                  {currentStep + 1} / {questions.length}
                </span>
              </div>

              {/* Question */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    questions[currentStep].difficulty === 'easy' ? 'bg-green-500/10 text-green-500' :
                    questions[currentStep].difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {questions[currentStep].difficulty}
                  </span>
                  <h3 className="text-xl font-bold text-text-primary leading-tight">
                    {questions[currentStep].question}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {questions[currentStep].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      className={`p-4 text-left rounded-2xl border-2 transition-all font-medium flex items-center justify-between group ${
                        selectedAnswers[currentStep] === index
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-primary/5 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <span>{option}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedAnswers[currentStep] === index
                          ? "border-primary bg-primary text-white"
                          : "border-primary/10 group-hover:border-primary/30"
                      }`}>
                        {selectedAnswers[currentStep] === index && <CheckCircle2 size={14} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4">
                <button
                  disabled={selectedAnswers[currentStep] === undefined || isSubmitting}
                  onClick={handleNext}
                  className="w-full py-4 bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg hover:bg-primary-light transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      {currentStep === questions.length - 1 ? "Finish Quiz" : "Next Question"}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
