import { useEffect, useRef, useState } from "react";
import Badge, { scenarioStatusTone } from "../../components/Badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Data } from "../../model";
import { fullDateLabel, monthLabel } from "../../format";
import {
  SCENARIO_STATUS_LABELS,
  type SavedScenario,
  type ScenarioStatus,
} from "../../../../shared/schedule-shift.ts";

export type SavedScenarioAction =
  | "edit"
  | "compare"
  | "uncompare"
  | "approve"
  | "withdraw"
  | "apply"
  | "revert"
  | "delete";

type Props = {
  data: Data;
  scenarios: SavedScenario[];
  /** Saved scenarios shown in the comparison. */
  comparedIds: string[];
  isAdmin: boolean;
  userId: string;
  busy: boolean;
  onAction: (action: SavedScenarioAction, scenario: SavedScenario) => void;
  onDeleteClosed: () => void;
  onDeleteSelected: (ids: string[]) => void;
  historyOnly?: boolean;
};

const day = (iso?: string) => (iso ? fullDateLabel(iso.slice(0, 10)) : "");
/** Status order for badges and records with the same creation time. */
const ORDER: ScenarioStatus[] = [
  "draft",
  "approved",
  "applied",
  "reverted",
  "closed",
];

/** Saved delay scenarios, right under the cards: status summary, the
 * decision trail and the admin actions. History is hidden until asked for. */
