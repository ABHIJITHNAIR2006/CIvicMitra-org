import { memo } from "react";
import { cn } from "../lib/utils";

const colorMap: Record<string, string> = {
  green:  "bg-green-500/10 text-green-700 border border-green-200",
  yellow: "bg-yellow-500/10 text-yellow-700 border border-yellow-200",
  blue:   "bg-blue-500/10 text-blue-700 border border-blue-200",
  orange: "bg-orange-500/10 text-orange-700 border border-orange-200",
};

interface ImpactCardProps {
  icon: string;
  label: string;
  value: string;
  sublabel: string;
  color: "green" | "yellow" | "blue" | "orange";
}

const ImpactCard = memo(({ icon, label, value, sublabel, color }: ImpactCardProps) => (
  <div className={cn(
    "rounded-3xl p-6 card-shadow flex flex-col gap-3",
    colorMap[color]
  )}>
    <span className="text-3xl">{icon}</span>
    <div>
      <p className="text-xs font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-2xl font-display font-bold mt-1">{value}</p>
      <p className="text-xs opacity-50 mt-0.5">{sublabel}</p>
    </div>
  </div>
));

export default ImpactCard;
