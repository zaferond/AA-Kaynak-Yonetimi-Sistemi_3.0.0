import { activityQuery } from "./activity-report.mjs";
import { scopeData } from "../shared/access.ts";
import {
  actualEntryScope,
  canManagePersonalCalendar,
} from "../shared/actual-entry-access.ts";
import { createEmployeeAssignmentIndex } from "../shared/employee-directory.ts";
import { visibleLeaderParents } from "../shared/leadership-hierarchy.ts";
import { actualVersionAt, monthsFrom } from "../shared/model.ts";
import { currentPlanningDate } from "../shared/resource-dates.ts";
import { createActualMonthIndex } from "../shared/actual-months.ts";
import { filterOwnRecords } from "../shared/records.ts";

export const actualViewQuery = activityQuery.pick({ start: true, count: true });

/** Read scope only; writes are checked in operations.mjs with the same rule
 * (shared/actual-entry-access.ts). Teams shown: the managed ones plus the
 * user's own team (a Team Member sees only their own row in it). */
export function actualViewTeams(data, user, date = currentPlanningDate()) {
  const scope = actualEntryScope(data, user, date);
  if (scope.admin) return data.teams;
  return data.teams.filter(
    (team) => scope.teamIds.has(team.id) || team.id === scope.ownTeamId,
  );
}

export function actualViewResources(
  data,
  user,
  _teams,
  currentMonth,
  date = currentPlanningDate(),
) {
  const scope = actualEntryScope(data, user, date);
  const assignments = createEmployeeAssignmentIndex(data, currentMonth);
  return data.resources.filter(
    (resource) =>
      resource.id === (user.resourceId || "") ||
      scope.teamIds.has(assignments.get(resource.id)?.team.id),
  );
}

/** Peers receive monthly totals, never colleagues' private calendar entries. */
export function actualView(data, user, query, date = currentPlanningDate()) {
  const currentMonth = date.slice(0, 7);
  const teams = actualViewTeams(data, user, date);
  const ids = new Set(teams.map((team) => team.id));
  const months = monthsFrom(query.start, query.count).filter(
    (month) => month <= currentMonth,
  );
  const monthSet = new Set(months);
  const ownId = user.resourceId || "";
  // This endpoint edits actual work/calendars, never planned allocations or
  // risks. Do not project their values/revisions through this read-only view.
  const base = scopeData(
    {
      ...data,
      allocations: {},
      revisions: filterOwnRecords(
        data.revisions,
        (key) =>
          key.startsWith("actual:") ||
          key.startsWith("workedHours:") ||
          key.startsWith("personDay:") ||
          key === "calendar:shared",
      ),
    },
    user,
    { projectAccessData: data },
  );
  const scope = actualEntryScope(data, user, date);
  const resources = actualViewResources(data, user, teams, currentMonth, date);
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const canRead = (id, month) =>
    byId.has(id) &&
    monthSet.has(month) &&
    (id === ownId ||
      scope.teamIds.has(actualVersionAt(byId.get(id), month)?.team));
  // Leave days of the people the user manages travel with the view.
  const canReadDay = (key) => {
    const [id, day] = key.split("|");
    return (
      byId.has(id) &&
      canManagePersonalCalendar(data, user, scope, id, day || "")
    );
  };
  const entries = (values, monthIndex) =>
    filterOwnRecords(values, (key) => {
      const parts = key.split("|");
      return canRead(parts[0], parts[monthIndex]);
    });
  const index = createActualMonthIndex(data);
  const monthSummaries = {};
  for (const resource of resources)
    for (const month of months)
      if (canRead(resource.id, month))
        monthSummaries[resource.id + "|" + month] = index.get(
          resource.id,
          month,
        );
  const leaders = [...new Set(teams.map((team) => team.lead).filter(Boolean))];
  return {
    data: {
      ...base,
      users: undefined,
      legacyArchive: undefined,
      risks: [],
      allocations: {},
      actualTeamTotals: {},
      // The reports' leave row; activity screens read the calendar itself.
      leaveDays: undefined,
      leaderManagers: {},
      leadershipUnits: filterOwnRecords(
        data.leadershipUnits,
        (name) => leaders.includes(name) && ids.has(data.leadershipUnits[name]),
      ),
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        lead: team.lead,
        excelCapacity: 0,
        ...(team.kind === "leadership" ? { kind: "leadership" } : {}),
      })),
      leaders,
      leaderParents: visibleLeaderParents(data, leaders),
      resources: resources.map((resource) => ({
        ...resource,
        note: "",
        code: undefined,
        versions: resource.versions.map((version) =>
          resource.id === ownId || ids.has(version.team)
            ? version
            : {
                effective: version.effective,
                team: "",
                lead: "",
                status: "",
                included: false,
                amount: 0,
                start: "",
                end: "",
              },
        ),
      })),
      // Descendant edits need the current revision even when generic/private
      // calendar scope is narrower. Keep optimistic locking authoritative.
      revisions: {
        ...filterOwnRecords(base.revisions, (key) => {
          if (key.startsWith("actual:")) {
            const parts = key.slice(7).split("|");
            return canRead(parts[0], parts[2]);
          }
          if (key.startsWith("workedHours:")) {
            const parts = key.slice(12).split("|");
            return canRead(parts[0], parts[1]);
          }
          return true;
        }),
        ...filterOwnRecords(data.revisions, (key) => {
          if (key.startsWith("personDay:")) return canReadDay(key.slice(10));
          const actual = key.startsWith("actual:");
          const hours = key.startsWith("workedHours:");
          if (!actual && !hours) return false;
          const parts = key.slice(actual ? 7 : 12).split("|");
          return canRead(parts[0], parts[actual ? 2 : 1]);
        }),
      },
      personCalendar: filterOwnRecords(data.personCalendar, canReadDay),
      actualAllocations: entries(data.actualAllocations, 2),
      actualWorkedHours: entries(data.actualWorkedHours, 1),
      actualPercentEntries: entries(data.actualPercentEntries, 2),
    },
    monthSummaries,
  };
}