export default function SavedScenarioList({
  data,
  scenarios,
  comparedIds,
  isAdmin,
  userId,
  busy,
  onAction,
  onDeleteClosed,
  onDeleteSelected,
  historyOnly = false,
}: Props) {
  const [open, setOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectable = scenarios.filter(
    (item) =>
      ["draft", "approved"].includes(item.status) &&
      (isAdmin || (item.createdBy === userId && item.status === "draft")),
  );
  const selected = selectable.filter((item) => selectedIds.has(item.id));
  const allSelected =
    selectable.length > 0 && selected.length === selectable.length;
  useEffect(() => {
    setSelectedIds((current) => {
      const valid = new Set(
        scenarios
          .filter(
            (item) =>
              ["draft", "approved"].includes(item.status) &&
              (isAdmin ||
                (item.createdBy === userId && item.status === "draft")),
          )
          .map((item) => item.id),
      );
      const next = new Set([...current].filter((id) => valid.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [scenarios, isAdmin, userId]);
  const listRef = useRef<HTMLUListElement>(null);
  const knownIds = useRef(new Set(scenarios.map((scenario) => scenario.id)));
  useEffect(() => {
    const added = scenarios.some(
      (scenario) => !knownIds.current.has(scenario.id),
    );
    knownIds.current = new Set(scenarios.map((scenario) => scenario.id));
    if (added) {
      setOpen(true);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0 }));
    }
  }, [scenarios]);
  const projectName = (id: string) =>
    data.projects.find((p) => p.id === id)?.name || "Silinmiş proje";
  const counts = ORDER.map((status) => ({
    status,
    n: scenarios.filter((s) => s.status === status).length,
  })).filter((c) => c.n);
  const rows = [...scenarios].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  );
  const button = (
    label: string,
    action: SavedScenarioAction,
    scenario: SavedScenario,
    tone = "",
  ) => (
    <button
      type="button"
      className={"button " + tone}
      disabled={busy}
      onClick={() => onAction(action, scenario)}
    >
      {label}
    </button>
  );
  return (
    <section className="saved-scenarios" aria-label="Kayıtlı senaryolar">
      <div className="saved-scenarios-head">
        <button
          type="button"
          className="saved-scenarios-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
          <h3>
            {historyOnly
              ? "Onaylanan Takvim Güncellemeleri"
              : "Kayıtlı Senaryolar"}{" "}
            ({scenarios.length})
          </h3>
        </button>
        <span className="saved-scenarios-summary">
          {counts.map(({ status, n }) => (
            <Badge
              key={status}
              tone={scenarioStatusTone(status)}
              data-scenario-status={status}
            >
              {n} {SCENARIO_STATUS_LABELS[status].toLocaleLowerCase("tr")}
            </Badge>
          ))}
        </span>
        {open && isAdmin && scenarios.some((s) => s.status === "closed") && (
          <button
            type="button"
            className="textbutton"
            disabled={busy}
            onClick={onDeleteClosed}
          >
            Kapatılanları Sil
          </button>
        )}
      </div>
      {!historyOnly && open && (
        <div className="scenario-bulk-actions">
          <label>
            <input
              type="checkbox"
              aria-label="Tüm silinebilir senaryoları seç"
              checked={allSelected}
              disabled={busy || !selectable.length}
              ref={(node) => {
                if (node)
                  node.indeterminate = selected.length > 0 && !allSelected;
              }}
              onChange={(e) =>
                setSelectedIds(
                  e.target.checked
                    ? new Set(selectable.map((item) => item.id))
                    : new Set(),
                )
              }
            />
            Tümünü Seç
          </label>
          <button
            type="button"
            className="button deletebutton"
            disabled={busy || !selected.length}
            onClick={() => onDeleteSelected(selected.map((item) => item.id))}
          >
            Seçilenleri Sil ({selected.length})
          </button>
        </div>
      )}
      {open && (
        <ul ref={listRef}>
          {rows.map((s) => {
            const canDelete =
              s.status !== "applied" &&
              (isAdmin ||
                (s.createdBy === userId &&
                  (s.status === "draft" || s.status === "closed")));
            const canEdit =
              s.status === "draft" && (isAdmin || s.createdBy === userId);
            const inComparison = comparedIds.includes(s.id);
            return (
              <li key={s.id} data-scenario-status={s.status}>
                {!historyOnly && canDelete && (
                  <input
                    className="scenario-row-select"
                    type="checkbox"
                    aria-label={s.name + " senaryosunu seç"}
                    checked={selectedIds.has(s.id)}
                    disabled={busy}
                    onChange={(e) =>
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                )}
                <div className="saved-scenario-main">
                  <strong>{s.name}</strong>
                  <Badge
                    variant="status"
                    tone={scenarioStatusTone(s.status)}
                    className="saved-scenario-status"
                  >
                    {SCENARIO_STATUS_LABELS[s.status]}
                  </Badge>
                  <span className="saved-scenario-shifts">
                    {s.shifts
                      .map(
                        (shift) =>
                          `${projectName(shift.projectId)} ${shift.months > 0 ? "+" : ""}${shift.months} ay (${monthLabel(shift.fromMonth)} itibarıyla)`,
                      )
                      .join(" · ")}
                  </span>
                  <small>
                    Hazırlayan: {s.createdByName} · {day(s.createdAt)}
                    {s.approvedByName &&
                      ` · Onaylayan: ${s.approvedByName} · ${day(s.approvedAt)}`}
                    {s.appliedByName &&
                      ` · Aktaran: ${s.appliedByName} · ${day(s.appliedAt)}`}
                    {s.revertedByName &&
                      ` · Geri alan: ${s.revertedByName} · ${day(s.revertedAt)}`}
                    {s.status === "closed" &&
                      ` · Yerine “${s.closedByName}” aktarıldı · ${day(s.closedAt)}`}
                  </small>
                </div>
                <div className="saved-scenario-actions">
                  {(s.status === "draft" || s.status === "approved") &&
                    (inComparison
                      ? button("Karşılaştırmadan Çıkar", "uncompare", s)
                      : button("Karşılaştır", "compare", s))}
                  {isAdmin &&
                    s.status === "draft" &&
                    button("Onayla", "approve", s, "primary")}
                  {isAdmin &&
                    s.status === "approved" &&
                    button("Onayı Geri Çek", "withdraw", s)}
                  {isAdmin &&
                    s.status === "approved" &&
                    button("Takvime Aktar", "apply", s, "primary")}
                  {isAdmin &&
                    s.status === "applied" &&
                    button("Geri Al", "revert", s, "deletebutton")}
                  {canEdit && button("Düzenle", "edit", s)}
                  {canDelete && button("Sil", "delete", s, "textbutton")}
                </div>
              </li>
            );
          })}
          {!rows.length && (
            <li className="saved-scenarios-empty">
              {scenarios.length
                ? "Bu bölümde gösterilecek kayıt yok."
                : historyOnly
                  ? "Henüz takvime aktarılmış güncelleme yok."
                  : "Henüz kayıtlı senaryo yok. Senaryo Ekleme bölümünde tanımlayıp “Senaryo Ekle”ye basın."}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
