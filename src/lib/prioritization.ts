import type { Doc } from "../../convex/_generated/dataModel";
import { interpolateCurve, type CurvePoint } from "../components/PriorityCurveEditor";
import { interpolateHourlyCurve, type HourlyPoint } from "../components/HourlyPriorityEditor";

type Activity = Doc<"activities">;
type Session = Doc<"sessions">;

export type ActivitySection = "available" | "wrong_time" | "too_tired";

export interface PrioritizedActivity {
  activity: Activity;
  section: ActivitySection;
  score: number;
  lastSession: Session | null;
  timeSinceLastMs: number | null;
  sessionCount: number;
  recentFrequency: string;
}

export interface PrioritizedResult {
  available: PrioritizedActivity[];
  wrong_time: PrioritizedActivity[];
  too_tired: PrioritizedActivity[];
}

// --- Legacy fallback for activities without priorityCurve ---

function getExpectedIntervalMs(freq: Activity["targetFrequency"]): number | null {
  const HOUR = 3600_000;
  switch (freq.type) {
    case "daily":
      return 24 * HOUR;
    case "weekly":
      return 7 * 24 * HOUR;
    case "per_period":
      if (freq.timesPerPeriod && freq.periodDays) {
        return (freq.periodDays * 24 * HOUR) / freq.timesPerPeriod;
      }
      return 7 * 24 * HOUR;
    case "freeform":
      return null;
  }
}

function getDecayConstantMs(freq: Activity["targetFrequency"]): number {
  const interval = getExpectedIntervalMs(freq);
  if (!interval) return 7 * 24 * 3600_000;
  return interval * 0.8;
}

function legacyScore(activity: Activity, timeSinceLastMs: number | null, sessionCount: number): number {
  let score = 0;
  const expectedInterval = getExpectedIntervalMs(activity.targetFrequency);

  if (expectedInterval && timeSinceLastMs !== null) {
    const overdueRatio = timeSinceLastMs / expectedInterval;
    score += overdueRatio * 10;
  } else if (activity.targetFrequency.type === "freeform" && timeSinceLastMs !== null) {
    const daysAgo = timeSinceLastMs / (24 * 3600_000);
    score += daysAgo * 0.5;
  }

  if (timeSinceLastMs !== null) {
    const decayConstant = getDecayConstantMs(activity.targetFrequency);
    const recencyPenalty = Math.exp(-timeSinceLastMs / decayConstant) * 5;
    score -= recencyPenalty;
  }

  if (sessionCount === 0) {
    score += 5;
  }

  return score;
}

// --- Recency-biased frequency ---

function formatRate(perWeek: number): string {
  if (perWeek >= 6.5) {
    const perDay = Math.round(perWeek / 7);
    return perDay === 1 ? "Daily" : `${perDay}/day`;
  }
  if (perWeek >= 0.95) {
    const rounded = Math.round(perWeek);
    return rounded === 1 ? "Weekly" : `${rounded}/week`;
  }
  const perMonth = perWeek * (30 / 7);
  if (perMonth >= 0.95) {
    const rounded = Math.round(perMonth);
    return rounded === 1 ? "Monthly" : `${rounded}/month`;
  }
  const perYear = perWeek * (365 / 7);
  if (perYear >= 0.95) {
    const rounded = Math.round(perYear);
    return rounded === 1 ? "Yearly" : `${rounded}/year`;
  }
  return "Rarely";
}

function computeRecentFrequency(sessions: Session[], now: number): string {
  if (sessions.length === 0) return "Never done";
  if (sessions.length === 1) return "Need more data";

  // With exactly 2 sessions, use the simple interval between them
  if (sessions.length === 2) {
    const intervalMs = Math.abs(sessions[0].startedAt - sessions[1].startedAt);
    if (intervalMs === 0) return "Need more data";
    const WEEK_MS = 7 * 24 * 3600_000;
    const perWeek = WEEK_MS / intervalMs;
    return formatRate(perWeek);
  }

  // 3+ sessions: recency-biased average of intervals
  // Sort newest first (should already be, but ensure)
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);

  const HALF_LIFE_MS = 10 * 24 * 3600_000;
  const DECAY = Math.LN2 / HALF_LIFE_MS;

  let weightedIntervalSum = 0;
  let weightSum = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const intervalMs = sorted[i].startedAt - sorted[i + 1].startedAt;
    const age = now - sorted[i].startedAt;
    const weight = Math.exp(-DECAY * age);
    weightedIntervalSum += intervalMs * weight;
    weightSum += weight;
  }

  if (weightSum === 0 || weightedIntervalSum === 0) return "Need more data";

  const avgIntervalMs = weightedIntervalSum / weightSum;
  const WEEK_MS = 7 * 24 * 3600_000;
  const perWeek = WEEK_MS / avgIntervalMs;

  return formatRate(perWeek);
}

