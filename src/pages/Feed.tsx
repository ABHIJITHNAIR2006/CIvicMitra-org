import { useEffect, useState, useCallback, memo, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, addDoc, updateDoc, increment, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { Completion } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Send, Image as ImageIcon, X, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "react-hot-toast";
import { getCurrentLevel } from "../lib/level-utils";
import { checkIsAdmin } from "../lib/auth-utils";
import { DEFAULT_FEED_POSTS } from "../lib/default-data";
import { useAuth } from "../contexts/AuthContext";
import { checkImageAuthenticity } from "../services/geminiService";
import { checkDuplicateImage, registerImageFingerprint } from "../lib/duplicate-check";

// Cache for user profiles to avoid redundant fetches
const userCache: Record<string, any> = {};

export default function Feed() {
  const [posts, setPosts] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("eco_cached_feed");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FEED_POSTS;
  });
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { user, isAdmin: authIsAdmin } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authIsAdmin || checkIsAdmin(null, auth.currentUser?.email || user?.email)) {
      setIsAdmin(true);
    }
  }, [authIsAdmin, user]);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      if (!postId.startsWith("local-") && !postId.startsWith("default-")) {
        await deleteDoc(doc(db, "completions", postId)).catch((e) => {
          handleFirestoreError(e, OperationType.DELETE, `completions/${postId}`);
        });
      }
      
      setPosts((prev) => {
        const updated = prev.filter((p) => p.id !== postId);
        try {
          localStorage.setItem("eco_cached_feed", JSON.stringify(updated));
        } catch {}
        return updated;
      });
      toast.success("Post deleted successfully");
    } catch (error) {
      console.error("Error deleting post:", error);
      setPosts((prev) => {
        const updated = prev.filter((p) => p.id !== postId);
        try {
          localStorage.setItem("eco_cached_feed", JSON.stringify(updated));
        } catch {}
        return updated;
      });
      toast.success("Post removed from feed");
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error("Image size must be less than 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [isQuotaLimited, setIsQuotaLimited] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "completions"), orderBy("submittedAt", "desc"), limit(20));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      setIsQuotaLimited(false);
      const completions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion));
      
      // Batch fetch user profiles
      const uniqueUserIds = Array.from(new Set(completions.map(c => c.userId)));
      const missingUserIds = uniqueUserIds.filter(id => !userCache[id]);

      if (missingUserIds.length > 0) {
        await Promise.all(missingUserIds.map(async (userId) => {
          try {
            const userSnap = await getDoc(doc(db, "users", userId)).catch(() => null);
            if (userSnap?.exists()) {
              userCache[userId] = userSnap.data();
            } else {
              userCache[userId] = {
                username: "eco_warrior",
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                points: 0
              };
            }
          } catch {
            userCache[userId] = {
              username: "eco_warrior",
              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
              points: 0
            };
          }
        }));
      }

      const postData = completions.map((data) => {
        const userData = userCache[data.userId];
        return { 
          ...data, 
          username: userData?.username || "eco_warrior", 
          userAvatar: userData?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.userId}`,
          userPoints: userData?.points || 0
        };
      });

      if (postData.length > 0) {
        setPosts(postData);
        try {
          localStorage.setItem("eco_cached_feed", JSON.stringify(postData));
        } catch {}
      } else {
        try {
          const cached = localStorage.getItem("eco_cached_feed");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPosts(parsed);
              setLoading(false);
              return;
            }
          }
        } catch {}
        setPosts(DEFAULT_FEED_POSTS);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Feed snapshot notice (offline/quota), using cached/sample feed:", error);
      setIsQuotaLimited(true);
      try {
        const cached = localStorage.getItem("eco_cached_feed");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPosts(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {}
      setPosts(prev => prev.length > 0 ? prev : DEFAULT_FEED_POSTS);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleCreatePost = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !auth.currentUser) return;

    setIsPosting(true);
    try {
      let isAiGen = false;
      let aiLikelihood = 0;
      let aiSignals: string[] = [];
      let aiReason = "";
      let imageFingerprint: any = null;

      if (selectedImage) {
        // Run duplicate check FIRST so duplicates never reach Gemini
        const { isDuplicate, fingerprint } = await checkDuplicateImage(selectedImage, { nearMatch: true });
        if (isDuplicate) {
          toast.error("This photo was already shared. Please post a new photo.");
          return;
        }
        imageFingerprint = fingerprint;

        toast.loading("Analyzing image authenticity...", { id: "feed-auth-check" });
        const checkResult = await checkImageAuthenticity(selectedImage);
        toast.dismiss("feed-auth-check");
        isAiGen = Boolean(checkResult.isAiGenerated);
        aiLikelihood = checkResult.aiGeneratedLikelihood || 0;
        aiSignals = checkResult.aiGeneratedSignals || [];
        aiReason = checkResult.reason || "";
      }

      const pointsAwarded = isAiGen ? -5 : 5;

      const postData = {
        userId: auth.currentUser.uid,
        challengeId: "community-update",
        proofUrl: selectedImage || `https://picsum.photos/seed/${Math.random()}/800/800`, 
        proofType: "IMAGE",
        aiVerificationStatus: isAiGen ? "REJECTED" : "VERIFIED",
        aiVerificationScore: isAiGen ? 0.0 : 1.0,
        pointsAwarded,
        isStreakDay: false,
        submittedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        caption: newPost,
        likesCount: 0,
        commentsCount: 0,
        isAiGenerated: isAiGen,
        aiGeneratedLikelihood: aiLikelihood,
        aiGeneratedSignals: aiSignals,
        aiCheckReason: aiReason
      };

      // If AI-generated image detected, deduct 5 points from user's profile
      if (isAiGen) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
          points: increment(-5),
          totalPoints: increment(-5)
        }).catch(err => {
          console.warn("Could not deduct profile points:", err);
        });
      }

      // Optimistically display post immediately in real-time feed
      const optimisticPost = {
        id: "local-" + Date.now(),
        ...postData,
        username: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "You",
        userAvatar: auth.currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser.uid}`,
        userPoints: pointsAwarded
      };
      setPosts(prev => {
        const updated = [optimisticPost, ...prev];
        try {
          localStorage.setItem("eco_cached_feed", JSON.stringify(updated));
        } catch {}
        return updated;
      });

      await addDoc(collection(db, "completions"), postData).catch(e => {
        console.warn("Local post queued for sync:", e);
      });

      // Register image fingerprint for future duplicate detection (non-blocking)
      if (imageFingerprint) {
        registerImageFingerprint(imageFingerprint, "FEED");
      }

      setNewPost("");
      setSelectedImage(null);
      if (isAiGen) {
        toast.error("AI-generated image detected! Penalty: -5 points deducted.");
      } else {
        toast.success("Update shared with the community!");
      }
    } catch (error) {
      toast.dismiss("feed-auth-check");
      toast.error("Failed to post update");
    } finally {
      setIsPosting(false);
    }
  }, [newPost, selectedImage]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl text-text-primary">Community Feed</h1>
          <div className="flex gap-2 bg-card p-1 rounded-xl card-shadow border border-primary/10">
            <button className="px-4 py-2 bg-primary text-white rounded-lg font-bold">Global</button>
            <button className="px-4 py-2 text-text-secondary hover:bg-primary/5 rounded-lg font-bold">Following</button>
          </div>
        </div>

        {isQuotaLimited && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <p className="font-bold">Firestore Free Quota Status (Cached & Local Mode Active)</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Firestore free tier limit is 50,000 document reads/day (resets daily at midnight PST / 00:00 UTC). When renewed or when billing is enabled, live multi-device syncing automatically resumes. Your posts and actions are saved locally.
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

        {/* Create Post */}
        <div className="bg-card rounded-3xl card-shadow p-6 border border-primary/10">
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/5 overflow-hidden flex-shrink-0">
                <img 
                  src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.uid}`} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 space-y-4">
                <textarea 
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share your eco-journey with the community..."
                  className="w-full bg-primary/5 border border-primary/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary resize-none min-h-[100px] transition-all text-text-primary"
                />
                
                {selectedImage && (
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-primary/5 group">
                    <img src={selectedImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center justify-between pt-2 border-t border-primary/5">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-text-secondary hover:text-primary font-bold transition-colors"
              >
                <ImageIcon size={20} />
                <span>{selectedImage ? "Change Photo" : "Add Photo"}</span>
              </button>
              <button 
                type="submit"
                disabled={(!newPost.trim() && !selectedImage) || isPosting}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-all disabled:opacity-50 shadow-md"
              >
                <Send size={18} />
                {isPosting ? "Posting..." : "Post"}
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-96 bg-primary/5 rounded-3xl animate-pulse" />)
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} isAdmin={isAdmin} onDeletePost={handleDeletePost} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const PostCard = memo(({ 
  post, 
  isAdmin, 
  onDeletePost 
}: { 
  post: any; 
  isAdmin: boolean; 
  onDeletePost: (postId: string) => Promise<void>; 
}) => {
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = Boolean(auth.currentUser?.uid && auth.currentUser.uid === post.userId);
  const canDelete = isAuthor || isAdmin;

  // Check if user liked the post
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const likeRef = doc(db, "completions", post.id, "likes", auth.currentUser.uid);
    const unsubscribe = onSnapshot(
      likeRef,
      (snap) => {
        setLiked(snap.exists());
      },
      (err) => {
        // Quietly ignore quota/offline errors
      }
    );
    
    return unsubscribe;
  }, [post.id]);

  // Fetch comments
  useEffect(() => {
    if (!showComments) return;
    
    const commentsRef = collection(db, "completions", post.id, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"), limit(50));
    
    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        const commentData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Fetch user profiles for comments if missing
        const userIds = Array.from(new Set(commentData.map((c: any) => c.userId)));
        const missingIds = userIds.filter(id => !userCache[id]);
        
        if (missingIds.length > 0) {
          await Promise.all(missingIds.map(async (uid: any) => {
            try {
              const uSnap = await getDoc(doc(db, "users", uid)).catch(() => null);
              if (uSnap?.exists()) userCache[uid] = uSnap.data();
            } catch (e) {}
          }));
        }
        
        setComments(commentData.map((c: any) => ({
          ...c,
          username: userCache[c.userId]?.username || "eco_warrior",
          avatarUrl: userCache[c.userId]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`
        })));
      },
      (err) => {
        // Quietly ignore quota/offline errors for comments
      }
    );
    
    return unsubscribe;
  }, [post.id, showComments]);

  const handleLike = async () => {
    if (!auth.currentUser) return;
    
    const likeRef = doc(db, "completions", post.id, "likes", auth.currentUser.uid);
    const postRef = doc(db, "completions", post.id);
    
    try {
      if (liked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { createdAt: new Date().toISOString() });
        await updateDoc(postRef, { likesCount: increment(1) });
      }
    } catch (error) {
      console.error("Error updating like:", error);
      toast.error("Failed to update like");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !auth.currentUser) return;

    setIsCommenting(true);
    try {
      const commentsRef = collection(db, "completions", post.id, "comments");
      const postRef = doc(db, "completions", post.id);
      
      await addDoc(commentsRef, {
        userId: auth.currentUser.uid,
        text: commentText,
        createdAt: new Date().toISOString()
      });
      
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });
      
      setCommentText("");
      toast.success("Comment added!");
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!auth.currentUser) return;
    
    try {
      const commentRef = doc(db, "completions", post.id, "comments", commentId);
      const postRef = doc(db, "completions", post.id);
      
      await deleteDoc(commentRef);
      await updateDoc(postRef, {
        commentsCount: increment(-1)
      });
      
      toast.success("Comment deleted");
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-3xl card-shadow overflow-hidden border border-primary/10"
    >
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/5 overflow-hidden">
            <img 
              src={post.userAvatar} 
              className="w-full h-full object-cover" 
              loading="lazy" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="font-bold text-text-primary flex items-center gap-1.5">
              @{post.username}
              {post.userPoints !== undefined && (
                <span title={getCurrentLevel(post.userPoints).title}>
                  {getCurrentLevel(post.userPoints).emoji}
                </span>
              )}
            </p>
            <p className="text-xs text-text-secondary">{new Date(post.submittedAt).toLocaleString()}</p>
          </div>
        </div>
        {/* Post Options Menu */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setIsMenuOpen(prev => !prev)}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-primary/5 rounded-full transition-colors"
            title="More options"
          >
            <MoreHorizontal size={20} />
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsMenuOpen(false)} 
              />
              <div className="absolute right-0 top-full mt-1 w-52 bg-card rounded-2xl shadow-xl border border-primary/10 py-1.5 z-30 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Post link copied to clipboard!");
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-text-secondary hover:text-text-primary hover:bg-primary/5 flex items-center gap-2.5 transition-colors"
                >
                  <Share2 size={16} />
                  <span>Copy Link</span>
                </button>

                {canDelete && (
                  <>
                    <div className="h-px bg-primary/5 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowDeleteModal(true);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 font-medium transition-colors"
                    >
                      <Trash2 size={16} />
                      <span>
                        {isAdmin && !isAuthor ? "Delete Post (Admin)" : "Delete Post"}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-4">
        <p className="text-text-primary mb-4">
          {post.caption || `Just completed the #${post.challengeId.replace(/-/g, '')} challenge! 💧 Small steps for a better planet.`}
        </p>
      </div>

      {/* Post Media */}
      <div className="aspect-square bg-primary/5 relative group">
        <img 
          src={post.proofUrl} 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm">
          Verified ✓
        </div>
      </div>

      {/* Post Actions */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1 transition-colors",
                liked ? "text-red-500" : "text-text-secondary hover:text-red-500"
              )}
            >
              <Heart size={24} fill={liked ? "currentColor" : "none"} />
              <span className="font-bold">{post.likesCount || 0}</span>
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors"
            >
              <MessageCircle size={24} />
              <span className="font-bold">{post.commentsCount || 0}</span>
            </button>
            <button className="text-text-secondary hover:text-primary transition-colors">
              <Share2 size={24} />
            </button>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-bold",
            (post.pointsAwarded ?? 0) < 0
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              : "bg-primary/10 text-primary"
          )}>
            {(post.pointsAwarded ?? 0) > 0 ? `+${post.pointsAwarded}` : (post.pointsAwarded ?? 0)} pts
          </div>
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-4 pt-2 border-t border-primary/5"
            >
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input 
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary text-text-primary"
                />
                <button 
                  type="submit"
                  disabled={!commentText.trim() || isCommenting}
                  className="p-2 text-primary hover:bg-primary/10 rounded-xl disabled:opacity-50 transition-all"
                >
                  <Send size={18} />
                </button>
              </form>
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2 group/comment">
                      <img 
                        src={comment.avatarUrl} 
                        className="w-6 h-6 rounded-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-text-primary">
                          <span className="font-bold">@{comment.username}</span> {comment.text}
                        </p>
                        <p className="text-[10px] text-text-secondary">
                          {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      {(auth.currentUser?.uid === comment.userId || isAdmin) && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 text-text-secondary hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-all"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary italic">No comments yet. Be the first!</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-primary/10 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  {isAdmin && !isAuthor ? "Delete User Post?" : "Delete Your Post?"}
                </h3>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                  {isAdmin && !isAuthor
                    ? `Are you sure you want to remove this post by @${post.username}? As an admin, this post will be permanently removed for everyone.`
                    : "Are you sure you want to delete this post? It will be permanently removed from the community feed."}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-text-secondary hover:bg-primary/5 font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await onDeletePost(post.id);
                      setShowDeleteModal(false);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-red-500/20"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
