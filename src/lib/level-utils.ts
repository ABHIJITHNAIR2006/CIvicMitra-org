export const LEVELS = [
  { level: 1,  min: 0,    max: 49,   emoji: "🌱", title: "Seedling",          color: "green"  },
  { level: 2,  min: 50,   max: 99,   emoji: "🌿", title: "Sprout",            color: "green"  },
  { level: 3,  min: 100,  max: 199,  emoji: "🍃", title: "Sapling",           color: "green"  },
  { level: 4,  min: 200,  max: 349,  emoji: "🌲", title: "Grower",            color: "blue"   },
  { level: 5,  min: 350,  max: 499,  emoji: "🌳", title: "Tree Guardian",     color: "blue"   },
  { level: 6,  min: 500,  max: 699,  emoji: "♻️", title: "Eco Warrior",       color: "blue"   },
  { level: 7,  min: 700,  max: 999,  emoji: "🌊", title: "Earth Defender",    color: "purple" },
  { level: 8,  min: 1000, max: 1499, emoji: "⚡", title: "Green Champion",    color: "purple" },
  { level: 9,  min: 1500, max: 1999, emoji: "🔥", title: "Sustainability Hero",color: "gold"  },
  { level: 10, min: 2000, max: Infinity, emoji: "🏆", title: "Climate Legend",color: "gold"  },
];

export const getCurrentLevel = (points: number) => {
  return LEVELS.find(l => points >= l.min && points <= l.max) || LEVELS[0];
};

export const getProgressToNextLevel = (points: number) => {
  const current = getCurrentLevel(points);
  if (current.level === 10) return 100;
  const next = LEVELS[current.level]; // level is 1-indexed, so LEVELS[current.level] is the next one
  const progress = ((points - current.min) / (next.min - current.min)) * 100;
  return Math.min(Math.max(Math.round(progress), 0), 100);
};

export const getPointsToNextLevel = (points: number) => {
  const current = getCurrentLevel(points);
  if (current.level === 10) return 0;
  const next = LEVELS[current.level];
  return next.min - points;
};

export const getLevelColor = (color: string) => {
  switch (color) {
    case "green": return "bg-green-500";
    case "blue": return "bg-blue-500";
    case "purple": return "bg-purple-500";
    case "gold": return "bg-yellow-500";
    default: return "bg-primary";
  }
};
