import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Users, Search } from "lucide-react";
import { getSocialState } from "../lib/social-utils";
import FollowButton from "./FollowButton";
import { cn } from "../lib/utils";

interface FollowListModalProps {
  userId: string;
  type: "followers" | "following";
  onClose: () => void;
  onUserClick: (userId: string) => void;
}

export default function FollowListModal({ userId, type, onClose, onUserClick }: FollowListModalProps) {
  const [search, setSearch] = useState("");
  const { all_users, follows } = getSocialState();
  const listIds = follows[userId]?.[type] || [];
  const listUsers = all_users.filter(u => listIds.includes(u.id));

  const filteredUsers = listUsers.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.college.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-card rounded-[2.5rem] overflow-hidden card-shadow border border-primary/10"
      >
        <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-xl font-display text-text-primary capitalize">{type}</h2>
              <p className="text-xs text-text-secondary font-bold uppercase tracking-widest">{listIds.length} members</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-primary/10 text-text-secondary rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" size={18} />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-3 bg-primary/5 rounded-2xl border border-primary/5 hover:border-primary/20 transition-all group"
                >
                  <div 
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => onUserClick(user.id)}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold",
                      ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500"][user.name.charCodeAt(0) % 6]
                    )}>
                      {user.avatar_initial}
                    </div>
                    <div>
                      <p className="font-bold text-text-primary group-hover:text-primary transition-colors">{user.name}</p>
                      <p className="text-xs text-text-secondary">{user.college}</p>
                    </div>
                  </div>
                  <FollowButton 
                    targetUserId={user.id} 
                    targetUserName={user.name} 
                    className="scale-90"
                  />
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Users className="mx-auto text-gray-200 mb-4" size={48} />
                <p className="text-text-secondary">No members found</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
