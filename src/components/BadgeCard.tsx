import React from "react";
import { Badge, EarnedBadge, getRarityStyles, getBadgeProgress, UserStats } from "../lib/badge-utils";
import { Lock, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "motion/react";

interface BadgeCardProps {
  badge: Badge;
  earnedBadge?: EarnedBadge;
  stats: UserStats;
  isNew?: boolean;
}

export default function BadgeCard({ badge, earnedBadge, stats, isNew }: BadgeCardProps) {
  const isEarned = !!earnedBadge;
  const styles = getRarityStyles(badge.rarity);
  const progress = getBadgeProgress(badge.id, stats);
  const isAlmostThere = !isEarned && progress.percentage >= 80;

  return (
    <motion.div
      layout
      initial={isNew ? { scale: 0.8, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "relative group perspective-1000",
        isEarned ? "cursor-default" : "cursor-help"
      )}
    >
      <div className={cn(
        "bg-card rounded-3xl p-6 border-2 transition-all duration-500 transform-style-3d h-full flex flex-col items-center text-center space-y-3 card-shadow",
        isEarned ? cn(styles.border, styles.glow) : "border-dashed border-primary/20 grayscale opacity-60 blur-[0.5px]",
        isNew && "animate-pulse"
      )}>
        {/* Badge Icon */}
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-2 transition-transform duration-500 group-hover:scale-110",
          isEarned ? "bg-primary/5" : "bg-gray-100"
        )}>
          {isEarned ? badge.emoji : <Lock className="text-gray-400" size={32} />}
        </div>

        {/* Badge Info */}
        <div className="space-y-1">
          <h4 className={cn("font-bold text-base", isEarned ? "text-text-primary" : "text-text-secondary")}>
            {badge.name}
          </h4>
          <div className="h-[1px] w-12 bg-primary/10 mx-auto" />
          <p className="text-[10px] text-text-secondary leading-tight min-h-[2.5rem] flex items-center justify-center">
            {badge.description}
          </p>
        </div>

        {/* Status Label */}
        <div className="mt-auto pt-2 w-full">
          {isEarned ? (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-green-500 font-bold text-[10px] uppercase tracking-widest">
                <CheckCircle2 size={12} />
                Earned
              </div>
              <p className="text-[9px] text-text-secondary">
                {new Date(earnedBadge.earned_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1 text-text-secondary font-bold text-[10px] uppercase tracking-widest">
                <Lock size={12} />
                Locked
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-text-secondary">{progress.current} / {progress.target}</span>
                  <span className="text-primary">{progress.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-primary/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percentage}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      isAlmostThere ? "bg-accent" : "bg-primary"
                    )}
                  />
                </div>
                {isAlmostThere && (
                  <p className="text-[9px] font-black text-accent animate-bounce mt-1">
                    🔥 ALMOST THERE!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rarity Tag */}
        <div className={cn(
          "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
          styles.border,
          styles.text,
          "bg-card"
        )}>
          {badge.rarity}
        </div>
      </div>
    </motion.div>
  );
}
