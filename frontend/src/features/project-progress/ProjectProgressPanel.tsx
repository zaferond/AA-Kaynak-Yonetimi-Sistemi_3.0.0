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
  density,
  user,
  saving,
  view,
  onSave,
  onDraftChange,
}: {
  onDraftChange?: (id: string, dirty: boolean) => void;
  data: Data;
  actionsHost: HTMLElement | null;
  density: WorkspaceDensity;
  user: Principal | null;
  saving: boolean;
  view: ProgressView;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const currentMonth = currentPlanningMonth().slice(0, 7);
  const months = entryMonths(currentMonth, data.projectProgress);
  const [selectedMonth, setMonth] = useState(() =>
    defaultEntryMonth(currentMonth, data.projectProgress),
  );
  const month = months.includes(selectedMonth)
    ? selectedMonth
    : defaultEntryMonth(currentMonth, data.projectProgress);
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
  // Entry runs from the earliest plan start; with no month to pick yet the
  // report shows the current month.
  const reportMonth = month || currentMonth;

  const responsibleFilter = (
    <>
      <label className="pick progress-responsible-filter">
        <span>Proje Sorumlusu</span>
        <select
          value={responsible === null ? "all" : "name:" + responsible}
          onChange={(e) =>
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
        </select>
      </label>
      {view === "report" && months.length > 0 && (
        <label className="pick progress-month">
          <span>Ay</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );

  function resetSharedFilters() {
    setResponsible(null);
    setMonth(defaultEntryMonth(currentMonth, data.projectProgress));
  }

  return (
    <section className="panel project-progress">
      {view === "warnings" && (
        <ScenarioWarningsPanel data={data} saving={saving} onSave={onSave} />
      )}
      {view === "settings" && user?.role === "admin" && (
        <WarningSettingsPanel data={data} saving={saving} onSave={onSave} />
      )}
      {view === "plan" && (
        <PlanAndEntry
          onDraftChange={onDraftChange}
          actionsHost={actionsHost}
          ctx={ctx}
          responsibleFilter={responsibleFilter}
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
