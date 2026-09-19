import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trophy, Calendar, Users, Star, Lock, Eye } from "lucide-react";
import { getSocialState, getFollowStats } from "../lib/social-utils";
import FollowButton from "./FollowButton";
import { cn } from "../lib/utils";

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"activity" | "submissions">("activity");
  const { current_user, follows } = getSocialState();
  const stats = getFollowStats(userId);
  const isFollowing = current_user ? follows[current_user.id]?.following.includes(userId) : false;

  useEffect(() => {
    const { all_users } = getSocialState();
    const foundUser = all_users.find(u => u.id === userId);
    if (foundUser) setUser(foundUser);
  }, [userId]);

  if (!user) return null;

  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500"];
  const avatarColor = colors[user.name.charCodeAt(0) % colors.length];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-2xl bg-card rounded-[2.5rem] overflow-hidden card-shadow border border-primary/10"
      >
        {/* Header/Cover */}
        <div className="h-32 bg-gradient-to-r from-primary to-accent relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-8 pb-8 -mt-16 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className={cn(
                "w-32 h-32 rounded-[2rem] border-4 border-card flex items-center justify-center text-4xl font-display text-white card-shadow",
                avatarColor
              )}>
                {user.avatar_initial}
              </div>
              <div className="text-center md:text-left pb-2">
                <h2 className="text-3xl font-display text-text-primary">{user.name}</h2>
                <p className="text-text-secondary flex items-center gap-2 justify-center md:justify-start">
                  <Star size={16} className="text-primary" />
                  {user.college}
                </p>
              </div>
            </div>
            <div className="flex justify-center pb-2">
              <FollowButton 
                targetUserId={user.id} 
                targetUserName={user.name} 
                className="w-full md:w-auto"
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            <StatBox label="Points" value={user.points || 0} icon={<Trophy size={16} />} />
            <StatBox label="Events" value={user.events_registered?.length || 0} icon={<Calendar size={16} />} />
            <StatBox label="Followers" value={stats.followers.length} icon={<Users size={16} />} />
            <StatBox label="Following" value={stats.following.length} icon={<Users size={16} />} />
          </div>

          {/* Badges */}
          <div className="mt-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">Achievements</h3>
            <div className="flex gap-3">
              <Badge icon="🌱" label="Eco-Starter" />
              <Badge icon="💧" label="Water Saver" />
              <Badge icon="🚲" label="Green Commuter" />
              {user.points > 300 && <Badge icon="👑" label="Eco King" />}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-10 border-b border-primary/10 flex gap-8">
            <TabButton 
              active={activeTab === "activity"} 
              onClick={() => setActiveTab("activity")}
              label="Activity"
            />
            <TabButton 
              active={activeTab === "submissions"} 
              onClick={() => setActiveTab("submissions")}
              label="Submissions"
            />
          </div>

          {/* Tab Content */}
          <div className="mt-6 min-h-[200px]">
            {activeTab === "activity" ? (
              <div className="space-y-4">
                <ActivityItem text="Registered for Beach Cleanup Drive" time="2 days ago" />
                <ActivityItem text="Completed Daily Quiz with 100% score" time="3 days ago" />
                <ActivityItem text="Earned 'Water Saver' badge" time="5 days ago" />
                <ActivityItem text="Joined CivicMitra community" time="1 week ago" />
              </div>
            ) : (
              <div className="relative">
                {!isFollowing && current_user?.id !== userId ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-md rounded-2xl p-8 text-center border border-primary/10">
                    <Lock className="text-primary mb-4" size={48} />
                    <h4 className="text-xl font-bold mb-2">Private Submissions</h4>
                    <p className="text-text-secondary mb-6">Follow {user.name} to see their eco-journey and proof submissions.</p>
                    <FollowButton targetUserId={user.id} targetUserName={user.name} />
                  </div>
                ) : null}
                <div className={cn("grid grid-cols-3 gap-4", !isFollowing && current_user?.id !== userId && "blur-sm pointer-events-none")}>
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="aspect-square bg-primary/5 rounded-2xl overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/${user.id}${i}/300/300`} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatBox({ label, value, icon }: any) {
  return (
    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
      <div className="flex items-center justify-center gap-2 text-primary mb-1">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-display text-text-primary">{value}</div>
    </div>
  );
}

function Badge({ icon, label }: any) {
  return (
    <div className="group relative">
      <div className="w-12 h-12 bg-card border border-primary/10 rounded-xl flex items-center justify-center text-2xl card-shadow hover:scale-110 transition-transform cursor-help">
        {icon}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "pb-4 text-sm font-bold uppercase tracking-widest transition-all relative",
        active ? "text-primary" : "text-text-secondary hover:text-primary"
      )}
    >
      {label}
      {active && (
        <motion.div 
          layoutId="profile-tab"
          className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"
        />
      )}
    </button>
  );
}

function ActivityItem({ text, time }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/5">
      <p className="text-text-primary font-medium">{text}</p>
      <span className="text-xs text-text-secondary">{time}</span>
    </div>
  );
}
