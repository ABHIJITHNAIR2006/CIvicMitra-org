export enum Role {
  USER = "USER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}

export enum Category {
  WATER = "WATER",
  ENERGY = "ENERGY",
  TRANSPORT = "TRANSPORT",
  WASTE = "WASTE",
  FOOD = "FOOD",
  COMMUNITY = "COMMUNITY",
  NATURE = "NATURE",
}

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuizAttempt {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  score: number;
  answers: number[];
  submittedAt: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  city?: string;
  country?: string;
  totalPoints: number;
  points: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  experiencePoints: number;
  role: Role;
  lastActivityDate?: string;
  createdAt: string;
  fcmToken?: string;
}

export interface Challenge {
  challengeId: string;
  title: string;
  description: string;
  shortDescription: string;
  category: Category;
  difficulty: Difficulty;
  points: number;
  bonusPointsStreak: number;
  iconEmoji: string;
  bannerImageUrl: string;
  proofInstructions: string;
  isDaily: boolean;
  isActive: boolean;
}

export interface Completion {
  id: string;
  userId: string;
  challengeId: string;
  proofUrl: string;
  proofType: "IMAGE" | "VIDEO" | "SCREEN_SCAN";
  caption?: string;
  aiVerificationStatus: VerificationStatus;
  aiVerificationScore: number;
  pointsAwarded: number;
  isStreakDay: boolean;
  submittedAt: string;
  verifiedAt?: string;
  likesCount?: number;
  commentsCount?: number;
}

export interface ScreenScan {
  id: string;
  userId: string;
  imageHash: string;
  matchedChallengeId: string | null;
  matchedChallengeTitle: string | null;
  status: "VERIFIED" | "REJECTED" | "DUPLICATE";
  confidence: number;
  pointsAwarded: number;
  reason: string;
  scannedAt: string;
  sourceUrl?: string;
}

export interface Badge {
  id: string;
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeIconUrl: string;
  earnedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}
