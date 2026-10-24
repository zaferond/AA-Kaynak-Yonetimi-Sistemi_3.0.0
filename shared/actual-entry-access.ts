import type { Data } from "./model.ts";
import { actualVersionAt, isWorkingStatus } from "./model.ts";
import type { Principal } from "./access.ts";
import { employeeAssignment } from "./employee-directory.ts";
import { selectedLeadershipScope } from "./leadership-planning.ts";
import { resourceRole } from "./resource-roles.ts";
import {
  currentPlanningDate,
  normalizeResourceDate,
} from "./resource-dates.ts";

/**
 * Aktivite Giriş follows the organisation, not the account's app role:
 * - Team Member (and CoE): only themselves.
 * - Product Owner: themselves and everyone in their own team.
 * - Lider: themselves and every team under their leadership (sub-leaderships
 *   included).
 * - Admin: everyone.
 * Whoever may see a person here may also enter their monthly activity and
 * their leave/training days.
 */
export type ActualEntryScope = {
  admin: boolean;
  /** Teams whose members (in a given month) the user manages. */
  teamIds: ReadonlySet<string>;
  /** The user's own team this month, shown even when it is not managed. */
  ownTeamId?: string;
};

type Org = Pick<Data, "teams" | "resources" | "leaders" | "leaderParents">;

export function actualEntryScope(
  data: Org,
  user: Pick<Principal, "role" | "resourceId">,
  date = currentPlanningDate(),
): ActualEntryScope {
  if (user.role === "admin")
    return {
      admin: true,
      teamIds: new Set((data.teams || []).map((team) => team.id)),
    };
  const own = employeeAssignment(data, user.resourceId || "", date.slice(0, 7));
  const working =
    !!own &&
    isWorkingStatus(own.version.status) &&
    (!own.version.start ||
      normalizeResourceDate(own.version.start, "start") <= date) &&
    (!own.version.end || normalizeResourceDate(own.version.end, "end") >= date);
  if (!own || !working) return { admin: false, teamIds: new Set() };
  const role = resourceRole(data, own.version);
  let teamIds = new Set<string>();
  if (role === "leader" && own.team.lead) {
    const leaders = selectedLeadershipScope(data, [own.team.lead], true);
    teamIds = new Set(
      data.teams
        .filter((team) => !!team.lead && leaders.has(team.lead))
        .map((team) => team.id),
    );
  } else if (role === "productOwner") teamIds = new Set([own.team.id]);
  return { admin: false, teamIds, ownTeamId: own.team.id };
}

/** The person's team in that month falls under the user's scope. */
export function managesPersonMonth(
  data: Pick<Data, "resources">,
  scope: ActualEntryScope,
  resourceId: string,
  month: string,
) {
  if (scope.admin) return true;
  const resource = data.resources.find((person) => person.id === resourceId);
  const version = resource && month && actualVersionAt(resource, month);
  return !!version && scope.teamIds.has(version.team);
}

/** Monthly activity of a person (actual allocations and worked hours). */
export function canEnterActual(
  data: Pick<Data, "resources">,
  user: Pick<Principal, "role" | "resourceId">,
  scope: ActualEntryScope,
  resourceId: string,
  month: string,
) {
  return (
    scope.admin ||
    (!!resourceId && resourceId === user.resourceId) ||
    managesPersonMonth(data, scope, resourceId, month)
  );
}

/** Leave/training days: the person, their PO or Lider for that day's team,
 * and administrators. `date` is the day (YYYY-MM-DD) or a month. */
export function canManagePersonalCalendar(
  data: Pick<Data, "resources">,
  user: Pick<Principal, "role" | "resourceId">,
  scope: ActualEntryScope,
  resourceId: string,
  date = currentPlanningDate(),
) {
  return canEnterActual(data, user, scope, resourceId, date.slice(0, 7));
}

/** Current responsibilities define the report's team scope. Each historical
 * row must belong to one of those teams, except the user's own history. */
export function activityReportScope(
  data: Org,
  user: Pick<Principal, "role" | "resourceId">,
  month: string,
  date = month === currentPlanningDate().slice(0, 7)
    ? currentPlanningDate()
    : month + "-01",
) {
  const scope = actualEntryScope(data, user, date);
  const teamIds = new Set(scope.teamIds);
  if (scope.ownTeamId) teamIds.add(scope.ownTeamId);
  return {
    teams: data.teams.filter((team) => teamIds.has(team.id)),
    includes: (resourceId: string, teamId: string) =>
      scope.admin ||
      (!!scope.ownTeamId && !!resourceId && resourceId === user.resourceId) ||
      scope.teamIds.has(teamId) ||
      // The report (read only) also shows a member's own teammates.
      (!!scope.ownTeamId && teamId === scope.ownTeamId),
  };
}
