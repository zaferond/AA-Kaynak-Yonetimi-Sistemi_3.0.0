import DateField from "../../components/DateField";
import {
  WARNING_PRIORITY_LABELS,
  warningPriority,
  warningFinding,
  warningEvidence,
  warningRecommendation,
  pendingAssessmentReason,
  type WarningPriority,
} from "../../../../shared/calendar-warning-review.ts";
import FilterSelect from "../../components/FilterSelect";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardPen,
  Eye,
  Lock,
} from "lucide-react";
import type { Data } from "../../model.ts";
import type { Change } from "../../../../shared/commands.ts";
import type {
  ScenarioWarning,
  WarningEvent,
} from "../../../../shared/scenario-warnings.ts";
import {
  WARNING_LIFECYCLE_LABELS,
  type WarningLifecycleState,
} from "../../../../shared/scenario-warning-policy.ts";
import { monthLabel } from "../../format";
import { WarningCalculationSummary } from "./ScenarioWarningStatus";
import Badge, { type BadgeTone } from "../../components/Badge";
import ReportDownloadButton from "../../components/ReportDownloadButton";
import ProgressFilters from "./ProgressFilters";
import {
  downloadScenarioWarnings,
  lastAction,
} from "./scenario-warning-export";
import EmptyState from "../../components/EmptyState";

const dateLabel = (at: string) => new Date(at).toLocaleString("tr-TR");
const dayLabel = (at: string) =>
  new Date(at).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const PAGE_SIZE = 30;
const ACTION_MAX = 3000;
const LIFECYCLE_TONES: Record<WarningLifecycleState, BadgeTone> = {
  open: "warning",
  seen: "info",
  acted: "success",
  closed: "neutral",
};
const LIFECYCLE_ICONS = {
  open: CircleAlert,
  seen: Eye,
  acted: CircleCheck,
  closed: Lock,
};
function elapsed(from: string, to: string) {
  const days = Math.floor(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
  );
  return days < 1 ? "aynı gün" : `${days} gün sonra`;
}

