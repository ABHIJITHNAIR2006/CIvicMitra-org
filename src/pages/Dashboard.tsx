import { useEffect, useState, useMemo, memo } from "react";
import { collection, query, getDocs, limit, orderBy, where, doc, getDoc, setDoc, writeBatch, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Category, Difficulty, Challenge, UserProfile, Completion, VerificationStatus, Role } from "../types";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Zap, Target, ArrowRight, Leaf, Users, Calendar, Database, CheckCircle2, Clock, Star, Award } from "lucide-react";
import { Link } from "react-router-dom";
import ChallengeCard from "../components/ChallengeCard";
import ChallengeModal from "../components/ChallengeModal";
import DailyQuizCard from "../components/DailyQuizCard";
import QuizModal from "../components/QuizModal";
import LevelBadge from "../components/LevelBadge";
import LevelUpCelebration from "../components/LevelUpCelebration";
import BadgeSection from "../components/BadgeSection";
import BadgeUnlockOverlay from "../components/BadgeUnlockOverlay";
import { useBadges } from "../hooks/useBadges";
import { cn } from "../lib/utils";
import { useEventData } from "../lib/event-registration-utils";
import { getCurrentLevel, LEVELS } from "../lib/level-utils";
import { calculateCO2, calculateElectricity, calculateWater, calculateWaste, formatCO2, formatElectricity, formatWater, formatWaste } from "../lib/impact-utils";
import ImpactCard from "../components/ImpactCard";
import { checkIsAdmin } from "../lib/auth-utils";
import { syncBadgesWithFirestorePoints } from "../lib/badge-utils";

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dailyChallenges, setDailyChallenges] = useState<Challenge[]>([]);
  const [recentActivity, setRecentActivity] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [displayCO2, setDisplayCO2] = useState(0);
  const [displayElectricity, setDisplayElectricity] = useState(0);
  const [displayWater, setDisplayWater] = useState(0);
  const [displayWaste, setDisplayWaste] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState<number | null>(null);
  const { registrations, submissions } = useEventData();
  const { newlyEarnedBadge, closeUnlockOverlay, refresh: refreshBadges } = useBadges();

  const userSubmissions = submissions.filter(s => s.userEmail === auth.currentUser?.email);
  const totalSubmissionPoints = userSubmissions.reduce((sum, s) => sum + s.points, 0);
  const totalPoints = (profile?.points || 0) + totalSubmissionPoints;

  const currentLevel = useMemo(() => getCurrentLevel(totalPoints), [totalPoints]);

  useEffect(() => {
    if (loading) return;
    refreshBadges();
  }, [totalPoints, loading, refreshBadges]);

  useEffect(() => {
    if (loading) return;

    const storedLevel = localStorage.getItem("user_level");
    const sessionShown = sessionStorage.getItem("level_shown_this_session");

    // 1. Initial Login/Session Popup (Show current level once per session)
    if (!sessionShown) {
      setNewLevel(currentLevel.level);
      setShowLevelUp(true);
      sessionStorage.setItem("level_shown_this_session", "true");
      // Sync localStorage if it's the first time ever
      if (!storedLevel) {
        localStorage.setItem("user_level", currentLevel.level.toString());
      }
      return;
    }

    // 2. Level Increase Popup
    if (storedLevel) {
      const lastLevel = parseInt(storedLevel);
      if (currentLevel.level > lastLevel) {
        setNewLevel(currentLevel.level);
        setShowLevelUp(true);
        localStorage.setItem("user_level", currentLevel.level.toString());
        toast.success(`⬆️ Level Up! You are now a ${currentLevel.title}!`, {
          icon: '🎉',
          duration: 5000
        });
      } else if (currentLevel.level < lastLevel) {
        // Sync if points decreased (rare but possible if data resets)
        localStorage.setItem("user_level", currentLevel.level.toString());
      }
    }
  }, [currentLevel.level, loading]);

  const animateValue = (
    from: number,
    to: number,
    setter: (v: number) => void,
    duration = 1500
  ) => {
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = progress * (2 - progress);
      setter(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(step);
      else setter(to);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    animateValue(displayCO2, calculateCO2(totalPoints), setDisplayCO2);
    animateValue(displayElectricity, calculateElectricity(totalPoints), setDisplayElectricity);
    animateValue(displayWater, calculateWater(totalPoints), setDisplayWater);
    animateValue(displayWaste, calculateWaste(totalPoints), setDisplayWaste);
  }, [totalPoints]);

  const welcomeMessage = useMemo(() => {
    const name = profile?.fullName?.split(' ')[0] || profile?.username || 'Eco-Warrior';
    const level = getCurrentLevel(totalPoints);
    
    return (
      <>
        <h1 className="text-4xl mb-2">Welcome back, {name}!</h1>
        <p className={cn(
          "text-lg transition-colors duration-300 flex items-center gap-2",
          isUpdating ? "text-green-500 font-bold" : "text-text-secondary"
        )}>
          <span className="font-bold">{level.emoji} {level.title}</span>
          <span className="opacity-30">|</span>
          <span>{formatCO2(displayCO2)} CO₂ saved</span>
        </p>
      </>
    );
  }, [profile, displayCO2, totalPoints, isUpdating]);

  const [communityCO2, setCommunityCO2] = useState<number>(0);
  const [communityElectricity, setCommunityElectricity] = useState(0);
  const [communityWater, setCommunityWater] = useState(0);
  const [communityWaste, setCommunityWaste] = useState(0);

  const fetchData = async () => {
    if (!auth.currentUser) return;

    try {
      // Parallel fetching for other data
      const [challengesSnap, activitySnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "challenges"), where("isDaily", "==", true), limit(3))).catch(e => {
          console.error("Challenges fetch failed:", e);
          return null;
        }),
        getDocs(query(
          collection(db, "completions"), 
          where("userId", "==", auth.currentUser.uid),
          limit(20)
        )).catch(e => {
          console.error("Activity fetch failed:", e);
          return null;
        }),
        getDocs(collection(db, "users")).catch(e => {
          console.error("Users fetch failed:", e);
          return null;
        })
      ]);

      if (challengesSnap) {
        setDailyChallenges(challengesSnap.docs.map(d => ({ challengeId: d.data().challengeId || d.id, ...d.data() } as Challenge)));
      }

      if (activitySnap) {
        const sortedComps = activitySnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Completion))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
          .slice(0, 5);
        setRecentActivity(sortedComps);
      }

      if (usersSnap) {
        const communityPoints = usersSnap.docs.reduce((sum, doc) => sum + (doc.data().points || 0), 0);
        setCommunityCO2(calculateCO2(communityPoints));
        setCommunityElectricity(calculateElectricity(communityPoints));
        setCommunityWater(calculateWater(communityPoints));
        setCommunityWaste(calculateWaste(communityPoints));
      }

      // Check for daily quiz attempt
      const today = new Date().toISOString().split('T')[0];
      const quizQuery = query(
        collection(db, "quiz_attempts"),
        where("userId", "==", auth.currentUser.uid),
        where("date", "==", today),
        limit(1)
      );
      const quizSnap = await getDocs(quizQuery).catch(e => {
        console.error("Quiz check failed:", e);
        return null;
      });

      if (quizSnap && quizSnap.empty) {
        setIsQuizOpen(true);
      }
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error?.message || "Unknown error");
      toast.error("Some data failed to load. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const challengesData: Challenge[] = [
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
        },
        // WATER
        { challengeId: "fix-a-drip", title: "Fix a Drip", description: "Find and report or fix a leaking tap in your home or locality to prevent water wastage.", shortDescription: "Find and fix a leaking tap in your home or area.", category: Category.WATER, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🔧", bannerImageUrl: "https://picsum.photos/seed/drip/800/400", proofInstructions: "Upload a photo of the leaking tap before and after fixing, or screenshot of report submitted.", isDaily: false, isActive: true },
        { challengeId: "bucket-bath", title: "Bucket Bath Challenge", description: "Use a bucket instead of a shower to significantly cut down water consumption today.", shortDescription: "Use a bucket instead of a shower to save water.", category: Category.WATER, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🪣", bannerImageUrl: "https://picsum.photos/seed/bucket/800/400", proofInstructions: "Upload a photo of your bucket setup in the bathroom.", isDaily: true, isActive: true },
        { challengeId: "rainwater-collector", title: "Rainwater Collector", description: "Set up any container to collect rainwater that can be reused for plants or cleaning purposes.", shortDescription: "Set up a container to collect rainwater for reuse.", category: Category.WATER, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "🌧️", bannerImageUrl: "https://picsum.photos/seed/rain/800/400", proofInstructions: "Upload a photo of your rainwater collection setup.", isDaily: false, isActive: true },
        { challengeId: "no-running-tap", title: "No Running Tap", description: "Turn off the tap while brushing teeth and washing hands throughout the entire day.", shortDescription: "Turn off tap while brushing and washing hands all day.", category: Category.WATER, difficulty: Difficulty.EASY, points: 10, bonusPointsStreak: 5, iconEmoji: "🚰", bannerImageUrl: "https://picsum.photos/seed/tap/800/400", proofInstructions: "Upload a selfie at the sink with the tap off while brushing.", isDaily: true, isActive: true },
        { challengeId: "grey-water-reuse", title: "Grey Water Reuse", description: "Reuse water from washing vegetables or rice to water your plants instead of discarding it.", shortDescription: "Reuse vegetable/rice wash water to water plants.", category: Category.WATER, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "♻️", bannerImageUrl: "https://picsum.photos/seed/greywater/800/400", proofInstructions: "Upload a photo of you pouring reused water into a plant pot.", isDaily: true, isActive: true },
        { challengeId: "car-wash-bucket", title: "Car Wash with Bucket", description: "Wash your vehicle using only a bucket of water instead of a running hosepipe.", shortDescription: "Wash your vehicle with a bucket, not a running hose.", category: Category.WATER, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🚗", bannerImageUrl: "https://picsum.photos/seed/carwash/800/400", proofInstructions: "Upload a photo of your vehicle being washed with a bucket.", isDaily: false, isActive: true },
        { challengeId: "water-audit", title: "Water Audit", description: "Check all taps, pipes, and toilets in your home for leaks and log your findings in writing.", shortDescription: "Audit all taps and pipes at home for leaks.", category: Category.WATER, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "📋", bannerImageUrl: "https://picsum.photos/seed/audit/800/400", proofInstructions: "Upload a photo of your written audit checklist with each item marked.", isDaily: false, isActive: true },
        { challengeId: "full-load-only", title: "Full Load Only", description: "Run the washing machine only when it is completely full to maximise water and energy efficiency.", shortDescription: "Only run the washing machine on a full load.", category: Category.WATER, difficulty: Difficulty.EASY, points: 10, bonusPointsStreak: 5, iconEmoji: "🫧", bannerImageUrl: "https://picsum.photos/seed/laundry/800/400", proofInstructions: "Upload a photo of your fully loaded washing machine drum.", isDaily: true, isActive: true },
        // ENERGY
        { challengeId: "unplug-standby", title: "Unplug Standby Devices", description: "Unplug all devices not actively in use such as TVs, chargers, and microwaves for the entire day.", shortDescription: "Unplug all standby devices for the day.", category: Category.ENERGY, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🔌", bannerImageUrl: "https://picsum.photos/seed/unplug/800/400", proofInstructions: "Upload a photo of your power strips switched off or plugs removed from sockets.", isDaily: true, isActive: true },
        { challengeId: "cold-water-wash", title: "Cold Water Wash", description: "Wash your clothes using a cold water cycle instead of a hot or warm cycle to save energy.", shortDescription: "Wash clothes on cold cycle instead of hot.", category: Category.ENERGY, difficulty: Difficulty.EASY, points: 10, bonusPointsStreak: 5, iconEmoji: "🧊", bannerImageUrl: "https://picsum.photos/seed/coldwash/800/400", proofInstructions: "Upload a photo of your washing machine set to cold/30°C cycle.", isDaily: true, isActive: true },
        { challengeId: "solar-charging", title: "Solar Charging", description: "Charge at least one of your devices using a solar charger or solar-powered powerbank today.", shortDescription: "Charge a device using solar power today.", category: Category.ENERGY, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "☀️", bannerImageUrl: "https://picsum.photos/seed/solar/800/400", proofInstructions: "Upload a photo of your device charging via solar panel or solar powerbank.", isDaily: false, isActive: true },
        { challengeId: "fan-over-ac", title: "Fan Over AC", description: "Use a ceiling or table fan instead of air conditioning for at least 4 continuous hours today.", shortDescription: "Use a fan instead of AC for at least 4 hours.", category: Category.ENERGY, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🌬️", bannerImageUrl: "https://picsum.photos/seed/fan/800/400", proofInstructions: "Upload a photo of your fan running with the AC unit visibly off.", isDaily: true, isActive: true },
        { challengeId: "natural-light-day", title: "Natural Light Day", description: "Rely entirely on natural daylight and switch on no artificial lights until after sunset.", shortDescription: "Use only natural light — no artificial lights until sunset.", category: Category.ENERGY, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🌤️", bannerImageUrl: "https://picsum.photos/seed/naturallight/800/400", proofInstructions: "Upload a photo of your well-lit room using only sunlight through windows.", isDaily: true, isActive: true },
        { challengeId: "energy-meter-check", title: "Energy Meter Check", description: "Read your home electricity meter in the morning and evening and calculate today's exact usage.", shortDescription: "Log your home electricity consumption today.", category: Category.ENERGY, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🔋", bannerImageUrl: "https://picsum.photos/seed/meter/800/400", proofInstructions: "Upload a photo of your electricity meter reading clearly showing the units.", isDaily: false, isActive: true },
        { challengeId: "switch-to-led", title: "Switch to LED", description: "Replace at least one incandescent or CFL bulb in your home with an energy-saving LED bulb.", shortDescription: "Replace one old bulb with an LED bulb at home.", category: Category.ENERGY, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "💡", bannerImageUrl: "https://picsum.photos/seed/led/800/400", proofInstructions: "Upload a before photo of the old bulb and after photo with the new LED installed.", isDaily: false, isActive: true },
        { challengeId: "screen-brightness-down", title: "Screen Brightness Down", description: "Lower the brightness on all your screens — phone, laptop, TV — to 50% or below for the entire day.", shortDescription: "Keep all screens at 50% brightness all day.", category: Category.ENERGY, difficulty: Difficulty.EASY, points: 10, bonusPointsStreak: 5, iconEmoji: "📱", bannerImageUrl: "https://picsum.photos/seed/screen/800/400", proofInstructions: "Upload a screenshot of your phone and laptop brightness settings at 50% or below.", isDaily: true, isActive: true },
        // TRANSPORT
        { challengeId: "cycle-to-work", title: "Cycle to Work or College", description: "Ride a bicycle for your entire commute today instead of using any motorized vehicle.", shortDescription: "Cycle to work or college instead of driving.", category: Category.TRANSPORT, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "🚲", bannerImageUrl: "https://picsum.photos/seed/cycle/800/400", proofInstructions: "Upload a selfie with your bicycle at your workplace or college entrance.", isDaily: true, isActive: true },
        { challengeId: "carpool-day", title: "Carpool Day", description: "Share your ride with at least one other person for any trip today to halve the emissions.", shortDescription: "Share a ride with at least one other person today.", category: Category.TRANSPORT, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🚘", bannerImageUrl: "https://picsum.photos/seed/carpool/800/400", proofInstructions: "Upload a photo of yourself and your co-passenger in the vehicle.", isDaily: true, isActive: true },
        { challengeId: "public-transport-only", title: "Public Transport Only", description: "Use only buses, metro, or trains for all travel today — absolutely no private vehicles.", shortDescription: "Use only public transport for all travel today.", category: Category.TRANSPORT, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "🚇", bannerImageUrl: "https://picsum.photos/seed/metro/800/400", proofInstructions: "Upload a photo of your bus ticket, metro card, or train platform.", isDaily: true, isActive: true },
        { challengeId: "work-from-home", title: "Work From Home", description: "Skip the commute entirely and work or study from home today to eliminate transport emissions.", shortDescription: "Work or study from home to skip the commute.", category: Category.TRANSPORT, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🏠", bannerImageUrl: "https://picsum.photos/seed/wfh/800/400", proofInstructions: "Upload a photo of your home workspace setup today.", isDaily: true, isActive: true },
        { challengeId: "no-vehicle-day", title: "No Vehicle Day", description: "Go the entire day without using any motorized vehicle — walk, cycle, or stay local.", shortDescription: "Go the whole day without using any motor vehicle.", category: Category.TRANSPORT, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "🚷", bannerImageUrl: "https://picsum.photos/seed/novehicle/800/400", proofInstructions: "Upload a photo of yourself walking or at home — no vehicle keys in sight!", isDaily: true, isActive: true },
        { challengeId: "idle-engine-off", title: "Idle Engine Off", description: "Switch off your vehicle engine at every red light or whenever waiting for more than 30 seconds.", shortDescription: "Turn off your engine at every red light today.", category: Category.TRANSPORT, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🛑", bannerImageUrl: "https://picsum.photos/seed/idleoff/800/400", proofInstructions: "Upload a photo of your ignition in the off position at a stop.", isDaily: true, isActive: true },
        { challengeId: "ev-awareness", title: "EV Awareness", description: "Visit or research an EV charging station in your city and document what you learned.", shortDescription: "Research or visit an EV charging station near you.", category: Category.TRANSPORT, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🔋", bannerImageUrl: "https://picsum.photos/seed/ev/800/400", proofInstructions: "Upload a photo at an EV charging station or screenshot of your research notes.", isDaily: false, isActive: true },
        { challengeId: "trip-combine", title: "Trip Combine", description: "Plan and combine all your errands into a single trip today to minimize total distance travelled.", shortDescription: "Combine all errands into one trip to cut travel.", category: Category.TRANSPORT, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🗺️", bannerImageUrl: "https://picsum.photos/seed/tripcombine/800/400", proofInstructions: "Upload a photo of your errand checklist or Google Maps route combining all stops.", isDaily: true, isActive: true },
        // WASTE
        { challengeId: "dry-wet-segregation", title: "Dry & Wet Segregation", description: "Separate all household waste into dry recyclables and wet organic waste for the entire day.", shortDescription: "Separate household waste into dry and wet today.", category: Category.WASTE, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🗂️", bannerImageUrl: "https://picsum.photos/seed/segregate/800/400", proofInstructions: "Upload a photo of your two clearly separated waste bins — dry and wet.", isDaily: true, isActive: true },
        { challengeId: "zero-plastic-day", title: "Zero Plastic Day", description: "Go the entire day without buying, using, or accepting any single-use plastic item whatsoever.", shortDescription: "Avoid all single-use plastic for the entire day.", category: Category.WASTE, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "🚫", bannerImageUrl: "https://picsum.photos/seed/noplastic/800/400", proofInstructions: "Upload a photo of your reusable alternatives — bag, bottle, container — used today.", isDaily: true, isActive: true },
        { challengeId: "compost-setup", title: "Compost Setup", description: "Start a composting bin or pit at home using kitchen food scraps and organic waste.", shortDescription: "Start a compost bin using kitchen food scraps.", category: Category.WASTE, difficulty: Difficulty.HARD, points: 35, bonusPointsStreak: 10, iconEmoji: "🌱", bannerImageUrl: "https://picsum.photos/seed/compost/800/400", proofInstructions: "Upload a photo of your compost bin or pit with the first layer of scraps added.", isDaily: false, isActive: true },
        { challengeId: "ewaste-dropoff", title: "E-Waste Drop-off", description: "Collect and drop off any old electronics, dead batteries, or unused cables at an official e-waste collection point.", shortDescription: "Drop off old electronics or batteries at an e-waste bin.", category: Category.WASTE, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "💻", bannerImageUrl: "https://picsum.photos/seed/ewaste/800/400", proofInstructions: "Upload a photo of your e-waste items at the drop-off point.", isDaily: false, isActive: true },
        { challengeId: "repair-dont-replace", title: "Repair Don't Replace", description: "Fix a broken item — clothing, electronics, or furniture — rather than throwing it away and buying new.", shortDescription: "Repair something broken instead of replacing it.", category: Category.WASTE, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "🔨", bannerImageUrl: "https://picsum.photos/seed/repair/800/400", proofInstructions: "Upload a before and after photo of the item you repaired.", isDaily: false, isActive: true },
        { challengeId: "donate-old-clothes", title: "Donate Old Clothes", description: "Collect at least 3 clothing items you no longer use and donate them to a local charity or collection drive.", shortDescription: "Collect and donate at least 3 old clothing items.", category: Category.WASTE, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "👕", bannerImageUrl: "https://picsum.photos/seed/donate/800/400", proofInstructions: "Upload a photo of the clothes you are donating packed and ready.", isDaily: false, isActive: true },
        { challengeId: "paper-free-day", title: "Paper-Free Day", description: "Get through the entire day without printing a single page or using paper unnecessarily.", shortDescription: "Go completely paper-free for the whole day.", category: Category.WASTE, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "📵", bannerImageUrl: "https://picsum.photos/seed/paperfree/800/400", proofInstructions: "Upload a screenshot of your digital notes or documents used instead of paper.", isDaily: true, isActive: true },
        { challengeId: "neighbourhood-cleanup", title: "Neighbourhood Cleanup", description: "Spend at least 30 minutes picking up litter from your street, park, or local community area.", shortDescription: "Spend 30 mins picking up litter in your area.", category: Category.WASTE, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "🧹", bannerImageUrl: "https://picsum.photos/seed/cleanup/800/400", proofInstructions: "Upload a photo of the litter you collected in bags ready for disposal.", isDaily: false, isActive: true },
        // FOOD
        { challengeId: "meatless-monday", title: "Meatless Monday", description: "Eat a completely vegetarian or vegan diet for the entire day — no meat, poultry, or seafood.", shortDescription: "Eat completely vegetarian or vegan for the day.", category: Category.FOOD, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🥗", bannerImageUrl: "https://picsum.photos/seed/meatless/800/400", proofInstructions: "Upload a photo of all your vegetarian meals from today.", isDaily: true, isActive: true },
        { challengeId: "cook-at-home", title: "Cook at Home", description: "Prepare all your meals at home today — avoid all takeaway, food delivery, and restaurant meals.", shortDescription: "Cook all your meals at home — no takeaway today.", category: Category.FOOD, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "👨‍🍳", bannerImageUrl: "https://picsum.photos/seed/cooking/800/400", proofInstructions: "Upload a photo of your home-cooked meal(s) from today.", isDaily: true, isActive: true },
        { challengeId: "local-market-shop", title: "Local Market Shop", description: "Buy your fruits or vegetables from a local farmer's market or sabzi mandi instead of a supermarket.", shortDescription: "Buy produce from a local market instead of a supermarket.", category: Category.FOOD, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🧺", bannerImageUrl: "https://picsum.photos/seed/market/800/400", proofInstructions: "Upload a photo of your fresh produce bought at the local market.", isDaily: false, isActive: true },
        { challengeId: "zero-food-waste", title: "Zero Food Waste Day", description: "Finish all leftovers and ensure absolutely no cooked or fresh food is wasted or thrown away today.", shortDescription: "Waste absolutely no food today — finish all leftovers.", category: Category.FOOD, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🍽️", bannerImageUrl: "https://picsum.photos/seed/foodwaste/800/400", proofInstructions: "Upload a photo of your clean, empty plate(s) from every meal today.", isDaily: true, isActive: true },
        { challengeId: "grow-something", title: "Grow Something", description: "Plant any herb, vegetable, or fruit seed in a pot, tray, or garden patch and document Day 1.", shortDescription: "Plant any herb, veggie, or fruit seed today.", category: Category.FOOD, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "🌿", bannerImageUrl: "https://picsum.photos/seed/grow/800/400", proofInstructions: "Upload a photo of your seed or seedling in the soil with your name tag visible.", isDaily: false, isActive: true },
        { challengeId: "no-packaged-snacks", title: "No Packaged Snacks", description: "Avoid all packaged and processed snack foods today — eat only whole, natural foods for snacking.", shortDescription: "Avoid all packaged snacks — eat whole foods only.", category: Category.FOOD, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🍎", bannerImageUrl: "https://picsum.photos/seed/wholefood/800/400", proofInstructions: "Upload a photo of your healthy whole-food snacks for the day.", isDaily: true, isActive: true },
        { challengeId: "seasonal-eating", title: "Seasonal Eating", description: "Eat only fruits and vegetables that are currently in season in your region — no out-of-season produce.", shortDescription: "Eat only fruits and vegetables in season today.", category: Category.FOOD, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🍅", bannerImageUrl: "https://picsum.photos/seed/seasonal/800/400", proofInstructions: "Upload a photo of your seasonal produce with a note of what's in season in your area.", isDaily: false, isActive: true },
        { challengeId: "homemade-lunch", title: "Homemade Lunch", description: "Carry a home-cooked lunch to work or college today in a reusable container instead of buying food outside.", shortDescription: "Carry a home-cooked lunch to work or college.", category: Category.FOOD, difficulty: Difficulty.EASY, points: 10, bonusPointsStreak: 5, iconEmoji: "🥡", bannerImageUrl: "https://picsum.photos/seed/lunchbox/800/400", proofInstructions: "Upload a photo of your packed homemade lunch in a reusable container.", isDaily: true, isActive: true },
        // COMMUNITY
        { challengeId: "eco-pledge-post", title: "Eco Pledge Post", description: "Share an eco-tip, sustainability fact, or personal green pledge on any social media platform today.", shortDescription: "Post an eco-tip or green pledge on social media.", category: Category.COMMUNITY, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "📢", bannerImageUrl: "https://picsum.photos/seed/pledge/800/400", proofInstructions: "Upload a screenshot of your social media post with the eco content visible.", isDaily: false, isActive: true },
        { challengeId: "teach-someone", title: "Teach Someone", description: "Explain one environmental issue or eco-friendly habit in detail to a friend or family member today.", shortDescription: "Teach a friend or family member one eco-habit.", category: Category.COMMUNITY, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🧑‍🏫", bannerImageUrl: "https://picsum.photos/seed/teach/800/400", proofInstructions: "Upload a photo or screenshot of you sharing the eco knowledge with someone.", isDaily: false, isActive: true },
        { challengeId: "tree-planting-drive", title: "Tree Planting Drive", description: "Participate in or organise a community tree planting activity in your neighbourhood or school.", shortDescription: "Join or organise a tree planting drive today.", category: Category.COMMUNITY, difficulty: Difficulty.HARD, points: 40, bonusPointsStreak: 10, iconEmoji: "🌳", bannerImageUrl: "https://picsum.photos/seed/treeplant/800/400", proofInstructions: "Upload a photo of you planting a tree with the location visible.", isDaily: false, isActive: true },
        { challengeId: "report-polluter", title: "Report a Polluter", description: "Report an instance of illegal dumping, open burning, or pollution to your local municipality or authority.", shortDescription: "Report illegal dumping or pollution to local authorities.", category: Category.COMMUNITY, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "🚨", bannerImageUrl: "https://picsum.photos/seed/report/800/400", proofInstructions: "Upload a screenshot of your complaint or report submitted to the authority.", isDaily: false, isActive: true },
        { challengeId: "eco-feedback", title: "Eco Feedback", description: "Submit a written suggestion or feedback to your local municipality or RWA about any green infrastructure issue.", shortDescription: "Submit eco feedback to your local authority or RWA.", category: Category.COMMUNITY, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "📝", bannerImageUrl: "https://picsum.photos/seed/feedback/800/400", proofInstructions: "Upload a screenshot of your submitted feedback form or email.", isDaily: false, isActive: true },
        // NATURE
        { challengeId: "bird-feeder-setup", title: "Bird Feeder Setup", description: "Set up a bird feeder or a small water bowl on your terrace, balcony, or garden for local birds.", shortDescription: "Set up a bird feeder or water bowl for birds.", category: Category.NATURE, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🐦", bannerImageUrl: "https://picsum.photos/seed/birdfeeder/800/400", proofInstructions: "Upload a photo of your bird feeder or water bowl set up and ready.", isDaily: false, isActive: true },
        { challengeId: "nature-walk", title: "Nature Walk", description: "Take a 30-minute mindful walk in a park, forest, or natural area with your phone on silent or left behind.", shortDescription: "Take a 30-min mindful walk in nature — no phone.", category: Category.NATURE, difficulty: Difficulty.EASY, points: 15, bonusPointsStreak: 5, iconEmoji: "🌲", bannerImageUrl: "https://picsum.photos/seed/naturewalk/800/400", proofInstructions: "Upload a photo of the natural area where you walked today.", isDaily: true, isActive: true },
        { challengeId: "invasive-plant-removal", title: "Invasive Plant Removal", description: "Help identify and remove invasive plant species from a park, community garden, or green space near you.", shortDescription: "Help remove invasive plants from a local green space.", category: Category.NATURE, difficulty: Difficulty.HARD, points: 30, bonusPointsStreak: 10, iconEmoji: "🌾", bannerImageUrl: "https://picsum.photos/seed/invasive/800/400", proofInstructions: "Upload a photo of the invasive plants you removed with the cleared area visible.", isDaily: false, isActive: true },
        { challengeId: "wildlife-spotting-log", title: "Wildlife Spotting Log", description: "Observe and document at least 5 different species of birds, insects, or animals in your local area today.", shortDescription: "Spot and document 5 birds, insects, or animals nearby.", category: Category.NATURE, difficulty: Difficulty.MEDIUM, points: 20, bonusPointsStreak: 5, iconEmoji: "🔭", bannerImageUrl: "https://picsum.photos/seed/wildlife/800/400", proofInstructions: "Upload a photo of your wildlife log or notebook with 5 species documented.", isDaily: false, isActive: true },
        { challengeId: "adopt-a-tree", title: "Adopt a Tree", description: "Choose a specific tree near your home or locality to water and care for regularly — document Day 1 of adoption.", shortDescription: "Adopt a nearby tree — water it and document Day 1.", category: Category.NATURE, difficulty: Difficulty.MEDIUM, points: 25, bonusPointsStreak: 5, iconEmoji: "🌳", bannerImageUrl: "https://picsum.photos/seed/adopttree/800/400", proofInstructions: "Upload a photo of you with your adopted tree with its location noted.", isDaily: false, isActive: true },
      ];

      const batch = writeBatch(db);
      challengesData.forEach(c => {
        const ref = doc(db, "challenges", c.challengeId);
        batch.set(ref, c);
      });
      await batch.commit();
      toast.success("Challenges seeded successfully!");
      fetchData();
    } catch (error) {
      toast.error("Failed to seed data");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile();

      if (!user) {
        setProfile(null);
        setIsAdmin(false);
        return;
      }

      // Immediate Admin Check based on email
      if (checkIsAdmin(null, user.email)) {
        setIsAdmin(true);
      }

      // Real-time user profile listener
      unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserProfile;
          setProfile(userData);
          syncBadgesWithFirestorePoints(userData.points || 0);
          if (checkIsAdmin(userData.role, user.email)) {
            setIsAdmin(true);
          }
        }
      }, (e) => {
        if (auth.currentUser) {
          console.error("User profile listener failed:", e);
        }
      });

      fetchData();
    });

    return () => {
      unsubAuth();
      unsubscribeProfile();
    };
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            {welcomeMessage}
            {isAdmin && (
              <button 
                onClick={handleSeedData}
                disabled={seeding}
                className="mt-4 flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all shadow-lg disabled:opacity-50"
              >
                <Database size={18} />
                {seeding ? "Seeding..." : "Update Challenges Database"}
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <StatCard icon={<Zap className="text-accent" />} label="Streak" value={`${profile?.currentStreak || 0} Days`} />
            <StatCard icon={<Trophy className="text-yellow-500" />} label="Points" value={(profile?.points || 0) + totalSubmissionPoints} />
          </div>
        </div>

        {/* Your Individual Impact */}
        <section>
          <h2 className="text-2xl mb-6 flex items-center gap-2">
            <Leaf className="text-primary" />
            Your Impact
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ImpactCard icon="🌿" label="CO₂ Saved"        value={formatCO2(displayCO2)}                sublabel="kilograms"  color="green"  />
            <ImpactCard icon="⚡" label="Electricity Saved" value={formatElectricity(displayElectricity)} sublabel="watt-hours" color="yellow" />
            <ImpactCard icon="💧" label="Water Saved"       value={formatWater(displayWater)}             sublabel="litres"     color="blue"   />
            <ImpactCard icon="🗑️" label="Waste Reduced"    value={formatWaste(displayWaste)}             sublabel="kilograms"  color="orange" />
          </div>
        </section>

        {/* Daily Challenges */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl flex items-center gap-2">
              <Target className="text-primary" />
              Daily Challenges
            </h2>
            <Link to="/challenges" className="text-primary font-bold flex items-center gap-1 hover:underline">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          
          {dailyChallenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {dailyChallenges.map((challenge, index) => (
                <ChallengeCard 
                  key={challenge.challengeId || `daily-${index}`} 
                  challenge={challenge} 
                  onClick={() => setSelectedChallenge(challenge)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-3xl p-12 text-center card-shadow">
              <Leaf className="mx-auto text-gray-200 mb-4" size={48} />
              <h3 className="text-xl mb-2">No daily challenges available</h3>
              <p className="text-text-secondary mb-6">Check back later or explore all challenges.</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 space-y-10">
            {/* Level Progress Card */}
            <div>
              <h2 className="text-2xl mb-6 flex items-center gap-2">
                <Award className="text-primary" />
                Your Rank Progress
              </h2>
              <LevelBadge points={totalPoints} />
            </div>

            {/* Badge Collection Section */}
            <BadgeSection />

            <div>
              <h2 className="text-2xl mb-6 flex items-center gap-2">
                <Calendar className="text-primary" />
                Recent Activity
              </h2>
              <div className="bg-card rounded-3xl card-shadow overflow-hidden">
                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-primary/5">
                    {recentActivity.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Leaf className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-text-secondary">No activity yet. Start a challenge to see your progress!</p>
                  </div>
                )}
              </div>
            </div>

            {/* My Event Submissions */}
            <div>
              <h2 className="text-2xl mb-6 flex items-center gap-2">
                <Star className="text-primary" />
                My Event Submissions
              </h2>
              <div className="bg-card rounded-3xl card-shadow overflow-hidden">
                {userSubmissions.length > 0 ? (
                  <>
                    <div className="divide-y divide-primary/5">
                      {userSubmissions.map((sub) => (
                        <div key={sub.id} className="p-6 flex items-center justify-between hover:bg-primary/5 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                              <CheckCircle2 size={24} />
                            </div>
                            <div>
                              <p className="font-bold">{sub.eventName}</p>
                              <p className="text-sm text-text-secondary">{sub.type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">+{sub.points} pts</p>
                            <div className="flex items-center gap-1 text-xs text-text-secondary uppercase tracking-widest font-bold">
                              <Clock size={12} />
                              {sub.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-primary/5 border-t border-primary/10 flex justify-between items-center">
                      <span className="font-bold text-text-secondary">Total Points from Submissions</span>
                      <span className="text-2xl font-display font-bold text-primary">⭐ {totalSubmissionPoints}</span>
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center">
                    <Trophy className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-text-secondary">No event submissions yet. Register for an event to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Community Stats */}
          <div className="space-y-6">
            <h2 className="text-2xl mb-6 flex items-center gap-2">
              <Zap className="text-primary" />
              Daily Bonus
            </h2>
            <DailyQuizCard />

            <h2 className="text-2xl mb-6 flex items-center gap-2">
              <Users className="text-primary" />
              Community
            </h2>
            <div className="bg-primary text-white rounded-3xl p-8 card-shadow relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-primary-light font-bold uppercase tracking-widest text-xs mb-4">Global Community Impact</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">CO₂ Saved</p>
                    <p className="text-xl font-display font-bold">{communityCO2.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Electricity</p>
                    <p className="text-xl font-display font-bold">{(communityElectricity / 1000).toFixed(1)} kWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Water Saved</p>
                    <p className="text-xl font-display font-bold">{communityWater.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Waste Reduced</p>
                    <p className="text-xl font-display font-bold">{communityWaste.toFixed(1)} kg</p>
                  </div>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">Together, the EcoStep community is making a real difference!</p>
              </div>
              <Leaf className="absolute -bottom-4 -right-4 text-white/10" size={120} />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {selectedChallenge && (
            <ChallengeModal 
              challenge={selectedChallenge} 
              onClose={() => setSelectedChallenge(null)} 
            />
          )}
          {isQuizOpen && (
            <QuizModal 
              isOpen={isQuizOpen} 
              onClose={() => setIsQuizOpen(false)} 
              onComplete={() => setIsQuizOpen(false)} 
            />
          )}
          {showLevelUp && newLevel && (
            <LevelUpCelebration 
              level={newLevel} 
              onClose={() => setShowLevelUp(false)} 
            />
          )}
          {newlyEarnedBadge && (
            <BadgeUnlockOverlay 
              badge={newlyEarnedBadge} 
              onClose={closeUnlockOverlay} 
            />
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

const StatCard = memo(({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => {
  return (
    <div className="bg-card px-6 py-4 rounded-2xl card-shadow flex items-center gap-4 min-w-[140px]">
      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">{label}</p>
        <p className="text-xl font-display">{value}</p>
      </div>
    </div>
  );
});

const ActivityItem = memo(({ activity }: { activity: Completion }) => {
  return (
    <div className="p-6 flex items-center justify-between hover:bg-primary/5 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-xl",
          activity.aiVerificationStatus === VerificationStatus.VERIFIED ? "bg-green-500/10" : "bg-red-500/10"
        )}>
          {activity.aiVerificationStatus === VerificationStatus.VERIFIED ? "🌱" : "❌"}
        </div>
        <div>
          <p className="font-bold">Challenge Completed</p>
          <p className="text-sm text-text-secondary">{new Date(activity.submittedAt).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          "font-bold",
          activity.aiVerificationStatus === VerificationStatus.VERIFIED ? "text-primary" : "text-red-500"
        )}>
          {activity.aiVerificationStatus === VerificationStatus.VERIFIED ? `+${activity.pointsAwarded} pts` : "Rejected"}
        </p>
        <p className="text-xs text-text-secondary uppercase tracking-widest font-bold">
          {activity.aiVerificationStatus}
        </p>
      </div>
    </div>
  );
});
