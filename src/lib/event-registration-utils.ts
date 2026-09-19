import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from './firestore-guard';
import { checkIsAdmin } from './auth-utils';

export interface Registration {
  id: string;
  eventId: string;
  eventName: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  teamName?: string;
  memberCount: string;
  registeredAt: string;
  userId?: string;
}

export interface Submission {
  id: string;
  userId?: string;
  userEmail: string;
  eventId: string;
  eventName: string;
  fileName: string;
  description: string;
  type: string;
  points: number;
  status: 'Pending' | 'Verified';
  timestamp: string;
  aiVerificationStatus?: string;
  proofUrl?: string;
}

export interface QuizScore {
  id: string;
  userEmail: string;
  score: number;
  timestamp: string;
}

export const useEventData = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubParticipants = () => {};
    let unsubCompletions = () => {};
    let unsubQuiz = () => {};

    const unsubAuth = auth.onAuthStateChanged((user) => {
      // Unsubscribe any existing listeners first
      unsubParticipants();
      unsubCompletions();
      unsubQuiz();

      if (!user) {
        setRegistrations([]);
        setSubmissions([]);
        setQuizScores([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // 1. Listen for public participants
      unsubParticipants = onSnapshot(
        collection(db, "event_participants_public"),
        (snap) => {
          const regs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
          setRegistrations(regs);
          setLoading(false);
        },
        (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.LIST, "event_participants_public");
          }
          setLoading(false);
        }
      );

      // 2. Listen for completions (publicly visible)
      unsubCompletions = onSnapshot(
        collection(db, "completions"),
        (snap) => {
          const subs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
          setSubmissions(subs);
          setLoading(false);
        },
        (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.LIST, "completions");
          }
          setLoading(false);
        }
      );

      // 3. Quiz scores - restrict reader query to current user isOwner rules, unless they are admin
      const isAdminUser = checkIsAdmin(null, user.email);
      const qQuiz = isAdminUser
        ? collection(db, "quiz_attempts")
        : query(collection(db, "quiz_attempts"), where("userId", "==", user.uid));

      unsubQuiz = onSnapshot(
        qQuiz,
        (snap) => {
          const scores = snap.docs.map(doc => ({ 
            id: doc.id, 
            userEmail: doc.data().userId, // Using userId as email placeholder
            score: doc.data().score,
            timestamp: doc.data().submittedAt
          } as QuizScore));
          setQuizScores(scores);
          setLoading(false);
        },
        (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.LIST, "quiz_attempts");
          }
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubParticipants();
      unsubCompletions();
      unsubQuiz();
    };
  }, []);

  const addRegistration = useCallback((reg: Registration) => {
    // No-op for local state, as onSnapshot handles it
  }, []);

  const addSubmission = useCallback((sub: Submission) => {
    // No-op for local state, as onSnapshot handles it
  }, []);

  const addQuizScore = useCallback((score: QuizScore) => {
    // No-op for local state, as onSnapshot handles it
  }, []);

  const getUserPoints = (userId: string) => {
    const subPoints = submissions
      .filter(s => s.userId === userId)
      .reduce((total, s) => total + s.points, 0);
    const quizPoints = quizScores
      .filter(q => q.userEmail === userId) // quiz_attempts uses userId as userEmail in my previous edit
      .reduce((total, q) => total + q.score, 0);
    return subPoints + quizPoints;
  };

  const isUserRegistered = (eventId: string) => {
    return registrations.some(r => r.userId === auth.currentUser?.uid && r.eventId === eventId);
  };

  return {
    registrations,
    submissions,
    quizScores,
    loading,
    addRegistration,
    addSubmission,
    addQuizScore,
    getUserPoints,
    isUserRegistered
  };
};
