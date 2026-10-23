import {
  WarningCalculationSummary,
  ScenarioWarningStatus,
} from "./ScenarioWarningStatus";
import type { WarningAssessment } from "../../../../shared/scenario-warnings.ts";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ReportDownloadButton from "../../components/ReportDownloadButton";
import ProgressLeadershipToggle from "./ProgressLeadershipToggle";
import ProgressMonthLock from "./ProgressMonthLock";
import { createPortal } from "react-dom";
import type { WorkspaceDensity } from "../WorkspaceNavigation";
import type { Principal } from "../../access";
import ProjectResponsible from "../../ProjectResponsible";
import type { Change } from "../../../../shared/commands";
import { monthLabel, monthName, fmt } from "../../format";
import { downloadProgressReport } from "./progress-export";
import {
  projectRows,
  pctLabel,
  type ProgressContext,
  type ProjectRow,
} from "./progress-view";
import {
  manageProject,
  transferComparisons,
  type ManagedProject,
} from "./progress-management";
import ProgressManagementMatrix from "./ProgressManagementMatrix";
import ProgressFilters from "./ProgressFilters";
import {
  managementSheets,
  managementExportRows,
} from "./progress-management-export";
import EmptyState from "../../components/EmptyState";

type DecisionFilter =
  | ""
  | "risk"
  | "ahead"
  | "behind"
  | "missing"
  | "donor"
  | "needsPlan"
  | "recovery"
  | "review"
  | "completed";
const FILTER_LABELS: Record<DecisionFilter, string> = {
  "": "Tüm projeler",
  risk: "Dikkat gerektiren konular",
  ahead: "Planın İlerisinde",
  behind: "Planın Gerisinde / Kritik Gecikme",
  missing: "Değerlendirme bekliyor",
  donor: "Kaynak aktarımı için incelenebilecek projeler",
  needsPlan: "Kaynak planı yok",
  recovery: "Gecikme için aksiyon gerekli",
  review: "Fazla kaynak değerlendirilebilir",
  completed: "Tamamlandı",
};
const matches = (project: ManagedProject, filter: DecisionFilter) => {
  const { assessment: a, scenario: s } = project;
  if (s) {
    if (filter === "risk")
      return (
        s.progressState === "critical" ||
        s.progressState === "behind" ||
        !!s.warning2 ||
        a.risk === "red" ||
        a.risk === "amber"
      );
    if (filter === "ahead")
      return s.status === "ready" && s.progressState === "ahead";
    if (filter === "behind")
      return (
        s.status === "ready" &&
        ["behind", "critical"].includes(s.progressState || "")
      );
    if (filter === "completed") return s.status === "completed";
    if (filter === "missing")
      return ["missing", "unlocked", "notStarted"].includes(s.status);
    if (filter === "needsPlan") return s.resourceState === "unplanned";
    if (filter === "recovery")
      return ["S-01", "S-02", "S-03", "S-04"].includes(s.code || "");
    if (filter === "review" || filter === "donor")
      return ["S-07", "S-08"].includes(s.code || "");
  }
  if (filter === "risk") return a.risk === "red" || a.risk === "amber";
  if (filter === "ahead" || filter === "behind" || filter === "completed")
    return a.point.state === filter;
  if (filter === "missing")
    return ["missing", "unplanned", "unweighted"].includes(a.point.state);
  if (filter === "donor") return a.donor;
  if (filter === "needsPlan" || filter === "recovery")
    return (
      a.resourceReview === filter ||
      project.leaders.some((l) => l.assessment.resourceReview === filter)
    );
  if (filter === "review")
    return (
      ["review", "release"].includes(a.resourceReview) ||
      project.leaders.some((l) =>
        ["review", "release"].includes(l.assessment.resourceReview),
      )
    );
  return true;
};
/** Projects added each time the table is scrolled near its end. */
const BATCH = 10;

