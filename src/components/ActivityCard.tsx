import { useMutation } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import type { PrioritizedActivity } from "../lib/prioritization";
import {
  CATEGORY_ICONS,
  formatTimeRemaining,
  energyDots,
} from "../lib/constants";

interface ActivityCardProps {
  item: PrioritizedActivity;
  mentalEnergy: number;
  physicalEnergy: number;
}

export function ActivityCard({
  item,
  mentalEnergy,
  physicalEnergy,
}: ActivityCardProps) {
  const logSession = useMutation(api.sessions.log);
  const { activity, section, cooldownRemainingMs, recentFrequency } = item;
  const Icon = CATEGORY_ICONS[activity.category];

  const handleDo = async () => {
    await logSession({
      activityId: activity._id,
      mentalEnergyCostAtTime: mentalEnergy,
      physicalEnergyCostAtTime: physicalEnergy,
    });
  };

  const isAvailable = section === "available";

  return (
    <div
      className={`rounded-xl p-4 mb-3 border ${
        isAvailable
          ? "bg-base-850 border-base-700"
          : "bg-base-900/50 border-base-800/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <Link
          to="/activities/$activityId"
          params={{ activityId: activity._id }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            {Icon && <Icon size={20} className={isAvailable ? "text-base-300" : "text-base-600"} />}
            <span
              className={`text-base font-medium ${isAvailable ? "text-base-50" : "text-base-400"}`}
            >
              {activity.name}
            </span>
            {item.sessionCount > 0 && (
              <span className="text-sm text-base-500">#{item.sessionCount}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-base-400">
            <span className="flex items-center gap-2">
              <span className="text-red-400/70">{energyDots(activity.physicalEnergyCost)}</span>
              <span className="text-emerald-400/70">{energyDots(activity.mentalEnergyCost)}</span>
            </span>
            <span className="text-base-600">&middot;</span>
            <span>
              {section === "cooldown" && cooldownRemainingMs
                ? `in ${formatTimeRemaining(cooldownRemainingMs)}`
                : section === "too_tired"
                  ? needsText(activity, mentalEnergy, physicalEnergy)
                  : recentFrequency}
            </span>
          </div>
        </Link>
        {isAvailable && (
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="text-base-500 text-sm tabular-nums">
              {item.score.toFixed(2)}
            </span>
            <button
              onClick={handleDo}
              className="bg-accent/90 hover:bg-accent text-base-950 text-base font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Do
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function needsText(
  activity: { mentalEnergyCost: number; physicalEnergyCost: number },
  mentalEnergy: number,
  physicalEnergy: number
): string {
  const parts = [];
  if (activity.mentalEnergyCost > mentalEnergy)
    parts.push(`mental ${activity.mentalEnergyCost}`);
  if (activity.physicalEnergyCost > physicalEnergy)
    parts.push(`physical ${activity.physicalEnergyCost}`);
  return `Needs ${parts.join(" + ")}`;
}
