import { useId, useState, type ReactNode } from "react";
import Badge from "../../components/Badge";
import { createPortal } from "react-dom";
import ProgressLeadershipToggle from "./ProgressLeadershipToggle";
import { CheckCheck, ChevronDown, ChevronRight } from "lucide-react";
import type { Principal } from "../../access";
import type { Change } from "../../../../shared/commands";
import ProgressCard from "./ProgressCard";
import ProgressFilters from "./ProgressFilters";
import {
  baselineStatus,
  entryStatus,
  PLAN_LABELS,
  ENTRY_LABELS,
  entryPresentation,
  type PlanStatus,
  type EntryStatus,
} from "./progress-status";
import {
  progressGroups,
  progressLeaders,
  type ProgressItem,
} from "./progress-scope";
import { progressChange, type ProgressContext } from "./progress-view";
import { monthName } from "../../format";

/** Quick "waiting work" boxes under the filters; checked boxes combine. */
const WAITING = [
  { key: "planEntry", label: "Hedef Plan Giriş Bekleyen" },
  { key: "planApproval", label: "Hedef Plan Onay Bekleyen" },
  { key: "actualEntry", label: "Gerçekleşen Plan Giriş Bekleyen" },
  // Actual entered for the month; it is evaluated once the month is locked.
  { key: "evaluation", label: "Ayı Değerlendirme Bekliyor" },
] as const;
type Waiting = (typeof WAITING)[number]["key"];

const PLAN_ORDER: Record<PlanStatus, number> = {
  pending: 0,
  draft: 2,
  new: 3,
  approved: 4,
};

/**
 * Plan ve Giriş: every project of the user's leaderships, grouped by
 * leadership. A card takes the target curve until it is approved, then the
 * month's actual on the same grid.
 */