// --- Curve-based scoring ---

// Simple seeded PRNG (mulberry32) for deterministic daily tiebreaking
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

export function prioritizeActivities(
  activities: Activity[],
  sessions: Session[],
  mentalEnergy: number,
  physicalEnergy: number,
  currentHour: number
): PrioritizedResult {
  const now = Date.now();

  const sessionsByActivity = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.activityId;
    if (!sessionsByActivity.has(key)) {
      sessionsByActivity.set(key, []);
    }
    sessionsByActivity.get(key)!.push(s);
  }
  for (const group of sessionsByActivity.values()) {
    group.sort((a, b) => b.startedAt - a.startedAt);
  }

  const result: PrioritizedResult = {
    available: [],
    wrong_time: [],
    too_tired: [],
  };

  for (const activity of activities) {
    const actSessions = sessionsByActivity.get(activity._id) ?? [];
    const lastSession = actSessions[0] ?? null;
    const timeSinceLastMs = lastSession ? now - lastSession.startedAt : null;
    const sessionCount = actSessions.length;
    const recentFrequency = computeRecentFrequency(actSessions, now);

    // 1. Energy filter
    if (mentalEnergy < activity.mentalEnergyCost || physicalEnergy < activity.physicalEnergyCost) {
      result.too_tired.push({
        activity, section: "too_tired", score: 0,
        lastSession, timeSinceLastMs, sessionCount, recentFrequency,
      });
      continue;
    }

    // 2. Time-of-day filter
    const hourlyCurve = activity.hourlyPriorityCurve as HourlyPoint[] | undefined;
    const useHourlyCurve = hourlyCurve && hourlyCurve.length >= 2;
    let hourlyMultiplier = 1;

    if (useHourlyCurve) {
      hourlyMultiplier = interpolateHourlyCurve(currentHour, hourlyCurve);
      if (hourlyMultiplier <= 0) {
        result.wrong_time.push({
          activity, section: "wrong_time", score: 0,
          lastSession, timeSinceLastMs, sessionCount, recentFrequency,
        });
        continue;
      }
    } else {
      const tier = activity.hourTiers[currentHour];
      if (tier === "impossible") {
        result.wrong_time.push({
          activity, section: "wrong_time", score: 0,
          lastSession, timeSinceLastMs, sessionCount, recentFrequency,
        });
        continue;
      }
    }

    // Energy match: penalize activities that waste available energy
    const energyWaste =
      (mentalEnergy - activity.mentalEnergyCost) +
      (physicalEnergy - activity.physicalEnergyCost);
    const energyMatchMultiplier = Math.pow(0.75, energyWaste);

    const curve = activity.priorityCurve as CurvePoint[] | undefined;

    if (curve && curve.length >= 2) {
      // --- Curve-based path ---
      const timeSinceLastDays = timeSinceLastMs !== null
        ? timeSinceLastMs / (24 * 3600_000)
        : null;

      // Score from curve
      let score: number;
      if (timeSinceLastDays !== null) {
        score = interpolateCurve(timeSinceLastDays, curve);
      } else {
        // Never done: use the curve's max priority
        score = Math.max(...curve.map((p) => p.priority));
      }

      // Time-of-day multiplier
      if (useHourlyCurve) {
        score *= hourlyMultiplier;
      } else {
        const hasPreferred = activity.hourTiers.includes("preferred");
        const tier = activity.hourTiers[currentHour];
        if (hasPreferred && tier === "possible") {
          score *= 0.5;
        }
      }

      score *= energyMatchMultiplier;

      result.available.push({
        activity, section: "available", score,
        lastSession, timeSinceLastMs, sessionCount, recentFrequency,
      });
    } else {
      // --- Legacy fallback ---
      let score = legacyScore(activity, timeSinceLastMs, sessionCount);

      // Time-of-day multiplier
      if (useHourlyCurve) {
        score *= hourlyMultiplier;
      } else {
        const hasPreferred = activity.hourTiers.includes("preferred");
        const tier = activity.hourTiers[currentHour];
        if (hasPreferred && tier === "possible") {
          score *= 0.5;
        }
      }

      score *= energyMatchMultiplier;

      result.available.push({
        activity, section: "available", score,
        lastSession, timeSinceLastMs, sessionCount, recentFrequency,
      });
    }
  }

  // Daily-seeded tiebreaker so equal-priority activities shuffle once per day
  const rng = mulberry32(dailySeed());
  const tiebreaker = new Map<string, number>();
  for (const item of result.available) {
    tiebreaker.set(item.activity._id, rng());
  }

  result.available.sort((a, b) => {
    const diff = b.score - a.score;
    if (Math.abs(diff) > 0.001) return diff;
    return tiebreaker.get(a.activity._id)! - tiebreaker.get(b.activity._id)!;
  });

  return result;
}
