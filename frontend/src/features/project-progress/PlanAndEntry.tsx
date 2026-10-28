import FilterSelect from "../../components/FilterSelect";
import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ProgressLeadershipToggle from "./ProgressLeadershipToggle";
import ProgressMonthLock from "./ProgressMonthLock";
import { CheckCheck, ChevronDown, ChevronRight } from "lucide-react";
import type { Principal } from "../../access";
import type { Change } from "../../../../shared/commands";
import ProgressCard from "./ProgressCard";
import ProgressFilters from "./ProgressFilters";
import {
  baselineStatus,
  entryStatus,
  type PlanStatus,
} from "./progress-status";
import {
  progressGroups,
  progressLeaders,
  type ProgressItem,
} from "./progress-scope";
import {
  activeProgressRecords,
  progressChange,
  defaultEntryMonth,
  type ProgressContext,
} from "./progress-view";
import { monthLabel, monthName } from "../../format";
import EmptyState from "../../components/EmptyState";

/** At most one waiting-work category is active; pressing it again clears it. */
const WAITING = [
  { key: "planEntry", label: "Hedef Plan-Yönetici Girişi Bekleyen" },
  { key: "planApproval", label: "Hedef Plan-Proje Onayı Bekleyen" },
  { key: "actualEntry", label: "Gerçekleşen Plan-Yönetici Girişi Bekleyen" },
  // Actual entered for the month; it is evaluated once the month is locked.
  { key: "evaluation", label: "Değerlendirme Bekliyor" },
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
  leader,
  onLeaderChange,
  onResetFilters,
  user,
  month,
  months,
  onMonthChange,
  currentMonth,
  saving,
  onSave,
  onDraftChange,
  onBeforeFilterChange = () => true,
}: {
  onDraftChange?: (id: string, dirty: boolean) => void;
  onBeforeFilterChange?: () => boolean;
  ctx: ProgressContext;
  actionsHost: HTMLElement | null;
  responsibleFilter: ReactNode;
  leader: string;
  onLeaderChange: (leader: string) => void;
  onResetFilters: () => void;
  user: Principal | null;
  month: string;
  months: string[];
  onMonthChange: (month: string) => void;
  currentMonth: string;
  saving: boolean;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const leaders = progressLeaders(ctx, user);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [approval, setApproval] = useState<{
    text: string;
    error?: boolean;
  }>();
  const groupId = useId();
  const monthYears = [
    ...new Set([
      ...months.map((value) => value.slice(0, 4)),
      currentMonth.slice(0, 4),
    ]),
  ];
  const allowedMonths = new Set(months);
  // Only this and last year stay open; older years sit behind a toggle so the
  // strip keeps one height however long a project has been tracked.
  const [showOlderYears, setShowOlderYears] = useState(false);
  const recentFrom = String(Number(currentMonth.slice(0, 4)) - 1);
  const olderYears = monthYears.filter(
    (year) => year < recentFrom && year !== month.slice(0, 4),
  );
  const shownYears = showOlderYears
    ? monthYears
    : monthYears.filter((year) => !olderYears.includes(year));
  function resetAllFilters() {
    if (!onBeforeFilterChange()) return;
    onLeaderChange("");
    setWaiting(null);
    onResetFilters();
  }
  const locked = (ctx.data.progressLocks || []).some((l) => l.id === month);
  const entryOf = (item: ProgressItem) =>
    entryStatus(item.record, month, currentMonth);
  const planOf = (item: ProgressItem) => baselineStatus(item.record);
  const all = progressGroups(ctx, leader ? [leader] : leaders);
  const items = all.flatMap(([, groupItems]) => groupItems);
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
        .filter((item) => !waiting || isWaiting(item, waiting))
        .sort(
          (a, b) =>
            priority(a) - priority(b) ||
            a.project.name.localeCompare(b.project.name, "tr"),
        ),
    ])
    .filter(([, items]) => items.length > 0);
  // "Hedef Planların Tümünü Onayla" acts on the selection only: the cards shown under the
  // checked boxes and filters that await approval (actuals need none).
  const approvable =
    waiting === "planApproval"
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
          <>
            {month && (
              <ProgressMonthLock
                data={ctx.data}
                month={month}
                admin={isAdmin}
                saving={saving}
                onSave={onSave}
                onError={(text) =>
                  setApproval(text ? { text, error: true } : undefined)
                }
              />
            )}
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
            />
          </>,
          actionsHost,
        )}
      <ProgressFilters onReset={resetAllFilters}>
        <label className="pick">
          <span>Liderlik</span>
          <FilterSelect
            value={leader}
            onChange={(e) =>
              onBeforeFilterChange() && onLeaderChange(e.target.value)
            }
          >
            <option value="">Tümü</option>
            {leaders.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </FilterSelect>
        </label>
        {responsibleFilter}
      </ProgressFilters>
      <div
        className="progress-waiting-strip"
        role="group"
        aria-label="Bekleyen işler"
      >
        <div className="progress-waiting-filter">
          {WAITING.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={waiting === key}
              data-waiting={key}
              onClick={() => {
                if (!onBeforeFilterChange()) return;
                const next = waiting === key ? null : key;
                if (next === "evaluation")
                  onMonthChange(
                    defaultEntryMonth(
                      currentMonth,
                      activeProgressRecords(ctx.data),
                    ),
                  );
                setWaiting(next);
              }}
            >
              {label}{" "}
              <span className="progress-waiting-count">
                {waitingCount(key)}
              </span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            type="button"
            className="button primary progress-approve-all"
            disabled={saving || !approvable.length}
            title={
              waiting === "planApproval"
                ? "Görünen ve proje onayı bekleyen hedef planları onaylar"
                : "Önce Hedef Plan-Proje Onayı Bekleyen filtresini seçin"
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
      {(waiting === "actualEntry" || waiting === "evaluation") && (
        <div
          className="progress-month-strip"
          role="group"
          aria-label="Ay seçimi"
        >
          {shownYears.map((year) => (
            <div className="progress-month-year" key={year}>
              <strong>{year}</strong>
              <div className="progress-waiting-filter progress-month-filter">
                {Array.from(
                  { length: 12 },
                  (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
                ).map((value) => (
                  <button
                    type="button"
                    key={value}
                    data-month={value}
                    aria-label={monthLabel(value)}
                    aria-pressed={month === value}
                    disabled={!allowedMonths.has(value)}
                    title={
                      !allowedMonths.has(value)
                        ? value === currentMonth
                          ? "Ay henüz tamamlanmadı; bir sonraki ay seçilebilir."
                          : value > currentMonth
                            ? "Gelecek ay için gerçekleşen girişi yapılamaz."
                            : "Takip dönemi başlamadı."
                        : undefined
                    }
                    onClick={() =>
                      onBeforeFilterChange() && onMonthChange(value)
                    }
                  >
                    {monthName(value)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {olderYears.length > 0 && (
            <button
              type="button"
              className="progress-older-years"
              aria-expanded={showOlderYears}
              onClick={() => setShowOlderYears((open) => !open)}
            >
              {showOlderYears ? (
                <ChevronDown size={14} aria-hidden />
              ) : (
                <ChevronRight size={14} aria-hidden />
              )}
              Önceki yıllar ({olderYears.length})
            </button>
          )}
        </div>
      )}
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
                  onDraftChange={onDraftChange}
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
      ) : leaders.length ? (
        <EmptyState
          title="Proje bulunamadı"
          action={{ label: "Filtreleri Sıfırla", onClick: resetAllFilters }}
        >
          Seçili süzgeçlere uyan proje kartı yok.
        </EmptyState>
      ) : (
        <EmptyState title="Liderlik yetkiniz yok">
          Kaynak Planlama Yetkisi'nde size liderlik atanmamış; Admin yetki
          verdiğinde projeleriniz burada görünür.
        </EmptyState>
      )}
    </div>
  );
}
