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
import {
  WarningCalculationSummary,
  ScenarioWarningStatus,
} from "./ScenarioWarningStatus";
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
  const [status, setStatus] = useState<WarningLifecycleState | "">("");
  const [sort, setSort] = useState("month-desc");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState("");
  const [detail, setDetail] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setPage(0);
  }, [project, status, sort]);
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
            (!project || w.projectId === project) &&
            (!status || w.status === status),
        )
        .sort((a, b) => {
          const name = (w: ScenarioWarning) =>
            projects.get(w.projectId)?.name || w.projectId;
          const order =
            sort === "project"
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
    [data.scenarioWarnings, projects, project, status, sort],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  async function update(w: ScenarioWarning, next: "seen" | "acted") {
    setError("");
    if (next === "acted" && !explanation.trim()) {
      setError("Aksiyon açıklaması zorunludur.");
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
    <section className="scenario-warnings-panel" aria-label="Senaryo Uyarıları">
      <ProgressFilters
        onReset={() => {
          setProject("");
          setStatus("");
          setSort("month-desc");
        }}
      >
        <label className="pick progress-project-filter">
          <span>Proje</span>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Tümü</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pick">
          <span>Durum</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="">Tümü</option>
            {Object.entries(WARNING_LIFECYCLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="pick">
          <span>Sıralama</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="month-desc">Ay: yeniden eskiye</option>
            <option value="month-asc">Ay: eskiden yeniye</option>
            <option value="project">Proje adı</option>
            <option value="code">Kod</option>
            <option value="status">Durum</option>
          </select>
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
            aria-label="Senaryo uyarı listesi"
          >
            <thead>
              <tr>
                <th>Proje</th>
                <th>Kod</th>
                <th>1. Uyarı</th>
                <th>2. Uyarı / Aksiyon</th>
                <th>Ay</th>
                <th>Durum</th>
                <th>Aksiyon Açıklaması</th>
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
                      <td>{w.code || "—"}</td>
                      <td>
                        <ScenarioWarningStatus
                          assessment={{ ...w.assessment, warning2: "" }}
                        />
                      </td>
                      <td>{w.warning2 || "—"}</td>
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
                        <td colSpan={8}>
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
                            {w.warning2 && (
                              <p className="scenario-action-prompt">
                                <strong>Beklenen aksiyon:</strong> {w.warning2}
                              </p>
                            )}
                            <label>
                              Aksiyon açıklaması
                              <textarea
                                required
                                autoFocus
                                maxLength={ACTION_MAX}
                                value={explanation}
                                placeholder="Alınan aksiyonu, sorumluyu ve hedef tarihi yazın…"
                                onChange={(e) => setExplanation(e.target.value)}
                              />
                            </label>
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
                                  disabled={saving || !explanation.trim()}
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
                        <td colSpan={8}>
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
          title="Senaryo uyarısı yok"
          action={
            project || status
              ? {
                  label: "Filtreleri Sıfırla",
                  onClick: () => {
                    setProject("");
                    setStatus("");
                  },
                }
              : undefined
          }
        >
          {project || status
            ? "Seçili filtrelere uyan uyarı bulunamadı."
            : "Uyarılar bir ay kilitlendiğinde oluşur; henüz uyarı yok."}
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
