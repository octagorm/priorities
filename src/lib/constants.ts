import type { LucideIcon } from "lucide-react";
import {
  DraftingCompass,
  PenLine,
  BookOpen,
  Clapperboard,
  Drama,
  Music,
  BringToFront,
  Flame,
  BrushCleaning,
  Brain,
  BicepsFlexed,
} from "lucide-react";

export const MAX_ENERGY = 3;

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Projects: DraftingCompass,
  Writing: PenLine,
  Reading: BookOpen,
  Entertainment: Clapperboard,
  RPG: Drama,
  Skills: Music,
  Habits: BringToFront,
  Challenges: Flame,
  Chores: BrushCleaning,
};

export const CATEGORIES = Object.keys(CATEGORY_ICONS);

export const MentalIcon = Brain;
export const PhysicalIcon = BicepsFlexed;

export function formatTimeSince(ms: number | null): string {
  if (ms === null) return "Never done";
  const hours = ms / 3600_000;
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function formatTimeRemaining(ms: number): string {
  const hours = ms / 3600_000;
  if (hours < 1) return `${Math.ceil(ms / 60_000)}m`;
  if (hours < 24) return `${Math.ceil(hours)}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
}

export function energyDots(cost: number): string {
  const clamped = Math.min(cost, MAX_ENERGY);
  return "\u{25CF}".repeat(clamped) + "\u{25CB}".repeat(MAX_ENERGY - clamped);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatTimerDisplay(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
