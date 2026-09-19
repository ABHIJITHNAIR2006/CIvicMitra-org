import { collection, doc, writeBatch, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Category, Difficulty, Role } from "./types";

const challenges = [
  {
    challengeId: "reusable-bottle-day",
    title: "Reusable Bottle Day",
    description: "Carry and use a reusable water bottle all day to reduce single-use plastic waste.",
    shortDescription: "Carry and use a reusable water bottle all day.",
    category: Category.WATER,
    difficulty: Difficulty.EASY,
    points: 10,
    bonusPointsStreak: 5,
    iconEmoji: "💧",
    bannerImageUrl: "https://picsum.photos/seed/bottle/800/400",
    proofInstructions: "Upload a photo of your reusable bottle in hand or on your desk.",
    isDaily: true,
    isActive: true
  },
  {
    challengeId: "short-shower",
    title: "Short Shower Challenge",
    description: "Take a shower under 5 minutes to conserve water.",
    shortDescription: "Take a shower under 5 minutes.",
    category: Category.WATER,
    difficulty: Difficulty.MEDIUM,
    points: 15,
    bonusPointsStreak: 5,
    iconEmoji: "🚿",
    bannerImageUrl: "https://picsum.photos/seed/shower/800/400",
    proofInstructions: "Upload a photo of a timer showing <5:00 next to running water.",
    isDaily: true,
    isActive: true
  },
  {
    challengeId: "lights-out",
    title: "Lights Out Hour",
    description: "Turn off all non-essential lights for 1 hour to save energy.",
    shortDescription: "Turn off all non-essential lights for 1 hour.",
    category: Category.ENERGY,
    difficulty: Difficulty.EASY,
    points: 10,
    bonusPointsStreak: 5,
    iconEmoji: "💡",
    bannerImageUrl: "https://picsum.photos/seed/lights/800/400",
    proofInstructions: "Upload a photo of your dark room or only essential light.",
    isDaily: true,
    isActive: true
  },
  {
    challengeId: "walk-it",
    title: "Walk It",
    description: "Walk instead of taking a vehicle for any trip under 1 km.",
    shortDescription: "Walk instead of taking a vehicle for short trips.",
    category: Category.TRANSPORT,
    difficulty: Difficulty.EASY,
    points: 15,
    bonusPointsStreak: 5,
    iconEmoji: "🚶",
    bannerImageUrl: "https://picsum.photos/seed/walk/800/400",
    proofInstructions: "Upload a walking selfie or a Google Maps screenshot showing your walk.",
    isDaily: true,
    isActive: true
  },
  {
    challengeId: "no-plastic-bag",
    title: "No Plastic Bag",
    description: "Carry a cloth or reusable bag for all your shopping today.",
    shortDescription: "Carry a cloth/reusable bag for all shopping.",
    category: Category.WASTE,
    difficulty: Difficulty.EASY,
    points: 10,
    bonusPointsStreak: 5,
    iconEmoji: "🛍️",
    bannerImageUrl: "https://picsum.photos/seed/bag/800/400",
    proofInstructions: "Upload a photo of your cloth bag with your purchases.",
    isDaily: true,
    isActive: true
  }
];

const events = [
  {
    eventId: "clean-up-drive-juhu",
    title: "Juhu Beach Clean-up Drive 2026",
    description: "Join us for a massive beach clean-up drive at Juhu Beach. Let's make our coastline plastic-free!",
    eventType: "CLEAN_UP_DRIVE",
    status: "UPCOMING",
    startDate: "2026-03-28T07:00:00Z",
    endDate: "2026-03-28T11:00:00Z",
    location: {
      venueName: "Juhu Beach",
      city: "Mumbai",
      country: "India"
    },
    bonusPoints: 50,
    bannerImageUrl: "https://picsum.photos/seed/cleanup/1200/600"
  }
];

export async function seedChallenges() {
  const batch = writeBatch(db);
  
  // Seed Challenges
  challenges.forEach((challenge) => {
    const ref = doc(collection(db, "challenges"), challenge.challengeId);
    batch.set(ref, challenge);
  });

  // Seed Events
  events.forEach((event) => {
    const ref = doc(collection(db, "events"), event.eventId);
    batch.set(ref, event);
  });

  await batch.commit();

  // Seed Admin User (if not exists)
  // Note: In real app, you'd do this via admin panel or script
  console.log("Seed data populated successfully!");
}