/** Project headings, leadership detail and monthly cumulative progress. */
export default function ProgressReport({
  ctx,
  actionsHost,
  density,
  responsibleFilter,
  onResetFilters,
  user,
  month,
  currentMonth,
  saving,
  onSave,
}: {
  ctx: ProgressContext;
  actionsHost: HTMLElement | null;
  density: WorkspaceDensity;
  responsibleFilter: ReactNode;
  onResetFilters: () => void;
  user: Principal | null;
  month: string;
  currentMonth: string;
  saving: boolean;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const { data } = ctx;
  const admin = user?.role === "admin";
  const [leader, setLeader] = useState("");
  const [projectId, setProjectId] = useState("");
  const [decision, setDecision] = useState<DecisionFilter>("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState("");
  const year = month.slice(0, 4);
  const [shown, setShown] = useState(BATCH);
  const [error, setError] = useState("");
  useEffect(() => {
    setShown(BATCH);
  }, [ctx, month, leader, projectId, decision]);
  useEffect(() => {
    if (projectId && !data.projects.some((p) => p.id === projectId))
      setProjectId("");
  }, [data.projects, projectId]);
  const allRows = useMemo(
    () => projectRows(ctx, month, { includeUntracked: true }),
    [ctx, month],
  );
  const rows = useMemo(
    () =>
      projectRows(ctx, month, { leader, projectId, includeUntracked: true }),
    [ctx, month, leader, projectId],
  );
  const projects = useMemo(
    () =>
      rows
        .map((row) => manageProject(ctx, row, month))
        .sort((a, b) => {
          const order = (p: ManagedProject) =>
            p.scenario?.progressState === "critical"
              ? -2
              : p.scenario?.progressState === "behind"
                ? -1
                : p.assessment.risk === "red"
                  ? 0
                  : p.assessment.point.state === "behind"
                    ? 1
                    : p.assessment.risk === "amber"
                      ? 2
                      : ["missing", "unplanned"].includes(
                            p.assessment.point.state,
                          )
                        ? 3
                        : 4;
          return (
            order(a) - order(b) ||
            (a.scenario?.deviation ?? a.assessment.point.gap ?? 0) -
              (b.scenario?.deviation ?? b.assessment.point.gap ?? 0) ||
            a.row.project.name.localeCompare(b.row.project.name, "tr")
          );
        }),
    [ctx, rows, month],
  );
  const filtered = useMemo(
    () => projects.filter((p) => matches(p, decision)),
    [projects, decision],
  );
  const comparisons = useMemo(
    () => transferComparisons(projects, ctx),
    [projects, ctx],
  );
  const monthColumns = useMemo(
    () =>
      Array.from(
        { length: density === "overview" ? 60 : 12 },
        (_, index) =>
          `${Number(year) + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
      ),
    [year, density],
  );
  const leaderNames = [
    ...new Set(allRows.flatMap((r) => r.leaders.map((l) => l.record.leader))),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  const count = (filter: DecisionFilter) =>
    projects.filter((p) => matches(p, filter)).length;
  const visible = filtered.slice(0, shown);
  const loadMore = useCallback(() => setShown((count) => count + BATCH), []);
  const lastLockedMonth = [...(data.progressLocks || [])]
    .map((item) => item.id)
    .sort()
    .at(-1);
  const detailRow = rows.find((row) => row.project.id === detail);

  function resetAllFilters() {
    setLeader("");
    setProjectId("");
    setDecision("");
    onResetFilters();
  }
  function exportReport() {
    try {
      downloadProgressReport(
        managementExportRows(filtered),
        month,
        monthLabel(month),
        managementSheets(ctx, filtered, month, monthColumns),
      );
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="progress-report">
      {actionsHost &&
        createPortal(
          <>
            <ProgressMonthLock
              data={data}
              month={month}
              admin={admin}
              saving={saving}
              onSave={onSave}
              onError={setError}
            />
            <ProgressLeadershipToggle
              checked={visible.some((project) =>
                expanded.has(project.row.project.id),
              )}
              disabled={!visible.length}
              onChange={(open) => {
                const next = new Set(expanded);
                visible.forEach((project) => {
                  if (open) next.add(project.row.project.id);
                  else next.delete(project.row.project.id);
                });
                setExpanded(next);
              }}
            />
            <ReportDownloadButton
              label="Excel’e Aktar"
              disabled={!filtered.length}
              onClick={exportReport}
            />
          </>,
          actionsHost,
        )}
      <ProgressFilters onReset={resetAllFilters}>
        <label className="pick">
          <span>Liderlik</span>
          <select
            value={leader}
            onChange={(e) => {
              setLeader(e.target.value);
              setProjectId("");
            }}
          >
            <option value="">Tümü</option>
            {leaderNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {responsibleFilter}
        <label className="pick progress-project-filter">
          <span>Proje</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Tümü</option>
            {allRows.map((r) => (
              <option key={r.project.id} value={r.project.id}>
                {r.project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pick progress-decision-filter">
          <span>Değerlendirme</span>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as DecisionFilter)}
          >
            {(Object.keys(FILTER_LABELS) as DecisionFilter[]).map((key) => (
              <option key={key} value={key}>
                {FILTER_LABELS[key]} ({count(key)})
              </option>
            ))}
          </select>
        </label>
      </ProgressFilters>
      {error && (
        <p role="alert" className="progress-error">
          {error}
        </p>
      )}
      {comparisons.length > 0 && (
        <section
          className="progress-transfer-review"
          aria-label="Kaynak aktarımı için karşılaştırma"
        >
          <h4>Kaynak aktarımı için karşılaştırma</h4>
          <p>
            Seçili proje ve liderlik kapsamında aynı liderlikteki projeler
            eşleştirilir. Kaynak miktarı ve takım yetkinliği ayrıca
            değerlendirilir.
          </p>
          <div>
            {comparisons.slice(0, 6).map((pair) => (
              <article
                key={`${pair.from.row.project.id}:${pair.to.row.project.id}:${pair.leader}`}
              >
                <strong>
                  {pair.from.row.project.name} → {pair.to.row.project.name}
                </strong>
                <span>{pair.leader}</span>
                <small>
                  Hedef farkı: {pair.fromGap > 0 ? "+" : ""}
                  {fmt(pair.fromGap)} puan → {pair.toGap > 0 ? "+" : ""}
                  {fmt(pair.toGap)} puan
                </small>
                <small>
                  İncelenecek kaynak planı ({pair.horizonMonths} ay):{" "}
                  {fmt(pair.planned)} kişi-ay
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
      {filtered.length ? (
        <ProgressManagementMatrix
          ctx={ctx}
          projects={visible}
          months={monthColumns}
          monthWidth={
            density === "overview" ? 24 : density === "compact" ? 68 : 150
          }
          month={month}
          lastLockedMonth={lastLockedMonth}
          expanded={expanded}
          setExpanded={setExpanded}
          detail={detail}
          onDetail={setDetail}
          onLoadMore={visible.length < filtered.length ? loadMore : undefined}
        />
      ) : (
        <EmptyState
          title="Proje bulunamadı"
          action={{ label: "Filtreleri Sıfırla", onClick: resetAllFilters }}
        >
          Seçili süzgeçlere uyan değerlendirme kaydı yok.
        </EmptyState>
      )}
      {detailRow && (
        <ProjectDetail
          row={detailRow}
          assessment={data.warningAssessments?.find(
            (a) => a.id === detailRow.project.id,
          )}
        />
      )}
    </div>
  );
}

function ProjectDetail({
  row,
  assessment,
}: {
  row: ProjectRow;
  assessment?: WarningAssessment;
}) {
  const history = row.leaders
    .flatMap((l) =>
      Object.entries(l.record.actuals).map(([month, entry]) => ({
        month,
        leader: l.record.leader,
        ...entry,
      })),
    )
    .sort(
      (a, b) =>
        b.month.localeCompare(a.month) ||
        a.leader.localeCompare(b.leader, "tr"),
    );
  return (
    <section
      id="progress-detail"
      className="progress-detail"
      aria-label={row.project.name + " ayrıntısı"}
    >
      <h3>{row.project.name}</h3>
      <ProjectResponsible project={row.project} />
      <ScenarioWarningStatus assessment={assessment} />
      <WarningCalculationSummary assessment={assessment} />
      <h4>Açıklama geçmişi</h4>
      {history.length ? (
        <table className="progress-table compact">
          <thead>
            <tr>
              <th>Ay</th>
              <th>Liderlik</th>
              <th className="num">Gerçekleşen %</th>
              <th>Açıklama</th>
              <th>Giren</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.month + h.leader}>
                <td>{monthLabel(h.month)}</td>
                <td>{h.leader}</td>
                <td className="num">{pctLabel(h.pct)}</td>
                <td>{h.note}</td>
                <td>{h.byName || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="Gerçekleşen girişi yok">
          Bu proje için henüz aylık gerçekleşen yüzdesi kaydedilmedi.
        </EmptyState>
      )}
    </section>
  );
}
