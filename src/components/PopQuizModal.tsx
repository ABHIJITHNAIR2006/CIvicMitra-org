import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Zap, Loader2, RotateCcw, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEventData } from '../lib/event-registration-utils';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: string;
}

const INITIAL_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "What does AI stand for?",
    options: ["Automated Intelligence", "Artificial Intelligence", "Advanced Integration", "Analog Input"],
    correctAnswer: "Artificial Intelligence"
  },
  {
    id: 2,
    text: "Which language is most used for AI/ML?",
    options: ["Java", "C++", "Python", "PHP"],
    correctAnswer: "Python"
  },
  {
    id: 3,
    text: "What is a neural network inspired by?",
    options: ["Computer circuits", "The human brain", "Mathematical equations", "Database systems"],
    correctAnswer: "The human brain"
  },
  {
    id: 4,
    text: "What does API stand for?",
    options: ["Applied Program Interface", "Automated Processing Input", "Application Programming Interface", "Advanced Protocol Integration"],
    correctAnswer: "Application Programming Interface"
  },
  {
    id: 5,
    text: "What is machine learning?",
    options: [
      "Teaching machines to walk",
      "Programming with machines",
      "AI learning from data without being explicitly programmed",
      "A type of computer hardware"
    ],
    correctAnswer: "AI learning from data without being explicitly programmed"
  }
];

interface PopQuizModalProps {
  userEmail: string;
  onClose: () => void;
}

export const PopQuizModal: React.FC<PopQuizModalProps> = ({ userEmail, onClose }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [showResults, setShowResults] = useState(false);
  const { addQuizScore } = useEventData();

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const startQuiz = useCallback(() => {
    const shuffledQuestions = shuffleArray(INITIAL_QUESTIONS).map(q => ({
      ...q,
      options: shuffleArray(q.options)
    }));
    setQuestions(shuffledQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setTimeLeft(30);
    setShowResults(false);
  }, []);

  useEffect(() => {
    startQuiz();
  }, [startQuiz]);

  useEffect(() => {
    if (showResults || isAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAnswer(null); // Time out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestionIndex, isAnswered, showResults]);

  const handleAnswer = (answer: string | null) => {
    if (isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    if (answer === questions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 10);
    }

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setTimeLeft(30);
      } else {
        setShowResults(true);
        // Save score
        const finalScore = score + (answer === questions[currentQuestionIndex].correctAnswer ? 10 : 0);
        addQuizScore({
          id: Math.random().toString(36).substr(2, 9),
          userEmail,
          score: finalScore,
          timestamp: new Date().toISOString()
        });
      }
    }, 1200);
  };

  const getStarRating = () => {
    if (score === 50) return { stars: "⭐⭐⭐", text: "Perfect Score!" };
    if (score >= 30) return { stars: "⭐⭐", text: "Great Job!" };
    if (score >= 10) return { stars: "⭐", text: "Keep Practicing!" };
    return { stars: "", text: "Better luck next time!" };
  };

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden relative"
      >
        {!showResults ? (
          <>
            {/* Progress Bar */}
            <div className="h-1.5 bg-gray-100 w-full">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-primary transition-all duration-500"
              />
            </div>

            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Zap className="text-yellow-500 fill-yellow-500" size={24} />
                    Pop Quiz Time!
                  </h3>
                  <p className="text-text-secondary text-sm">Question {currentQuestionIndex + 1} of {questions.length}</p>
                </div>
                
                {/* Timer */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="#f3f4f6"
                      strokeWidth="4"
                    />
                    <motion.circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke={timeLeft < 10 ? "#ef4444" : "#10b981"}
                      strokeWidth="4"
                      strokeDasharray="125.6"
                      animate={{ strokeDashoffset: 125.6 * (1 - timeLeft / 30) }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                  </svg>
                  <span className={cn(
                    "absolute text-sm font-bold",
                    timeLeft < 10 ? "text-red-500" : "text-emerald-500"
                  )}>
                    {timeLeft}
                  </span>
                </div>
              </div>

              <div className="mb-10">
                <h4 className="text-xl font-bold text-text-primary leading-tight">
                  {currentQuestion.text}
                </h4>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => {
                  const isCorrect = option === currentQuestion.correctAnswer;
                  const isSelected = option === selectedAnswer;
                  
                  let buttonClass = "bg-gray-50 border-gray-100 text-text-primary hover:bg-gray-100 hover:border-gray-200";
                  
                  if (isAnswered) {
                    if (isCorrect) {
                      buttonClass = "bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20";
                    } else if (isSelected) {
                      buttonClass = "bg-red-50 border-red-200 text-red-700 ring-2 ring-red-500/20";
                    } else {
                      buttonClass = "bg-gray-50 border-gray-100 text-gray-400 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={option}
                      disabled={isAnswered}
                      onClick={() => handleAnswer(option)}
                      className={cn(
                        "w-full p-4 rounded-2xl border text-left font-medium transition-all duration-200 flex items-center justify-between group",
                        buttonClass
                      )}
                    >
                      <span>{option}</span>
                      {isAnswered && isCorrect && (
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg">
                          Correct!
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="text-primary" size={40} />
            </div>
            <h3 className="text-3xl font-bold text-text-primary mb-2">Quiz Complete!</h3>
            <p className="text-text-secondary mb-8">You've earned points for your knowledge!</p>
            
            <div className="bg-gray-50 rounded-3xl p-8 mb-8">
              <p className="text-sm text-text-secondary font-bold uppercase tracking-widest mb-2">Your Score</p>
              <p className="text-5xl font-display font-bold text-primary mb-4">{score} / 50</p>
              <div className="text-2xl mb-2">{getStarRating().stars}</div>
              <p className="text-lg font-bold text-text-primary">{getStarRating().text}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-text-primary rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                View Dashboard
              </button>
              <button
                onClick={startQuiz}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
              >
                <RotateCcw size={20} />
                Retry Quiz
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
