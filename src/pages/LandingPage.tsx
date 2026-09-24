import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Leaf, Trophy, Users, Zap, Calendar } from "lucide-react";

export default function LandingPage() {
  // State for live date display
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    // Format current date e.g., "Thursday, September 24, 2026"
    const updateDate = () => {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
      setCurrentDate(new Date().toLocaleDateString(undefined, options));
    };

    updateDate();
    
    // Check every hour if the day changed (in case page stays open overnight)
    const timer = setInterval(updateDate, 1000 * 60 * 60);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-primary/10"
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: -100, 
                rotate: 0 
              }}
              animate={{ 
                y: window.innerHeight + 100, 
                rotate: 360,
                x: (Math.random() - 0.5) * 200 + (Math.random() * window.innerWidth)
              }}
              transition={{ 
                duration: 10 + Math.random() * 20, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            >
              <Leaf size={24 + Math.random() * 48} />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 max-w-4xl"
        >
          {/* Current Date Widget Added Here */}
          {currentDate && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-card/80 backdrop-blur-md border border-primary/15 shadow-sm mb-8 text-sm font-medium text-text-secondary"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <Calendar size={15} className="text-primary" />
              <span>{currentDate}</span>
            </motion.div>
          )}

          <h1 className="text-6xl md:text-8xl mb-6 tracking-tight">
            Small habits. <span className="text-primary">Big planet.</span>
          </h1>

          <p className="text-xl md:text-2xl text-text-secondary mb-10 max-w-2xl mx-auto">
            Turn sustainable living into a game. Complete challenges, earn points, and save the world one habit at a time.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/register"
              className="px-10 py-4 bg-primary text-white rounded-full text-lg font-bold hover:bg-primary-light transition-all hover:scale-105 shadow-lg shadow-primary/20"
            >
              Start Your Eco Journey
            </Link>
            <Link
              to="/login"
              className="px-10 py-4 bg-card text-primary border-2 border-primary rounded-full text-lg font-bold hover:bg-primary/5 transition-all hover:scale-105"
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-card border-t border-primary/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl text-center mb-16 text-text-primary">Why CivicMitra?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="text-accent" />}
              title="Daily Challenges"
              description="New eco-friendly tasks every day to keep you engaged and making an impact."
            />
            <FeatureCard 
              icon={<Trophy className="text-primary" />}
              title="Gamified Rewards"
              description="Earn points, unlock badges, and climb the leaderboard as you complete habits."
            />
            <FeatureCard 
              icon={<Users className="text-primary-light" />}
              title="Community Impact"
              description="Join events, follow friends, and see the collective difference we're making."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-8 rounded-2xl bg-background border border-primary/10 card-shadow"
    >
      <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center mb-6 shadow-sm border border-primary/5">
        {icon}
      </div>
      <h3 className="text-xl mb-3 text-text-primary">{title}</h3>
      <p className="text-text-secondary leading-relaxed">{description}</p>
    </motion.div>
  );
}
