import { formatTimerDisplay } from "../lib/constants";
import type { TimerPhase } from "../lib/useTimer";
import { Shell, Apple, Coffee } from "lucide-react";

interface MinimizedTimerProps {
  activityName: string;
  remainingMs: number;
  totalElapsedMs: number;
  phase: TimerPhase;
  isPaused: boolean;
  onMaximize: () => void;
}

const PHASE_ICON = {
  work: Apple,
  break: Coffee,
  meditation: Shell,
} as const;

export function MinimizedTimer({
  activityName,
  remainingMs,
  totalElapsedMs,
  phase,
  isPaused,
  onMaximize,
}: MinimizedTimerProps) {
  const PhaseIcon = PHASE_ICON[phase];
  const displayMs = phase === "meditation" ? totalElapsedMs : remainingMs;
  return (
    <button
      onClick={onMaximize}
      className="w-full bg-accent/15 border-t border-accent/30 px-4 py-2.5 flex items-center gap-3 text-left"
    >
      <PhaseIcon size={16} className="text-accent shrink-0" />
      <span className="text-base-200 text-sm flex-1 truncate">{activityName}</span>
      <span className="text-accent font-mono text-sm tabular-nums">
        {formatTimerDisplay(displayMs)}
      </span>
      {isPaused && (
        <span className="text-base-500 text-xs">Paused</span>
      )}
    </button>
  );
}
