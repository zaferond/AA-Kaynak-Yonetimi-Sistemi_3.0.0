import FlowButton from "../../components/FlowButton";
import { ScenarioWarningStatus } from "./ScenarioWarningStatus";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Principal } from "../../access";
import type { Project } from "../../model";
import type { Change } from "../../../../shared/commands";
import {
  PROGRESS_NOTE_MAX,
  currentBaseline,
  resourcePlanStart,
  alignPlanStart,
  monthsAfter,
  nextMonth,
  previousMonth,
  clearAfterComplete,
  recalculateTargetsAfterEdit,
  proposalProblems,
  suggestRevisionTargets,
  suggestTargets,
  targetAt,
  lastLockedMonth,
  lockedTargets,
  type ProgressProposal,
  type ProjectProgress,
  type ProgressTargets,
} from "../../../../shared/project-progress.ts";
import { monthLabel, monthName } from "../../format";
import MonthGrid, { fullMonth, type GridRow } from "./MonthGrid";
import {
  pctLabel,
  canLead,
  newProgressId,
  progressChange,
  type ProgressContext,
} from "./progress-view";

import {
  baselineStatus,
  entryStatus,
  entryIsEditable,
  PLAN_LABELS,
  PLAN_STATUS_TITLE,
  ENTRY_STATUS_TITLE,
  PLAN_HELP,
  entryPresentation,
} from "./progress-status";

type Form = {
  openingMonth: string;
  openingPct: string;
  targets: Record<string, string>;
  reason: string;
  adjustedSuggestion?: ProgressTargets;
};
const decimal = (value: number) => String(value).replace(".", ",");
const num = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));
const text = (value: number) => String(value).replace(".", ",");
const asText = (targets: Record<string, number>) =>
  Object.fromEntries(Object.entries(targets).map(([m, v]) => [m, text(v)]));

/**
 * One project × leadership. Until its baseline is approved the card takes the
 * target curve; afterwards the targets stay fixed and the chosen month's
 * actual % (with a note) is entered on the same grid. A new baseline can be
 * proposed alongside without stopping the monthly entry.
 */
type CardProps = Parameters<typeof ProgressCardForm>[0];
export default function ProgressCard({
  onDraftChange,
  ...props
}: CardProps & { onDraftChange?: (id: string, dirty: boolean) => void }) {
  const id = props.project.id + "|" + props.leader;
  const [dirty, setDirty] = useState(false);
  const [reset, setReset] = useState(0);
  const [opened, setOpened] = useState(props);
  useLayoutEffect(() => {
    if (opened.month !== props.month) {
      setDirty(false);
      setOpened(props);
    }
  }, [props.month, opened.month]);
  useLayoutEffect(() => {
    onDraftChange?.(id, dirty);
    return () => onDraftChange?.(id, false);
  }, [id, dirty, onDraftChange]);
  const freeze = () => {
    if (!dirty) {
      setOpened(props);
      setDirty(true);
    }
  };
  const held = dirty ? opened : props;
  const stale =
    dirty &&
    (props.record?.id !== opened.record?.id ||
      (props.ctx.data.revisions["progress:" + props.record?.id] || 0) !==
        (opened.ctx.data.revisions["progress:" + opened.record?.id] || 0) ||
      JSON.stringify(props.ctx.data.progressLocks) !==
        JSON.stringify(opened.ctx.data.progressLocks));
  return (
    <div
      onChangeCapture={freeze}
      onClickCapture={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (
          button &&
          /Önerileni Uygula|Hedef Plan Revize Et/.test(button.textContent || "")
        )
          freeze();
        if (
          button &&
          /^(Vazgeç|Gerçekleşen Revizyonunu İptal Et)$/.test(
            (button.textContent || "").trim(),
          )
        )
          setDirty(false);
      }}
    >
      {dirty && (
        <div
          className="progress-draft-notice"
          role={stale ? "alert" : "status"}
        >
          {stale
            ? "Kayıt başka bir işlemde değişti. Taslağınız korunuyor; kaydetmeden önce güncel kaydı kontrol edin."
            : "Kaydedilmemiş değişiklikleriniz var."}
          <button
            type="button"
            disabled={props.saving}
            onClick={() => {
              setDirty(false);
              setOpened(props);
              setReset((value) => value + 1);
            }}
          >
            Taslağı İptal Et
          </button>
        </div>
      )}
      <ProgressCardForm
        key={reset}
        {...props}
        ctx={held.ctx}
        project={held.project}
        record={held.record}
        onSave={async (changes) => {
          await props.onSave(changes);
          setDirty(false);
        }}
      />
    </div>
  );
}

