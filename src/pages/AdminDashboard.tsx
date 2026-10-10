import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { collection, query, getDocs, where, doc, updateDoc, getDoc, increment, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import { UserProfile, Completion, VerificationStatus, Role, Challenge, Category, Difficulty } from "../types";
import { motion } from "motion/react";
import { Users, Zap, AlertCircle, CheckCircle2, XCircle, ShieldCheck, Eye, Database, Plus, Brain, Trophy, Search, Mail, ExternalLink, RefreshCw, Flame, Info, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { checkIsAdmin } from "../lib/auth-utils";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"verifications" | "users">("verifications");
  const [pendingCompletions, setPendingCompletions] = useState<Completion[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [challengesMap, setChallengesMap] = useState<Record<string, Challenge>>({});
  const [isQuotaLimited, setIsQuotaLimited] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompletions: 0,
    pendingReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(u => 
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.uid && u.uid.toLowerCase().includes(q))
    );
  }, [allUsers, userSearch]);

  const fetchAdminData = async () => {
    try {
      // 1. Fetch Pending Completions
      const q = query(collection(db, "completions"), where("aiVerificationStatus", "in", [VerificationStatus.PENDING, VerificationStatus.MANUAL_REVIEW]));
      const snap = await getDocs(q).catch(e => {
        console.warn("Completions fetch note:", e);
        return null;
      });

      if (snap) {
        const comps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion));
        setPendingCompletions(comps);

        const userIds = Array.from(new Set(comps.map(c => c.userId).filter(Boolean))) as string[];
        const uMap: Record<string, any> = {};
        for (const uid of userIds) {
          const uDoc = await getDoc(doc(db, "users", uid)).catch(() => null);
          if (uDoc && uDoc.exists()) uMap[uid] = uDoc.data();
        }
        setUsersMap(uMap);

        const cMap: Record<string, Challenge> = {};
        const cSnap = await getDocs(collection(db, "challenges")).catch(() => null);
        if (cSnap) {
          cSnap.docs.forEach(d => {
            const c = d.data() as Challenge;
            cMap[c.challengeId] = c;
          });
        }
        setChallengesMap(cMap);
      }

      // 2. Fetch Users
      let userList: UserProfile[] = [];
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        userList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        setAllUsers(userList);
        setIsQuotaLimited(false);
        try {
          localStorage.setItem("admin_cached_users", JSON.stringify(userList));
        } catch {}
      } catch (err: any) {
        console.warn("Users fetch note (offline/quota):", err);
        setIsQuotaLimited(true);
        try {
          const cached = localStorage.getItem("admin_cached_users") || localStorage.getItem("eco_cached_leaderboard");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              userList = parsed;
              setAllUsers(userList);
            }
          }
        } catch {}
      }

      // 3. Completions count
      let compsCount = 0;
      try {
        const compsSnap = await getDocs(collection(db, "completions"));
        compsCount = compsSnap.size;
      } catch {
        compsCount = pendingCompletions.length;
      }

      setStats({
        totalUsers: userList.length,
        totalCompletions: compsCount,
        pendingReviews: snap ? snap.size : 0
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      // Check admin status
      if (checkIsAdmin(null, user.email)) {
        setIsAdmin(true);
        fetchAdminData();
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid)).catch(e => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));
        if (userDoc && userDoc.exists() && checkIsAdmin(userDoc.data().role, user.email)) {
          setIsAdmin(true);
          fetchAdminData();
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleVerify = async (completion: Completion, status: VerificationStatus) => {
    try {
      const compRef = doc(db, "completions", completion.id);
      await updateDoc(compRef, {
        aiVerificationStatus: status,
        verifiedAt: new Date().toISOString()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `completions/${completion.id}`));

      if (status === VerificationStatus.VERIFIED) {
        const challenge = challengesMap[completion.challengeId];
        const points = challenge?.points || 10;
        const userRef = doc(db, "users", completion.userId);
        
        const updateData = {
          totalPoints: increment(points),
          currentStreak: increment(1)
        };

        await updateDoc(userRef, updateData).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${completion.userId}`));
      }

      setPendingCompletions(prev => prev.filter(c => c.id !== completion.id));
      toast.success(`Submission ${status.toLowerCase()}`);
    } catch (error) {
      toast.error("Action failed");
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
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

      const batch = writeBatch(db);
      challenges.forEach(c => {
        const ref = doc(db, "challenges", c.challengeId);
        batch.set(ref, c);
      });
      await batch.commit();
      toast.success("Challenges seeded successfully!");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to seed data");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <XCircle size={64} className="text-red-500 mx-auto" />
        <h1 className="text-3xl">Access Denied</h1>
        <p className="text-text-secondary">You do not have administrative privileges to access this area.</p>
        <button onClick={() => window.history.back()} className="px-8 py-3 bg-primary text-white rounded-xl font-bold">Go Back</button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-4xl">Admin Control Panel</h1>
          </div>
          <button 
            onClick={handleSeedData}
            disabled={seeding}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg"
          >
            <Database size={20} />
            {seeding ? "Seeding..." : "Seed Challenges"}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AdminStatCard icon={<Users />} label="Total Users" value={stats.totalUsers} color="bg-blue-500" />
          <AdminStatCard icon={<Zap />} label="Completions" value={stats.totalCompletions} color="bg-green-500" />
          <AdminStatCard icon={<AlertCircle />} label="Pending Reviews" value={stats.pendingReviews} color="bg-orange-500" />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/admin/quiz" className="bg-card p-8 rounded-[2.5rem] card-shadow flex items-center justify-between group hover:bg-primary transition-all">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center text-primary group-hover:bg-white/20 group-hover:text-white transition-all">
                <Brain size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold group-hover:text-white transition-all">Quiz Manager</h3>
                <p className="text-text-secondary group-hover:text-white/70 transition-all">Manage daily quiz questions and pool.</p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-text-secondary group-hover:bg-white/20 group-hover:text-white transition-all">
              <Plus size={24} />
            </div>
          </Link>

          <Link to="/admin/challenges" className="bg-card p-8 rounded-[2.5rem] card-shadow flex items-center justify-between group hover:bg-accent transition-all">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-accent/10 rounded-[1.5rem] flex items-center justify-center text-accent group-hover:bg-white/20 group-hover:text-white transition-all">
                <Trophy size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold group-hover:text-white transition-all">Challenge Manager</h3>
                <p className="text-text-secondary group-hover:text-white/70 transition-all">Create and edit eco-challenges.</p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-text-secondary group-hover:bg-white/20 group-hover:text-white transition-all">
              <Plus size={24} />
            </div>
          </Link>
        </div>

        {/* Firebase Authentication vs Database Explanation & Quota Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-3xl p-6 space-y-3 text-text-primary">
          <div className="flex items-start gap-3">
            <Info className="text-blue-500 shrink-0 mt-0.5" size={22} />
            <div className="space-y-2 text-sm leading-relaxed">
              <h4 className="font-bold text-base text-blue-600 dark:text-blue-400">
                Understanding Firebase Users & Cloud Database
              </h4>
              <p className="text-text-secondary">
                <strong className="text-text-primary">Why can the number of users in Firebase Console differ from the app?</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-text-secondary">
                <li>
                  <strong className="text-text-primary">Firebase Authentication</strong> (Console &rarr; Authentication tab) records login accounts (emails, passwords, OAuth providers).
                </li>
                <li>
                  <strong className="text-text-primary">Cloud Firestore Database</strong> (the <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-xs">users</code> collection) stores application game profiles (points, levels, streaks, badges).
                </li>
                <li>
                  When registered accounts sign in to the app for the first time, their profile is automatically generated in Cloud Firestore. Accounts created via Firebase Console or imported without ever signing in do not have a Firestore profile document yet.
                </li>
              </ul>
              {isQuotaLimited && (
                <div className="mt-3 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle size={18} className="shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Firestore Free Read Quota Active:</span> Google Cloud free daily read quota (50,000 reads/day) has been reached today. The app is serving cached member data until midnight PST.
                    <div className="mt-1">
                      <a 
                        href="https://console.firebase.google.com/project/gen-lang-client-0940566692/firestore/databases/ai-studio-f8852c1b-8e2f-48c8-87d9-cde479c4a402/data?openUpgradeDialog=true" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold underline hover:text-amber-600 dark:hover:text-amber-100"
                      >
                        Open Firestore Database in Firebase Console <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex bg-card p-1.5 rounded-2xl card-shadow border border-primary/10">
            <button
              onClick={() => setActiveTab("verifications")}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                activeTab === "verifications" 
                  ? "bg-primary text-white shadow-md" 
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Zap size={16} />
              Pending Verifications
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold",
                activeTab === "verifications" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
              )}>
                {pendingCompletions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                activeTab === "users" 
                  ? "bg-primary text-white shadow-md" 
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Users size={16} />
              User Directory
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold",
                activeTab === "users" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
              )}>
                {allUsers.length}
              </span>
            </button>
          </div>

          <button
            onClick={fetchAdminData}
            className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-primary/5 text-text-primary text-sm font-bold rounded-xl border border-primary/10 transition-all card-shadow"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* Pending Verifications Tab */}
        {activeTab === "verifications" && (
          <section className="bg-card rounded-3xl card-shadow overflow-hidden">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <h3 className="text-xl font-bold">Pending Verifications</h3>
              <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                {pendingCompletions.length} New
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-primary/5 text-xs font-bold text-text-secondary uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Challenge</th>
                    <th className="px-6 py-4">Proof</th>
                    <th className="px-6 py-4">AI Score</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {pendingCompletions.map((comp) => (
                    <tr key={comp.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden">
                            {usersMap[comp.userId]?.avatarUrl && <img src={usersMap[comp.userId].avatarUrl} className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="font-bold">{usersMap[comp.userId]?.username || "Unknown"}</p>
                            <p className="text-xs text-text-secondary">{comp.userId.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold">{challengesMap[comp.challengeId]?.title || "Unknown Challenge"}</p>
                        <p className="text-xs text-text-secondary">{comp.challengeId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div 
                          className="w-12 h-12 rounded-lg bg-primary/5 overflow-hidden cursor-pointer relative group"
                          onClick={() => setSelectedProof(comp.proofUrl)}
                        >
                          <img src={comp.proofUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye size={16} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-bold",
                          comp.aiVerificationScore > 0.7 ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
                        )}>
                          {(comp.aiVerificationScore * 100).toFixed(0)}% AI
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleVerify(comp, VerificationStatus.VERIFIED)}
                            className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                            title="Approve"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleVerify(comp, VerificationStatus.REJECTED)}
                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            title="Reject"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingCompletions.length === 0 && (
                <div className="p-12 text-center text-text-secondary">
                  No pending verifications. Great job!
                </div>
              )}
            </div>
          </section>
        )}

        {/* User Directory Tab */}
        {activeTab === "users" && (
          <section className="bg-card rounded-3xl card-shadow overflow-hidden">
            <div className="p-6 border-b border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Cloud Firestore Users</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Showing {filteredUsers.length} of {allUsers.length} profiles in the database
                </p>
              </div>
              <div className="relative min-w-[240px]">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search user, email or UID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-background border border-primary/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-text-primary"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-primary/5 text-xs font-bold text-text-secondary uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Points & Level</th>
                    <th className="px-6 py-4">Streaks</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden shrink-0">
                            <img 
                              src={u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                              alt={u.username}
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <div>
                            <p className="font-bold text-text-primary">{u.fullName || u.username || "User"}</p>
                            <p className="text-xs text-text-secondary">@{u.username || "user"} &bull; <span className="font-mono text-[10px]">{u.uid.slice(0, 8)}...</span></p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-text-secondary flex items-center gap-1.5">
                          <Mail size={13} className="text-primary/70 shrink-0" />
                          {u.email || "No email"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-text-primary">
                          {Number(u.points ?? u.totalPoints ?? 0).toLocaleString()} pts
                        </div>
                        <div className="text-xs text-text-secondary">
                          Level {u.level || 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-orange-500">
                          <Flame size={14} />
                          {u.currentStreak || 0} days
                        </div>
                        <div className="text-xs text-text-secondary">
                          Best: {u.longestStreak || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1",
                          u.role === Role.ADMIN 
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" 
                            : "bg-primary/10 text-primary"
                        )}>
                          {u.role === Role.ADMIN && <ShieldCheck size={12} />}
                          {u.role || "USER"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-text-secondary space-y-2">
                  <p className="font-bold text-text-primary">No users found</p>
                  <p className="text-sm">
                    {userSearch ? "Try adjusting your search criteria" : "No user documents in Cloud Firestore yet"}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Proof Modal */}
        {selectedProof && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProof(null)}>
            <div className="relative max-w-4xl w-full">
              <img src={selectedProof} className="w-full h-auto rounded-2xl shadow-2xl" referrerPolicy="no-referrer" />
              <button className="absolute -top-12 right-0 text-white flex items-center gap-2 font-bold">
                <XCircle size={24} /> Close
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AdminStatCard({ icon, label, value, color }: any) {
  return (
    <div className="bg-card p-6 rounded-3xl card-shadow flex items-center gap-4">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white", color)}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-text-secondary font-bold uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-display font-bold text-text-primary">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

// No placeholder needed
