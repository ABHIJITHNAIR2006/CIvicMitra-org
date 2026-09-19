import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserPlus, Check, X } from "lucide-react";
import { followUser, unfollowUser, getSocialState } from "../lib/social-utils";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";

interface FollowButtonProps {
  targetUserId: string;
  targetUserName: string;
  className?: string;
  onToggle?: () => void;
}

export default function FollowButton({ targetUserId, targetUserName, className, onToggle }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const { current_user } = getSocialState();

  useEffect(() => {
    if (current_user) {
      const { follows } = getSocialState();
      setIsFollowing(follows[current_user.id]?.following.includes(targetUserId) || false);
    }
  }, [targetUserId, current_user]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!current_user) {
      toast.error("Please log in to follow users");
      return;
    }

    if (isFollowing) {
      unfollowUser(current_user.id, targetUserId);
      setIsFollowing(false);
      toast.success(`You unfollowed ${targetUserName}`);
    } else {
      followUser(current_user.id, targetUserId);
      setIsFollowing(true);
      toast.success(`You are now following ${targetUserName}!`);
    }
    
    if (onToggle) onToggle();
  };

  if (current_user?.id === targetUserId) return null;

  return (
    <button
      onClick={handleToggle}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 overflow-hidden min-w-[120px]",
        !isFollowing 
          ? "bg-transparent border-2 border-primary text-primary hover:bg-primary/5" 
          : isHovering 
            ? "bg-red-500 text-white border-2 border-red-500" 
            : "bg-green-500 text-white border-2 border-green-500",
        className
      )}
    >
      <AnimatePresence mode="wait">
        {!isFollowing ? (
          <motion.div
            key="follow"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <UserPlus size={18} />
            <span>Follow</span>
          </motion.div>
        ) : isHovering ? (
          <motion.div
            key="unfollow"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <X size={18} />
            <span>Unfollow</span>
          </motion.div>
        ) : (
          <motion.div
            key="following"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Check size={18} />
            <span>Following</span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
