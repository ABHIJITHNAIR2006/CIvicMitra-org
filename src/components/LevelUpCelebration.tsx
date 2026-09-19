import { motion, AnimatePresence } from "motion/react";
import { getCurrentLevel } from "../lib/level-utils";
import { X, Trophy, Star } from "lucide-react";

interface LevelUpCelebrationProps {
  level: number;
  onClose: () => void;
}

export default function LevelUpCelebration({ level, onClose }: LevelUpCelebrationProps) {
  const current = LEVELS.find(l => l.level === level) || LEVELS[0];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden">
      {/* Confetti Animation (CSS only) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i}
            className="confetti-dot absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10%`,
              backgroundColor: ['#22c55e', '#3b82f6', '#a855f7', '#eab308'][Math.floor(Math.random() * 4)],
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              borderRadius: '50%',
              animation: `fall ${Math.random() * 3 + 2}s linear infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: 100 }}
        className="relative w-full max-w-md bg-card rounded-[3rem] p-12 text-center card-shadow border-4 border-primary/20"
      >
        <div className="absolute -top-16 left-1/2 -translate-x-1/2">
          <motion.div 
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            className="text-9xl drop-shadow-2xl"
          >
            {current.emoji}
          </motion.div>
        </div>

        <div className="space-y-6 pt-12">
          <div className="space-y-2">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-4xl font-black text-primary uppercase tracking-tighter"
            >
              🎉 LEVEL UP!
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-xl text-text-secondary font-medium"
            >
              You reached Level {current.level}
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="bg-primary/5 p-6 rounded-3xl border border-primary/10"
          >
            <div className="text-4xl mb-2">{current.emoji}</div>
            <h3 className="text-2xl font-bold text-text-primary">{current.title}</h3>
          </motion.div>

          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={onClose}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary-light transition-all shadow-xl shadow-primary/20"
          >
            Keep Going!
          </motion.button>
        </div>
      </motion.div>

      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .confetti-dot {
          z-index: 10;
        }
      `}</style>
    </div>
  );
}

import { LEVELS } from "../lib/level-utils";
