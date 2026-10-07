import { LEVELS, getCurrentLevel } from "./level-utils";
import { auth } from "../firebase";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type BadgeCategory = "citizenship" | "eco" | "quiz" | "events" | "proof" | "special";

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  description: string;
  requirement: number;
  requirementType: "points" | "quizzes" | "perfect_quizzes" | "consecutive_perfect_quizzes" | "events" | "proofs" | "level" | "special";
}

export interface EarnedBadge {
  id: string;
  name: string;
  emoji: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  earned_at: string;
}

export interface UserStats {
  points: number;
  quizzes_completed: number;
  perfect_quiz_scores: number;
  consecutive_perfect_quizzes: number;
  events_registered: number;
  proofs_submitted: number;
  points_earned_today: number;
  today_date: string;
  join_order: number;
}

export interface UserBadges {
  earned: EarnedBadge[];
  seen_animations: string[];
}

export const BADGES: Badge[] = [
  // Citizenship
  { id: "bronze_citizen", name: "Bronze Citizen", emoji: "🟤", category: "citizenship", rarity: "common", description: "Earn 50 points", requirement: 50, requirementType: "points" },
  { id: "good_citizen", name: "Good Citizen", emoji: "🔵", category: "citizenship", rarity: "uncommon", description: "Earn 150 points", requirement: 150, requirementType: "points" },
  { id: "active_citizen", name: "Active Citizen", emoji: "🟢", category: "citizenship", rarity: "rare", description: "Earn 300 points", requirement: 300, requirementType: "points" },
  { id: "responsible_citizen", name: "Responsible Citizen", emoji: "🟡", category: "citizenship", rarity: "rare", description: "Earn 500 points", requirement: 500, requirementType: "points" },
  { id: "dedicated_citizen", name: "Dedicated Citizen", emoji: "🟠", category: "citizenship", rarity: "epic", description: "Earn 750 points", requirement: 750, requirementType: "points" },
  { id: "elite_citizen", name: "Elite Citizen", emoji: "🔴", category: "citizenship", rarity: "epic", description: "Earn 1000 points", requirement: 1000, requirementType: "points" },
  { id: "legend_citizen", name: "Legend Citizen", emoji: "🟣", category: "citizenship", rarity: "legendary", description: "Earn 1500 points", requirement: 1500, requirementType: "points" },
  { id: "supreme_citizen", name: "Supreme Citizen", emoji: "⭐", category: "citizenship", rarity: "legendary", description: "Earn 2000 points", requirement: 2000, requirementType: "points" },

  // Eco
  { id: "eco_starter", name: "Eco Starter", emoji: "🌱", category: "eco", rarity: "common", description: "Earn 100 points", requirement: 100, requirementType: "points" },
  { id: "green_warrior", name: "Green Warrior", emoji: "🌿", category: "eco", rarity: "uncommon", description: "Earn 250 points", requirement: 250, requirementType: "points" },
  { id: "nature_protector", name: "Nature Protector", emoji: "🍃", category: "eco", rarity: "rare", description: "Earn 500 points", requirement: 500, requirementType: "points" },
  { id: "earth_guardian", name: "Earth Guardian", emoji: "🌍", category: "eco", rarity: "epic", description: "Earn 1000 points", requirement: 1000, requirementType: "points" },
  { id: "solar_champion", name: "Solar Champion", emoji: "☀️", category: "eco", rarity: "epic", description: "Earn 1500 points", requirement: 1500, requirementType: "points" },
  { id: "ocean_savior", name: "Ocean Savior", emoji: "🌊", category: "eco", rarity: "legendary", description: "Earn 2000 points", requirement: 2000, requirementType: "points" },

  // Quiz
  { id: "quiz_taker", name: "Quiz Taker", emoji: "🧠", category: "quiz", rarity: "common", description: "Complete 1st quiz", requirement: 1, requirementType: "quizzes" },
  { id: "quick_thinker", name: "Quick Thinker", emoji: "⚡", category: "quiz", rarity: "uncommon", description: "Score 40/50 or above", requirement: 40, requirementType: "special" },
  { id: "sharp_mind", name: "Sharp Mind", emoji: "🎯", category: "quiz", rarity: "rare", description: "Score 50/50 perfect score", requirement: 1, requirementType: "perfect_quizzes" },
  { id: "quiz_streak", name: "Quiz Streak", emoji: "🔥", category: "quiz", rarity: "epic", description: "Complete 3 quizzes total", requirement: 3, requirementType: "quizzes" },
  { id: "knowledge_master", name: "Knowledge Master", emoji: "💡", category: "quiz", rarity: "epic", description: "Complete 5 quizzes total", requirement: 5, requirementType: "quizzes" },
  { id: "quiz_legend", name: "Quiz Legend", emoji: "👑", category: "quiz", rarity: "legendary", description: "Score perfect 3 times", requirement: 3, requirementType: "perfect_quizzes" },

  // Events
  { id: "first_timer", name: "First Timer", emoji: "🎟️", category: "events", rarity: "common", description: "Register for 1st event", requirement: 1, requirementType: "events" },
  { id: "event_explorer", name: "Event Explorer", emoji: "🎪", category: "events", rarity: "uncommon", description: "Register for 3 events", requirement: 3, requirementType: "events" },
  { id: "event_enthusiast", name: "Event Enthusiast", emoji: "🏅", category: "events", rarity: "rare", description: "Register for 5 events", requirement: 5, requirementType: "events" },
  { id: "event_champion", name: "Event Champion", emoji: "🎖️", category: "events", rarity: "epic", description: "Register for 10 events", requirement: 10, requirementType: "events" },

  // Proofs
  { id: "first_proof", name: "First Proof", emoji: "📸", category: "proof", rarity: "common", description: "Submit 1st image proof", requirement: 1, requirementType: "proofs" },
  { id: "consistent_performer", name: "Consistent Performer", emoji: "📋", category: "proof", rarity: "uncommon", description: "Submit 3 proofs", requirement: 3, requirementType: "proofs" },
  { id: "proof_master", name: "Proof Master", emoji: "🏆", category: "proof", rarity: "rare", description: "Submit 5 proofs", requirement: 5, requirementType: "proofs" },
  { id: "diamond_submitter", name: "Diamond Submitter", emoji: "💎", category: "proof", rarity: "epic", description: "Submit 10 proofs", requirement: 10, requirementType: "proofs" },

  // Special
  { id: "early_adopter", name: "Early Adopter", emoji: "🚀", category: "special", rarity: "legendary", description: "One of first 10 users to join", requirement: 10, requirementType: "special" },
  { id: "speed_demon", name: "Speed Demon", emoji: "⚡", category: "special", rarity: "legendary", description: "Earn 100 points in one day", requirement: 100, requirementType: "special" },
  { id: "transformation", name: "Transformation", emoji: "🦋", category: "special", rarity: "legendary", description: "Reach level 5", requirement: 5, requirementType: "level" },
  { id: "visionary", name: "Visionary", emoji: "🔮", category: "special", rarity: "legendary", description: "Reach level 10 max level", requirement: 10, requirementType: "level" },
  { id: "heart_of_gold", name: "Heart of Gold", emoji: "❤️", category: "special", rarity: "legendary", description: "Earn all citizenship badges", requirement: 8, requirementType: "special" },
  { id: "lucky_streak", name: "Lucky Streak", emoji: "🎰", category: "special", rarity: "legendary", description: "Score perfect on quiz twice in a row", requirement: 2, requirementType: "consecutive_perfect_quizzes" },
];

