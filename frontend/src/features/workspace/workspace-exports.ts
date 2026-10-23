import type { Data, Team, Project } from "../../model";
import {
  downloadActualAllocations,
  downloadPlannedAllocations,
} from "../../allocation-export";
import { downloadProjects } from "../../project-export";
import { downloadResourceReport } from "../../resource-report-export";
import { downloadHeadcountReport } from "../../headcount-report-export";
import { buildHeadcountReport } from "../resource-reports/headcount-report-data";
import { downloadActivityReport } from "../activity-report/activity-report-export";
import type { ActivityRow } from "../activity-report/activity-report-data";
import type { ActualUnit } from "../../actual-units";
import { currentPlanningDate } from "../../resource-dates";
import type { Principal } from "../../access";
import type { Metric } from "../../metrics";
import type { ReportGroup } from "../RemainingResourceTable";
import type { WorkspaceDensity } from "../WorkspaceNavigation";
import {
  buildResourceReportGroups,
  resourceReportFilterSummary,
} from "./resource-report-data";
type Props = {
  data: Data | null;
  actualMonthSummaries?: Record<
    string,
    import("../../../../shared/actual-months").ActualMonthSummary
  >;
  user: Principal | null;
  tab: string;
  reportView?: "resources" | "headcount";
  todayDate?: string;
  teams: Team[];
  projects: Project[];
  months: string[];
  density: WorkspaceDensity;
  projectWeekly: boolean;
  showProjectCodes: boolean;
  currentMonth: string;
  start: string;
  personIds: string[];
  leads: string[];
  teamIds: string[];
  leaderReportGroups: ReportGroup[];
  teamReportGroups: ReportGroup[];
  metric: (ids: string[], month: string) => Metric;
  /** Shown in the report heading when a delay scenario is drawn. */
  scenarioLabel?: string;
  /** Aktivite Raporu rows as loaded for the current filters. */
  activityRows?: ActivityRow[];
  activityUnit?: ActualUnit;
  projectIds?: string[];
  setError: (message: string) => void;
};
/** Dispatch only the current authorized view to the existing workbook writers. */
export function createWorkspaceExports({
  data,
  actualMonthSummaries,
  user,
  tab,
  reportView = "resources",
  todayDate = currentPlanningDate(),
  teams,
  projects,
  months,
  density,
  projectWeekly,
  showProjectCodes,
  currentMonth,
  start,
  personIds,
  leads,
  teamIds,
  leaderReportGroups,
  teamReportGroups,
  metric,
  scenarioLabel,
  activityRows = [],
  activityUnit = "percent",
  projectIds = [],
  setError,
}: Props) {
  function exportResourceReport() {
    if (!data) return;
    downloadResourceReport(
      months,
      buildResourceReportGroups(
        data,
        teams,
        leaderReportGroups,
        start,
        months,
        metric,
        false,
      ),
      buildResourceReportGroups(
        data,
        teams,
        teamReportGroups,
        start,
        months,
        metric,
        true,
      ),
      resourceReportFilterSummary(leads, teamIds) +
        (scenarioLabel ? " · Senaryo: " + scenarioLabel : ""),
    );
  }
  function exportCurrentTab() {
    try {
      if (tab === "projects")
        downloadProjects(
          projects,
          months,
          density,
          projectWeekly,
          showProjectCodes,
        );
      else if (tab === "overview" && reportView === "headcount" && data)
        downloadHeadcountReport(
          buildHeadcountReport(data, teams, leaderReportGroups, todayDate),
          resourceReportFilterSummary(leads, teamIds),
        );
      else if (tab === "overview") exportResourceReport();
      else if (tab === "activity") {
        // Same rows as the screen: the selected teams, every page.
        const ids = new Set(teams.map((team) => team.id));
        downloadActivityReport({
          rows: activityRows.filter((row) => ids.has(row.teamId)),
          months,
          unit: activityUnit,
          todayDate,
          filterLabel:
            resourceReportFilterSummary(leads, teamIds) +
            (projectIds.length ? ` · Proje: ${projectIds.length} seçili` : ""),
          projectFiltered: projectIds.length > 0,
        });
      } else if (tab === "plan" && data)
        downloadPlannedAllocations(data, teams, projects, months);
      else if (tab === "actual" && data)
        downloadActualAllocations(
          data,
          teams,
          projects,
          months,
          currentMonth,
          personIds,
          user?.role !== "admin" ? user?.resourceId : undefined,
          actualMonthSummaries,
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return { exportCurrentTab };
}
