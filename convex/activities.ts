import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_HOUR_TIERS = Array(24).fill("possible") as (
  | "preferred"
  | "possible"
  | "impossible"
)[];

type PriorityCurvePoint = { days: number; priority: number };

function frequencyToCurve(
  freq: { type: string; timesPerPeriod?: number; periodDays?: number },
  cooldownHours?: number
): PriorityCurvePoint[] {
  const cooldownDays = cooldownHours ? cooldownHours / 24 : 0;

  let baseCurve: PriorityCurvePoint[];
  switch (freq.type) {
    case "daily":
      baseCurve = [{ days: 0, priority: 0 }, { days: 1, priority: 1 }];
      break;
    case "weekly":
      baseCurve = [{ days: 0, priority: 0 }, { days: 7, priority: 1 }];
      break;
    case "per_period": {
      const interval = (freq.periodDays ?? 7) / (freq.timesPerPeriod ?? 1);
      baseCurve = [
        { days: 0, priority: 0 },
        { days: parseFloat(interval.toFixed(1)), priority: 1 },
      ];
      break;
    }
    case "freeform":
    default:
      baseCurve = [{ days: 0, priority: 0 }, { days: 14, priority: 0.5 }, { days: 30, priority: 1 }];
      break;
  }

  if (cooldownDays > 0) {
    return baseCurve.map((p) => ({
      days: parseFloat((p.days + cooldownDays).toFixed(1)),
      priority: p.priority,
    }));
  }
  return baseCurve;
}

const DEFAULT_ACTIVITIES = [
  { name: "Spacetime Watch", category: "Projects", mentalEnergyCost: 3, physicalEnergyCost: 0, targetFrequency: { type: "freeform" as const }, notes: "Deep focus coding" },
  { name: "Virtualism essay", category: "Writing", mentalEnergyCost: 3, physicalEnergyCost: 0, targetFrequency: { type: "per_period" as const, timesPerPeriod: 3, periodDays: 7 }, notes: "" },
  { name: "Fiction writing (Weave)", category: "Writing", mentalEnergyCost: 3, physicalEnergyCost: 0, targetFrequency: { type: "per_period" as const, timesPerPeriod: 2, periodDays: 7 }, notes: "Short story" },
  { name: "Philosophy reading", category: "Reading", mentalEnergyCost: 3, physicalEnergyCost: 0, targetFrequency: { type: "daily" as const }, notes: "" },
  { name: "Min Kamp (Knausgård)", category: "Reading", mentalEnergyCost: 1, physicalEnergyCost: 0, targetFrequency: { type: "daily" as const }, notes: "All 6 volumes" },
  { name: "Film exploration", category: "Entertainment", mentalEnergyCost: 1, physicalEnergyCost: 0, targetFrequency: { type: "per_period" as const, timesPerPeriod: 2, periodDays: 7 }, notes: "See film sequence list" },
  { name: "Weave RPG design", category: "RPG", mentalEnergyCost: 3, physicalEnergyCost: 0, targetFrequency: { type: "per_period" as const, timesPerPeriod: 2, periodDays: 7 }, notes: "" },
  { name: "Piano practice", category: "Skills", mentalEnergyCost: 2, physicalEnergyCost: 0, targetFrequency: { type: "daily" as const }, notes: "" },
  { name: "Sketching", category: "Skills", mentalEnergyCost: 2, physicalEnergyCost: 0, targetFrequency: { type: "daily" as const }, notes: "" },
  { name: "Whittling", category: "Skills", mentalEnergyCost: 1, physicalEnergyCost: 2, targetFrequency: { type: "per_period" as const, timesPerPeriod: 3, periodDays: 7 }, notes: "" },
  { name: "Talking practice (AI)", category: "Skills", mentalEnergyCost: 2, physicalEnergyCost: 0, targetFrequency: { type: "per_period" as const, timesPerPeriod: 3, periodDays: 7 }, notes: "Philosophy monologues, improv, storytelling" },
  { name: "Meditation", category: "Habits", mentalEnergyCost: 1, physicalEnergyCost: 0, targetFrequency: { type: "daily" as const }, notes: "" },
  { name: "Walking + audiobook", category: "Habits", mentalEnergyCost: 0, physicalEnergyCost: 2, targetFrequency: { type: "daily" as const }, notes: "10k steps target" },
  { name: "Running", category: "Challenges", mentalEnergyCost: 0, physicalEnergyCost: 3, targetFrequency: { type: "per_period" as const, timesPerPeriod: 3, periodDays: 7 }, cooldownHours: 48, notes: "C25K?" },
  { name: "Sauna", category: "Challenges", mentalEnergyCost: 0, physicalEnergyCost: 1, targetFrequency: { type: "per_period" as const, timesPerPeriod: 3, periodDays: 7 }, cooldownHours: 24, notes: "Find local options" },
  { name: "Astronomy club", category: "Challenges", mentalEnergyCost: 1, physicalEnergyCost: 0, targetFrequency: { type: "freeform" as const }, cooldownHours: 168, notes: "Research local clubs" },
  { name: "Electronic music", category: "Challenges", mentalEnergyCost: 3, physicalEnergyCost: 0, targetFrequency: { type: "per_period" as const, timesPerPeriod: 2, periodDays: 7 }, notes: "Sonic Pi, TidalCycles, spatial audio" },
  { name: "Vacuuming", category: "Chores", mentalEnergyCost: 0, physicalEnergyCost: 1, targetFrequency: { type: "per_period" as const, timesPerPeriod: 1, periodDays: 7 }, cooldownHours: 168, notes: "" },
];