const getStatsStorageKey = (userId?: string | null): string | null => {
  const uid = userId || auth.currentUser?.uid;
  return uid ? `user_stats_${uid}` : null;
};

const getBadgesStorageKey = (userId?: string | null): string | null => {
  const uid = userId || auth.currentUser?.uid;
  return uid ? `user_badges_${uid}` : null;
};

export const clearLegacyBadgeStorage = () => {
  try {
    localStorage.removeItem("user_stats");
    localStorage.removeItem("user_badges");
    localStorage.removeItem("user_level");
  } catch {
    // ignore
  }
};

export const clearUserBadgeData = (userId?: string | null) => {
  clearLegacyBadgeStorage();
  const statsKey = getStatsStorageKey(userId);
  const badgesKey = getBadgesStorageKey(userId);
  if (statsKey) localStorage.removeItem(statsKey);
  if (badgesKey) localStorage.removeItem(badgesKey);
};

export const getStats = (userId?: string | null): UserStats => {
  const defaultStats: UserStats = {
    points: 0,
    quizzes_completed: 0,
    perfect_quiz_scores: 0,
    consecutive_perfect_quizzes: 0,
    events_registered: 0,
    proofs_submitted: 0,
    points_earned_today: 0,
    today_date: new Date().toISOString().split('T')[0],
    join_order: 100, // Default high number
  };
  
  clearLegacyBadgeStorage();

  const key = getStatsStorageKey(userId);
  if (!key) return defaultStats;

  const stored = localStorage.getItem(key);
  if (!stored) return defaultStats;
  
  try {
    const stats = JSON.parse(stored) as UserStats;
    
    // Reset daily points if date changed
    const today = new Date().toISOString().split('T')[0];
    if (stats.today_date !== today) {
      stats.points_earned_today = 0;
      stats.today_date = today;
      localStorage.setItem(key, JSON.stringify(stats));
    }
    
    return stats;
  } catch {
    return defaultStats;
  }
};

