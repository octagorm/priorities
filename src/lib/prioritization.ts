import type { Doc } from "../../convex/_generated/dataModel";
import { interpolateCurve, type CurvePoint } from "../components/PriorityCurveEditor";

type Activity = Doc<"activities">;
type Session = Doc<"sessions">;

export type ActivitySection = "available" | "cooldown" | "wrong_time" | "too_tired";

export interface PrioritizedActivity {
  activity: Activity;
  section: ActivitySection;
  score: number;
  lastSession: Session | null;
  timeSinceLastMs: number | null;
  cooldownRemainingMs?: number;
  sessionCount: number;
}

export interface PrioritizedResult {
  available: PrioritizedActivity[];
  cooldown: PrioritizedActivity[];
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

function legacyCooldown(activity: Activity, timeSinceLastMs: number | null): number | null {
  if (activity.cooldownHours && timeSinceLastMs !== null) {
    const cooldownMs = activity.cooldownHours * 3600_000;
    if (timeSinceLastMs < cooldownMs) {
      return cooldownMs - timeSinceLastMs;
    }
  }
  return null;
}

// --- Curve-based scoring ---

function getCurveCooldownInfo(
  curve: CurvePoint[],
  timeSinceLastDays: number
): { onCooldown: boolean; remainingMs: number } {
  const sorted = [...curve].sort((a, b) => a.days - b.days);
  const currentPriority = interpolateCurve(timeSinceLastDays, sorted);

  if (currentPriority <= 0) {
    // Find first point with priority > 0
    const firstNonZero = sorted.find((p) => p.priority > 0);
    if (firstNonZero && firstNonZero.days > timeSinceLastDays) {
      const remainingDays = firstNonZero.days - timeSinceLastDays;
      return { onCooldown: true, remainingMs: remainingDays * 24 * 3600_000 };
    }
  }
  return { onCooldown: false, remainingMs: 0 };
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
    cooldown: [],
    wrong_time: [],
    too_tired: [],
  };

  for (const activity of activities) {
    const actSessions = sessionsByActivity.get(activity._id) ?? [];
    const lastSession = actSessions[0] ?? null;
    const timeSinceLastMs = lastSession ? now - lastSession.startedAt : null;
    const sessionCount = actSessions.length;

    // 1. Energy filter
    if (mentalEnergy < activity.mentalEnergyCost || physicalEnergy < activity.physicalEnergyCost) {
      result.too_tired.push({
        activity, section: "too_tired", score: 0,
        lastSession, timeSinceLastMs, sessionCount,
      });
      continue;
    }

    // 2. Time-of-day filter
    const tier = activity.hourTiers[currentHour];
    if (tier === "impossible") {
      result.wrong_time.push({
        activity, section: "wrong_time", score: 0,
        lastSession, timeSinceLastMs, sessionCount,
      });
      continue;
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

      // Cooldown check
      if (timeSinceLastDays !== null) {
        const cooldown = getCurveCooldownInfo(curve, timeSinceLastDays);
        if (cooldown.onCooldown) {
          result.cooldown.push({
            activity, section: "cooldown", score: 0,
            lastSession, timeSinceLastMs,
            cooldownRemainingMs: cooldown.remainingMs,
            sessionCount,
          });
          continue;
        }
      }

      // Score from curve
      let score: number;
      if (timeSinceLastDays !== null) {
        score = interpolateCurve(timeSinceLastDays, curve);
      } else {
        // Never done: use the curve's max priority
        score = Math.max(...curve.map((p) => p.priority));
      }

      // Time-of-day multiplier
      const hasPreferred = activity.hourTiers.includes("preferred");
      if (hasPreferred && tier === "possible") {
        score *= 0.5;
      }

      score *= energyMatchMultiplier;

      result.available.push({
        activity, section: "available", score,
        lastSession, timeSinceLastMs, sessionCount,
      });
    } else {
      // --- Legacy fallback ---
      const cooldownRemaining = legacyCooldown(activity, timeSinceLastMs);
      if (cooldownRemaining !== null) {
        result.cooldown.push({
          activity, section: "cooldown", score: 0,
          lastSession, timeSinceLastMs,
          cooldownRemainingMs: cooldownRemaining,
          sessionCount,
        });
        continue;
      }

      let score = legacyScore(activity, timeSinceLastMs, sessionCount);

      const hasPreferred = activity.hourTiers.includes("preferred");
      if (hasPreferred && tier === "possible") {
        score *= 0.5;
      }

      score *= energyMatchMultiplier;

      result.available.push({
        activity, section: "available", score,
        lastSession, timeSinceLastMs, sessionCount,
      });
    }
  }

  result.available.sort((a, b) => b.score - a.score);
  return result;
}
