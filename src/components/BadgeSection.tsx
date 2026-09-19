import React, { useState, useMemo } from "react";
import { BADGES, getUserBadges, getStats, BadgeCategory, Badge } from "../lib/badge-utils";
import BadgeCard from "./BadgeCard";
import { Trophy, Filter, LayoutGrid, Award, Star, Zap, Calendar, Camera, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function BadgeSection() {
  const [activeFilter, setActiveFilter] = useState<"all" | "earned" | "locked">("all");
  const [activeCategory, setActiveCategory] = useState<BadgeCategory | "all">("all");
  
  const stats = getStats();
  const userBadges = getUserBadges();
  const earnedIds = userBadges.earned.map(b => b.id);

  const filteredBadges = useMemo(() => {
    let result = [...BADGES];
    
    if (activeCategory !== "all") {
      result = result.filter(b => b.category === activeCategory);
    }
    
    if (activeFilter === "earned") {
      result = result.filter(b => earnedIds.includes(b.id));
    } else if (activeFilter === "locked") {
      result = result.filter(b => !earnedIds.includes(b.id));
    }
    
    // Sorting: Earned first (newest first), then locked (closest first)
    return result.sort((a, b) => {
      const aEarned = earnedIds.includes(a.id);
      const bEarned = earnedIds.includes(b.id);
      
      if (aEarned && !bEarned) return -1;
      if (!aEarned && bEarned) return 1;
      
      if (aEarned && bEarned) {
        const aEarnedAt = userBadges.earned.find(eb => eb.id === a.id)?.earned_at || "";
        const bEarnedAt = userBadges.earned.find(eb => eb.id === b.id)?.earned_at || "";
        return new Date(bEarnedAt).getTime() - new Date(aEarnedAt).getTime();
      }
      
      // Both locked: sort by progress
      const aProgress = getProgress(a.id);
      const bProgress = getProgress(b.id);
      return bProgress - aProgress;
    });
  }, [activeFilter, activeCategory, earnedIds, userBadges.earned]);

  function getProgress(badgeId: string) {
    const badge = BADGES.find(b => b.id === badgeId);
    if (!badge) return 0;
    
    // Simplified progress for sorting
    switch (badge.requirementType) {
      case "points": return stats.points / badge.requirement;
      case "quizzes": return stats.quizzes_completed / badge.requirement;
      case "perfect_quizzes": return stats.perfect_quiz_scores / badge.requirement;
      case "events": return stats.events_registered / badge.requirement;
      case "proofs": return stats.proofs_submitted / badge.requirement;
      default: return 0;
    }
  }

  const completionPercentage = Math.round((earnedIds.length / BADGES.length) * 100);

  const categories: { id: BadgeCategory | "all"; label: string; icon: any }[] = [
    { id: "all", label: "All", icon: LayoutGrid },
    { id: "citizenship", label: "Citizenship", icon: Award },
    { id: "eco", label: "Eco", icon: Star },
    { id: "quiz", label: "Quiz", icon: Zap },
    { id: "events", label: "Events", icon: Calendar },
    { id: "proof", label: "Proof", icon: Camera },
    { id: "special", label: "Special", icon: Sparkles },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Overall Progress */}
      <div className="bg-card rounded-[40px] p-8 card-shadow border border-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Trophy size={120} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-display text-text-primary flex items-center gap-3">
              <Trophy className="text-primary" size={32} />
              My Badge Collection
            </h2>
            <p className="text-text-secondary text-lg">
              Unlock achievements by completing challenges and participating in events.
            </p>
          </div>
          
          <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 min-w-[240px] space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-text-secondary mb-1">Total Earned</p>
                <p className="text-3xl font-display font-bold text-primary">
                  {earnedIds.length} <span className="text-lg text-text-secondary font-normal">/ {BADGES.length}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-primary">{completionPercentage}%</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Complete</p>
              </div>
            </div>
            
            <div className="h-3 w-full bg-primary/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                className="h-full bg-primary rounded-full transition-all duration-1000"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div className="flex bg-card p-1.5 rounded-2xl card-shadow border border-primary/10 w-fit">
          {["all", "earned", "locked"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f as any)}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all uppercase tracking-widest",
                activeFilter === f ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-text-secondary hover:bg-primary/5 hover:text-primary"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap border",
                activeCategory === cat.id 
                  ? "bg-primary/10 border-primary text-primary" 
                  : "bg-card border-primary/10 text-text-secondary hover:border-primary/30 hover:text-primary"
              )}
            >
              <cat.icon size={16} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              earnedBadge={userBadges.earned.find(eb => eb.id === badge.id)}
              stats={stats}
            />
          ))}
        </AnimatePresence>
      </div>

      {filteredBadges.length === 0 && (
        <div className="text-center py-20 bg-card rounded-[40px] card-shadow border border-primary/10">
          <Trophy className="mx-auto text-gray-200 mb-4" size={64} />
          <h3 className="text-2xl mb-2">No badges found</h3>
          <p className="text-text-secondary">Try changing your filters or categories.</p>
        </div>
      )}
    </div>
  );
}
