import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, writeBatch, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { Challenge, Category, Difficulty, Role } from "../types";
import { AnimatePresence } from "motion/react";
import { Search, Database, Plus, AlertTriangle } from "lucide-react";
import ChallengeCard from "../components/ChallengeCard";
import ChallengeModal from "../components/ChallengeModal";
import { toast } from "react-hot-toast";
import { checkIsAdmin } from "../lib/auth-utils";

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      if (checkIsAdmin(null, user.email)) {
        setIsAdmin(true);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid)).catch(e => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));
        if (userSnap && userSnap.exists() && checkIsAdmin(userSnap.data().role, user.email)) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchChallenges = async () => {
    try {
      const snap = await getDocs(collection(db, "challenges")).catch(e => {
        handleFirestoreError(e, OperationType.LIST, "challenges");
        return null;
      });
      if (snap) {
        const data = snap.docs.map(d => ({ challengeId: d.data().challengeId || d.id, ...d.data() } as Challenge));
        setChallenges(data);
      }
    } catch (error: any) {
      console.error("Error fetching challenges:", error?.message || "Unknown error");
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
      fetchChallenges();
    } catch (error) {
      toast.error("Failed to seed data");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const filteredChallenges = useMemo(() => {
    let filtered = challenges;
    if (selectedCategory !== "ALL") {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }
    if (search) {
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(search.toLowerCase()) || 
        c.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  }, [search, selectedCategory, challenges]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl">Eco Challenges</h1>
            {isAdmin && !loading && (
              <button 
                onClick={handleSeedData}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-accent/90 transition-all text-sm shadow-md disabled:opacity-50"
              >
                <Database size={16} />
                {seeding ? "Seeding..." : "Update Database"}
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
              <input
                type="text"
                placeholder="Search challenges..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-card border border-primary/10 rounded-xl card-shadow outline-none focus:ring-2 focus:ring-primary text-text-primary"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 bg-card border border-primary/10 rounded-xl card-shadow outline-none focus:ring-2 focus:ring-primary font-bold text-text-primary"
            >
              <option value="ALL">All Categories</option>
              {Object.values(Category).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredChallenges.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChallenges.map((challenge, index) => (
              <ChallengeCard 
                key={challenge.challengeId || `chal-${index}`} 
                challenge={challenge} 
                onClick={() => setSelectedChallenge(challenge)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-card rounded-3xl card-shadow">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="text-text-secondary opacity-20" size={40} />
            </div>
            <h3 className="text-2xl mb-2">No challenges found</h3>
            <p className="text-text-secondary">Try adjusting your filters or search terms.</p>
          </div>
        )}

        <AnimatePresence>
          {selectedChallenge && (
            <ChallengeModal 
              challenge={selectedChallenge} 
              onClose={() => setSelectedChallenge(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
