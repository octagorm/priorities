import { useMutation } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import type { PrioritizedActivity } from "../lib/prioritization";
import {
  CATEGORY_ICONS,
  formatTimeSince,
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
  const { activity, section, timeSinceLastMs, cooldownRemainingMs, sessionCount } = item;
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
      className={`rounded-lg p-3 mb-2 ${
        isAvailable ? "bg-base-900" : "bg-base-900/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <Link
          to="/activities/$activityId"
          params={{ activityId: activity._id }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {Icon && <Icon size={16} className={isAvailable ? "text-base-400" : "text-base-600"} />}
            <span
              className={`font-medium ${isAvailable ? "text-base-100" : "text-base-400"}`}
            >
              {activity.name}
            </span>
            {sessionCount > 0 && (
              <span className="text-xs text-base-600">#{sessionCount}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-base-500">
            <span className="flex items-center gap-1.5">
              <span className="text-red-400/60">{energyDots(activity.physicalEnergyCost)}</span>
              <span className="text-emerald-400/60">{energyDots(activity.mentalEnergyCost)}</span>
            </span>
            <span className="text-base-600">&middot;</span>
            <span>
              {section === "cooldown" && cooldownRemainingMs
                ? `in ${formatTimeRemaining(cooldownRemainingMs)}`
                : section === "too_tired"
                  ? needsText(activity, mentalEnergy, physicalEnergy)
                  : formatTimeSince(timeSinceLastMs)}
            </span>
          </div>
        </Link>
        {isAvailable && (
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {import.meta.env.DEV && (
              <span className="text-base-600 text-xs tabular-nums">
                {item.score.toFixed(2)}
              </span>
            )}
            <button
              onClick={handleDo}
              className="bg-accent/90 hover:bg-accent text-base-950 text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
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
