import React, { useEffect, useState } from "react";
import { Badge, getRarityStyles, markAnimationSeen } from "../lib/badge-utils";
import { motion, AnimatePresence } from "motion/react";
import { Star, Sparkles, Trophy } from "lucide-react";
import { cn } from "../lib/utils";

interface BadgeUnlockOverlayProps {
  badge: Badge | null;
  onClose: () => void;
}

export default function BadgeUnlockOverlay({ badge, onClose }: BadgeUnlockOverlayProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (badge) {
      setShow(true);
      // Mark as seen when the animation starts
      markAnimationSeen(badge.id);
    } else {
      setShow(false);
    }
  }, [badge]);

  if (!badge) return null;

  const styles = getRarityStyles(badge.rarity);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Content Container */}
          <div className="relative z-10 max-w-md w-full text-center">
            {/* Star Burst Animation */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute w-full h-full animate-star-burst">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-1 h-24 bg-yellow-400/50 rounded-full"
                    style={{ transform: `translate(-50%, -50%) rotate(${i * 30}deg)` }}
                  />
                ))}
              </div>
            </div>

            {/* Glowing Ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn(
                "w-72 h-72 rounded-full border-4 border-dashed animate-ring-spin opacity-30",
                styles.border
              )} />
            </div>

            {/* Badge Card */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 10 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              className={cn(
                "bg-card rounded-[40px] p-10 border-4 shadow-2xl relative overflow-hidden",
                styles.border,
                styles.glow
              )}
            >
              {/* Floating Sparkles */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: [0, 1, 0], y: -100, x: (Math.random() - 0.5) * 200 }}
                    transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                    className="absolute bottom-0 left-1/2 text-yellow-400"
                  >
                    <Sparkles size={12 + Math.random() * 12} />
                  </motion.div>
                ))}
              </div>

              <div className="relative z-10 space-y-6">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-primary font-black uppercase tracking-[0.3em] text-xs mb-2">
                    New Badge Unlocked!
                  </p>
                  <h2 className="text-4xl font-display text-text-primary">Congratulations!</h2>
                </motion.div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="w-40 h-40 bg-primary/5 rounded-full flex items-center justify-center text-8xl mx-auto shadow-inner"
                >
                  {badge.emoji}
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-2"
                >
                  <h3 className="text-3xl font-display text-text-primary">{badge.name}</h3>
                  <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm bg-card",
                    styles.border,
                    styles.text
                  )}>
                    <Star size={14} fill="currentColor" />
                    {badge.rarity} Badge
                  </div>
                  <p className="text-text-secondary mt-4 text-lg italic">
                    "{badge.description}"
                  </p>
                </motion.div>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-primary/20 hover:bg-primary-light transition-all mt-8 flex items-center justify-center gap-2"
                >
                  Awesome! <Trophy size={20} />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
