import { motion } from "motion/react";
import { Challenge, Difficulty } from "../types";
import { cn } from "../lib/utils";

interface ChallengeCardProps {
  challenge: Challenge;
  onClick: () => void;
  variant?: "grid" | "list";
}

export default function ChallengeCard({ challenge, onClick, variant = "grid" }: ChallengeCardProps) {
  if (variant === "list") {
    return (
      <motion.div 
        whileHover={{ y: -4 }}
        onClick={onClick}
        className="bg-card p-6 rounded-3xl card-shadow flex gap-4 cursor-pointer"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-3xl shrink-0">
          {challenge.iconEmoji}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase tracking-wider">
              {challenge.category}
            </span>
            <span className="text-sm font-bold text-accent">+{challenge.points} pts</span>
          </div>
          <h3 className="text-xl mb-2 font-bold">{challenge.title}</h3>
          <p className="text-sm text-text-secondary line-clamp-2 mb-4">{challenge.shortDescription}</p>
          <button className="w-full py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors">
            Submit Proof
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="bg-card rounded-3xl card-shadow overflow-hidden cursor-pointer flex flex-col"
    >
      <div className="h-40 relative overflow-hidden">
        <img 
          src={challenge.bannerImageUrl} 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary">
          {challenge.category}
        </div>
        <div className="absolute top-4 right-4 bg-accent text-white px-3 py-1 rounded-full text-xs font-bold">
          +{challenge.points} pts
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{challenge.iconEmoji}</span>
          <h3 className="text-xl font-bold">{challenge.title}</h3>
        </div>
        <p className="text-text-secondary text-sm line-clamp-3 mb-6 flex-1">
          {challenge.shortDescription}
        </p>
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-full",
            challenge.difficulty === Difficulty.EASY ? "bg-green-100 text-green-700" :
            challenge.difficulty === Difficulty.MEDIUM ? "bg-orange-100 text-orange-700" :
            "bg-red-100 text-red-700"
          )}>
            {challenge.difficulty}
          </span>
          <button className="text-primary font-bold hover:underline">Submit Proof</button>
        </div>
      </div>
    </motion.div>
  );
}
