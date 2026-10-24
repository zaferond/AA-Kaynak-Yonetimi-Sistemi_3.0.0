import { z } from "zod";
import { buildActivityRows } from "../shared/activity-report.ts";
import { createEmployeeAssignmentIndex } from "../shared/employee-directory.ts";
import { activityReportScope } from "../shared/actual-entry-access.ts";
import { visibleLeaderParents } from "../shared/leadership-hierarchy.ts";
import { currentPlanningMonth } from "../shared/resource-dates.ts";
import {
  validPlanningMonth,
  MAX_FILTER_START,
} from "../shared/planning-dates.ts";
import { actualVersionAt, monthsFrom } from "../shared/model.ts";
import { projectVisibility } from "../shared/project-access.ts";
export const activityQuery = z
  .object({
    start: z
      .string()
      .refine(
        (value) => validPlanningMonth(value) && value <= MAX_FILTER_START,
      ),
    count: z.coerce.number().int().min(1).max(60),
    projects: z
      .string()
      .max(16000)
      .default("[]")
      .transform((value, context) => {
        try {
          return z
            .array(z.string().max(120))
            .max(1000)
            .parse(JSON.parse(value));
        } catch {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Geçersiz proje filtresi.",
          });
          return z.NEVER;
        }
      }),
  })
  .strict();
export function activityReportResources(data, scope, currentMonth, months) {
  const teamIds = new Set(data.teams.map((team) => team.id));
  const assignments = createEmployeeAssignmentIndex(data, currentMonth);
  const pastMonths = months.filter((month) => month <= currentMonth);
  // An entirely future query retains the current eligible employee list.
  const reportMonths = pastMonths.length ? pastMonths : [currentMonth];
  return data.resources.filter((resource) => {
    // Keep the existing current-status policy (employees/departed, not ads).
    if (!assignments.get(resource.id)) return false;
    return reportMonths.some((month) => {
      const version = actualVersionAt(resource, month);
      // Use the month's team so leaving a team cannot erase its history.
      // Self access is restricted to the employee's own rows, not old peers.
      return (
        version &&
        teamIds.has(version.team) &&
        scope.includes(resource.id, version.team)
      );
    });
  });
}
export function activityReport(
  data,
  user,
  query,
  currentMonth = currentPlanningMonth(),
  date,
) {
  const scope = activityReportScope(data, user, currentMonth, date);
  const months = monthsFrom(query.start, query.count);
  const resources = activityReportResources(data, scope, currentMonth, months);
  // Without a project filter the rows keep every project (team totals stay
  // complete); a filter may only name projects this user can view.
  const canSeeProject = projectVisibility(data, user, currentMonth);
  const projects = data.projects.filter(
    (project) =>
      !query.projects.length ||
      (query.projects.includes(project.id) && canSeeProject(project.id)),
  );
  const teamIds = new Set(scope.teams.map((team) => team.id));
  const own = resources.find((resource) => resource.id === user.resourceId);
  if (own)
    for (const month of months.filter((month) => month <= currentMonth)) {
      const version = actualVersionAt(own, month);
      if (version && scope.includes(own.id, version.team))
        teamIds.add(version.team);
    }
  const permitted = data.teams.filter((team) => teamIds.has(team.id));
  // Authorize every team row: adding a user's former teams must never expose
  // those teams' peers. Future self assignments do not expand the team scope.
  const rows = buildActivityRows(
    { ...data, resources },
    permitted,
    projects,
    months,
    currentMonth,
  ).filter((row) => scope.includes(row.resourceId, row.teamId));
  const leaders = [
    ...new Set(permitted.map((team) => team.lead).filter(Boolean)),
  ];
  return {
    teams: permitted.map((team) => ({
      id: team.id,
      name: team.name,
      lead: team.lead,
      excelCapacity: 0,
      ...(team.kind === "leadership" ? { kind: "leadership" } : {}),
    })),
    leaders,
    leaderParents: visibleLeaderParents(data, leaders),
    // Only aggregate cells leave the server: never return calendars, leave labels,
    // personal project records, HR notes, account identifiers or credentials.
    rows,
  };
}
