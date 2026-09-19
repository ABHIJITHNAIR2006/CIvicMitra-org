import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { 
  Home, 
  Zap, 
  Trophy, 
  Calendar, 
  Users, 
  User, 
  Settings, 
  LogOut, 
  Bell,
  Menu,
  X,
  Flame,
  ShieldCheck,
  Star
} from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Role } from "../types";
import { useEventData } from "../lib/event-registration-utils";
import { getCurrentLevel } from "../lib/level-utils";
import { getUserBadges, syncBadgesWithFirestorePoints } from "../lib/badge-utils";
import { checkIsAdmin } from "../lib/auth-utils";
import AIScreenScanner from "../components/AIScreenScanner";

const baseNavItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: Zap, label: "Challenges", path: "/challenges" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: Calendar, label: "Events", path: "/events" },
  { icon: Users, label: "Feed", path: "/feed" },
  { icon: User, label: "Profile", path: "/profile" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [firestorePoints, setFirestorePoints] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { submissions } = useEventData();
  const userBadges = getUserBadges();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setUserEmail(null);
        setFirestorePoints(0);
        setUserName(null);
        return;
      }
      
      setUserEmail(user.email);
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid)).catch(e => {
          console.error("User profile fetch failed:", e);
          return null;
        });
        
        if (userDoc && userDoc.exists()) {
          const userData = userDoc.data();
          const pts = userData.points || 0;
          setFirestorePoints(pts);
          syncBadgesWithFirestorePoints(pts);
          setUserName(userData.fullName || userData.username || user.displayName);
          if (checkIsAdmin(userData.role, user.email)) {
            setIsAdmin(true);
          }
        } else if (checkIsAdmin(null, user.email)) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Error checking user status:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const eventPoints = submissions
    .filter(s => s.userEmail === userEmail)
    .reduce((total, s) => total + s.points, 0);

  const totalPoints = firestorePoints + eventPoints;
  const currentLevel = getCurrentLevel(totalPoints);

  // Get 3 most recently earned badges
  const recentBadges = [...userBadges.earned]
    .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
    .slice(0, 3);

  const navItems = isAdmin 
    ? [...baseNavItems, { icon: ShieldCheck, label: "Admin", path: "/admin" }]
    : baseNavItems;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-primary/10 p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Zap className="text-white" size={24} />
          </div>
          <span className="text-2xl font-display font-bold text-primary">CivicMitra</span>
        </div>

        <div className="mb-6 px-4 py-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3">
          <div className="text-2xl">{currentLevel.emoji}</div>
          <div>
            <p className="text-xs text-text-secondary font-medium">Level {currentLevel.level}</p>
            <p className="text-sm font-bold text-primary">{currentLevel.title}</p>
          </div>
        </div>

        <div className="mb-6 px-4 py-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Star className="text-primary" size={18} />
          </div>
          <div>
            <p className="text-xs text-text-secondary font-medium">Your Points</p>
            <p className="text-lg font-bold text-primary">⭐ {totalPoints} Points</p>
          </div>
        </div>

        {recentBadges.length > 0 && (
          <div className="mb-6 px-4 py-3 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mb-2">Recent Badges</p>
            <div className="flex gap-2">
              {recentBadges.map((badge, idx) => (
                <div 
                  key={`${badge.id}-${idx}`} 
                  title={badge.name}
                  className="w-10 h-10 bg-card rounded-lg flex items-center justify-center text-xl shadow-sm border border-primary/10 cursor-help hover:scale-110 transition-transform"
                >
                  {badge.emoji}
                </div>
              ))}
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                location.pathname === item.path
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-text-secondary hover:bg-primary/5 hover:text-primary"
              )}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 mt-auto"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-primary/10 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="text-white" size={18} />
          </div>
          <span className="text-xl font-display font-bold text-primary">CivicMitra</span>
        </div>
        <div className="flex items-center gap-3">
          {recentBadges.length > 0 && (
            <div className="hidden sm:flex gap-1 mr-2">
              {recentBadges.map((badge, idx) => (
                <span key={`${badge.id}-${idx}`} title={badge.name} className="text-lg cursor-help">
                  {badge.emoji}
                </span>
              ))}
            </div>
          )}
          <div className="bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 flex items-center gap-1.5">
            <span className="text-sm">{currentLevel.emoji}</span>
            <span className="text-sm font-bold text-primary">Lvl {currentLevel.level}</span>
          </div>
          <div className="bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 flex items-center gap-1.5">
            <Star className="text-primary" size={14} />
            <span className="text-sm font-bold text-primary">{totalPoints}</span>
          </div>
          <button className="p-2 text-text-secondary">
            <Bell size={20} />
          </button>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-text-secondary"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-card z-[70] p-6 lg:hidden"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Zap className="text-white" size={18} />
                  </div>
                  <span className="text-xl font-display font-bold text-primary">CivicMitra</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                      location.pathname === item.path
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "text-text-secondary hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 mt-10 w-full"
              >
                <LogOut size={20} />
                <span className="font-medium">Logout</span>
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 p-4 pt-20 lg:pt-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Floating Ambient AI Screen Scanner & Quick Nav Widget */}
      <AIScreenScanner />
    </div>
  );
}
