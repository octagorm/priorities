import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Shell, Apple, List } from "lucide-react";
import { EnergySliders } from "../components/EnergySliders";
import { ActivityCard } from "../components/ActivityCard";
import { TimerScreen } from "../components/TimerScreen";
import { MinimizedTimer } from "../components/MinimizedTimer";
import { prioritizeActivities } from "../lib/prioritization";
import { CATEGORY_ICONS, formatTimeRemaining } from "../lib/constants";
import { useTimer } from "../lib/useTimer";
import { playSound } from "../lib/audio";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: search.q as string | undefined,
  }),
  component: MainScreen,
});

function MainScreen() {
  const { q = "" } = Route.useSearch();
  const activities = useQuery(api.activities.list);
  const sessions = useQuery(api.sessions.listRecent);
  const seed = useMutation(api.activities.seedDefaultActivities);
  const logSession = useMutation(api.sessions.log);

  const [mentalEnergy, setMentalEnergy] = useState(() => {
    const saved = localStorage.getItem("mentalEnergy");
    return saved ? Number(saved) : 2;
  });
  const [physicalEnergy, setPhysicalEnergy] = useState(() => {
    const saved = localStorage.getItem("physicalEnergy");
    return saved ? Number(saved) : 1;
  });

  useEffect(() => { localStorage.setItem("mentalEnergy", String(mentalEnergy)); }, [mentalEnergy]);
  useEffect(() => { localStorage.setItem("physicalEnergy", String(physicalEnergy)); }, [physicalEnergy]);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [showMore, setShowMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(q);
  const searchRef = useRef<HTMLInputElement>(null);

  // Simple doing state (no timer)
  const [doingActivity, setDoingActivity] = useState<string | null>(null);

  // Timer state
  const [timerActivity, setTimerActivity] = useState<Doc<"activities"> | null>(null);
  const [timerMinimized, setTimerMinimized] = useState(false);

  const timerActivityRef = useRef(timerActivity);
  timerActivityRef.current = timerActivity;
  const mentalEnergyRef = useRef(mentalEnergy);
  mentalEnergyRef.current = mentalEnergy;
  const physicalEnergyRef = useRef(physicalEnergy);
  physicalEnergyRef.current = physicalEnergy;
  const totalElapsedRef = useRef(0);

  const handleTimerComplete = useCallback(() => {
    const act = timerActivityRef.current;
    if (!act) return;
    logSession({
      activityId: act._id,
      mentalEnergyCostAtTime: mentalEnergyRef.current,
      physicalEnergyCostAtTime: physicalEnergyRef.current,
      durationMs: totalElapsedRef.current,
    });
    setTimerActivity(null);
    setTimerMinimized(false);
  }, [logSession]);

  const handleGong = useCallback(() => {
    const act = timerActivityRef.current;
    if (act?.timerSettings?.type === "meditation") {
      playSound("gong.mp3");
    } else {
      playSound("bell.mp3");
    }
  }, []);

  const handlePhaseChange = useCallback((_phase: string, prevPhase: string) => {
    if (prevPhase === "work") {
      playSound("bell.mp3");         // work done → break
    } else {
      playSound("bell-reverse.mp3"); // break done → back to work
    }
  }, []);

  const timer = useTimer({
    onComplete: handleTimerComplete,
    onGong: handleGong,
    onPhaseChange: handlePhaseChange,
  });
  totalElapsedRef.current = timer.totalElapsedMs;

  const [doingActivityFull, setDoingActivityFull] = useState<Doc<"activities"> | null>(null);

  const handleMarkDone = useCallback(() => {
    const act = doingActivityFull;
    if (act) {
      logSession({
        activityId: act._id,
        mentalEnergyCostAtTime: mentalEnergyRef.current,
        physicalEnergyCostAtTime: physicalEnergyRef.current,
      });
    }
    setDoingActivity(null);
    setDoingActivityFull(null);
  }, [doingActivityFull, logSession]);

  const handleCancelDoing = () => {
    setDoingActivity(null);
    setDoingActivityFull(null);
  };

  const handleDo = (activity: Doc<"activities">) => {
    setDoingActivity(activity.name);
    setDoingActivityFull(activity);
  };

  const handleStartTimer = () => {
    if (!doingActivityFull?.timerSettings) return;
    setDoingActivity(null);
    setTimerActivity(doingActivityFull);
    setDoingActivityFull(null);
    setTimerMinimized(false);
    timer.start(doingActivityFull.timerSettings);
  };

  // Auto-mark-done after 2 minutes for non-timer doing screen
  const handleMarkDoneRef = useRef(handleMarkDone);
  handleMarkDoneRef.current = handleMarkDone;
  useEffect(() => {
    if (!doingActivity) return;
    const timeout = setTimeout(() => {
      handleMarkDoneRef.current();
    }, 2 * 60_000);
    return () => clearTimeout(timeout);
  }, [doingActivity]);

  const handleTimerStop = () => {
    // Both timers are infinite — stopping is how you finish, so log the session
    const act = timerActivityRef.current;
    if (act && totalElapsedRef.current > 0) {
      logSession({
        activityId: act._id,
        mentalEnergyCostAtTime: mentalEnergyRef.current,
        physicalEnergyCostAtTime: physicalEnergyRef.current,
        durationMs: totalElapsedRef.current,
      });
    }
    timer.stop();
    setTimerActivity(null);
    setTimerMinimized(false);
  };

  // Seed on first load
  useEffect(() => {
    if (activities !== undefined && activities.length === 0) {
      seed();
    }
  }, [activities, seed]);

  // Update hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (activities === undefined || sessions === undefined) {
    return <div className="pt-8 text-base-400 text-center">Loading...</div>;
  }

  const now = Date.now();
  const pausedActivities = activities.filter(
    (a) => a.pausedUntil && a.pausedUntil > now
  );
  const activeActivities = activities.filter(
    (a) => !a.pausedUntil || a.pausedUntil <= now
  );

  const prioritized = prioritizeActivities(
    activeActivities,
    sessions,
    mentalEnergy,
    physicalEnergy,
    currentHour
  );

  const moreCount = Math.max(0, prioritized.available.length - 3);
  const beyondCount = prioritized.too_tired.length + prioritized.wrong_time.length + pausedActivities.length;

  const query = searchQuery.toLowerCase().trim();
  const searchResults = query
    ? activities.filter((a) => a.name.toLowerCase().includes(query))
    : [];

  // Full-screen timer
  if (timerActivity && timer.isRunning && !timerMinimized) {
    return (
      <div className="pt-4">
        <TimerScreen
          activityName={timerActivity.name}
          remainingMs={timer.remainingMs}
          totalElapsedMs={timer.totalElapsedMs}
          phase={timer.phase}
          isPaused={timer.isPaused}
          completedPomodoros={timer.completedPomodoros}
          onPause={timer.pause}
          onResume={timer.resume}
          onMinimize={() => setTimerMinimized(true)}
          onStop={handleTimerStop}
        />
        <div className="h-20" />
        <div className="fixed bottom-0 left-0 right-0 bg-base-950/90 backdrop-blur border-t border-base-800 px-4 py-3 flex justify-center max-w-lg mx-auto">
          <EnergySliders
            mentalEnergy={mentalEnergy}
            physicalEnergy={physicalEnergy}
            onMentalChange={setMentalEnergy}
            onPhysicalChange={setPhysicalEnergy}
          />
        </div>
      </div>
    );
  }

  // Simple doing screen (no timer)
  if (doingActivity) {
    return (
      <div className="pt-4">
        <DoingScreen
          activityName={doingActivity}
          timerSettings={doingActivityFull?.timerSettings}
          onMarkDone={handleMarkDone}
          onCancel={handleCancelDoing}
          onStartTimer={handleStartTimer}
        />
        <div className="h-20" />
        <div className="fixed bottom-0 left-0 right-0 bg-base-950/90 backdrop-blur border-t border-base-800 px-4 py-3 flex justify-center max-w-lg mx-auto">
          <EnergySliders
            mentalEnergy={mentalEnergy}
            physicalEnergy={physicalEnergy}
            onMentalChange={setMentalEnergy}
            onPhysicalChange={setPhysicalEnergy}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 mb-2">
        <Link
          to="/list"
          search={searchQuery ? { q: searchQuery } : { q: undefined }}
          className="text-base-500 hover:text-base-300 transition-colors shrink-0"
        >
          <List size={22} />
        </Link>
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities..."
            className="w-full bg-base-900 text-base-100 rounded-xl pl-10 pr-9 py-2.5 border border-base-700 focus:border-accent focus:outline-none text-sm placeholder:text-base-600"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-500 hover:text-base-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {query && (
        <div className="mb-4">
          {searchResults.length === 0 ? (
            <p className="text-base-500 text-sm text-center py-4">No matches</p>
          ) : (
            searchResults.map((a) => {
              const AIcon = CATEGORY_ICONS[a.category];
              return (
                <Link
                  key={a._id}
                  to="/activities/$activityId"
                  params={{ activityId: a._id }}
                  className="flex items-center gap-2.5 bg-base-850 border border-base-700 rounded-xl px-4 py-3 mb-3"
                >
                  {AIcon && <AIcon size={20} className="text-base-300" />}
                  <span className="text-base text-base-50 flex-1">{a.name}</span>
                  <span className="text-sm text-base-500">{a.category}</span>
                </Link>
              );
            })
          )}
        </div>
      )}

      {!query && prioritized.available.length > 0 && (
        <Section
          title="What to do now"
          action={
            <Link
              to="/activities/$activityId"
              params={{ activityId: "new" }}
              className="text-base-400 text-sm tracking-wider"
            >
              + Add
            </Link>
          }
        >
          {prioritized.available.slice(0, 3).map((item) => (
            <ActivityCard
              key={item.activity._id}
              item={item}
              mentalEnergy={mentalEnergy}
              physicalEnergy={physicalEnergy}
              onDo={handleDo}
            />
          ))}
          {(moreCount > 0 || beyondCount > 0) && (
            <>
              <button
                onClick={() => setShowMore(!showMore)}
                className="w-full text-base-400 text-sm py-3 hover:text-base-300 transition-colors"
              >
                {showMore
                  ? "Show less"
                  : "More"}
              </button>
              {showMore && (
                <>
                  {prioritized.available.slice(3).map((item) => (
                    <ActivityCard
                      key={item.activity._id}
                      item={item}
                      mentalEnergy={mentalEnergy}
                      physicalEnergy={physicalEnergy}
                      onDo={handleDo}
                    />
                  ))}
                  {prioritized.too_tired.length > 0 && (
                    <div className="mt-4 mb-2 px-1">
                      <h3 className="text-sm uppercase tracking-wider text-base-500">
                        Too tired for
                      </h3>
                    </div>
                  )}
                  {prioritized.too_tired.map((item) => (
                    <ActivityCard
                      key={item.activity._id}
                      item={item}
                      mentalEnergy={mentalEnergy}
                      physicalEnergy={physicalEnergy}
                    />
                  ))}
                  {prioritized.wrong_time.length > 0 && (
                    <div className="mt-4 mb-2 px-1">
                      <h3 className="text-sm uppercase tracking-wider text-base-500">
                        Not right now
                      </h3>
                    </div>
                  )}
                  {prioritized.wrong_time.map((item) => (
                    <ActivityCard
                      key={item.activity._id}
                      item={item}
                      mentalEnergy={mentalEnergy}
                      physicalEnergy={physicalEnergy}
                    />
                  ))}
                  {pausedActivities.length > 0 && (
                    <div className="mt-4 mb-2 px-1">
                      <h3 className="text-sm uppercase tracking-wider text-base-500">
                        Paused
                      </h3>
                    </div>
                  )}
                  {pausedActivities.map((a) => {
                    const PausedIcon = CATEGORY_ICONS[a.category];
                    return (
                      <Link
                        key={a._id}
                        to="/activities/$activityId"
                        params={{ activityId: a._id }}
                        className="flex items-center gap-2.5 bg-base-900/50 border border-base-800/50 rounded-xl px-4 py-3 mb-3"
                      >
                        {PausedIcon && <PausedIcon size={18} className="text-base-600" />}
                        <span className="text-base-400 text-base flex-1">{a.name}</span>
                        <span className="text-base-500 text-sm">
                          {formatTimeRemaining(a.pausedUntil! - now)}
                        </span>
                      </Link>
                    );
                  })}
                  <button
                    onClick={() => setShowMore(false)}
                    className="w-full text-base-400 text-sm py-3 hover:text-base-300 transition-colors"
                  >
                    Show less
                  </button>
                </>
              )}
            </>
          )}
        </Section>
      )}

      <div className="h-20" /> {/* spacer for fixed bottom bar */}

      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto">
        {timerActivity && timer.isRunning && timerMinimized && (
          <MinimizedTimer
            activityName={timerActivity.name}
            remainingMs={timer.remainingMs}
            totalElapsedMs={timer.totalElapsedMs}
            phase={timer.phase}
            isPaused={timer.isPaused}
            onMaximize={() => setTimerMinimized(false)}
          />
        )}
        <div className="bg-base-950/90 backdrop-blur border-t border-base-800 px-4 py-3 flex justify-center">
          <EnergySliders
            mentalEnergy={mentalEnergy}
            physicalEnergy={physicalEnergy}
            onMentalChange={setMentalEnergy}
            onPhysicalChange={setPhysicalEnergy}
          />
        </div>
      </div>
    </div>
  );
}

function DoingScreen({
  activityName,
  timerSettings,
  onMarkDone,
  onCancel,
  onStartTimer,
}: {
  activityName: string;
  timerSettings?: { type: "pomodoro" | "meditation" } | undefined;
  onMarkDone: () => void;
  onCancel: () => void;
  onStartTimer: () => void;
}) {
  const TimerIcon = timerSettings?.type === "meditation" ? Shell : Apple;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <p className="text-base-500 text-sm uppercase tracking-wider mb-3">Doing</p>
      <h2 className="text-2xl font-semibold text-base-50 mb-10">{activityName}</h2>
      <div className="flex flex-col items-center gap-4">
        {timerSettings && (
          <button
            onClick={onStartTimer}
            className="border border-accent/30 bg-accent/10 text-accent text-base font-medium px-8 py-3 rounded-xl hover:bg-accent/20 transition-colors flex items-center gap-2"
          >
            <TimerIcon size={18} />
            Start timer
          </button>
        )}
        <button
          onClick={onMarkDone}
          className="border border-green-500/30 bg-green-500/10 text-green-400 text-base font-medium px-8 py-3 rounded-xl hover:bg-green-500/20 transition-colors"
        >
          Mark as done
        </button>
        <button
          onClick={onCancel}
          className="text-base-500 text-sm hover:text-base-300 transition-colors px-6 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-sm uppercase tracking-wider text-base-400 font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
