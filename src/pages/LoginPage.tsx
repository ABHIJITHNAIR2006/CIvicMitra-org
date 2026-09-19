import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { signInWithGoogle } from "../lib/auth-utils";
import { setCurrentSocialUser } from "../lib/social-utils";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";
import { LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Fetch profile to sync
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        setCurrentSocialUser(userSnap.data());
      } else {
        setCurrentSocialUser({ uid: user.uid, email: user.email, username: user.email?.split('@')[0] });
      }

      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = "Failed to login";
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
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      let message = "Failed to sign in with Google";
      
      // Handle Firebase Auth errors
      if (error.code === 'auth/popup-blocked') {
        message = "Popup blocked by browser. Please allow popups for this site.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "Sign-in popup closed before completion.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "This domain is not authorized for Google Sign-In. Please check Firebase Console.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "Google Sign-In is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.";
      } else {
        // Handle custom Firestore errors (JSON strings)
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card p-8 rounded-3xl card-shadow border border-primary/10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="text-primary" size={32} />
          </div>
          <h1 className="text-3xl text-text-primary">Welcome Back</h1>
          <p className="text-text-secondary">Ready for your next eco-challenge?</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" size={20} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-primary"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-primary/5 border border-primary/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-primary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/50 hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
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

        <div className="mt-8 text-center space-y-4">
          <p className="text-text-secondary">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-bold hover:underline">
              Register Now
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
