import { useEffect, useState, useMemo, memo } from "react";
import { collection, query, limit, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import DashboardLayout from "../layouts/DashboardLayout";
import { UserProfile } from "../types";
import { motion } from "motion/react";
import { Trophy, Medal, Star, Flame } from "lucide-react";
import { cn } from "../lib/utils";
import { useEventData } from "../lib/event-registration-utils";
import { getCurrentLevel } from "../lib/level-utils";
import { getUserBadges } from "../lib/badge-utils";

// Filter out any legacy dummy/fake users (e.g. user-top-*, demo-user-*, mock-*, aarav_green, diya_eco, karan_nature, priya_earth)
export const isFakeUser = (uid?: string, username?: string, email?: string): boolean => {
  if (!uid) return true;
  const uidLower = uid.toLowerCase();
  if (
    uidLower.startsWith("user-top-") ||
    uidLower.startsWith("demo-user-") ||
    uidLower.startsWith("mock-") ||
    uidLower.startsWith("fake-") ||
    uidLower.startsWith("temp-") ||
    uidLower.startsWith("sample-")
  ) {
    return true;
  }

  const fakeUsernames = [
    "aarav_green", "diya_eco", "karan_nature", "priya_earth",
    "eco_champion", "green_warrior", "demo_user", "test_user"
  ];
  if (username && fakeUsernames.includes(username.toLowerCase().trim())) {
    return true;
  }

  const fakeEmails = [
    "aarav@example.com", "diya@example.com", "karan@example.com", "priya@example.com"
  ];
  if (email) {
    const eLower = email.toLowerCase().trim();
    if (fakeEmails.includes(eLower)) return true;
    if (eLower.endsWith("@example.com") && (eLower.includes("aarav") || eLower.includes("diya") || eLower.includes("karan") || eLower.includes("priya"))) {
      return true;
    }
  }

  return false;
};

// Merge only real users whose data is present in Firebase (or active user)
const mergeLeaderboardUsers = (firestoreUsers: UserProfile[], eventPoints: number): UserProfile[] => {
  const currentAuth = auth.currentUser;
  const userMap = new Map<string, UserProfile>();

  // 1. Real Firestore users from database ONLY (no fake social mock objects)
  firestoreUsers.forEach(u => {
    if (u && u.uid && !isFakeUser(u.uid, u.username, u.email)) {
      const pts = Number(u.points ?? u.totalPoints ?? u.experiencePoints ?? 0);
      const anyU = u as any;
      userMap.set(u.uid, {
        uid: u.uid,
        username: u.username || (u.email ? u.email.split('@')[0] : "eco_warrior"),
        fullName: u.fullName || anyU.name || anyU.displayName || u.username || "Eco Warrior",
        avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`,
        points: pts,
        totalPoints: pts,
        currentStreak: u.currentStreak || 0,
        longestStreak: u.longestStreak || 0,
        level: u.level || getCurrentLevel(pts).level,
        experiencePoints: pts,
        city: u.city || anyU.college || "Earth",
        country: u.country || "India",
        email: u.email || "",
        role: u.role || ("USER" as any),
        createdAt: u.createdAt || new Date().toISOString()
      });
    }
  });

  // 2. Current authenticated user (ensure their real points are up to date and include event points)
  if (currentAuth && !isFakeUser(currentAuth.uid, undefined, currentAuth.email || undefined)) {
    const existing = userMap.get(currentAuth.uid);
    let basePts = existing?.points;

    // Check local profile storage if not yet in snapshot list
    if (basePts === undefined) {
      try {
        const cachedSelf = localStorage.getItem(`eco_user_profile_${currentAuth.uid}`);
        if (cachedSelf) {
          const parsed = JSON.parse(cachedSelf);
          basePts = Number(parsed.points ?? parsed.totalPoints ?? 0);
        }
      } catch {}
    }

    const currentPoints = Number(basePts ?? 0);

    userMap.set(currentAuth.uid, {
      uid: currentAuth.uid,
      username: existing?.username || currentAuth.email?.split('@')[0] || "user",
      fullName: existing?.fullName || currentAuth.displayName || currentAuth.email?.split('@')[0] || "You",
      avatarUrl: existing?.avatarUrl || currentAuth.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentAuth.uid}`,
      points: currentPoints,
      totalPoints: currentPoints,
      currentStreak: existing?.currentStreak || 0,
      longestStreak: existing?.longestStreak || 0,
      level: existing?.level || getCurrentLevel(currentPoints + eventPoints).level,
      experiencePoints: currentPoints,
      city: existing?.city || "Earth",
      country: existing?.country || "India",
      email: currentAuth.email || "",
      role: existing?.role || ("USER" as any),
      createdAt: existing?.createdAt || new Date().toISOString()
    });
  }

  // Sort real users by total points descending
  const list = Array.from(userMap.values());
  return list.sort((a, b) => {
    const ptsA = a.uid === currentAuth?.uid ? (a.points || 0) + eventPoints : (a.points || 0);
    const ptsB = b.uid === currentAuth?.uid ? (b.points || 0) + eventPoints : (b.points || 0);
    return ptsB - ptsA;
  });
};

export default function Leaderboard() {
  const { submissions } = useEventData();
  const eventPoints = useMemo(() => {
    return submissions
      .filter(s => s.userEmail === auth.currentUser?.email)
      .reduce((total, s) => total + s.points, 0);
  }, [submissions]);

  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const cached = localStorage.getItem("eco_cached_leaderboard");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strictly filter out any fake users from existing cache
          const realCached = parsed.filter(u => u && u.uid && !isFakeUser(u.uid, u.username, u.email));
          return mergeLeaderboardUsers(realCached, 0);
        }
      }
    } catch {}
    return mergeLeaderboardUsers([], 0);
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL_TIME");
  const [isQuotaLimited, setIsQuotaLimited] = useState(false);
  const userBadges = getUserBadges();

  const getPrestigiousBadges = (uid: string) => {
    if (uid !== auth.currentUser?.uid) return [];
    
    return [...userBadges.earned]
      .sort((a, b) => {
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
        return rarityOrder[a.rarity] - rarityOrder[b.rarity];
      })
      .slice(0, 2);
  };

  useEffect(() => {
    setLoading(true);
    // Fetch users directly without strict orderBy constraints that omit unindexed documents
    const q = query(collection(db, "users"), limit(100));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setIsQuotaLimited(false);
      let rawUsers: UserProfile[] = [];
      if (!snap.empty) {
        rawUsers = snap.docs
          .map(d => ({
            uid: d.id,
            ...d.data()
          } as UserProfile))
          .filter(u => u && u.uid && !isFakeUser(u.uid, u.username, u.email));

        try {
          localStorage.setItem("eco_cached_leaderboard", JSON.stringify(rawUsers));
        } catch {}
      }
      const merged = mergeLeaderboardUsers(rawUsers, eventPoints);
      setUsers(merged);
      setLoading(false);
    }, (error) => {
      console.warn("Leaderboard snapshot notice (offline/quota), using cached real users:", error);
      setIsQuotaLimited(true);
      let cached: UserProfile[] = [];
      try {
        const raw = localStorage.getItem("eco_cached_leaderboard");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            cached = parsed.filter(u => u && u.uid && !isFakeUser(u.uid, u.username, u.email));
          }
        }
      } catch {}
      const merged = mergeLeaderboardUsers(cached, eventPoints);
      setUsers(merged);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, eventPoints]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl mb-4">Eco Leaderboard</h1>
          <p className="text-text-secondary">See how you stack up against the global community of eco-warriors.</p>
        </div>

        {isQuotaLimited && (
          <div className="max-w-2xl mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <p className="font-bold">Firestore Free Quota Status (Local Cache Mode Active)</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Firestore free tier limit is 50,000 document reads/day (resets daily at midnight PST / 00:00 UTC). Real registered users and their earned points are preserved in local storage.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsQuotaLimited(false)}
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-medium transition-colors flex-shrink-0"
              title="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex justify-center">
          <div className="bg-card p-1 rounded-2xl card-shadow flex gap-1 border border-primary/10">
            {["WEEKLY", "MONTHLY", "ALL_TIME"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold transition-all",
                  activeTab === tab ? "bg-primary text-white" : "text-text-secondary hover:bg-primary/5"
                )}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Podium */}
        {!loading && users.length >= 3 && (
          <div className="flex items-end justify-center gap-4 md:gap-12 py-12">
            <PodiumItem user={users[1]} rank={2} height="h-48" eventPoints={eventPoints} />
            <PodiumItem user={users[0]} rank={1} height="h-64" eventPoints={eventPoints} />
            <PodiumItem user={users[2]} rank={3} height="h-40" eventPoints={eventPoints} />
          </div>
        )}
        {!loading && users.length === 2 && (
          <div className="flex items-end justify-center gap-4 md:gap-12 py-12">
            <PodiumItem user={users[0]} rank={1} height="h-64" eventPoints={eventPoints} />
            <PodiumItem user={users[1]} rank={2} height="h-48" eventPoints={eventPoints} />
          </div>
        )}
        {!loading && users.length === 1 && (
          <div className="flex items-end justify-center py-12">
            <PodiumItem user={users[0]} rank={1} height="h-64" eventPoints={eventPoints} />
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-3xl card-shadow overflow-hidden border border-primary/10">
          <div className="grid grid-cols-12 gap-4 p-6 bg-primary/5 text-xs font-bold text-text-secondary uppercase tracking-widest">
            <div className="col-span-1">Rank</div>
            <div className="col-span-7 md:col-span-8">User</div>
            <div className="col-span-2 md:col-span-1 text-right">Streak</div>
            <div className="col-span-2 text-right">Points</div>
          </div>

          {loading ? (
            <div className="p-12 text-center animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-primary/5 rounded-xl" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary text-2xl font-bold">
                🌱
              </div>
              <h3 className="text-xl font-bold text-text-primary">No Real Users Yet</h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Be the first eco-warrior on the leaderboard! Complete challenges and join events to earn points and claim the top rank.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-primary/5">
              {users.map((user, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={user.uid} 
                  className={cn(
                    "grid grid-cols-12 gap-4 p-6 items-center hover:bg-primary/5 transition-colors",
                    user.uid === auth.currentUser?.uid && "bg-primary/10"
                  )}
                >
                  <div className="col-span-1 font-display font-bold text-lg text-text-secondary">
                    #{i + 1}
                  </div>
                  <div className="col-span-7 md:col-span-8 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden">
                      <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-text-primary flex items-center gap-2">
                        {user.fullName}
                        <span className="flex items-center gap-1">
                          {getPrestigiousBadges(user.uid).map((badge, bIdx) => (
                            <span key={`${badge.id}-${bIdx}`} title={badge.name} className="text-sm">
                              {badge.emoji}
                            </span>
                          ))}
                        </span>
                        <span className="text-sm px-2 py-0.5 bg-primary/5 rounded-full border border-primary/10 text-primary flex items-center gap-1">
                          {getCurrentLevel(user.uid === auth.currentUser?.uid ? user.points + eventPoints : user.points).emoji}
                          Lvl {getCurrentLevel(user.uid === auth.currentUser?.uid ? user.points + eventPoints : user.points).level}
                        </span>
                      </p>
                      <p className="text-xs text-text-secondary">@{user.username}</p>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1 text-right flex items-center justify-end gap-1 text-accent font-bold">
                    <Flame size={14} />
                    {user.currentStreak}
                  </div>
                  <div className="col-span-2 text-right font-bold text-primary">
                    {user.uid === auth.currentUser?.uid 
                      ? (user.points + eventPoints).toLocaleString() 
                      : user.points.toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

const PodiumItem = memo(({ user, rank, height, eventPoints }: { user: UserProfile, rank: number, height: string, eventPoints: number }) => {
  const points = user.uid === auth.currentUser?.uid ? user.points + eventPoints : user.points;
  const level = getCurrentLevel(points);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className={cn(
          "w-20 h-20 md:w-24 md:h-24 rounded-full border-4 p-1",
          rank === 1 ? "border-yellow-400" : rank === 2 ? "border-gray-300" : "border-orange-400"
        )}>
          <img 
            src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
            className="w-full h-full rounded-full object-cover" 
            loading="lazy"
          />
        </div>
        <div className={cn(
          "absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
          rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-300" : "bg-orange-400"
        )}>
          {rank}
        </div>
        <div className="absolute -top-2 -left-2 bg-card rounded-full p-1 shadow-sm border border-primary/10 text-xl">
          {level.emoji}
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm md:text-base">{user.fullName}</p>
        <div className="flex flex-col items-center">
          <p className="text-primary font-bold">{points} pts</p>
          <p className="text-[10px] uppercase tracking-widest font-black text-text-secondary">{level.title}</p>
        </div>
      </div>
      <motion.div 
        initial={{ height: 0 }}
        animate={{ height: "auto" }}
        className={cn(
          "w-24 md:w-32 rounded-t-2xl flex flex-col items-center justify-center text-white font-display font-bold text-2xl",
          rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-300" : "bg-orange-400",
          height
        )}
      >
        {rank === 1 ? <Trophy size={32} /> : rank === 2 ? <Medal size={32} /> : <Star size={32} />}
      </motion.div>
    </div>
  );
});
