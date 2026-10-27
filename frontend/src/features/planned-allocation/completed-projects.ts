import type { Data, Project } from "../../model.ts";

export const visiblePlanningProjects = (projects: Project[], show: boolean) =>
  show ? projects : projects.filter((project) => !project.completed);

/** Count projects in the visible filter scope without changing allocation data. */
export function completedPlanningCount({
  allocations,
  projects,
  teamIds,
  months,
  onlyDataRows,
}: {
  allocations: Data["allocations"];
  projects: Project[];
  teamIds: string[];
  months: string[];
  onlyDataRows: boolean;
}) {
  if (!teamIds.length) return 0;
  return projects.filter(
    (project) =>
      project.completed &&
      (!onlyDataRows ||
        teamIds.some((team) =>
          months.some(
            (month) =>
              (allocations[team + "|" + project.id + "|" + month] || 0) !== 0,
          ),
        )),
  ).length;
}
