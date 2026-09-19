import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { handleFirestoreError, OperationType } from "./firestore-guard";
import { Role } from "../types";

export const ADMIN_EMAIL = "arcadeabhi6@gmail.com";

export const checkIsAdmin = (role?: string | null, email?: string | null): boolean => {
  return role === Role.ADMIN || (!!email && email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase());
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  try {
    // Check if user profile exists
    const userDoc = await getDoc(doc(db, "users", user.uid)).catch(e => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));
    
    if (userDoc && !userDoc.exists()) {
      // Create user profile if it doesn't exist
      const isAdmin = checkIsAdmin(null, user.email);
      const username = user.email?.split('@')[0] || `user_${user.uid.slice(0, 5)}`;
      const fullName = user.displayName || "Eco Warrior";
      const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

      const userData: any = {
        uid: user.uid,
        username: username,
        email: user.email,
        fullName: fullName,
        avatarUrl: avatarUrl,
        city: "Unknown",
        country: "Unknown",
        points: 0,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        experiencePoints: 0,
        role: isAdmin ? Role.ADMIN : Role.USER,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", user.uid), userData).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`));
    }
  } catch (error) {
    console.error("Error during profile sync:", error);
    // We don't necessarily want to block the login if profile sync fails, 
    // but we should at least log it. However, the app depends on the profile.
    throw error;
  }

  return user;
};
