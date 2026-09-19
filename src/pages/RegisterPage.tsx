import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { signInWithGoogle } from "../lib/auth-utils";
import { handleFirestoreError, OperationType } from "../lib/firestore-guard";
import { syncUserToAllUsers, setCurrentSocialUser } from "../lib/social-utils";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";
import { UserPlus, Mail, Lock, User, MapPin } from "lucide-react";
import { Role } from "../types";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    city: "",
    country: "India"
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Create user profile in Firestore
      const userProfile = {
        uid: user.uid,
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        city: formData.city,
        country: formData.country,
        points: 0,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        experiencePoints: 0,
        role: Role.USER,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", user.uid), userProfile).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`));

      // Sync to social state
      setCurrentSocialUser(userProfile);

      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Registration Error:", error);
      let message = "Failed to register";
      if (error.code === 'auth/operation-not-allowed') {
        message = "Email/Password sign-in is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.";
      } else {
        message = error.message || message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      let message = "Failed to sign in with Google";
      
      if (error.code === 'auth/popup-blocked') {
        message = "Popup blocked by browser. Please allow popups for this site.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "Sign-in popup closed before completion.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "This domain is not authorized for Google Sign-In. Please check Firebase Console.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "Google Sign-In is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.";
      } else {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) message = `Profile Error: ${parsed.error}`;
        } catch {
          message = error.message || message;
        }
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-card p-8 rounded-3xl card-shadow border border-primary/10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserPlus className="text-primary" size={32} />
          </div>
          <h1 className="text-3xl text-text-primary">Join CivicMitra</h1>
          <p className="text-text-secondary">Start your sustainable journey today</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="Full Name" 
              icon={<User size={20} />} 
              value={formData.fullName}
              onChange={(v) => setFormData({...formData, fullName: v})}
              placeholder="John Doe"
            />
            <InputField 
              label="Username" 
              icon={<User size={20} />} 
              value={formData.username}
              onChange={(v) => setFormData({...formData, username: v})}
              placeholder="johndoe"
            />
          </div>

          <InputField 
            label="Email" 
            type="email"
            icon={<Mail size={20} />} 
            value={formData.email}
            onChange={(v) => setFormData({...formData, email: v})}
            placeholder="you@example.com"
          />

          <InputField 
            label="Password" 
            type="password"
            icon={<Lock size={20} />} 
            value={formData.password}
            onChange={(v) => setFormData({...formData, password: v})}
            placeholder="••••••••"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="City" 
              icon={<MapPin size={20} />} 
              value={formData.city}
              onChange={(v) => setFormData({...formData, city: v})}
              placeholder="Mumbai"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Country</label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
                className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-primary"
              >
                <option value="India" className="bg-card">India</option>
                <option value="USA" className="bg-card">USA</option>
                <option value="UK" className="bg-card">UK</option>
                <option value="Canada" className="bg-card">Canada</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg disabled:opacity-50 mt-4"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-text-secondary">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-card border border-primary/10 rounded-xl font-bold text-text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>

        <p className="mt-8 text-center text-text-secondary">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function InputField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50">
          {icon}
        </div>
        <input
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-primary"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