export const seedDefaultActivities = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("activities").first();
    if (existing) return;

    const now = Date.now();
    for (const activity of DEFAULT_ACTIVITIES) {
      const priorityCurve = frequencyToCurve(
        activity.targetFrequency,
        activity.cooldownHours
      );
      await ctx.db.insert("activities", {
        ...activity,
        priorityCurve,
        hourTiers: DEFAULT_HOUR_TIERS,
        isActive: true,
        isTemporary: false,
        createdAt: now,
      });
    }
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("activities")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const listArchived = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("activities")
      .filter((q) => q.eq(q.field("isActive"), false))
      .collect();
  },
});

export const unarchive = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { isActive: true });
  },
});

export const get = query({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    mentalEnergyCost: v.number(),
    physicalEnergyCost: v.number(),
    targetFrequency: v.object({
      type: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("per_period"),
        v.literal("freeform")
      ),
      timesPerPeriod: v.optional(v.number()),
      periodDays: v.optional(v.number()),
    }),
    cooldownHours: v.optional(v.number()),
    priorityCurve: v.optional(v.array(v.object({
      days: v.number(),
      priority: v.number(),
    }))),
    hourTiers: v.optional(
      v.array(
        v.union(
          v.literal("preferred"),
          v.literal("possible"),
          v.literal("impossible")
        )
      )
    ),
    hourlyPriorityCurve: v.optional(v.array(v.object({
      hour: v.number(),
      multiplier: v.number(),
    }))),
    isTemporary: v.boolean(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      ...args,
      hourTiers: args.hourTiers ?? DEFAULT_HOUR_TIERS,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("activities"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    mentalEnergyCost: v.optional(v.number()),
    physicalEnergyCost: v.optional(v.number()),
    targetFrequency: v.optional(
      v.object({
        type: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("per_period"),
          v.literal("freeform")
        ),
        timesPerPeriod: v.optional(v.number()),
        periodDays: v.optional(v.number()),
      })
    ),
    cooldownHours: v.optional(v.number()),
    priorityCurve: v.optional(v.array(v.object({
      days: v.number(),
      priority: v.number(),
    }))),
    hourTiers: v.optional(
      v.array(
        v.union(
          v.literal("preferred"),
          v.literal("possible"),
          v.literal("impossible")
        )
      )
    ),
    hourlyPriorityCurve: v.optional(v.array(v.object({
      hour: v.number(),
      multiplier: v.number(),
    }))),
    isTemporary: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    // Filter out undefined values
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const pause = mutation({
  args: {
    id: v.id("activities"),
    weeks: v.number(),
  },
  handler: async (ctx, { id, weeks }) => {
    const pausedUntil = Date.now() + weeks * 7 * 24 * 3600_000;
    await ctx.db.patch(id, { pausedUntil });
  },
});

export const unpause = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { pausedUntil: undefined });
  },
});

export const archive = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { isActive: false });
  },
});
