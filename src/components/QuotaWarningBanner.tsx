import { useState, useEffect } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";

export default function QuotaWarningBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleQuotaExceeded = (e: any) => {
      setShowBanner(true);
      if (e.detail?.originalError) {
        setErrorMessage(e.detail.originalError);
      }
    };

    window.addEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    return () => {
      window.removeEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    };
  }, []);

  if (!showBanner) return null;

  const projectId = "gen-lang-client-0940566692";
  const databaseId = "ai-studio-f8852c1b-8e2f-48c8-87d9-cde479c4a402";
  const upgradeUrl = `https://console.firebase.google.com/project/${projectId}/firestore/databases/${databaseId}/data?openUpgradeDialog=true`;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-amber-950 dark:text-amber-100">
              Firestore Daily Free-Tier Quota Reached
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              The daily free read limit for your database has been exceeded. Free read units reset daily at midnight PST.
            </p>
            {errorMessage && (
              <p className="text-xs font-mono opacity-80 max-w-2xl truncate">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
          >
            Manage / Upgrade Quota
            <ExternalLink size={13} />
          </a>
          <button
            onClick={() => setShowBanner(false)}
            className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors"
            title="Dismiss notice"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
