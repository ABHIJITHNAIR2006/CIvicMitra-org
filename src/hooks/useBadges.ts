import { useState, useEffect, useCallback } from "react";
import { 
  getStats, 
  getUserBadges, 
  checkAndAwardBadges, 
  BADGES, 
  Badge, 
  UserStats, 
  UserBadges, 
  updateStats 
} from "../lib/badge-utils";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  getCountFromServer
} from "firebase/firestore";

export function useBadges() {
  const [stats, setStats] = useState<UserStats>(() => getStats(auth.currentUser?.uid));
  const [userBadges, setUserBadges] = useState<UserBadges>(() => getUserBadges(auth.currentUser?.uid));
  const [newlyEarnedBadge, setNewlyEarnedBadge] = useState<Badge | null>(null);

  const refresh = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setStats(getStats(null));
      setUserBadges(getUserBadges(null));
      return;
    }

    const currentLocal = getStats(currentUser.uid);

    try {
      // 1. Fetch latest points from Firestore
      const userDoc = await getDoc(doc(db, "users", currentUser.uid)).catch(() => null);
      const userData = userDoc?.exists() ? userDoc.data() : null;
      const points = userData?.points ?? currentLocal.points ?? 0;

      // 2. Fetch quiz completions
      const quizSnap = await getDocs(query(collection(db, "quiz_attempts"), where("userId", "==", currentUser.uid))).catch(() => null);
      const quizzes_completed = quizSnap ? quizSnap.size : currentLocal.quizzes_completed;
      const perfect_quiz_scores = quizSnap ? quizSnap.docs.filter(d => d.data().score === 50).length : currentLocal.perfect_quiz_scores;
      
      // Consecutive perfect quizzes
      let consecutive_perfect_quizzes = currentLocal.consecutive_perfect_quizzes;
      if (quizSnap) {
        const sortedQuizzes = quizSnap.docs
          .map(d => d.data())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        consecutive_perfect_quizzes = 0;
        for (const quiz of sortedQuizzes) {
          if (quiz.score === 50) consecutive_perfect_quizzes++;
          else break;
        }
      }

      // 3. Fetch event registrations
      let events_registered = currentLocal.events_registered;
      if (currentUser.email) {
        const eventSnap = await getDocs(query(collection(db, "event_registrations"), where("email", "==", currentUser.email))).catch(() => null);
        if (eventSnap) events_registered = eventSnap.size;
      }

      // 4. Fetch proof submissions
      const proofSnap = await getDocs(query(collection(db, "completions"), where("userId", "==", currentUser.uid))).catch(() => null);
      const proofs_submitted = proofSnap ? proofSnap.size : currentLocal.proofs_submitted;

      // 5. Join order (approximate if not stored)
      let join_order = userData?.joinOrder || currentLocal.join_order || 100;
      if (!userData?.joinOrder && userData?.createdAt) {
        try {
          const countSnap = await getCountFromServer(
            query(collection(db, "users"), where("createdAt", "<", userData.createdAt))
          );
          join_order = countSnap.data().count + 1;
        } catch {
          join_order = currentLocal.join_order || 100;
        }
      }

      const newStats = updateStats({
        points,
        quizzes_completed,
        perfect_quiz_scores,
        consecutive_perfect_quizzes,
        events_registered,
        proofs_submitted,
        join_order
      }, currentUser.uid);

      setStats(newStats);

      // Check for new badges
      const newlyEarnedIds = checkAndAwardBadges(newStats, currentUser.uid);
      const currentBadges = getUserBadges(currentUser.uid);
      setUserBadges(currentBadges);

      if (newlyEarnedIds.length > 0) {
        // Only show animation for the first one that hasn't been seen
        const firstUnseen = newlyEarnedIds.find(id => !currentBadges.seen_animations.includes(id));
        if (firstUnseen) {
          setNewlyEarnedBadge(BADGES.find(b => b.id === firstUnseen) || null);
        }
      }
    } catch (error) {
      console.warn("Badge stats refresh notice (quota/offline fallback):", error);
      const fallbackStats = getStats(currentUser.uid);
      setStats(fallbackStats);
      setUserBadges(getUserBadges(currentUser.uid));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setStats(getStats(user.uid));
        setUserBadges(getUserBadges(user.uid));
        refresh();
      } else {
        setStats(getStats(null));
        setUserBadges(getUserBadges(null));
        setNewlyEarnedBadge(null);
      }
    });
    return () => unsubscribe();
  }, [refresh]);

  const closeUnlockOverlay = () => {
    setNewlyEarnedBadge(null);
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    // After closing, check if there are more unseen badges
    const currentBadges = getUserBadges(currentUser.uid);
    const unseen = currentBadges.earned.find(eb => !currentBadges.seen_animations.includes(eb.id));
    if (unseen) {
      setNewlyEarnedBadge(BADGES.find(b => b.id === unseen.id) || null);
    }
  };

  return {
    stats,
    userBadges,
    newlyEarnedBadge,
    refresh,
    closeUnlockOverlay
  };
}
