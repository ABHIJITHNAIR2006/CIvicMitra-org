import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { collection, query, getDocs, where, doc, updateDoc, getDoc, increment, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import { UserProfile, Completion, VerificationStatus, Role, Challenge, Category, Difficulty } from "../types";
import { motion } from "motion/react";
import { Users, Zap, AlertCircle, CheckCircle2, XCircle, ShieldCheck, Eye, Database, Plus, Brain, Trophy } from "lucide-react";
import { cn } from "../lib/utils";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { checkIsAdmin } from "../lib/auth-utils";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCompletions, setPendingCompletions] = useState<Completion[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [challengesMap, setChallengesMap] = useState<Record<string, Challenge>>({});
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompletions: 0,
    pendingReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Fetch Pending Completions
        const q = query(collection(db, "completions"), where("aiVerificationStatus", "in", [VerificationStatus.PENDING, VerificationStatus.MANUAL_REVIEW]));
        const snap = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, "completions"));
        if (snap) {
          const comps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion));
          setPendingCompletions(comps);

          // Fetch related users and challenges
          const userIds = Array.from(new Set(comps.map(c => c.userId)));
          const challengeIds = Array.from(new Set(comps.map(c => c.challengeId)));

          const uMap: Record<string, any> = {};
          for (const uid of userIds) {
            const uDoc = await getDoc(doc(db, "users", uid));
            if (uDoc.exists()) uMap[uid] = uDoc.data();
          }
          setUsersMap(uMap);

          const cMap: Record<string, Challenge> = {};
          const cSnap = await getDocs(collection(db, "challenges"));
          cSnap.docs.forEach(d => {
            const c = d.data() as Challenge;
            cMap[c.challengeId] = c;
          });
          setChallengesMap(cMap);
        }

        const usersSnap = await getDocs(collection(db, "users")).catch(e => handleFirestoreError(e, OperationType.LIST, "users"));
        const compsSnap = await getDocs(collection(db, "completions")).catch(e => handleFirestoreError(e, OperationType.LIST, "completions"));

        if (usersSnap && compsSnap && snap) {
          setStats({
            totalUsers: usersSnap.size,
            totalCompletions: compsSnap.size,
            pendingReviews: snap.size
          });
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

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

  const fetchAdminData = async () => {
    try {
      // Fetch Pending Completions
      const q = query(collection(db, "completions"), where("aiVerificationStatus", "in", [VerificationStatus.PENDING, VerificationStatus.MANUAL_REVIEW]));
      const snap = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, "completions"));
      if (snap) {
        const comps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion));
        setPendingCompletions(comps);

        // Fetch related users and challenges
        const userIds = Array.from(new Set(comps.map(c => c.userId)));
        const challengeIds = Array.from(new Set(comps.map(c => c.challengeId)));

        const uMap: Record<string, any> = {};
        for (const uid of userIds) {
          const uDoc = await getDoc(doc(db, "users", uid));
          if (uDoc.exists()) uMap[uid] = uDoc.data();
        }
        setUsersMap(uMap);

        const cMap: Record<string, Challenge> = {};
        const cSnap = await getDocs(collection(db, "challenges"));
        cSnap.docs.forEach(d => {
          const c = d.data() as Challenge;
          cMap[c.challengeId] = c;
        });
        setChallengesMap(cMap);
      }

      const usersSnap = await getDocs(collection(db, "users")).catch(e => handleFirestoreError(e, OperationType.LIST, "users"));
      const compsSnap = await getDocs(collection(db, "completions")).catch(e => handleFirestoreError(e, OperationType.LIST, "completions"));

      if (usersSnap && compsSnap && snap) {
        setStats({
          totalUsers: usersSnap.size,
          totalCompletions: compsSnap.size,
          pendingReviews: snap.size
        });
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
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

        {/* Pending Verifications */}
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
