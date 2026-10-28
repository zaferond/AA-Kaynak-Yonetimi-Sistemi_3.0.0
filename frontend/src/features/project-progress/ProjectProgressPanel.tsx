import { createPortal } from "react-dom";
import { baselineStatus, entryStatus } from "./progress-status";
import { progressGroups, progressLeaders } from "./progress-scope";
import FilterSelect from "../../components/FilterSelect";
import { useMemo, useState } from "react";
import type { Data } from "../../model";
import type { WorkspaceDensity } from "../WorkspaceNavigation";
import type { Principal } from "../../access";
import type { Change } from "../../../../shared/commands";
import { monthLabel } from "../../format";
import { currentPlanningMonth } from "../../resource-dates";
import PlanAndEntry from "./PlanAndEntry";
import ProgressReport from "./ProgressReport";
import {
  activeProgressRecords,
  defaultEntryMonth,
  entryMonths,
  progressContext,
} from "./progress-view";
import "./project-progress.css";

import ScenarioWarningsPanel from "./ScenarioWarningsPanel";
import WarningSettingsPanel from "./WarningSettingsPanel";

export type ProgressView = "plan" | "report" | "warnings" | "settings";

/** Proje İlerlemesi: plan and monthly entry on one screen, and the report. */
export default function ProjectProgressPanel({
  data,
  actionsHost,
  countsHost,
  density,
  user,
  saving,
  view,
  onSave,
  onDraftChange,
  onBeforeFilterChange = () => true,
}: {
  onDraftChange?: (id: string, dirty: boolean) => void;
  onBeforeFilterChange?: () => boolean;
  data: Data;
  actionsHost: HTMLElement | null;
  countsHost: HTMLElement | null;
  density: WorkspaceDensity;
  user: Principal | null;
  saving: boolean;
  view: ProgressView;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const currentMonth = currentPlanningMonth().slice(0, 7);
  const activeRecords = useMemo(() => activeProgressRecords(data), [data]);
  const months = entryMonths(currentMonth, activeRecords, view === "plan");
  const [selectedMonth, setMonth] = useState(() =>
    defaultEntryMonth(currentMonth, activeRecords),
  );
  const preferredMonth = defaultEntryMonth(currentMonth, activeRecords);
  const month = months.includes(selectedMonth)
    ? selectedMonth
    : months.includes(preferredMonth)
      ? preferredMonth
      : months.at(-1) || "";
  const [leader, setLeader] = useState("");
  const [responsible, setResponsible] = useState<string | null>(null);
  const responsibleNames = useMemo(
    () =>
      [
        ...new Set(data.projects.map((p) => p.responsibleName?.trim() || "")),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [data.projects],
  );
  const progressData = useMemo(
    () =>
      responsible === null
        ? data
        : {
            ...data,
            projects: data.projects.filter(
              (p) => (p.responsibleName?.trim() || "") === responsible,
            ),
          },
    [data, responsible],
  );
  const ctx = useMemo(() => progressContext(progressData), [progressData]);
  // Entry-tab work counts must never include an unfinished report month.
  const completedMonths = entryMonths(currentMonth, activeRecords, true);
  const workMonth = completedMonths.includes(month)
    ? month
    : completedMonths.at(-1) || "";
  const authorizedLeaders = progressLeaders(ctx, user);
  const workItems = progressGroups(
    ctx,
    leader && authorizedLeaders.includes(leader) ? [leader] : authorizedLeaders,
  ).flatMap(([, items]) => items);
  const planEntryCount = workItems.filter((item) =>
    ["new", "draft"].includes(baselineStatus(item.record)),
  ).length;
  const planApprovalCount = workItems.filter(
    (item) => baselineStatus(item.record) === "pending",
  ).length;
  const actualCount = workItems.filter(
    (item) => entryStatus(item.record, workMonth, currentMonth) === "waiting",
  ).length;
  // Entry runs from the earliest plan start; with no month to pick yet the
  // report shows the current month.
  const reportMonth = month || currentMonth;

  const responsibleFilter = (
    <>
      <label className="pick progress-responsible-filter">
        <span>Proje Sorumlusu</span>
        <FilterSelect
          value={responsible === null ? "all" : "name:" + responsible}
          onChange={(e) =>
            onBeforeFilterChange() &&
            setResponsible(
              e.target.value === "all" ? null : e.target.value.slice(5),
            )
          }
        >
          <option value="all">Tümü</option>
          {responsibleNames.map((name) => (
            <option key={name} value={"name:" + name}>
              {name || "Atanmamış"}
            </option>
          ))}
        </FilterSelect>
      </label>
      {view === "report" && months.length > 0 && (
        <label className="pick progress-month">
          <span>Ay</span>
          <FilterSelect
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </FilterSelect>
        </label>
      )}
    </>
  );

  function resetSharedFilters() {
    setResponsible(null);
    setLeader("");
    setMonth(defaultEntryMonth(currentMonth, activeRecords));
  }

  return (
    <section className="panel project-progress">
      {countsHost &&
        createPortal(
          <>
            <span
              className="progress-work-count"
              data-kind="plan"
              aria-label={`Hedef Plan Bekleyen: ${planEntryCount + planApprovalCount}`}
              title={`Hedef plan bekleyen: ${planEntryCount + planApprovalCount} (${planEntryCount} yönetici girişi, ${planApprovalCount} proje onayı)`}
            >
              {planEntryCount + planApprovalCount}
            </span>
            <span
              className="progress-work-count"
              data-kind="actual"
              aria-label={`Gerçekleşen Giriş Bekleyen: ${actualCount}`}
              title={`${workMonth ? monthLabel(workMonth) : "Takip ayı yok"} gerçekleşen giriş bekleyen: ${actualCount}`}
            >
              {actualCount}
            </span>
          </>,
          countsHost,
        )}
      {view === "warnings" && (
        <ScenarioWarningsPanel
          data={data}
          saving={saving}
          onSave={onSave}
          onDraftChange={onDraftChange}
        />
      )}
      {view === "settings" && user?.role === "admin" && (
        <WarningSettingsPanel data={data} saving={saving} onSave={onSave} />
      )}
      {view === "plan" && (
        <PlanAndEntry
          onDraftChange={onDraftChange}
          onBeforeFilterChange={onBeforeFilterChange}
          actionsHost={actionsHost}
          ctx={ctx}
          responsibleFilter={responsibleFilter}
          leader={leader}
          onLeaderChange={setLeader}
          onResetFilters={resetSharedFilters}
          user={user}
          month={month}
          months={months}
          onMonthChange={setMonth}
          currentMonth={currentMonth}
          saving={saving}
          onSave={onSave}
        />
      )}
      {view === "report" && (
        <ProgressReport
          actionsHost={actionsHost}
          density={density}
          ctx={ctx}
          responsibleFilter={responsibleFilter}
          onResetFilters={resetSharedFilters}
          user={user}
          month={reportMonth}
          currentMonth={currentMonth}
          saving={saving}
          onSave={onSave}
        />
      )}
    </section>
  );
}
