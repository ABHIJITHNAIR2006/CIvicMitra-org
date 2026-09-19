import { getCurrentLevel, getProgressToNextLevel, getPointsToNextLevel, getLevelColor } from "../lib/level-utils";
import { cn } from "../lib/utils";
import { motion } from "motion/react";

interface LevelBadgeProps {
  points: number;
  className?: string;
  showProgress?: boolean;
}

export default function LevelBadge({ points, className, showProgress = true }: LevelBadgeProps) {
  const current = getCurrentLevel(points);
  const progress = getProgressToNextLevel(points);
  const pointsToNext = getPointsToNextLevel(points);
  const isMax = current.level === 10;

  return (
    <div className={cn(
      "bg-card p-6 rounded-3xl card-shadow border border-primary/10 relative overflow-hidden",
      isMax && "animate-pulse-gold",
      className
    )}>
      <div className="flex items-center gap-4 mb-3">
        <div className="text-4xl">{current.emoji}</div>
        <div>
          <h3 className="text-xl font-bold text-text-primary">Level {current.level}</h3>
          <p className="text-sm text-text-secondary font-medium">{current.title}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-end text-xs font-bold uppercase tracking-wider">
          <span className="text-text-secondary">{points} / {isMax ? "∞" : LEVELS[current.level].min} pts</span>
          <span className="text-primary">{progress}%</span>
        </div>
        
        <div className="h-3 bg-primary/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-full", getLevelColor(current.color))}
          />
        </div>

        <p className="text-xs text-text-secondary font-bold text-center">
          {isMax ? "MAX LEVEL 🏆" : `${pointsToNext} pts to next level`}
        </p>
      </div>

      {isMax && (
        <div className="absolute inset-0 pointer-events-none bg-yellow-500/5 animate-pulse" />
      )}
    </div>
  );
}

// Add this to your global CSS or keep it here if using Tailwind's arbitrary values
// .animate-pulse-gold { animation: pulse-gold 2s infinite; }
// @keyframes pulse-gold { 0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(234, 179, 8, 0); } 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); } }
import { LEVELS } from "../lib/level-utils";
