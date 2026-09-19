import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { UserProfile, Completion } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Award, Grid, List, Flame, Star, Zap, MapPin, Calendar, Trophy, Leaf } from "lucide-react";
import { cn } from "../lib/utils";
import { useEventData } from "../lib/event-registration-utils";
import { getCurrentLevel } from "../lib/level-utils";
import LevelBadge from "../components/LevelBadge";
import { getUserBadges, BADGES, getStats } from "../lib/badge-utils";
import BadgeCard from "../components/BadgeCard";
import BadgeUnlockOverlay from "../components/BadgeUnlockOverlay";
import { useBadges } from "../hooks/useBadges";
import { calculateCO2, calculateElectricity, calculateWater, calculateWaste, formatCO2, formatElectricity, formatWater, formatWaste } from "../lib/impact-utils";
import ImpactCard from "../components/ImpactCard";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ACTIVITY");
  const { submissions } = useEventData();
  const { newlyEarnedBadge, closeUnlockOverlay } = useBadges();
  const userBadges = getUserBadges();
  const stats = getStats();

  const totalSubmissionPoints = submissions
    .filter(s => s.userEmail === auth.currentUser?.email)
    .reduce((sum, s) => sum + s.points, 0);

  const totalPoints = (profile?.points || 0) + totalSubmissionPoints;
  const currentLevel = getCurrentLevel(totalPoints);

  // Top 4 badges
  const topBadges = [...userBadges.earned]
    .sort((a, b) => {
      // Sort by rarity first, then newest
      const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
      if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
        return rarityOrder[a.rarity] - rarityOrder[b.rarity];
      }
      return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime();
    })
    .slice(0, 4);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid)).catch(e => handleFirestoreError(e, OperationType.GET, `users/${auth.currentUser?.uid}`));
        if (userDoc && userDoc.exists()) setProfile(userDoc.data() as UserProfile);
        else if (userDoc && !userDoc.exists()) console.warn("User profile document not found");

        const compQuery = query(collection(db, "completions"), where("userId", "==", auth.currentUser.uid));
        const compSnap = await getDocs(compQuery).catch(e => handleFirestoreError(e, OperationType.LIST, "completions"));
        if (compSnap) {
          const sorted = compSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Completion))
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
          setCompletions(sorted);
        }

      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="p-12 text-center">Loading profile...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="bg-card rounded-3xl card-shadow overflow-hidden border border-primary/10">
          <div className="h-48 bg-gradient-to-r from-primary to-primary-light relative">
            <div className="absolute -bottom-16 left-8 p-2 bg-card rounded-full">
              <div className="w-32 h-32 rounded-full bg-primary/5 overflow-hidden border-4 border-card">
                <img 
                  src={profile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`} 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          </div>
          <div className="pt-20 pb-8 px-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-display text-text-primary">{profile?.fullName}</h1>
              <p className="text-text-secondary mb-4">@{profile?.username}</p>
              
              {/* Top Badges Row */}
              {topBadges.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  {topBadges.map(badge => (
                    <div 
                      key={badge.id} 
                      title={badge.name}
                      className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-xl border border-primary/10 shadow-sm cursor-help hover:scale-110 transition-transform"
                    >
                      {badge.emoji}
                    </div>
                  ))}
                  {userBadges.earned.length > 4 && (
                    <button 
                      onClick={() => setActiveTab("BADGES")}
                      className="text-xs font-bold text-primary hover:underline ml-2"
                    >
                      + {userBadges.earned.length - 4} more
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                <div className="flex items-center gap-1">
                  <MapPin size={16} />
                  {profile?.city}, {profile?.country}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  Joined {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Recently'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors">
                Edit Profile
              </button>
              <button className="px-6 py-2 bg-primary/5 text-text-primary rounded-xl font-bold hover:bg-primary/10 transition-colors border border-primary/10">
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <StatCard icon={<Star className="text-primary" />} label="Total Points" value={totalPoints} />
            <StatCard icon={<Flame className="text-accent" />} label="Current Streak" value={profile?.currentStreak || 0} />
            <StatCard icon={<Award className="text-primary-light" />} label="Badges" value={userBadges.earned.length} />
            <StatCard icon={<Zap className="text-yellow-500" />} label="Rank" value={currentLevel.title} />
          </div>
          <div className="md:col-span-1">
            <LevelBadge points={totalPoints} />
          </div>
        </div>

        {/* Environmental Impact */}
        <div>
          <h2 className="text-2xl mb-4 flex items-center gap-2">
            <Leaf className="text-primary" />
            Environmental Impact
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ImpactCard icon="🌿" label="CO₂ Saved"        value={formatCO2(calculateCO2(totalPoints))}                sublabel="kilograms"  color="green"  />
            <ImpactCard icon="⚡" label="Electricity Saved" value={formatElectricity(calculateElectricity(totalPoints))} sublabel="watt-hours" color="yellow" />
            <ImpactCard icon="💧" label="Water Saved"       value={formatWater(calculateWater(totalPoints))}             sublabel="litres"     color="blue"   />
            <ImpactCard icon="🗑️" label="Waste Reduced"    value={formatWaste(calculateWaste(totalPoints))}             sublabel="kilograms"  color="orange" />
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-6">
          <div className="flex border-b border-primary/10">
            {["ACTIVITY", "BADGES", "GALLERY"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-8 py-4 font-bold transition-all relative",
                  activeTab === tab ? "text-primary" : "text-text-secondary hover:text-primary"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === "ACTIVITY" && (
              <div className="space-y-4">
                {completions.length > 0 ? completions.map(comp => (
                  <div key={comp.id} className="bg-card p-6 rounded-3xl card-shadow flex items-center justify-between border border-primary/10">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/5 overflow-hidden">
                        <img src={comp.proofUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <h4 className="font-bold text-text-primary">Challenge Completed</h4>
                        <p className="text-sm text-text-secondary">{new Date(comp.submittedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-primary font-bold">+{comp.pointsAwarded} pts</span>
                      <p className="text-xs text-green-500 font-bold uppercase tracking-wider mt-1">Verified</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 bg-card rounded-3xl card-shadow border border-primary/10">
                    <p className="text-text-secondary">No activity yet. Start a challenge!</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "BADGES" && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-display text-text-primary">Earned Badges</h3>
                  <p className="text-sm text-text-secondary font-bold">
                    {userBadges.earned.length} / {BADGES.length} Badges
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {BADGES.map(badge => {
                    const earned = userBadges.earned.find(eb => eb.id === badge.id);
                    return (
                      <BadgeCard 
                        key={badge.id} 
                        badge={badge} 
                        earnedBadge={earned} 
                        stats={stats} 
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "GALLERY" && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {completions.map(comp => (
                  <div key={comp.id} className="aspect-square rounded-2xl overflow-hidden card-shadow border border-primary/10">
                    <img src={comp.proofUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {newlyEarnedBadge && (
          <BadgeUnlockOverlay 
            badge={newlyEarnedBadge} 
            onClose={closeUnlockOverlay} 
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <div className="bg-card p-6 rounded-3xl card-shadow flex items-center gap-4 border border-primary/10">
      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-text-secondary font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-display font-bold text-text-primary">{value}</p>
      </div>
    </div>
  );
}