/** Hesap ve geçmiş: every lifecycle step on a vertical timeline. */
function WarningTimeline({ history }: { history: WarningEvent[] }) {
  return (
    <ol className="scenario-timeline" aria-label="Aksiyon geçmişi">
      {history.map((event, index) => {
        const Icon = LIFECYCLE_ICONS[event.status];
        return (
          <li
            key={index}
            data-status={event.status}
            data-current={index === history.length - 1 || undefined}
          >
            <span className="scenario-timeline-marker" aria-hidden="true">
              <Icon size={14} />
            </span>
            <div className="scenario-timeline-body">
              <div className="scenario-timeline-head">
                <strong>{WARNING_LIFECYCLE_LABELS[event.status]}</strong>
                {index > 0 && (
                  <span className="scenario-timeline-gap">
                    {elapsed(history[index - 1].at, event.at)}
                  </span>
                )}
              </div>
              <span className="scenario-timeline-meta">
                <time dateTime={event.at}>{dateLabel(event.at)}</time> ·{" "}
                {event.byName}
              </span>
              {event.responsible && (
                <p className="scenario-timeline-note">
                  Sorumlu: {event.responsible} · Hedef:{" "}
                  {event.targetDate
                    ? dayLabel(event.targetDate + "T12:00:00")
                    : "—"}
                </p>
              )}
              {event.explanation && (
                <p className="scenario-timeline-note">{event.explanation}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export default function ScenarioWarningsPanel({
  data,
  saving,
  onSave,
}: {
  data: Data;
  saving: boolean;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<WarningLifecycleState | "" | "active">(
    "active",
  );
  const [priority, setPriority] = useState<WarningPriority | "">("");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState("");
  const [detail, setDetail] = useState("");
  const [explanation, setExplanation] = useState("");
  const [responsible, setResponsible] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  const [error, setError] = useState("");
  useEffect(() => {
    setPage(0);
  }, [project, status, priority, sort]);
  const projects = useMemo(
    () => new Map(data.projects.map((p) => [p.id, p])),
    [data.projects],
  );
  const rows = useMemo(
    () =>
      (data.scenarioWarnings || [])
        .filter(
          (w) =>
            projects.has(w.projectId) &&
            warningPriority(w.assessment) !== null &&
            (!project || w.projectId === project) &&
            (!priority || warningPriority(w.assessment) === priority) &&
            (status === "active"
              ? w.status !== "closed"
              : !status || w.status === status) &&
            (w.status === "closed" ||
              !pendingAssessmentReason(
                data.warningAssessments?.find((a) => a.id === w.projectId) ||
                  w.assessment,
                today,
              )),
        )
        .sort((a, b) => {
          const name = (w: ScenarioWarning) =>
            projects.get(w.projectId)?.name || w.projectId;
          const order =
            sort === "priority"
              ? { critical: 0, attention: 1, information: 2 }[
                  warningPriority(a.assessment)!
                ] -
                { critical: 0, attention: 1, information: 2 }[
                  warningPriority(b.assessment)!
                ]
              : sort === "project"
                ? name(a).localeCompare(name(b), "tr")
                : sort === "status"
                  ? WARNING_LIFECYCLE_LABELS[a.status].localeCompare(
                      WARNING_LIFECYCLE_LABELS[b.status],
                      "tr",
                    )
                  : sort === "code"
                    ? (a.code || "").localeCompare(b.code || "")
                    : sort === "month-asc"
                      ? a.month.localeCompare(b.month)
                      : b.month.localeCompare(a.month);
          return (
            order ||
            name(a).localeCompare(name(b), "tr") ||
            a.id.localeCompare(b.id)
          );
        }),
    [
      data.scenarioWarnings,
      data.warningAssessments,
      projects,
      project,
      status,
      priority,
      sort,
      today,
    ],
  );
  const recommendation = (w: ScenarioWarning) =>
    w.assessment.progressState
      ? warningRecommendation(
          w.assessment.progressState,
          w.assessment.resourceState,
        )
      : "";
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  async function update(w: ScenarioWarning, next: "seen" | "acted") {
    setError("");
    if (
      next === "acted" &&
      (!explanation.trim() || !responsible.trim() || !targetDate)
    ) {
      setError("Aksiyon açıklaması, sorumlusu ve hedef tarihi zorunludur.");
      return;
    }
    try {
      await onSave([
        {
          kind: "scenarioWarning",
          id: w.id,
          revision: data.revisions["scenarioWarning:" + w.id] || 0,
          value: {
            status: next,
            explanation: next === "acted" ? explanation.trim() : "",
            ...(next === "acted"
              ? { responsible: responsible.trim(), targetDate }
              : {}),
          },
        },
      ]);
      setEditing("");
      setExplanation("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function exportList(format: "csv" | "xlsx") {
    try {
      downloadScenarioWarnings(data, rows, format);
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <section
      className="scenario-warnings-panel"
      aria-label="Proje Takvimi Uyarıları"
    >
      <ProgressFilters
        onReset={() => {
          setProject("");
          setStatus("active");
          setPriority("");
          setSort("priority");
        }}
      >
        <label className="pick progress-project-filter">
          <span>Proje</span>
          <FilterSelect
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">Tümü</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </FilterSelect>
        </label>
        <label className="pick">
          <span>Durum</span>
          <FilterSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="active">Açık takipler</option>
            <option value="">Geçmiş dahil tümü</option>
            {Object.entries(WARNING_LIFECYCLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </FilterSelect>
        </label>
        <label className="pick">
          <span>Öncelik</span>
          <FilterSelect
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
          >
            <option value="">Tümü</option>
            {Object.entries(WARNING_PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </FilterSelect>
        </label>
        <label className="pick">
          <span>Sıralama</span>
          <FilterSelect value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="priority">Öncelik: kritik önce</option>
            <option value="month-desc">Ay: yeniden eskiye</option>
            <option value="month-asc">Ay: eskiden yeniye</option>
            <option value="project">Proje adı</option>
            <option value="code">Kod</option>
            <option value="status">Durum</option>
          </FilterSelect>
        </label>
      </ProgressFilters>
      <div className="progress-toolbar">
        <span className="progress-result-count">{rows.length} uyarı</span>
        <ReportDownloadButton
          label="Excel’e Aktar"
          disabled={!rows.length}
          onClick={() => exportList("xlsx")}
        />
        <ReportDownloadButton
          label="CSV’ye Aktar"
          disabled={!rows.length}
          onClick={() => exportList("csv")}
        />
      </div>
      {error && (
        <p className="progress-error" role="alert">
          {error}
        </p>
      )}
      {rows.length ? (
        <div className="scenario-table-scroll">
          <table
            className="progress-table scenario-warning-table"
            aria-label="Proje takvimi uyarı listesi"
          >
            <thead>
              <tr>
                <th>Proje</th>
                <th>Öncelik</th>
                <th>Tespit</th>
                <th>Dayanak</th>
                <th>Önerilen Aksiyon</th>
                <th>Ay</th>
                <th>Durum</th>
                <th>Aksiyon Takibi</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                .map((w) => (
                  <Fragment key={w.id}>
                    <tr data-warning-id={w.id}>
                      <td>{projects.get(w.projectId)?.name || w.projectId}</td>
                      <td>
                        <Badge
                          tone={
                            warningPriority(w.assessment) === "critical"
                              ? "danger"
                              : warningPriority(w.assessment) === "attention"
                                ? "warning"
                                : "info"
                          }
                          variant="status"
                        >
                          {
                            WARNING_PRIORITY_LABELS[
                              warningPriority(w.assessment)!
                            ]
                          }
                        </Badge>
                      </td>
                      <td>
                        {warningFinding(w.assessment)}
                        <small className="calendar-warning-code">
                          Kural: {w.code || "İlerleme / kaynak değerlendirmesi"}
                        </small>
                      </td>
                      <td>{warningEvidence(w.assessment)}</td>
                      <td>{recommendation(w) || "—"}</td>
                      <td>{monthLabel(w.month)}</td>
                      <td>
                        <Badge
                          tone={LIFECYCLE_TONES[w.status]}
                          variant="status"
                          data-status={w.status}
                        >
                          {WARNING_LIFECYCLE_LABELS[w.status]}
                        </Badge>
                      </td>
                      <td>
                        {(() => {
                          const action = lastAction(w);
                          return action ? (
                            <div className="scenario-action-cell">
                              <p title={action.explanation}>
                                {action.explanation}
                              </p>
                              <span>
                                Sorumlu: {action.responsible || "Belirtilmemiş"}
                              </span>
                              <span>
                                Hedef tarih:{" "}
                                {action.targetDate
                                  ? dayLabel(action.targetDate + "T12:00:00")
                                  : "Belirtilmemiş"}
                              </span>
                              <span>
                                {action.byName} · {dayLabel(action.at)}
                              </span>
                            </div>
                          ) : (
                            <span className="scenario-action-none">—</span>
                          );
                        })()}
                      </td>
                      <td>
                        <div className="scenario-row-actions">
                          {w.status === "open" && (
                            <button
                              className="button primary"
                              disabled={saving}
                              onClick={() => void update(w, "seen")}
                            >
                              <Eye size={14} aria-hidden="true" />
                              Görüldü İşaretle
                            </button>
                          )}
                          {w.status === "seen" && editing !== w.id && (
                            <button
                              className="button primary"
                              disabled={saving}
                              onClick={() => {
                                setEditing(w.id);
                                setExplanation("");
                                setResponsible("");
                                setTargetDate("");
                                setError("");
                              }}
                            >
                              <ClipboardPen size={14} aria-hidden="true" />
                              Aksiyon Gir
                            </button>
                          )}
                          <button
                            type="button"
                            className="textbutton scenario-warning-detail"
                            aria-expanded={detail === w.id}
                            onClick={() =>
                              setDetail(detail === w.id ? "" : w.id)
                            }
                          >
                            Hesap ve geçmiş
                            <ChevronDown size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editing === w.id && w.status === "seen" && (
                      <tr className="scenario-expanded-row">
                        <td colSpan={9}>
                          <form
                            className="scenario-action-form"
                            aria-label="Aksiyon girişi"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void update(w, "acted");
                            }}
                          >
                            <header>
                              <ClipboardPen size={16} aria-hidden="true" />
                              <h4>Aksiyon Girişi</h4>
                              <span>
                                {projects.get(w.projectId)?.name || w.projectId}{" "}
                                · {w.code || "—"} · {monthLabel(w.month)}
                              </span>
                            </header>
                            {recommendation(w) && (
                              <p className="scenario-action-prompt">
                                <strong>Önerilen aksiyon:</strong>{" "}
                                {recommendation(w)}
                              </p>
                            )}
                            <label>
                              Aksiyon açıklaması
                              <textarea
                                required
                                autoFocus
                                maxLength={ACTION_MAX}
                                value={explanation}
                                placeholder="Kararlaştırılan aksiyonu ve kapsamını yazın…"
                                onChange={(e) => setExplanation(e.target.value)}
                              />
                            </label>
                            <div className="calendar-warning-tracking-fields">
                              <label>
                                Aksiyon sorumlusu
                                <input
                                  required
                                  maxLength={200}
                                  value={responsible}
                                  onChange={(e) =>
                                    setResponsible(e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                Hedef aksiyon tarihi
                                <DateField
                                  type="date"
                                  required
                                  value={targetDate}
                                  onChange={(e) =>
                                    setTargetDate(e.target.value)
                                  }
                                />
                              </label>
                            </div>
                            <div className="scenario-action-foot">
                              <span className="scenario-action-count">
                                {explanation.length} / {ACTION_MAX}
                              </span>
                              <div className="scenario-form-actions">
                                <button
                                  className="button"
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    setEditing("");
                                    setExplanation("");
                                  }}
                                >
                                  Vazgeç
                                </button>
                                <button
                                  className="button primary"
                                  type="submit"
                                  disabled={
                                    saving ||
                                    !explanation.trim() ||
                                    !responsible.trim() ||
                                    !targetDate
                                  }
                                >
                                  Aksiyon Alındı
                                </button>
                              </div>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                    {detail === w.id && (
                      <tr className="scenario-expanded-row">
                        <td colSpan={9}>
                          <div className="scenario-expanded-details">
                            <section className="scenario-detail-card">
                              <WarningCalculationSummary
                                assessment={w.assessment}
                              />
                            </section>
                            <section className="scenario-detail-card">
                              <h4>Aksiyon Geçmişi</h4>
                              <WarningTimeline history={w.history} />
                            </section>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Takip gerektiren uyarı yok"
          action={
            project || status !== "active" || priority
              ? {
                  label: "Filtreleri Sıfırla",
                  onClick: () => {
                    setProject("");
                    setStatus("active");
                    setPriority("");
                  },
                }
              : undefined
          }
        >
          {project || status !== "active" || priority
            ? "Seçili filtrelere uyan uyarı bulunamadı."
            : "Seçili kapsam için takip gerektiren güncel bir uyarı bulunmuyor."}
        </EmptyState>
      )}
      {pageCount > 1 && (
        <div className="progress-report-pages">
          <button
            className="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Önceki
          </button>
          <span>
            {currentPage + 1} / {pageCount}
          </span>
          <button
            className="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Sonraki
          </button>
        </div>
      )}
    </section>
  );
}
