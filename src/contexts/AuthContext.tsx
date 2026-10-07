import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile, Role } from "../types";
import { checkIsAdmin } from "../lib/auth-utils";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setProfile(data);

            // One-time backfill usernames mapping if missing
            if (data.username) {
              const usernameLower = data.username.toLowerCase().trim();
              try {
                const unameDoc = await getDoc(doc(db, "usernames", usernameLower));
                if (!unameDoc.exists()) {
                  await setDoc(doc(db, "usernames", usernameLower), {
                    uid: firebaseUser.uid,
                    email: (data.email || firebaseUser.email || "").toLowerCase().trim()
                  });
                }
              } catch (e) {
                console.warn("Backfill usernames doc failed in AuthContext:", e);
              }
            }
          } else {
            // Profile does not exist (e.g. old account) - create fallback profile
            const rawUsername = firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.slice(0, 5)}`;
            const username = rawUsername.toLowerCase().trim();
            const isAdmin = checkIsAdmin(null, firebaseUser.email);
            const userEmail = (firebaseUser.email || "").toLowerCase().trim();

            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              username: username,
              email: userEmail,
              fullName: firebaseUser.displayName || "Eco Warrior",
              city: "Unknown",
              country: "India",
              points: 0,
              totalPoints: 0,
              currentStreak: 0,
              longestStreak: 0,
              level: 1,
              experiencePoints: 0,
              role: isAdmin ? Role.ADMIN : Role.USER,
              createdAt: new Date().toISOString()
            };

            await setDoc(userDocRef, fallbackProfile).catch((e) => console.error("Failed to create fallback profile:", e));
            setProfile(fallbackProfile);

            // Backfill username doc
            try {
              const unameDoc = await getDoc(doc(db, "usernames", username));
              if (!unameDoc.exists()) {
                await setDoc(doc(db, "usernames", username), {
                  uid: firebaseUser.uid,
                  email: userEmail
                });
              }
            } catch (e) {
              console.warn("Backfill usernames doc failed in AuthContext fallback:", e);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = checkIsAdmin(profile?.role, user?.email);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
