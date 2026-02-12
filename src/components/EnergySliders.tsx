import type { LucideIcon } from "lucide-react";
import { MAX_ENERGY, MentalIcon, PhysicalIcon } from "../lib/constants";

interface EnergySlidersProps {
  mentalEnergy: number;
  physicalEnergy: number;
  onMentalChange: (v: number) => void;
  onPhysicalChange: (v: number) => void;
}

function EnergyButtons({
  icon: Icon,
  value,
  onChange,
  activeColor,
  activeBorder,
}: {
  icon: LucideIcon;
  value: number;
  onChange: (v: number) => void;
  activeColor: string;
  activeBorder: string;
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: MAX_ENERGY }, (_, i) => i + 1).map((level) => {
        const isActive = level <= value;
        return (
          <button
            key={level}
            onClick={() => onChange(level === value ? level - 1 : level)}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
              isActive
                ? `${activeColor} ${activeBorder}`
                : "bg-base-850 border-base-700"
            }`}
          >
            <Icon
              size={16}
              className={isActive ? "text-base-200" : "text-base-600"}
            />
          </button>
        );
      })}
    </div>
  );
}

export function EnergySliders({
  mentalEnergy,
  physicalEnergy,
  onMentalChange,
  onPhysicalChange,
}: EnergySlidersProps) {
  return (
    <div className="flex items-center gap-6 py-3">
      <EnergyButtons
        icon={PhysicalIcon}
        value={physicalEnergy}
        onChange={onPhysicalChange}
        activeColor="bg-red-500/30"
        activeBorder="border-red-400/40"
      />
      <EnergyButtons
        icon={MentalIcon}
        value={mentalEnergy}
        onChange={onMentalChange}
        activeColor="bg-emerald-500/30"
        activeBorder="border-emerald-400/40"
      />
    </div>
  );
}
