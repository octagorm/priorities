import { formatTimerDisplay } from "../lib/constants";
import type { TimerPhase } from "../lib/useTimer";
import { Pause, Play, Minimize2, Square, Shell, Apple, Coffee } from "lucide-react";

interface TimerScreenProps {
  activityName: string;
  remainingMs: number;
  totalElapsedMs: number;
  phase: TimerPhase;
  isPaused: boolean;
  completedPomodoros: number;
  onPause: () => void;
  onResume: () => void;
  onMinimize: () => void;
  onStop: () => void;
}

const PHASE_ICON = {
  work: Apple,
  break: Coffee,
  meditation: Shell,
} as const;

export function TimerScreen({
  activityName,
  remainingMs,
  totalElapsedMs,
  phase,
  isPaused,
  completedPomodoros,
  onPause,
  onResume,
  onMinimize,
  onStop,
}: TimerScreenProps) {
  const PhaseIcon = PHASE_ICON[phase];
  const displayMs = phase === "meditation" ? totalElapsedMs : remainingMs;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <PhaseIcon size={24} className="text-base-500 mb-3" />
      <h2 className="text-lg font-medium text-base-200 mb-8">{activityName}</h2>

      <div className="text-6xl font-light text-base-50 tabular-nums mb-12 font-mono">
        {formatTimerDisplay(displayMs)}
      </div>

      {completedPomodoros > 0 && (phase === "work" || phase === "break") && (
        <p className="text-base-500 text-sm mb-8 -mt-8">
          {completedPomodoros} {completedPomodoros === 1 ? "pomodoro" : "pomodoros"} completed
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={onStop}
          className="w-12 h-12 rounded-full border border-base-700 bg-base-850 flex items-center justify-center text-base-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
          title="Stop"
        >
          <Square size={18} />
        </button>

        <button
          onClick={isPaused ? onResume : onPause}
          className="w-16 h-16 rounded-full bg-accent/90 hover:bg-accent flex items-center justify-center text-base-950 transition-colors"
        >
          {isPaused ? <Play size={24} /> : <Pause size={24} />}
        </button>

        <button
          onClick={onMinimize}
          className="w-12 h-12 rounded-full border border-base-700 bg-base-850 flex items-center justify-center text-base-400 hover:text-base-200 hover:border-base-500 transition-colors"
          title="Minimize"
        >
          <Minimize2 size={18} />
        </button>
      </div>
    </div>
  );
}