export const updateStats = (updates: Partial<UserStats>, userId?: string | null) => {
  const key = getStatsStorageKey(userId);
  const current = getStats(userId);
  const updated = { ...current, ...updates };
  
  // Handle points earned today
  if (updates.points !== undefined) {
    const diff = updates.points - current.points;
    if (diff > 0) {
      updated.points_earned_today = current.points_earned_today + diff;
    }
  }
  
  if (key) {
    localStorage.setItem(key, JSON.stringify(updated));
  }
  return updated;
};

export const getUserBadges = (userId?: string | null): UserBadges => {
  const defaultBadges: UserBadges = {
    earned: [],
    seen_animations: [],
  };
  
  clearLegacyBadgeStorage();

  const key = getBadgesStorageKey(userId);
  if (!key) return defaultBadges;

  const stored = localStorage.getItem(key);
  if (!stored) return defaultBadges;
  
  try {
    return JSON.parse(stored) as UserBadges;
  } catch {
    return defaultBadges;
  }
};

export const awardBadge = (badgeId: string, userId?: string | null) => {
  const key = getBadgesStorageKey(userId);
  if (!key) return false;

  const userBadges = getUserBadges(userId);
  const badge = BADGES.find(b => b.id === badgeId);
  
  if (!badge || userBadges.earned.some(b => b.id === badgeId)) return false;
  
  const newEarned: EarnedBadge = {
    id: badge.id,
    name: badge.name,
    emoji: badge.emoji,
    category: badge.category,
    rarity: badge.rarity,
    earned_at: new Date().toISOString(),
  };
  
  userBadges.earned.push(newEarned);
  localStorage.setItem(key, JSON.stringify(userBadges));
  return true;
};

export const markAnimationSeen = (badgeId: string, userId?: string | null) => {
  const key = getBadgesStorageKey(userId);
  if (!key) return;

  const userBadges = getUserBadges(userId);
  if (!userBadges.seen_animations.includes(badgeId)) {
    userBadges.seen_animations.push(badgeId);
    localStorage.setItem(key, JSON.stringify(userBadges));
  }
};

export const checkAndAwardBadges = (stats: UserStats, userId?: string | null): string[] => {
  // New users with 0 points and 0 activity MUST have all badges locked!
  const hasAnyActivity = stats.points > 0 || stats.quizzes_completed > 0 || stats.events_registered > 0 || stats.proofs_submitted > 0;
  if (!hasAnyActivity) {
    return [];
  }

  const newlyEarned: string[] = [];
  const userBadges = getUserBadges(userId);
  const alreadyEarned = userBadges.earned.map(b => b.id);

  const award = (id: string) => {
    if (!alreadyEarned.includes(id) && !newlyEarned.includes(id)) {
      newlyEarned.push(id);
    }
  };

  // Citizenship
  if (stats.points >= 50) award("bronze_citizen");
  if (stats.points >= 150) award("good_citizen");
  if (stats.points >= 300) award("active_citizen");
  if (stats.points >= 500) award("responsible_citizen");
  if (stats.points >= 750) award("dedicated_citizen");
  if (stats.points >= 1000) award("elite_citizen");
  if (stats.points >= 1500) award("legend_citizen");
  if (stats.points >= 2000) award("supreme_citizen");

  // Eco
  if (stats.points >= 100) award("eco_starter");
  if (stats.points >= 250) award("green_warrior");
  if (stats.points >= 500) award("nature_protector");
  if (stats.points >= 1000) award("earth_guardian");
  if (stats.points >= 1500) award("solar_champion");
  if (stats.points >= 2000) award("ocean_savior");

  // Quiz
  if (stats.quizzes_completed >= 1) award("quiz_taker");
  if (stats.quizzes_completed >= 3) award("quiz_streak");
  if (stats.quizzes_completed >= 5) award("knowledge_master");
  if (stats.perfect_quiz_scores >= 1) award("sharp_mind");
  if (stats.perfect_quiz_scores >= 3) award("quiz_legend");
  if (stats.consecutive_perfect_quizzes >= 2) award("lucky_streak");

  // Events
  if (stats.events_registered >= 1) award("first_timer");
  if (stats.events_registered >= 3) award("event_explorer");
  if (stats.events_registered >= 5) award("event_enthusiast");
  if (stats.events_registered >= 10) award("event_champion");

  // Proofs
  if (stats.proofs_submitted >= 1) award("first_proof");
  if (stats.proofs_submitted >= 3) award("consistent_performer");
  if (stats.proofs_submitted >= 5) award("proof_master");
  if (stats.proofs_submitted >= 10) award("diamond_submitter");

  // Special
  if (stats.join_order <= 10 && hasAnyActivity) award("early_adopter");
  if (stats.points_earned_today >= 100) award("speed_demon");
  
  const currentLevel = getCurrentLevel(stats.points);
  if (currentLevel.level >= 5) award("transformation");
  if (currentLevel.level >= 10) award("visionary");
  
  // Heart of Gold: all citizenship badges
  const citizenshipBadgeIds = ["bronze_citizen", "good_citizen", "active_citizen", "responsible_citizen", "dedicated_citizen", "elite_citizen", "legend_citizen", "supreme_citizen"];
  const earnedCitizenshipCount = alreadyEarned.filter(id => citizenshipBadgeIds.includes(id)).length + newlyEarned.filter(id => citizenshipBadgeIds.includes(id)).length;
  if (earnedCitizenshipCount === citizenshipBadgeIds.length) award("heart_of_gold");

  // Actually award them
  newlyEarned.forEach(id => awardBadge(id, userId));

  return newlyEarned;
};

