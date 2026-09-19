import { useEffect, useState, useCallback, memo, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, addDoc, updateDoc, increment, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import DashboardLayout from "../layouts/DashboardLayout";
import { Completion } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Send, Image as ImageIcon, X } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "react-hot-toast";
import { getCurrentLevel } from "../lib/level-utils";
import { checkIsAdmin } from "../lib/auth-utils";

// Cache for user profiles to avoid redundant fetches
const userCache: Record<string, any> = {};

export default function Feed() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkIsAdmin(null, auth.currentUser?.email)) {
      setIsAdmin(true);
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

  useEffect(() => {
    const q = query(collection(db, "completions"), orderBy("submittedAt", "desc"), limit(20));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      const completions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion));
      
      // Batch fetch user profiles
      const uniqueUserIds = Array.from(new Set(completions.map(c => c.userId)));
      const missingUserIds = uniqueUserIds.filter(id => !userCache[id]);

      if (missingUserIds.length > 0) {
        await Promise.all(missingUserIds.map(async (userId) => {
          try {
            const userSnap = await getDoc(doc(db, "users", userId));
            if (userSnap.exists()) {
              userCache[userId] = userSnap.data();
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
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

      setPosts(postData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "completions");
    });

    return unsubscribe;
  }, []);

  const handleCreatePost = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !auth.currentUser) return;

    setIsPosting(true);
    try {
      const postData = {
        userId: auth.currentUser.uid,
        challengeId: "community-update",
        proofUrl: selectedImage || `https://picsum.photos/seed/${Math.random()}/800/800`, 
        proofType: "IMAGE",
        aiVerificationStatus: "VERIFIED",
        aiVerificationScore: 1.0,
        pointsAwarded: 5,
        isStreakDay: false,
        submittedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        caption: newPost,
        likesCount: 0,
        commentsCount: 0
      };

      await addDoc(collection(db, "completions"), postData).catch(e => handleFirestoreError(e, OperationType.CREATE, "completions"));
      setNewPost("");
      setSelectedImage(null);
      toast.success("Update shared with the community!");
    } catch (error) {
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
              <PostCard key={post.id} post={post} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const PostCard = memo(({ post, isAdmin }: { post: any, isAdmin: boolean }) => {
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  // Check if user liked the post
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const likeRef = doc(db, "completions", post.id, "likes", auth.currentUser.uid);
    const unsubscribe = onSnapshot(likeRef, (snap) => {
      setLiked(snap.exists());
    });
    
    return unsubscribe;
  }, [post.id]);

  // Fetch comments
  useEffect(() => {
    if (!showComments) return;
    
    const commentsRef = collection(db, "completions", post.id, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"), limit(50));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      const commentData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Fetch user profiles for comments if missing
      const userIds = Array.from(new Set(commentData.map((c: any) => c.userId)));
      const missingIds = userIds.filter(id => !userCache[id]);
      
      if (missingIds.length > 0) {
        await Promise.all(missingIds.map(async (uid: any) => {
          try {
            const uSnap = await getDoc(doc(db, "users", uid));
            if (uSnap.exists()) userCache[uid] = uSnap.data();
          } catch (e) {}
        }));
      }
      
      setComments(commentData.map((c: any) => ({
        ...c,
        username: userCache[c.userId]?.username || "eco_warrior",
        avatarUrl: userCache[c.userId]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`
      })));
    });
    
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
        <button className="p-2 text-text-secondary hover:bg-primary/5 rounded-full">
          <MoreHorizontal size={20} />
        </button>
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
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
            +{post.pointsAwarded} pts
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
    </motion.div>
  );
});
