import type { Data, Project } from "../../model.ts";

export { visibleProjectsByCompletion as visiblePlanningProjects } from "../../../../shared/project-completion.ts";

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
