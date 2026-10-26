import DateField from "../../components/DateField";
import FlowButton from "../../components/FlowButton";
import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import { ChartColumn, Copy, Eraser, Plus, Save, X } from "lucide-react";
import ReportDownloadButton from "../../components/ReportDownloadButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Data } from "../../model";
import { fmt, monthLabel } from "../../format";
import {
  DUPLICATE_SCENARIO_MESSAGE,
  duplicateScenario,
  applyScenario,
  scenarioApplyPlan,
  scenarioRevertPlan,
  type SavedScenario,
  type ShiftScenario,
} from "../../../../shared/schedule-shift";
import type { Change } from "../../../../shared/commands";
import SavedScenarioList, {
  type SavedScenarioAction,
} from "./SavedScenarioList";
import {
  compareScenarios,
  groupRemaining,
  newScenario,
  nextScenarioName,
  type ScenarioDraft,
  type ComparisonColumn,
  type ScenarioComparison,
} from "./scenario-comparison";
import { downloadScenarioWorkbook } from "./scenario-export";

type Props = {
  embedded?: boolean;
  historyOnly?: boolean;
  open: boolean;
  onClose: () => void;
  data: Data;
  currentMonth: string;
  scenarios: ScenarioDraft[];
  setScenarios: Dispatch<SetStateAction<ScenarioDraft[]>>;
  /** Saved scenarios shown in the comparison, kept for the session. */
  comparedIds: string[];
  setComparedIds: Dispatch<SetStateAction<string[]>>;
  /** Draw the resource reports for this scenario. */
  onShowInReports: (scenarioId: string) => void;
  isAdmin: boolean;
  userId: string;
  saving: boolean;
  /** Writes one atomic batch; rejects with the server message. */
  onSaveChanges: (changes: Change[]) => Promise<void>;
};

const MAX_SCENARIOS = 3;

