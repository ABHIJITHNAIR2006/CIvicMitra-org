import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, writeBatch, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { handleFirestoreError, OperationType, isFirestoreQuotaOrOfflineError } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { Challenge, Category, Difficulty, Role } from "../types";
import { AnimatePresence } from "motion/react";
import { Search, Database, Plus, AlertTriangle } from "lucide-react";
import ChallengeCard from "../components/ChallengeCard";
import ChallengeModal from "../components/ChallengeModal";
import { toast } from "react-hot-toast";
import { checkIsAdmin } from "../lib/auth-utils";
import { DEFAULT_CHALLENGES } from "../lib/default-data";

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>(DEFAULT_CHALLENGES);
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
        if (!isFirestoreQuotaOrOfflineError(error)) {
          console.error("Error checking admin status:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "challenges"), (snap) => {
      if (!snap.empty) {
        const data = snap.docs.map(d => ({ challengeId: d.data().challengeId || d.id, ...d.data() } as Challenge));
        setChallenges(data);
      } else {
        setChallenges(DEFAULT_CHALLENGES);
      }
      setLoading(false);
    }, (error: any) => {
      console.warn("Using fallback challenges catalog (quota/offline):", error?.message || error);
      setChallenges(DEFAULT_CHALLENGES);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      DEFAULT_CHALLENGES.forEach(c => {
        const ref = doc(db, "challenges", c.challengeId);
        batch.set(ref, c);
      });
      await batch.commit();
      toast.success("Challenges seeded successfully!");
    } catch (error) {
      toast.error("Failed to seed data (check Firestore permissions or quota)");
    } finally {
      setSeeding(false);
    }
  };

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