export default function PlanAndEntry({
  ctx,
  actionsHost,
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
  responsibleFilter: ReactNode;
  onResetFilters: () => void;
  user: Principal | null;
  month: string;
  currentMonth: string;
  saving: boolean;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const leaders = progressLeaders(ctx, user);
  const [leader, setLeader] = useState("");
  const [planFilter, setPlanFilter] = useState<"" | PlanStatus>("");
  const [entryFilter, setEntryFilter] = useState<"" | EntryStatus>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [waiting, setWaiting] = useState<ReadonlySet<Waiting>>(() => new Set());
  const [approval, setApproval] = useState<{
    text: string;
    error?: boolean;
  }>();
  const groupId = useId();
  const locked = (ctx.data.progressLocks || []).some((l) => l.id === month);
  const entryOf = (item: ProgressItem) =>
    entryStatus(item.record, month, currentMonth);
  const planOf = (item: ProgressItem) => baselineStatus(item.record);
  const all = progressGroups(ctx, leader ? [leader] : leaders);
  const items = all.flatMap(([, groupItems]) => groupItems);
  const planCount = (status: PlanStatus) =>
    items.filter(
      (item) =>
        planOf(item) === status &&
        (!entryFilter || entryOf(item) === entryFilter),
    ).length;
  const entryCount = (status: EntryStatus) =>
    items.filter(
      (item) =>
        entryOf(item) === status &&
        (!planFilter || planOf(item) === planFilter),
    ).length;
  const isWaiting = (item: ProgressItem, key: Waiting) =>
    key === "planEntry"
      ? ["new", "draft"].includes(planOf(item))
      : key === "planApproval"
        ? planOf(item) === "pending"
        : key === "evaluation"
          ? !locked && entryOf(item) === "entered"
          : entryOf(item) === "waiting";
  const waitingCount = (key: Waiting) =>
    items.filter((item) => isWaiting(item, key)).length;
  const isAdmin = user?.role === "admin";
  async function approveAll() {
    if (
      !approvable.length ||
      !window.confirm(
        approvable.length +
          " hedef plan onaylansın mı? Bu işlem toplu yapılır.",
      )
    )
      return;
    setApproval(undefined);
    try {
      await onSave(
        approvable.map((item) =>
          progressChange(ctx.data, {
            ...item.record!,
            proposal: { ...item.record!.proposal!, status: "approved" },
          }),
        ),
      );
      setApproval({ text: approvable.length + " hedef plan onaylandı." });
    } catch (error) {
      setApproval({ text: (error as Error).message, error: true });
    }
  }
  const priority = (item: ProgressItem) => {
    const plan = planOf(item);
    if (plan === "pending") return 0;
    if (entryOf(item) === "waiting") return 1;
    return PLAN_ORDER[plan];
  };
  const groups = all
    .map(([name, items]): [string, ProgressItem[]] => [
      name,
      items
        .filter(
          (item) =>
            (!planFilter || planOf(item) === planFilter) &&
            (!entryFilter || entryOf(item) === entryFilter) &&
            (!waiting.size || [...waiting].some((key) => isWaiting(item, key))),
        )
        .sort(
          (a, b) =>
            priority(a) - priority(b) ||
            a.project.name.localeCompare(b.project.name, "tr"),
        ),
    ])
    .filter(([, items]) => items.length > 0);
  // "Hedef Planların Tümünü Onayla" acts on the selection only: the cards shown under the
  // checked boxes and filters that await approval (actuals need none).
  const approvable = waiting.size
    ? groups.flatMap(([, groupItems]) =>
        groupItems.filter(
          (item) => planOf(item) === "pending" && item.record?.proposal,
        ),
      )
    : [];

  return (
    <div className="progress-baseline">
      {actionsHost &&
        createPortal(
          <ProgressLeadershipToggle
            checked={groups.some(([name]) => !collapsed.has(name))}
            disabled={!groups.length}
            onChange={(open) => {
              setCollapsed((previous) => {
                const next = new Set(previous);
                groups.forEach(([name]) => {
                  if (open) next.delete(name);
                  else next.add(name);
                });
                return next;
              });
            }}
          />,
          actionsHost,
        )}
      <ProgressFilters
        onReset={() => {
          setLeader("");
          setPlanFilter("");
          setEntryFilter("");
          setWaiting(new Set());
          onResetFilters();
        }}
      >
        <label className="pick">
          <span>Liderlik</span>
          <select value={leader} onChange={(e) => setLeader(e.target.value)}>
            <option value="">Tümü</option>
            {leaders.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {responsibleFilter}
        <label className="pick progress-status-filter">
          <span>Hedef Plan</span>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as "" | PlanStatus)}
          >
            <option value="">Tümü</option>
            {(Object.keys(PLAN_ORDER) as PlanStatus[]).map((status) => (
              <option key={status} value={status}>
                {PLAN_LABELS[status]} ({planCount(status)})
              </option>
            ))}
          </select>
        </label>
        <label className="pick progress-status-filter">
          <span>Gerçekleşen Plan</span>
          <select
            value={entryFilter}
            onChange={(e) => setEntryFilter(e.target.value as "" | EntryStatus)}
          >
            <option value="">Tümü</option>
            {(Object.keys(ENTRY_LABELS) as (keyof typeof ENTRY_LABELS)[]).map(
              (status) => (
                <option key={status} value={status}>
                  {entryPresentation(status, locked)!.label} (
                  {entryCount(status)})
                </option>
              ),
            )}
          </select>
        </label>
      </ProgressFilters>
      <div
        className="progress-waiting-strip"
        role="group"
        aria-label="Bekleyen işler"
      >
        {WAITING.map(({ key, label }) => (
          <label key={key} className="progress-waiting-option">
            <input
              type="checkbox"
              checked={waiting.has(key)}
              onChange={(e) =>
                setWaiting((previous) => {
                  const next = new Set(previous);
                  if (e.target.checked) next.add(key);
                  else next.delete(key);
                  return next;
                })
              }
            />
            {key === "evaluation"
              ? `${month ? monthName(month) : "Seçili"} ${label}`
              : label}
            <Badge
              variant="count"
              className="progress-waiting-count"
              aria-label="adet"
            >
              {waitingCount(key)}
            </Badge>
          </label>
        ))}
        {isAdmin && (
          <button
            type="button"
            className="button primary progress-approve-all"
            disabled={saving || !approvable.length}
            title={
              waiting.size
                ? "Seçili kutulara uyan ve onay bekleyen hedef planları onaylar"
                : "Önce onaylanacak kutuyu seçin"
            }
            onClick={() => void approveAll()}
          >
            <CheckCheck size={14} aria-hidden="true" />
            Hedef Planların Tümünü Onayla
          </button>
        )}
        {approval && (
          <span
            role={approval.error ? "alert" : "status"}
            className={
              "progress-approve-message" + (approval.error ? " negative" : "")
            }
          >
            {approval.text}
          </span>
        )}
      </div>
      {groups.length ? (
        groups.map(([name, items]) => (
          <section
            key={name}
            className="progress-leader-group"
            aria-label={name + " liderliği"}
          >
            <h3>
              <button
                type="button"
                className="progress-group-toggle"
                aria-label={name + " projeleri"}
                aria-expanded={!collapsed.has(name)}
                aria-controls={groupId + "-" + encodeURIComponent(name)}
                title={
                  name +
                  (collapsed.has(name)
                    ? " projelerini aç"
                    : " projelerini kapat")
                }
                onClick={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    return next;
                  })
                }
              >
                {collapsed.has(name) ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
                {name}
                <small>{items.length} proje</small>
              </button>
            </h3>
            <div
              id={groupId + "-" + encodeURIComponent(name)}
              className="progress-group-projects"
              hidden={collapsed.has(name)}
            >
              {items.map((item) => (
                <ProgressCard
                  key={item.project.id}
                  ctx={ctx}
                  user={user}
                  project={item.project}
                  leader={name}
                  record={item.record}
                  month={month}
                  currentMonth={currentMonth}
                  saving={saving}
                  onSave={onSave}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="emptymsg">
          {leaders.length
            ? "Bu süzgece uyan proje yok."
            : "Kaynak Planlama Yetkisi'nde size liderlik atanmamış; admin yetki verdiğinde projeleriniz burada görünür."}
        </p>
      )}
    </div>
  );
}
