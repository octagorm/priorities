import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
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
    priorityCurve: v.optional(v.array(v.object({
      days: v.number(),
      priority: v.number(),
    }))),
    hourTiers: v.array(
      v.union(
        v.literal("preferred"),
        v.literal("possible"),
        v.literal("impossible")
      )
    ),
    hourlyPriorityCurve: v.optional(v.array(v.object({
      hour: v.number(),
      multiplier: v.number(),
    }))),
    isActive: v.boolean(),
    isTemporary: v.boolean(),
    pausedUntil: v.optional(v.number()),
    notes: v.string(),
    createdAt: v.number(),
    timerSettings: v.optional(v.object({
      type: v.union(v.literal("pomodoro"), v.literal("meditation")),
      workMinutes: v.optional(v.number()),
      breakMinutes: v.optional(v.number()),
      durationMinutes: v.optional(v.number()),
      gongIntervalMinutes: v.optional(v.number()),
    })),
  }),

  sessions: defineTable({
    activityId: v.id("activities"),
    startedAt: v.number(),
    note: v.optional(v.string()),
    mentalEnergyCostAtTime: v.number(),
    physicalEnergyCostAtTime: v.number(),
    durationMs: v.optional(v.number()),
  })
    .index("by_activity", ["activityId"])
    .index("by_started_at", ["startedAt"]),

  energyCostChanges: defineTable({
    activityId: v.id("activities"),
    changedAt: v.number(),
    previousMentalCost: v.number(),
    newMentalCost: v.number(),
    previousPhysicalCost: v.number(),
    newPhysicalCost: v.number(),
    reason: v.optional(v.string()),
  }).index("by_activity", ["activityId"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