export default function ScheduleScenarioDialog({
  embedded = false,
  historyOnly = false,
  open,
  onClose,
  data,
  currentMonth,
  scenarios,
  setScenarios,
  comparedIds,
  setComparedIds,
  onShowInReports,
  isAdmin,
  userId,
  saving,
  onSaveChanges,
}: Props) {
  const [focus, setFocus] = useState(0);
  const [entryOpen, setEntryOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const saved = data.scheduleScenarios || [];
  // Only saved scenarios explicitly selected for comparison affect the tables.
  const compared = comparedIds
    .map((id) => saved.find((s) => s.id === id))
    .filter(
      (s): s is SavedScenario =>
        !!s && (s.status === "draft" || s.status === "approved"),
    );
  const comparisonList: ShiftScenario[] = [
    ...compared.map(({ id, name, includeTimeline, shifts }) => ({
      id,
      name,
      includeTimeline,
      shifts,
    })),
  ];
  const scenarioChange = (value: SavedScenario, revision?: number): Change => ({
    kind: "scenario",
    id: value.id,
    value,
    revision: revision ?? (data.revisions["scenario:" + value.id] || 0),
  });
  async function run(changes: Change[], done: string, after?: () => void) {
    setMessage(undefined);
    try {
      await onSaveChanges(changes);
      setMessage({ text: done });
      after?.();
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    }
  }
  // Cards of transferred or closed scenarios would compare against a plan
  // that already holds the shift; take them off the comparison.
  const dropCards = (ids: string[]) => {
    setComparedIds((all) => all.filter((id) => !ids.includes(id)));
    setScenarios((all) => {
      const rest = all.filter((s) => !ids.includes(s.id));
      return rest.length
        ? rest
        : [newScenario(nextScenarioName(saved), currentMonth, 3)];
    });
  };
  const overlaps = (a: ShiftScenario, b: ShiftScenario) =>
    a.shifts.some((s) => b.shifts.some((t) => t.projectId === s.projectId));
  /** "Ekle": the card becomes a saved draft in Kayıtlı Senaryolar and stays
   * in the comparison; a fresh card takes its place. */
  function addCard(scenario: ScenarioDraft) {
    const shifts = scenario.shifts.filter((s) => s.projectId && s.months);
    if (!shifts.length || !scenario.name.trim()) {
      setMessage({
        text: "Eklemek için senaryo adı ve en az bir proje ile ay sayısı girin.",
        error: true,
      });
      return;
    }
    const editing = scenario.editingRevision !== undefined;
    const existing = saved.find((item) => item.id === scenario.id);
    if (editing && (!existing || existing.status !== "draft")) {
      setMessage({
        text: "Düzenlenen senaryo silinmiş veya durumu değişmiş. Değişiklikler kaydedilmedi.",
        error: true,
      });
      return;
    }
    if (existing && !editing) {
      setMessage({
        text: "Bu kaydı değiştirmek için Kayıtlı Senaryolar'daki Düzenle butonunu kullanın.",
        error: true,
      });
      return;
    }
    const value: SavedScenario = {
      ...(editing ? existing : {}),
      status: "draft",
      createdBy: userId,
      createdByName: "",
      createdAt: new Date().toISOString(),
      id: scenario.id,
      name: scenario.name.trim(),
      includeTimeline: scenario.includeTimeline,
      shifts,
    };
    if (duplicateScenario(value, saved))
      return setMessage({ text: DUPLICATE_SCENARIO_MESSAGE, error: true });
    void run(
      [scenarioChange(value, scenario.editingRevision)],
      `“${value.name}” ${editing ? "güncellendi" : "eklendi"}.`,
      () => {
        setEntryOpen(false);
        setComparedIds((all) =>
          [...all.filter((id) => id !== value.id), value.id].slice(
            -MAX_SCENARIOS,
          ),
        );
        setScenarios((all) => {
          const rest = all.filter((s) => s.id !== value.id);
          return rest.length
            ? rest
            : [
                newScenario(
                  nextScenarioName([...saved, value]),
                  currentMonth,
                  3,
                ),
              ];
        });
      },
    );
  }
  function act(action: SavedScenarioAction, item: SavedScenario) {
    if (action === "edit") {
      if (item.status !== "draft" || (!isAdmin && item.createdBy !== userId))
        return;
      if (!scenarios.some((card) => card.id === item.id)) {
        const empty = scenarios.findIndex(
          (card) =>
            card.editingRevision === undefined &&
            card.name === nextScenarioName(saved) &&
            card.includeTimeline &&
            card.shifts.length === 1 &&
            !card.shifts[0].projectId &&
            card.shifts[0].months === 3 &&
            card.shifts[0].fromMonth === currentMonth,
        );
        if (empty < 0 && scenarios.length >= MAX_SCENARIOS) {
          setMessage({
            text: "Düzenlemek için önce açık kartlardan birini kaydedin veya temizleyin.",
            error: true,
          });
          return;
        }
        const draft: ScenarioDraft = {
          id: item.id,
          name: item.name,
          includeTimeline: item.includeTimeline,
          shifts: structuredClone(item.shifts),
          editingRevision: data.revisions["scenario:" + item.id] || 0,
        };
        setScenarios((all) => [
          draft,
          ...all.filter(
            (card, index) => index !== empty && card.id !== item.id,
          ),
        ]);
      }
      setEntryOpen(true);
      setMessage(undefined);
      requestAnimationFrame(() => {
        const card = document.getElementById("scenario-card-" + item.id);
        card?.scrollIntoView({ block: "nearest" });
        card
          ?.querySelector<HTMLInputElement>('input[aria-label="Senaryo İsmi"]')
          ?.focus();
      });
      return;
    }

    if (action === "compare") {
      setComparedIds((all) =>
        all.includes(item.id)
          ? all
          : all.length < MAX_SCENARIOS
            ? [...all, item.id]
            : [...all.slice(0, -1), item.id],
      );
      return;
    }
    if (action === "uncompare")
      return setComparedIds((all) => all.filter((id) => id !== item.id));
    if (action === "approve" || action === "withdraw")
      return void run(
        [
          scenarioChange({
            ...item,
            status: action === "approve" ? "approved" : "draft",
          }),
        ],
        action === "approve"
          ? `“${item.name}” onaylandı.`
          : `“${item.name}” onayı geri çekildi.`,
      );
    if (action === "delete") {
      if (!confirm(`“${item.name}” senaryosu silinsin mi?`)) return;
      return void run(
        [
          {
            kind: "scenario",
            id: item.id,
            value: null,
            operation: "delete",
            // The stored record's revision, as for any other change.
            revision: data.revisions["scenario:" + item.id] || 0,
          },
        ],
        `“${item.name}” silindi.`,
        // The card would linger as an unsaved copy in the reports.
        () => dropCards([item.id]),
      );
    }
    if (action === "apply") {
      let plan;
      try {
        plan = scenarioApplyPlan(data, item);
      } catch (error) {
        return setMessage({ text: (error as Error).message, error: true });
      }
      // The server closes these too; say so before the transfer.
      const closing = saved.filter(
        (s) =>
          s.id !== item.id &&
          (s.status === "draft" || s.status === "approved") &&
          overlaps(s, item),
      );
      const closingNote = closing.length
        ? `\n\nAynı projeleri içeren ${closing.map((s) => "“" + s.name + "”").join(", ")} kapatılacak; geri alınırsa yeniden taslak olur.`
        : "";
      if (
        !confirm(
          `“${item.name}” takvime aktarılsın mı?\n\n${plan.moved} planlanan kayıt taşınacak; proje dönemleri${item.includeTimeline ? ", aşamalar ve kilometre taşları" : ""} güncellenecek. Bu işlem kayıtları değiştirir. Gerekirse “Geri Al” ile önceki takvime dönülebilir.${closingNote}`,
        )
      )
        return;
      return void run(
        [
          ...(plan.changes as Change[]),
          scenarioChange({ ...item, status: "applied", undo: plan.undo }),
        ],
        `“${item.name}” takvime aktarıldı.` +
          (closing.length ? ` ${closing.length} senaryo kapatıldı.` : ""),
        () => dropCards([item.id, ...closing.map((s) => s.id)]),
      );
    }
    if (action === "revert") {
      let changes;
      try {
        if (!item.undo) throw Error("Geri alma bilgisi bulunamadı.");
        changes = scenarioRevertPlan(data, item.undo);
      } catch (error) {
        return setMessage({ text: (error as Error).message, error: true });
      }
      if (
        !confirm(
          `“${item.name}” geri alınsın mı? Projeler ve planlanan kayıtlar aktarmadan önceki haline döner.`,
        )
      )
        return;
      return void run(
        [
          ...(changes as Change[]),
          scenarioChange({ ...item, status: "reverted" }),
        ],
        `“${item.name}” geri alındı; önceki takvim yüklendi.` +
          (saved.some(
            (s) => s.status === "closed" && s.closedByScenarioId === item.id,
          )
            ? " Bu aktarma yüzünden kapatılan senaryolar yeniden taslak oldu."
            : ""),
        () => dropCards([item.id]),
      );
    }
  }
  const comparison = useMemo(
    () => compareScenarios(data, comparisonList, currentMonth),
    // comparisonList is rebuilt every render from these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, comparedIds, currentMonth],
  );
  const draftProblems = useMemo(
    () => scenarios.map((scenario) => applyScenario(data, scenario).problems),
    [data, scenarios],
  );
  const update = (index: number, next: ScenarioDraft) =>
    setScenarios((all) => all.map((s, i) => (i === index ? next : s)));
  const shown = Math.max(0, Math.min(focus, comparison.columns.length - 2));
  const reportTarget =
    comparison.columns[shown + 1]?.key || comparison.columns[1]?.key;

  return (
    <ScenarioContainer embedded={embedded} open={open} onClose={onClose}>
      <div className="schedule-scenario-body">
        <div
          className={
            "schedule-scenario-top" +
            (historyOnly ? " scenario-history-view" : "")
          }
        >
          {!historyOnly && (
            <section
              className="schedule-scenario-cards"
              aria-labelledby="schedule-scenario-add-title"
            >
              <h3
                id="schedule-scenario-add-title"
                className="schedule-section-title"
              >
                Senaryo Ekleme
              </h3>
              {!entryOpen && (
                <FlowButton
                  type="button"
                  className="schedule-create-scenario"
                  onClick={() => setEntryOpen(true)}
                >
                  <Plus size={14} aria-hidden="true" />
                  Senaryo Oluştur
                </FlowButton>
              )}
              {entryOpen &&
                scenarios.map((scenario, index) => (
                  <ScenarioCard
                    key={scenario.id}
                    data={data}
                    scenario={scenario}
                    problems={draftProblems[index] || []}
                    duplicate={
                      !!duplicateScenario(
                        { ...scenario, name: scenario.name.trim() },
                        [
                          ...saved,
                          // Another card being defined counts as well.
                          ...scenarios
                            .filter((_, i) => i < index)
                            .map((card) => ({
                              ...card,
                              status: "draft" as const,
                            })),
                        ] as SavedScenario[],
                      )
                    }
                    saving={saving}
                    onAdd={() => addCard(scenario)}
                    canCopy={scenarios.length < MAX_SCENARIOS}
                    onChange={(next) => update(index, next)}
                    onRemove={() =>
                      setScenarios((all) => {
                        const rest = all.filter((_, i) => i !== index);
                        // Removing the last card leaves an empty one to start over.
                        return rest.length
                          ? rest
                          : [
                              newScenario(
                                nextScenarioName(saved),
                                currentMonth,
                                3,
                              ),
                            ];
                      })
                    }
                    onCopy={() =>
                      setScenarios((all) => [
                        ...all,
                        {
                          ...structuredClone(scenario),
                          id: crypto.randomUUID(),
                          editingRevision: undefined,
                          name: nextScenarioName([...all, ...saved]),
                          shifts: scenario.shifts.map((s) => ({
                            ...s,
                            months: s.months + 2,
                          })),
                        },
                      ])
                    }
                  />
                ))}
            </section>
          )}
          <SavedScenarioList
            data={data}
            comparedIds={compared.map((s) => s.id)}
            scenarios={saved.filter((item) =>
              historyOnly
                ? !["draft", "approved"].includes(item.status)
                : ["draft", "approved"].includes(item.status),
            )}
            historyOnly={historyOnly}
            onDeleteSelected={(ids) => {
              const selected = saved.filter((item) => ids.includes(item.id));
              if (!selected.length) return;
              if (
                selected.some(
                  (item) =>
                    !["draft", "approved"].includes(item.status) ||
                    (!isAdmin &&
                      (item.createdBy !== userId || item.status !== "draft")),
                )
              ) {
                setMessage({
                  text: "Seçilen kayıtlardan bazıları silinemez. Listeyi kontrol edin.",
                  error: true,
                });
                return;
              }
              if (!confirm(`${selected.length} seçili senaryo silinsin mi?`))
                return;
              void run(
                selected.map((item) => ({
                  kind: "scenario",
                  id: item.id,
                  value: null,
                  operation: "delete" as const,
                  revision: data.revisions["scenario:" + item.id] || 0,
                })),
                `${selected.length} senaryo silindi.`,
                () => dropCards(selected.map((item) => item.id)),
              );
            }}
            isAdmin={isAdmin}
            userId={userId}
            busy={saving}
            onAction={act}
            onDeleteClosed={() => {
              const closed = saved.filter((s) => s.status === "closed");
              if (
                !closed.length ||
                !confirm(`${closed.length} kapatılmış senaryo silinsin mi?`)
              )
                return;
              void run(
                closed.map((s) => ({
                  kind: "scenario",
                  id: s.id,
                  value: null,
                  operation: "delete" as const,
                  revision: data.revisions["scenario:" + s.id] || 0,
                })),
                `${closed.length} kapatılmış senaryo silindi.`,
                () => dropCards(closed.map((s) => s.id)),
              );
            }}
          />
        </div>
        {!historyOnly && (
          <ComparisonView
            comparison={comparison}
            data={data}
            shown={shown}
            onShow={setFocus}
          />
        )}
      </div>
      <div className="schedule-scenario-actions">
        {message ? (
          <small
            className={message.error ? "negative" : "scenario-message"}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </small>
        ) : (
          <span />
        )}
        {!historyOnly && (
          <>
            <ReportDownloadButton
              label="Excel'e Aktar"
              disabled={!comparison.ready}
              onClick={() => downloadScenarioWorkbook(data, comparison)}
            />
            <button
              type="button"
              className="button"
              disabled={!reportTarget}
              title="Liderlik ve Takım Bazında Eksik raporlarını bu senaryoyla açar"
              onClick={() => reportTarget && onShowInReports(reportTarget)}
            >
              <ChartColumn size={16} aria-hidden="true" />
              Raporlarda Göster
            </button>
          </>
        )}
        {!embedded && (
          <FlowButton
            type="button"
            className="button primary"
            onClick={onClose}
          >
            Kapat
          </FlowButton>
        )}
      </div>
    </ScenarioContainer>
  );
}

function ScenarioContainer({
  embedded,
  open,
  onClose,
  children,
}: {
  embedded: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (embedded)
    return (
      <section
        className="panel schedule-scenario-dialog schedule-scenario-page"
        aria-label="Proje Takvimi Güncelle"
      >
        {children}
      </section>
    );
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="editor schedule-scenario-dialog">
        <DialogHeader>
          <DialogTitle>Proje Takvimi Güncelle</DialogTitle>
          <DialogDescription className="sr-only">
            Projeleri ileri veya geri kaydırıp kaynak etkisini karşılaştırın.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function ScenarioCard({
  data,
  scenario,
  problems,
  canCopy,
  onChange,
  onRemove,
  onCopy,
  duplicate,
  saving,
  onAdd,
}: {
  data: Data;
  scenario: ScenarioDraft;
  problems: string[];
  canCopy: boolean;
  onChange: (next: ScenarioDraft) => void;
  onRemove: () => void;
  onCopy: () => void;
  /** It repeats a saved scenario's name or shifts: "Ekle" stays off. */
  duplicate: boolean;
  saving: boolean;
  onAdd: () => void;
}) {
  const editing = scenario.editingRevision !== undefined;
  const setShift = (
    index: number,
    patch: Partial<ShiftScenario["shifts"][0]>,
  ) =>
    onChange({
      ...scenario,
      shifts: scenario.shifts.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  const removeShift = (index: number) =>
    onChange({
      ...scenario,
      shifts: scenario.shifts.filter((_, i) => i !== index),
    });
  // Each shifted project has project, months, and start-month fields.
  // Scenario name and actions sit above the project lines.
  return (
    <article
      id={"scenario-card-" + scenario.id}
      className="schedule-scenario-card"
      aria-label={scenario.name}
      data-editing={editing || undefined}
    >
      {editing && (
        <small className="schedule-editing-label">
          Kayıtlı senaryo düzenleniyor
        </small>
      )}
      <div className="schedule-card-action-row">
        <div className="schedule-card-buttons">
          <FlowButton
            busy={saving}
            type="button"
            className="button primary"
            title={
              duplicate
                ? DUPLICATE_SCENARIO_MESSAGE
                : editing
                  ? "Senaryodaki değişiklikleri kaydet"
                  : "Senaryoyu Kayıtlı Senaryolar'a ekle"
            }
            aria-label={
              scenario.name +
              (editing ? " senaryosunu kaydet" : " senaryosunu ekle")
            }
            disabled={duplicate || saving}
            onClick={onAdd}
          >
            {editing ? (
              <Save size={14} aria-hidden="true" />
            ) : (
              <Plus size={14} aria-hidden="true" />
            )}
            {editing ? "Kaydet" : "Senaryo Ekle"}
          </FlowButton>
          {canCopy && (
            <button
              type="button"
              className="button"
              title="Senaryoyu çoğalt (+2 ay)"
              aria-label={scenario.name + " senaryosunu çoğalt"}
              onClick={onCopy}
            >
              <Copy size={14} aria-hidden="true" />
              Kopyala
            </button>
          )}
          {/* Clears this draft card (the last one starts over empty);
                    saved scenarios are deleted from the list below. */}
          <button
            type="button"
            className="button"
            title={editing ? "Düzenlemeyi iptal et" : "Senaryo kartını temizle"}
            aria-label={
              scenario.name +
              (editing
                ? " senaryo düzenlemesini iptal et"
                : " senaryo kartını temizle")
            }
            onClick={onRemove}
          >
            {editing ? (
              <X size={14} aria-hidden="true" />
            ) : (
              <Eraser size={14} aria-hidden="true" />
            )}
            {editing ? "Vazgeç" : "Temizle"}
          </button>
        </div>
        <label className="schedule-field schedule-field-name">
          <span>Senaryo İsmi</span>
          <input
            aria-label="Senaryo İsmi"
            value={scenario.name}
            maxLength={40}
            onChange={(e) => onChange({ ...scenario, name: e.target.value })}
          />
        </label>
      </div>
      {scenario.shifts.map((shift, index) => (
        <div className="schedule-shift-row" key={index}>
          <label className="schedule-field schedule-field-from">
            <span>Başlangıç Ayı</span>
            <DateField
              type="month"
              aria-label="Kaydırmanın başladığı ay"
              value={shift.fromMonth}
              onChange={(e) =>
                e.target.value && setShift(index, { fromMonth: e.target.value })
              }
            />
          </label>
          <label className="schedule-field schedule-field-months">
            <span>Süre (Ay)</span>
            <input
              type="number"
              aria-label="Süre (Ay)"
              title="Artı: erteleme, eksi: öne çekme"
              min={-24}
              max={24}
              step={1}
              value={shift.months}
              onChange={(e) =>
                setShift(index, {
                  months: Math.max(
                    -24,
                    Math.min(24, Math.trunc(Number(e.target.value)) || 0),
                  ),
                })
              }
            />
          </label>
          <label className="schedule-field schedule-field-project">
            <span>Proje</span>
            <select
              aria-label="Proje"
              value={shift.projectId}
              onChange={(e) => setShift(index, { projectId: e.target.value })}
            >
              <option value="">Proje seçin</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {index > 0 && (
            <button
              type="button"
              className="icon-button schedule-shift-remove"
              aria-label="Projeyi senaryodan çıkar"
              title="Projeyi senaryodan çıkar"
              onClick={() => removeShift(index)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      <label className="schedule-timeline-option">
        <input
          type="checkbox"
          checked={scenario.includeTimeline}
          onChange={(e) =>
            onChange({ ...scenario, includeTimeline: e.target.checked })
          }
        />
        Aşamalar, başlıklar ve kilometre taşları da kaysın
      </label>
      <div className="schedule-card-options">
        <button
          type="button"
          className="button schedule-project-add"
          onClick={() =>
            onChange({
              ...scenario,
              shifts: [
                ...scenario.shifts,
                {
                  projectId: "",
                  months: scenario.shifts[0]?.months || 3,
                  fromMonth: scenario.shifts[0]?.fromMonth || "",
                },
              ],
            })
          }
        >
          <Plus size={15} aria-hidden="true" />
          Proje Ekle
        </button>
      </div>
      {duplicate && (
        <p className="negative schedule-card-duplicate" role="alert">
          {DUPLICATE_SCENARIO_MESSAGE}
        </p>
      )}
      {problems.map((problem) => (
        <p key={problem} className="negative" role="alert">
          {problem}
        </p>
      ))}
    </article>
  );
}

function ComparisonView({
  comparison,
  data,
  shown,
  onShow,
}: {
  comparison: ScenarioComparison;
  data: Data;
  shown: number;
  onShow: (index: number) => void;
}) {
  if (!comparison.ready)
    return (
      <p className="schedule-scenario-empty">
        Karşılaştırma için proje ve ay bilgilerini girip Senaryo Ekle butonuna
        basın.
      </p>
    );
  const { columns, months, teams } = comparison;
  const scenario = columns[shown + 1] || columns[1];
  const base = columns[0];
  const teamName = (id: string) =>
    data.teams.find((t) => t.id === id)?.name || id;
  return (
    <section className="schedule-comparison" aria-label="Karşılaştırma">
      <p className="schedule-comparison-scope">
        {teams.length} takım etkileniyor · {monthLabel(months[0])} –{" "}
        {monthLabel(months.at(-1)!)}
      </p>
      <table className="schedule-summary-table">
        <thead>
          <tr>
            <th />
            {columns.map((column) => (
              <th key={column.key}>
                {column.key === "base" ? "Mevcut Bitiş Tarihi" : column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.projects.map((project) => (
            <tr key={project.id}>
              <th>{project.name} bitişi</th>
              {columns.map((column) => (
                <td key={column.key}>
                  {monthLabel(column.projectEnds[project.id] || project.end)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="schedule-impact-head">
        <h3>Senaryo etkisi · kalan kaynak</h3>
        {columns.length > 2 && (
          <div role="group" aria-label="Gösterilen senaryo">
            {columns.slice(1).map((column, i) => (
              <button
                key={column.key}
                type="button"
                className={"button" + (i === shown ? " primary" : "")}
                aria-pressed={i === shown}
                onClick={() => onShow(i)}
              >
                {column.name}
              </button>
            ))}
          </div>
        )}
        <span className="schedule-impact-legend">
          <i className="is-worse" /> kötüleşen <i className="is-better" />{" "}
          iyileşen · değer: senaryodaki kalan (eksi = açık)
        </span>
      </div>
      <ImpactTable
        title="Liderlik Bazında Senaryo Karşılaştırma"
        firstHeader="Liderlik / Birim"
        rows={comparison.leaderRows.map((row) => ({
          key: "leader:" + (row.leader || row.unitId || row.name),
          label: row.name,
          depth: row.depth || 0,
          ids: row.ids,
        }))}
        months={months}
        base={base}
        scenario={scenario}
        total
      />
      <ImpactTable
        title="Takım Bazında Senaryo Karşılaştırma"
        firstHeader="Takım"
        rows={teams.map((team) => ({
          key: team,
          label: teamName(team),
          depth: 0,
          ids: [team],
        }))}
        months={months}
        base={base}
        scenario={scenario}
      />
    </section>
  );
}

type ImpactRow = { key: string; label: string; depth: number; ids: string[] };

/** Remaining capacity per row and month in the shown scenario; cells that
 * differ from the current plan are tinted, the tooltip gives both values. */
function ImpactTable({
  title,
  firstHeader,
  rows,
  months,
  base,
  scenario,
  total = false,
}: {
  title: string;
  firstHeader: string;
  rows: ImpactRow[];
  months: string[];
  base: ComparisonColumn;
  scenario: ComparisonColumn;
  /** Add a total row over the top-level rows (sub-rows are breakdowns). */
  total?: boolean;
}) {
  const totalIds = [
    ...new Set(rows.filter((row) => !row.depth).flatMap((row) => row.ids)),
  ];
  // No team is touched: say so instead of a header-only table or a lone 0 total.
  if (!rows.length)
    return (
      <div className="schedule-impact-block">
        <h4>{title}</h4>
        <p className="schedule-impact-empty">
          Bu senaryo hiçbir takımın kalan kaynağını değiştirmiyor.
        </p>
      </div>
    );
  const all = total
    ? [
        ...rows,
        { key: "total", label: "Toplam", depth: 0, ids: totalIds, sum: true },
      ]
    : rows;
  return (
    <div className="schedule-impact-block">
      <h4>{title}</h4>
      <div className="schedule-impact-wrap">
        <table className="schedule-impact-table">
          <thead>
            <tr>
              <th>{firstHeader}</th>
              {months.map((month) => (
                <th key={month}>{monthLabel(month)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((row) => (
              <tr
                key={row.key}
                className={"sum" in row ? "schedule-impact-total" : undefined}
                data-depth={row.depth || undefined}
              >
                <th>
                  {row.depth ? (
                    <span
                      className="schedule-impact-branch"
                      style={{ paddingLeft: row.depth * 14 }}
                    >
                      ↳ {row.label}
                    </span>
                  ) : (
                    row.label
                  )}
                </th>
                {months.map((month) => {
                  const now = groupRemaining(base, row.ids, month);
                  const next = groupRemaining(scenario, row.ids, month);
                  const changed = Math.abs(next - now) > 1e-9;
                  return (
                    <td
                      key={month}
                      className={
                        [
                          next < -1e-9 ? "is-short" : "",
                          changed
                            ? next > now
                              ? "is-better"
                              : "is-worse"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                      title={`Mevcut: ${fmt(now)} · ${scenario.name}: ${fmt(next)}`}
                    >
                      {fmt(next)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
