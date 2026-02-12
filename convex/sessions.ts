import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    activityId: v.id("activities"),
    note: v.optional(v.string()),
    mentalEnergyCostAtTime: v.number(),
    physicalEnergyCostAtTime: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      ...args,
      startedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const listAll = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_started_at")
      .order("desc")
      .collect();
  },
});

export const listRecent = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_started_at")
      .order("desc")
      .take(100);
  },
});
