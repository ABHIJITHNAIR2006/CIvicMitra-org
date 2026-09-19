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
  const [stats, setStats] = useState<UserStats>(getStats());
  const [userBadges, setUserBadges] = useState<UserBadges>(getUserBadges());
  const [newlyEarnedBadge, setNewlyEarnedBadge] = useState<Badge | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      // 1. Fetch latest points from Firestore
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data();
      const points = userData?.points || 0;

      // 2. Fetch quiz completions
      const quizSnap = await getDocs(query(collection(db, "quiz_attempts"), where("userId", "==", auth.currentUser.uid)));
      const quizzes_completed = quizSnap.size;
      const perfect_quiz_scores = quizSnap.docs.filter(d => d.data().score === 50).length;
      
      // Consecutive perfect quizzes
      const sortedQuizzes = quizSnap.docs
        .map(d => d.data())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let consecutive_perfect_quizzes = 0;
      for (const quiz of sortedQuizzes) {
        if (quiz.score === 50) consecutive_perfect_quizzes++;
        else break;
      }

      // 3. Fetch event registrations
      const eventSnap = await getDocs(query(collection(db, "event_registrations"), where("email", "==", auth.currentUser.email)));
      const events_registered = eventSnap.size;

      // 4. Fetch proof submissions
      const proofSnap = await getDocs(query(collection(db, "completions"), where("userId", "==", auth.currentUser.uid)));
      const proofs_submitted = proofSnap.size;

      // 5. Join order (approximate if not stored)
      let join_order = userData?.joinOrder || 100;
      if (!userData?.joinOrder) {
        // Use getCountFromServer for efficiency
        const countSnap = await getCountFromServer(
          query(collection(db, "users"), where("createdAt", "<", userData?.createdAt || new Date().toISOString()))
        );
        join_order = countSnap.data().count + 1;
      }

      const newStats = updateStats({
        points,
        quizzes_completed,
        perfect_quiz_scores,
        consecutive_perfect_quizzes,
        events_registered,
        proofs_submitted,
        join_order
      });

      setStats(newStats);

      // Check for new badges
      const newlyEarnedIds = checkAndAwardBadges(newStats);
      if (newlyEarnedIds.length > 0) {
        const currentBadges = getUserBadges();
        setUserBadges(currentBadges);
        
        // Only show animation for the first one that hasn't been seen
        const firstUnseen = newlyEarnedIds.find(id => !currentBadges.seen_animations.includes(id));
        if (firstUnseen) {
          setNewlyEarnedBadge(BADGES.find(b => b.id === firstUnseen) || null);
        }
      }
    } catch (error) {
      console.error("Error refreshing badge stats:", error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        refresh();
      }
    });
    return () => unsubscribe();
  }, [refresh]);

  const closeUnlockOverlay = () => {
    setNewlyEarnedBadge(null);
    // After closing, check if there are more unseen badges
    const currentBadges = getUserBadges();
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