export const getBadgeProgress = (badgeId: string, stats: UserStats, userId?: string | null): { current: number; target: number; percentage: number } => {
  const badge = BADGES.find(b => b.id === badgeId);
  if (!badge) return { current: 0, target: 0, percentage: 0 };

  let current = 0;
  let target = badge.requirement;

  switch (badge.requirementType) {
    case "points":
      current = stats.points;
      break;
    case "quizzes":
      current = stats.quizzes_completed;
      break;
    case "perfect_quizzes":
      current = stats.perfect_quiz_scores;
      break;
    case "consecutive_perfect_quizzes":
      current = stats.consecutive_perfect_quizzes;
      break;
    case "events":
      current = stats.events_registered;
      break;
    case "proofs":
      current = stats.proofs_submitted;
      break;
    case "level":
      current = getCurrentLevel(stats.points).level;
      break;
    case "special":
      if (badge.id === "early_adopter") {
        current = stats.join_order <= 10 && (stats.points > 0 || stats.quizzes_completed > 0) ? 10 : 0;
        target = 10;
      } else if (badge.id === "speed_demon") {
        current = stats.points_earned_today;
      } else if (badge.id === "heart_of_gold") {
        const citizenshipBadgeIds = ["bronze_citizen", "good_citizen", "active_citizen", "responsible_citizen", "dedicated_citizen", "elite_citizen", "legend_citizen", "supreme_citizen"];
        const earned = getUserBadges(userId).earned.map(b => b.id);
        current = earned.filter(id => citizenshipBadgeIds.includes(id)).length;
        target = citizenshipBadgeIds.length;
      } else if (badge.id === "quick_thinker") {
        current = 0;
        target = 40;
      }
      break;
  }

  const percentage = Math.min(Math.round((current / target) * 100), 100);
  return { current, target, percentage };
};

export const getRarityStyles = (rarity: BadgeRarity) => {
  switch (rarity) {
    case "common":
      return { border: "border-gray-400", glow: "", text: "text-gray-500" };
    case "uncommon":
      return { border: "border-green-400", glow: "shadow-[0_0_10px_rgba(74,222,128,0.3)]", text: "text-green-500" };
    case "rare":
      return { border: "border-blue-400", glow: "shadow-[0_0_15px_rgba(96,165,250,0.4)]", text: "text-blue-500" };
    case "epic":
      return { border: "border-purple-400", glow: "shadow-[0_0_20px_rgba(192,132,252,0.5)]", text: "text-purple-500" };
    case "legendary":
      return { border: "border-yellow-400 animate-pulse-glow", glow: "shadow-[0_0_25px_rgba(250,204,21,0.6)]", text: "text-yellow-500" };
  }
};

export const syncBadgesWithFirestorePoints = (firestorePoints: number, userId?: string | null) => {
  if (typeof firestorePoints !== "number" || isNaN(firestorePoints)) return;
  const current = getStats(userId);
  if (firestorePoints > current.points) {
    const updated = updateStats({ points: firestorePoints }, userId);
    checkAndAwardBadges(updated, userId);
  }
};

