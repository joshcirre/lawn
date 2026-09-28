import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, query } from "./_generated/server";
import { requireTeamAccess } from "./auth";

export async function getTeamStorageUsedBytes(ctx: QueryCtx | MutationCtx, teamId: Id<"teams">) {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect();

  const videosByProject = await Promise.all(
    projects.map((project) =>
      ctx.db
        .query("videos")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
    ),
  );

  let total = 0;
  for (const videos of videosByProject) {
    for (const video of videos) {
      if (video.status === "failed") continue;
      if (typeof video.fileSize === "number" && Number.isFinite(video.fileSize)) {
        total += video.fileSize;
      }
    }
  }

  return total;
}

// Informational only: self-hosted teams have no storage quota.
export const getTeamStorage = query({
  args: { teamId: v.id("teams") },
  returns: v.object({ storageUsedBytes: v.number() }),
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId, "viewer");
    return { storageUsedBytes: await getTeamStorageUsedBytes(ctx, args.teamId) };
  },
});
