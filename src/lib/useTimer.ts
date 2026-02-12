import { useState, useEffect, useRef, useCallback } from "react";

export type TimerPhase = "work" | "break" | "meditation";

export interface TimerSettings {
  type: "pomodoro" | "meditation";
  workMinutes?: number;
  breakMinutes?: number;
  durationMinutes?: number;     // meditation: first gong after this many minutes
  gongIntervalMinutes?: number; // meditation: gong every N minutes after first
}

interface UseTimerOptions {
  onComplete: () => void;
  onGong: () => void;
  onPhaseChange: (phase: TimerPhase, prevPhase: TimerPhase) => void;
}

export function useTimer({ onComplete, onGong, onPhaseChange }: UseTimerOptions) {
  const settingsRef = useRef<TimerSettings>({ type: "pomodoro" });
  const workerRef = useRef<Worker | null>(null);

  // For pomodoro: counts down. For meditation: counts up.
  const [remainingMs, setRemainingMs] = useState(0);
  const [totalElapsedMs, setTotalElapsedMs] = useState(0);
  const [phase, setPhase] = useState<TimerPhase>("work");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);

  const lastGongRef = useRef(0);
  const phaseRef = useRef<TimerPhase>("work");
  const onCompleteRef = useRef(onComplete);
  const onGongRef = useRef(onGong);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onCompleteRef.current = onComplete;
  onGongRef.current = onGong;
  onPhaseChangeRef.current = onPhaseChange;

  // Create worker on mount
  useEffect(() => {
    const worker = new Worker("/timer-worker.js");
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Handle ticks from worker — no React state in closure, use refs for reads
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    const handleTick = () => {
      if (!isRunning || isPaused) return;
      const settings = settingsRef.current;

      if (settings.type === "meditation") {
        // Meditation: count UP
        setTotalElapsedMs((prev) => {
          const next = prev + 1000;

          // Gong logic: first gong at durationMinutes, then every gongIntervalMinutes
          const firstGongMs = (settings.durationMinutes ?? 15) * 60_000;
          const intervalMs = (settings.gongIntervalMinutes ?? 10) * 60_000;

          let gongCount = 0;
          if (next >= firstGongMs) {
            gongCount = 1 + Math.floor((next - firstGongMs) / intervalMs);
          }
          if (gongCount > lastGongRef.current) {
            lastGongRef.current = gongCount;
            onGongRef.current();
          }

          return next;
        });
      } else {
        // Pomodoro: count DOWN
        // Use refs for phase to avoid stale closures; keep side effects out of updaters
        setRemainingMs((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            const currentPhase = phaseRef.current;
            if (currentPhase === "work") {
              phaseRef.current = "break";
              setPhase("break");
              setCompletedPomodoros((c) => c + 1);
              onPhaseChangeRef.current("break", "work");
              return (settings.breakMinutes ?? 5) * 60_000;
            } else {
              phaseRef.current = "work";
              setPhase("work");
              onPhaseChangeRef.current("work", "break");
              return (settings.workMinutes ?? 25) * 60_000;
            }
          }
          return next;
        });
        setTotalElapsedMs((e) => e + 1000);
      }
    };

    worker.onmessage = handleTick;
  }, [isRunning, isPaused]);

  // Start/stop worker based on running state
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (isRunning && !isPaused) {
      worker.postMessage("start");
    } else {
      worker.postMessage("stop");
    }
  }, [isRunning, isPaused]);

  const start = useCallback((settings: TimerSettings) => {
    settingsRef.current = settings;
    if (settings.type === "meditation") {
      setRemainingMs(0);
      setPhase("meditation");
      phaseRef.current = "meditation";
    } else {
      const initialMs = (settings.workMinutes ?? 25) * 60_000;
      setRemainingMs(initialMs);
      setPhase("work");
      phaseRef.current = "work";
    }
    setIsRunning(true);
    setIsPaused(false);
    setTotalElapsedMs(0);
    setCompletedPomodoros(0);
    lastGongRef.current = 0;
  }, []);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  return { remainingMs, phase, isRunning, isPaused, totalElapsedMs, completedPomodoros, start, pause, resume, stop };
}
