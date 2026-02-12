import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    activityId: v.id("activities"),
    previousMentalCost: v.number(),
    newMentalCost: v.number(),
    previousPhysicalCost: v.number(),
    newPhysicalCost: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("energyCostChanges", {
      ...args,
      changedAt: Date.now(),
    });
  },
});

export const listForActivity = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, { activityId }) => {
    return await ctx.db
      .query("energyCostChanges")
      .withIndex("by_activity", (q) => q.eq("activityId", activityId))
      .collect();
  },
});