function ProgressCardForm({
  ctx,
  user,
  project,
  leader,
  record,
  month,
  currentMonth,
  saving,
  onSave,
}: {
  ctx: ProgressContext;
  user: Principal | null;
  project: Project;
  leader: string;
  record: ProjectProgress | undefined;
  /** The month whose actual is entered ("" before tracking starts). */
  month: string;
  currentMonth: string;
  saving: boolean;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const { data } = ctx;
  const admin = user?.role === "admin";
  const baseline = record && currentBaseline(record);
  const status = baselineStatus(record);
  const planned = ctx.planned(project.id).get(leader);
  const resourceStart = resourcePlanStart(project, planned);
  const resourceOpening = resourceStart
    ? previousMonth(resourceStart)
    : undefined;
  const [rebaseline, setRebaseline] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const revision = record ? data.revisions["progress:" + record.id] || 0 : 0;
  // Monthly actual of the chosen month.
  const locked = (data.progressLocks || []).some((lock) => lock.id === month);
  // A revision keeps the approved targets up to the newest locked month.
  const lockedThrough = lastLockedMonth(data.progressLocks);
  const entry = entryStatus(record, month, currentMonth);
  const entryState = entryPresentation(entry, locked);
  const saved = month ? record?.actuals[month] : undefined;
  const [pct, setPct] = useState("");
  const [note, setNote] = useState("");
  const [entryRevisionMonth, setEntryRevisionMonth] = useState<string | null>(
    null,
  );
  const actualInput = useRef<HTMLInputElement>(null);
  const [entryMessage, setEntryMessage] = useState<{
    text: string;
    error?: boolean;
  }>();
  useEffect(() => {
    setPct(saved ? decimal(saved.pct) : "");
    setNote(saved?.note || "");
    setEntryMessage(undefined);
    setEntryRevisionMonth(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, revision, locked]);

  // Fresh values whenever the saved record changes. Targets of a new plan
  // start empty: the leader fills them or applies the suggestion.
  useEffect(() => {
    setRebaseline(false);
    const savedProposal = record?.proposal;
    const p =
      savedProposal && resourceOpening
        ? alignPlanStart(savedProposal, resourceOpening)
        : savedProposal;
    if (p)
      return setForm({
        openingMonth: p.openingMonth,
        openingPct: text(p.openingPct),
        targets: asText(
          baseline
            ? {
                ...p.targets,
                ...lockedTargets(baseline, p.openingMonth, lockedThrough),
              }
            : p.targets,
        ),
        reason: p.reason || "",
      });
    if (baseline) return setForm(null);
    if (!resourceOpening) return setForm(null);
    // The plan starts in the first month with planned resource, at 0 %.
    setForm({
      openingMonth: resourceOpening,
      openingPct: "0",
      targets: {},
      reason: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, !!resourceStart]);

  useEffect(() => {
    if (!resourceOpening) return;
    setForm((current) => {
      if (!current || current.openingMonth === resourceOpening) return current;
      const numericTargets = Object.fromEntries(
        Object.entries(current.targets)
          .filter(([, value]) => value.trim() && Number.isFinite(num(value)))
          .map(([month, value]) => [month, num(value)]),
      );
      const aligned = alignPlanStart(
        {
          openingMonth: current.openingMonth,
          openingPct: num(current.openingPct),
          targets: numericTargets,
        },
        resourceOpening,
      );
      return {
        ...current,
        openingMonth: resourceOpening,
        openingPct: text(aligned.openingPct),
        targets: Object.fromEntries(
          Object.entries(current.targets).filter(
            ([month]) => month > resourceOpening,
          ),
        ),
        adjustedSuggestion: undefined,
      };
    });
  }, [resourceOpening]);

  function startRebaseline() {
    if (!record || !baseline || !resourceOpening) return;
    const aligned = alignPlanStart(baseline, resourceOpening);
    setForm({
      openingMonth: resourceOpening,
      openingPct: text(aligned.openingPct),
      targets: asText(lockedTargets(aligned, resourceOpening, lockedThrough)),
      reason: "",
    });
    setRebaseline(true);
    setMessage(undefined);
  }

  const opening = form ? num(form.openingPct) : (baseline?.openingPct ?? null);
  const openingValid =
    Number.isFinite(opening) && opening! >= 0 && opening! <= 100;
  const frozen = (m: string) => !!baseline && m <= lockedThrough;
  // A revision keeps the locked months, follows the entered actuals and
  // spreads the rest from the newest actual; a new plan starts at opening.
  const suggested =
    form && openingValid
      ? (form.adjustedSuggestion ??
        (baseline
          ? suggestRevisionTargets({
              approved: baseline,
              openingMonth: form.openingMonth,
              openingPct: opening!,
              lockedThrough,
              actuals: record?.actuals,
              projectEnd: project.end,
              planned,
            })
          : suggestTargets(form.openingMonth, opening!, project.end, planned)))
      : undefined;
  const months = form ? monthsAfter(form.openingMonth, project.end) : [];
  const proposal = form && {
    openingMonth: form.openingMonth,
    openingPct: opening!,
    targets: Object.fromEntries(
      months
        .filter((m) => form.targets[m]?.trim())
        .map((m) => [m, num(form.targets[m])]),
    ),
    ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
  };
  const problems =
    proposal && form
      ? [
          ...(!openingValid ? ["Başlangıç değerini (0–100) girin."] : []),
          ...(months.some(
            (m) =>
              form.targets[m]?.trim() && !Number.isFinite(num(form.targets[m])),
          )
            ? ["Hedeflere yalnız sayı girin."]
            : []),
          ...proposalProblems(
            proposal,
            project.end,
            baseline ? lockedThrough : "",
          ),
          ...(baseline && !proposal.reason
            ? ["Hedef planı revizyonu için gerekçe yazın."]
            : []),
        ]
      : [];
  const pending = status === "pending";
  const editable =
    !!form &&
    !!resourceStart &&
    !pending &&
    canLead(user, leader) &&
    (!baseline || rebaseline || !!record?.proposal);
  const label = `${project.name} · ${leader}`;

  const actualFte = ctx.actual(project.id).get(leader);
  const canEnter =
    !!baseline && canLead(user, leader) && entryIsEditable(entry, locked);
  const revisingEntry = entryRevisionMonth === month;
  const canEditEntry = canEnter && (!saved || revisingEntry);
  useEffect(() => {
    if (revisingEntry) actualInput.current?.focus();
  }, [revisingEntry]);
  function startEntryRevision() {
    if (!saved || !canEnter || saving) return;
    setPct(decimal(saved.pct));
    setNote(saved.note);
    setEntryMessage(undefined);
    setEntryRevisionMonth(month);
  }
  function cancelEntryRevision() {
    setPct(saved ? decimal(saved.pct) : "");
    setNote(saved?.note || "");
    setEntryRevisionMonth(null);
    setEntryMessage(undefined);
  }
  const entryChanged =
    pct !== (saved ? decimal(saved.pct) : "") || note !== (saved?.note || "");
  const value = num(pct);
  const entryProblem = !(value >= 0 && value <= 100)
    ? "0 ile 100 arasında bir yüzde girin."
    : Math.abs(Math.round(value * 10) - value * 10) > 1e-6
      ? "En fazla bir ondalık basamak girin."
      : !note.trim()
        ? "Kısa bir açıklama yazın."
        : "";
  async function submitEntry() {
    if (!record || !canEditEntry || saving || !entryChanged) return;
    if (entryProblem)
      return setEntryMessage({ text: entryProblem, error: true });
    setEntryMessage(undefined);
    try {
      await onSave([
        progressChange(data, {
          ...record,
          actuals: {
            ...record.actuals,
            [month]: { pct: value, note: note.trim() },
          },
        }),
      ]);
      setEntryRevisionMonth(null);
      setEntryMessage({
        text: saved
          ? "Gerçekleşen oran ve açıklama güncellendi."
          : "Kaydedildi.",
      });
    } catch (error) {
      setEntryMessage({ text: (error as Error).message, error: true });
    }
  }

  async function send(next: ProgressProposal["status"] | null, done: string) {
    setMessage(undefined);
    const base: ProjectProgress = record || {
      id: newProgressId(),
      projectId: project.id,
      leader,
      baselines: [],
      actuals: {},
      createdBy: user?.id || "client",
      createdByName: user?.name || "",
      createdAt: new Date().toISOString(),
    };
    const { proposal: _, ...rest } = base;
    const value: ProjectProgress =
      next === null
        ? rest
        : pending
          ? { ...base, proposal: { ...base.proposal!, status: next } }
          : { ...base, proposal: { ...proposal!, status: next } };
    try {
      await onSave([progressChange(data, value)]);
      setMessage({ text: done });
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    }
  }
  async function remove() {
    if (
      !record ||
      !window.confirm(label + " ilerleme kaydı ve tüm girişleri silinsin mi?")
    )
      return;
    try {
      await onSave([progressChange(data, record, "delete")]);
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    }
  }
  const targets = form ? form.targets : {};
  function editTarget(month: string, input: string) {
    setForm((current) => {
      if (!current) return current;
      const numericTargets = Object.fromEntries(
        Object.entries(current.targets)
          .filter(
            ([m, value]) =>
              m > current.openingMonth &&
              value.trim() &&
              Number.isFinite(num(value)),
          )
          .map(([m, value]) => [m, num(value)]),
      );
      const recalculated = recalculateTargetsAfterEdit(
        numericTargets,
        month,
        num(input),
        project.end,
        planned,
      );
      const next = { ...current.targets, [month]: input };
      const updated = recalculated
        ? {
            ...Object.fromEntries(
              Object.entries(next).filter(([m]) => m <= month),
            ),
            ...asText(
              Object.fromEntries(
                Object.entries(recalculated).filter(([m]) => m > month),
              ),
            ),
          }
        : next;
      // Keep months after completion empty, including an earlier new finish.
      const firstComplete = Object.keys(updated)
        .sort()
        .find((m) => m > current.openingMonth && num(updated[m]) === 100);
      return {
        ...current,
        targets: clearAfterComplete(updated, firstComplete || month),
        ...(recalculated ? { adjustedSuggestion: recalculated } : {}),
      };
    });
  }
  // Months up to a new plan's opening carry no new target.
  const proposalCell = (m: string, input: () => React.ReactNode) =>
    !form || m <= form.openingMonth ? "—" : input();
  const past = (m: string) => m <= currentMonth;
  const planRows: GridRow[] = form
    ? [
        ...(editable
          ? [
              {
                label: baseline ? "Önerilen Yeni Hedef %" : "Önerilen Hedef %",
                cell: (m: string) =>
                  proposalCell(m, () =>
                    suggested ? pctLabel(suggested[m]) : "—",
                  ),
              },
            ]
          : []),
        {
          label: baseline ? "Yeni Hedef %" : "Hedeflenen %",
          editable,
          cell: (m: string) =>
            proposalCell(m, () =>
              editable && frozen(m) ? (
                <strong
                  className="progress-target-locked"
                  title="Kilitli ay: onaylı hedef değiştirilemez"
                >
                  {targets[m]}
                </strong>
              ) : editable ? (
                <input
                  aria-label={`${label} · ${fullMonth(m)} hedef %`}
                  inputMode="decimal"
                  value={targets[m] ?? ""}
                  title={
                    targets[m]?.trim()
                      ? undefined
                      : "Boş ay önceki hedefin devamı sayılır"
                  }
                  onChange={(e) => editTarget(m, e.target.value)}
                />
              ) : targets[m]?.trim() ? (
                <strong>{targets[m]}</strong>
              ) : (
                "—"
              ),
            ),
        },
      ]
    : [];
  const gridRows: GridRow[] = baseline
    ? [
        {
          label: "Gerçekleşen Kaynak (Kişi/Ay)",
          cell: (m) =>
            past(m) && actualFte?.[m] ? pctLabel(actualFte[m]) : "—",
        },
        {
          label: form ? "Onaylı Hedef %" : "Hedeflenen %",
          cell: (m) =>
            m > baseline.openingMonth ? pctLabel(targetAt(baseline, m)) : "—",
        },
        ...planRows,
        {
          label: "Gerçekleşen %",
          editable: canEditEntry,
          cell: (m) =>
            m === month && canEditEntry ? (
              <input
                ref={actualInput}
                aria-label={`${label} · ${fullMonth(m)} gerçekleşen %`}
                inputMode="decimal"
                value={pct}
                disabled={saving}
                onChange={(e) => {
                  setPct(e.target.value);
                  setEntryMessage(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitEntry();
                }}
              />
            ) : record!.actuals[m] ? (
              <strong title={record!.actuals[m].note}>
                {pctLabel(record!.actuals[m].pct)}
              </strong>
            ) : (
              "—"
            ),
        },
      ]
    : planRows;

  const cardAction = data.warningAssessments?.find(
    (a) => a.id === project.id,
  )?.warning2;
  return (
    <section className="progress-card" data-status={status} aria-label={label}>
      <header className="progress-card-head">
        <div className="progress-card-title">
          <strong>{project.name}</strong>
        </div>
        {/* Only an action (e.g. "Ek kaynak gerekli") is shown, at the right
            end of the project row; plan and actual states sit below. */}
        {cardAction && (
          <span className="progress-card-action">{cardAction}</span>
        )}
        <div className="progress-card-statuses" aria-label="İlerleme durumları">
          <ProgressStatusCard
            label={PLAN_STATUS_TITLE}
            value={PLAN_LABELS[baseline ? "approved" : status]}
            status={baseline ? "approved" : status}
            help={PLAN_HELP[baseline ? "approved" : status]}
          />
          {baseline && record?.proposal && (
            <ProgressStatusCard
              label="Revizyon Giriş Durumu"
              value={PLAN_LABELS[status]}
              status={status}
              help={PLAN_HELP[status]}
            />
          )}
          {entryState && (
            <ProgressStatusCard
              label={
                ENTRY_STATUS_TITLE + (month ? ` (${monthLabel(month)})` : "")
              }
              value={entryState.label}
              status={entryState.status}
              help={entryState.help}
            />
          )}
        </div>
      </header>
      {!resourceStart && (
        <p className="progress-card-hint">
          Kaynak planlaması bekleniyor. Başlangıç, bu liderliğin projeye ilk
          kaynak ayırdığı aydan otomatik belirlenecek.
        </p>
      )}
      <MonthGrid
        project={project}
        label={label}
        currentMonth={currentMonth}
        selectedMonth={baseline && month ? month : undefined}
        planned={planned}
        rows={gridRows}
      />
      {baseline && (entry === "closed" || canEditEntry || entryMessage) && (
        <footer className="progress-card-actions progress-card-entry">
          {entry === "closed" ? (
            <span className="progress-card-hint">
              Gerçekleşen girişi henüz açık değil. Plan başlangıcı:{" "}
              {monthLabel(nextMonth(record!.baselines[0].openingMonth))}.
            </span>
          ) : (
            <>
              {canEditEntry && (
                <label className="progress-card-noteinput">
                  <input
                    aria-label={`${label} · açıklama`}
                    maxLength={PROGRESS_NOTE_MAX}
                    value={note}
                    disabled={saving}
                    placeholder={`${monthName(month)} ayı için kısa açıklama giriniz…`}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setEntryMessage(undefined);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitEntry();
                    }}
                  />
                </label>
              )}
              {entryMessage && (
                <span
                  role={entryMessage.error ? "alert" : "status"}
                  className={
                    entryMessage.error ? "progress-error" : "progress-ok"
                  }
                >
                  {entryMessage.text}
                </span>
              )}
            </>
          )}
        </footer>
      )}
      {form && resourceStart && (baseline || form.reason) && (
        // The revision reason takes the same full-width line above the
        // buttons as the month's actual note.
        <footer className="progress-card-actions progress-card-entry">
          <label className="progress-card-noteinput">
            <input
              aria-label={label + " · revizyon gerekçesi"}
              value={form.reason}
              maxLength={500}
              disabled={!editable}
              placeholder="Revizyon gerekçesini giriniz (kapsam veya teslim tarihi değişikliği)…"
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </label>
        </footer>
      )}
      <footer className="progress-card-actions">
        {editable && (
          <>
            <button
              type="button"
              className="button"
              disabled={!suggested}
              onClick={() =>
                form &&
                suggested &&
                setForm({
                  ...form,
                  // Months after the curve reaches 100 % stay empty.
                  targets: Object.entries(asText(suggested)).reduce(
                    (out, [m, v]) =>
                      Object.values(out).includes("100")
                        ? out
                        : { ...out, [m]: v },
                    {} as Record<string, string>,
                  ),
                })
              }
            >
              Önerileni Uygula
            </button>
            <button
              type="button"
              className="button"
              disabled={saving || !openingValid}
              onClick={() =>
                void send("draft", "Hedef planı taslağı kaydedildi.")
              }
            >
              Taslağı Kaydet
            </button>
            <FlowButton
              busy={saving}
              type="button"
              className="button primary"
              disabled={saving || problems.length > 0}
              onClick={() =>
                void send(
                  "pending",
                  "Hedef planı proje ekibi onayına gönderildi.",
                )
              }
            >
              Hedef Planı Onaya Gönder
            </FlowButton>
            {admin && (
              <FlowButton
                busy={saving}
                type="button"
                className="button primary"
                disabled={saving || problems.length > 0}
                onClick={() => void send("approved", "Hedef planı onaylandı.")}
              >
                Hedef Planı Onayla
              </FlowButton>
            )}
            {rebaseline && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setRebaseline(false);
                  setForm(null);
                }}
              >
                Vazgeç
              </button>
            )}
          </>
        )}
        {pending && (
          <>
            {canLead(user, leader) && (
              <button
                type="button"
                className="button"
                disabled={saving}
                onClick={() =>
                  void send(
                    "draft",
                    admin
                      ? "Hedef planı düzeltme için geri gönderildi."
                      : "Onay talebi geri çekildi; hedef planı taslağa döndü.",
                  )
                }
              >
                {admin ? "Düzeltme İçin Geri Gönder" : "Onay Talebini Geri Çek"}
              </button>
            )}
            {admin && (
              <FlowButton
                busy={saving}
                type="button"
                className="button primary"
                disabled={saving || !resourceStart}
                onClick={() => void send("approved", "Hedef planı onaylandı.")}
              >
                Hedef Planı Onayla
              </FlowButton>
            )}
          </>
        )}
        {baseline && !form && canLead(user, leader) && (
          <button
            type="button"
            className="button"
            disabled={!resourceStart}
            onClick={startRebaseline}
          >
            Hedef Plan Revize Et
          </button>
        )}
        {canEditEntry && (
          <FlowButton
            busy={saving}
            type="button"
            className="button primary"
            disabled={saving || !entryChanged}
            onClick={() => void submitEntry()}
          >
            Gerçekleşen % Gönder
          </FlowButton>
        )}
        {canEnter &&
          saved &&
          (revisingEntry ? (
            <button
              type="button"
              className="button"
              disabled={saving}
              onClick={cancelEntryRevision}
            >
              Gerçekleşen Revizyonunu İptal Et
            </button>
          ) : (
            <button
              type="button"
              className="button"
              disabled={saving}
              onClick={startEntryRevision}
              title={`${monthLabel(month)} gerçekleşen oranını ve açıklamasını revize et`}
            >
              Gerçekleşen % Revize Et
            </button>
          ))}
        {record?.proposal && !pending && baseline && (
          <button
            type="button"
            className="button"
            disabled={saving}
            onClick={() => void send(null, "Revizyon taslağı silindi.")}
          >
            Revizyon Taslağını Sil
          </button>
        )}
        {admin && record && (
          <button
            type="button"
            className="button danger progress-card-delete"
            disabled={saving}
            onClick={() => void remove()}
          >
            Kaydı Sil
          </button>
        )}
        {editable && problems.length > 0 && !message && (
          <span className="progress-card-hint">{problems[0]}</span>
        )}
        {message && (
          <span
            role={message.error ? "alert" : "status"}
            className={message.error ? "progress-error" : "progress-ok"}
          >
            {message.text}
          </span>
        )}
      </footer>
    </section>
  );
}

function ProgressStatusCard({
  label,
  value,
  status,
  help,
}: {
  label: string;
  value: string;
  status: string;
  help?: string;
}) {
  return (
    <div className="progress-status-card" title={help}>
      <strong className="progress-status-card-label">{label}:</strong>{" "}
      <span className="progress-status" data-status={status}>
        {value}
      </span>
    </div>
  );
}
