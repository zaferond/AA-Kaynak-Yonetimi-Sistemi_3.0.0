import type { Principal } from "../../access";
import type { Project } from "../../model";
import type { ProjectProgress } from "../../../../shared/project-progress.ts";
import type { ProgressContext } from "./progress-view";
import { isTopLeader } from "../../../../shared/project-progress.ts";

export type ProgressItem = {
  project: Project;
  leader: string;
  record: ProjectProgress | undefined;
};

/**
 * Top leaderships the user works for: target plan cards go to the top unit
 * only, as in the leadership report. An admin sees all of them, a leader
 * those granted in "Kaynak Planlama Yetkisi" (the same list the server checks).
 */
export function progressLeaders(ctx: ProgressContext, user: Principal | null) {
  const names =
    user?.role === "admin"
      ? ctx.data.leaders || []
      : user?.role === "manager"
        ? user.leaders
        : [];
  return names.filter((name) => isTopLeader(ctx.data, name));
}

/**
 * A leadership's projects: those it has planned resource on, plus any that
 * already carry a progress record. Grouped by leadership, names in order.
 */
export function progressGroups(
  ctx: ProgressContext,
  leaders: string[],
): [string, ProgressItem[]][] {
  const records = ctx.data.projectProgress || [];
  return [...leaders]
    .sort((a, b) => a.localeCompare(b, "tr"))
    .map((leader): [string, ProgressItem[]] => [
      leader,
      ctx.data.projects
        .filter(
          (project) =>
            ctx.planned(project.id).has(leader) ||
            records.some(
              (r) => r.projectId === project.id && r.leader === leader,
            ),
        )
        .map((project) => ({
          project,
          leader,
          record: records.find(
            (r) => r.projectId === project.id && r.leader === leader,
          ),
        })),
    ])
    .filter(([, items]) => items.length > 0);
}
