import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Challenge, Category, Difficulty, Role } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { Plus, Trash2, Edit2, Save, X, RefreshCw, ShieldCheck, Trophy, Image as ImageIcon, HelpCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import ConfirmModal from "../components/ConfirmModal";
import { checkIsAdmin } from "../lib/auth-utils";

export default function AdminChallengeManager() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Challenge>({
    challengeId: "",
    title: "",
    description: "",
    shortDescription: "",
    category: Category.WATER,
    difficulty: Difficulty.EASY,
    points: 10,
    bonusPointsStreak: 5,
    iconEmoji: "🌱",
    bannerImageUrl: "https://picsum.photos/seed/eco/800/400",
    proofInstructions: "",
    isDaily: true,
    isActive: true
  });

  const fetchChallenges = async () => {
    try {
      const snap = await getDocs(collection(db, "challenges")).catch(e => handleFirestoreError(e, OperationType.LIST, "challenges"));
      if (snap) {
        setChallenges(snap.docs.map(d => ({ ...d.data() } as Challenge)));
      }
    } catch (error) {
      console.error("Error fetching challenges:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (checkIsAdmin(null, user.email)) {
        setIsAdmin(true);
        fetchChallenges();
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && checkIsAdmin(userDoc.data().role, user.email)) {
          setIsAdmin(true);
          fetchChallenges();
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const handleSave = async () => {
    if (!formData.challengeId || !formData.title) {
      toast.error("Challenge ID and Title are required");
      return;
    }

    try {
      const ref = doc(db, "challenges", formData.challengeId);
      await setDoc(ref, formData).catch(err => handleFirestoreError(err, OperationType.WRITE, `challenges/${formData.challengeId}`));

      toast.success(editingId ? "Challenge updated" : "Challenge created");
      setEditingId(null);
      setIsAdding(false);
      fetchChallenges();
    } catch (error) {
      console.error("Error saving challenge:", error);
      toast.error("Failed to save challenge");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "challenges", id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `challenges/${id}`));
      toast.success("Challenge deleted");
      fetchChallenges();
    } catch (error) {
      toast.error("Failed to delete challenge");
    } finally {
      setChallengeToDelete(null);
    }
  };

  const startEdit = (challenge: Challenge) => {
    setFormData(challenge);
    setEditingId(challenge.challengeId);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      challengeId: "",
      title: "",
      description: "",
      shortDescription: "",
      category: Category.WATER,
      difficulty: Difficulty.EASY,
      points: 10,
      bonusPointsStreak: 5,
      iconEmoji: "🌱",
      bannerImageUrl: "https://picsum.photos/seed/eco/800/400",
      proofInstructions: "",
      isDaily: true,
      isActive: true
    });
    setEditingId(null);
    setIsAdding(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
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
            <h1 className="text-4xl">Challenge Manager</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchChallenges}
              className="p-3 bg-card border border-primary/10 rounded-xl hover:bg-primary/5 transition-all text-text-primary"
              title="Refresh"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={() => { resetForm(); setIsAdding(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
              Create Challenge
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="bg-card p-8 rounded-[2.5rem] card-shadow space-y-6 border-2 border-primary/20">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-text-primary">{editingId ? "Edit Challenge" : "New Challenge"}</h3>
              <button onClick={resetForm} className="p-2 hover:bg-primary/5 rounded-full text-text-secondary">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Challenge ID (Unique)</label>
                <input 
                  type="text"
                  disabled={!!editingId}
                  value={formData.challengeId}
                  onChange={e => setFormData({ ...formData, challengeId: e.target.value })}
                  placeholder="e.g. daily-water-bottle"
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Title</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Challenge Title"
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Short Description</label>
                <input 
                  type="text"
                  value={formData.shortDescription}
                  onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Appears on cards"
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Full Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed instructions and impact"
                  rows={3}
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium resize-none text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                >
                  {Object.values(Category).map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Difficulty</label>
                <select 
                  value={formData.difficulty}
                  onChange={e => setFormData({ ...formData, difficulty: e.target.value as Difficulty })}
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                >
                  {Object.values(Difficulty).map(d => <option key={d} value={d} className="bg-card">{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Points</label>
                <input 
                  type="number"
                  value={formData.points}
                  onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })}
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Icon Emoji</label>
                <input 
                  type="text"
                  value={formData.iconEmoji}
                  onChange={e => setFormData({ ...formData, iconEmoji: e.target.value })}
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Banner Image URL</label>
                <input 
                  type="text"
                  value={formData.bannerImageUrl}
                  onChange={e => setFormData({ ...formData, bannerImageUrl: e.target.value })}
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Proof Instructions</label>
                <input 
                  type="text"
                  value={formData.proofInstructions}
                  onChange={e => setFormData({ ...formData, proofInstructions: e.target.value })}
                  placeholder="What should the user photograph?"
                  className="w-full p-4 bg-primary/5 rounded-2xl border-2 border-transparent focus:border-primary focus:bg-card transition-all outline-none font-medium text-text-primary"
                />
              </div>
              <div className="flex items-center gap-8 md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.isDaily}
                    onChange={e => setFormData({ ...formData, isDaily: e.target.checked })}
                    className="w-6 h-6 rounded-lg text-primary focus:ring-primary border-primary/20 bg-primary/5"
                  />
                  <span className="font-bold text-text-primary">Daily Challenge</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-6 h-6 rounded-lg text-primary focus:ring-primary border-primary/20 bg-primary/5"
                  />
                  <span className="font-bold text-text-primary">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={handleSave}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-primary-light transition-all flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {editingId ? "Update Challenge" : "Create Challenge"}
              </button>
              <button 
                onClick={resetForm}
                className="px-8 py-4 bg-primary/10 text-text-primary rounded-2xl font-bold text-lg hover:bg-primary/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {challenges.map((c) => (
            <div key={c.challengeId} className="bg-card p-6 rounded-3xl card-shadow flex items-center justify-between gap-6 group hover:border-primary/30 border-2 border-transparent transition-all">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-3xl">
                  {c.iconEmoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-text-primary">{c.title}</h3>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      c.isActive ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-text-secondary"
                    )}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-secondary">
                    <span className="flex items-center gap-1"><Trophy size={14} /> {c.points} pts</span>
                    <span className="flex items-center gap-1"><HelpCircle size={14} /> {c.difficulty}</span>
                    <span className="flex items-center gap-1"><ImageIcon size={14} /> {c.category}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => startEdit(c)}
                  className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                  title="Edit"
                >
                  <Edit2 size={20} />
                </button>
                <button 
                  onClick={() => setChallengeToDelete(c.challengeId)}
                  className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                  title="Delete"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
          {challenges.length === 0 && (
            <div className="p-12 text-center bg-card rounded-3xl border-2 border-dashed border-primary/10 text-text-secondary">
              No challenges found. Create your first one!
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={!!challengeToDelete}
          onClose={() => setChallengeToDelete(null)}
          onConfirm={() => challengeToDelete && handleDelete(challengeToDelete)}
          title="Delete Challenge"
          message="Are you sure you want to delete this challenge? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
