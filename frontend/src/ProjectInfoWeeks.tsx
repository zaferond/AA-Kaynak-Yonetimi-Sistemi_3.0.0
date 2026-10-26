import { useState } from "react";
import type { IsoWeek } from "./iso-week";
import { shiftWeek, weekDates, weekLabel } from "./iso-week";
import type { TopicWeek, WeekState } from "./project-info-status";

/** Current ranges longer than this collapse to one "W01–W20" chip. */
const COLLAPSE_CURRENT_WEEKS = 9;
/** Beyond this many boxes the rest fold into one "+N hafta" button. */
const MAX_VISIBLE_CHIPS = 8;
const FOLDED_SHOWN = 6;

/** Consecutive weeks in the same state; only very long runs of current
 * weeks collapse. Cancelled weeks stay one red box each, and this week is
 * always its own box so its frame marks that week alone. */
function weekRuns(weeks: TopicWeek[], thisWeek: string) {
  const runs: TopicWeek[][] = [];
  for (const item of weeks) {
    const last = runs.at(-1)?.at(-1);
    if (
      last &&
      last.state === item.state &&
      last.week.key !== thisWeek &&
      item.week.key !== thisWeek &&
      shiftWeek(last.week, 1).key === item.week.key
    )
      runs.at(-1)!.push(item);
    else runs.push([item]);
  }
  return runs.flatMap((run) =>
    run.length >= COLLAPSE_CURRENT_WEEKS && run[0].state === "current"
      ? [run]
      : run.map((w) => [w]),
  );
}

export default function TopicWeeks({
  weeks,
  thisWeek,
  selected,
}: {
  weeks: TopicWeek[];
  thisWeek: IsoWeek;
  selected: ReadonlySet<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!weeks.length) return null;
  const year = thisWeek.year;
  const current = weeks.filter((w) => w.state !== "cancelled");
  const cancelled = weeks.filter((w) => w.state === "cancelled");
  const notes: Record<WeekState, string> = {
    current: "Mevcut tarih aralığı",
    late: "Mevcut tarih aralığı · gecikmiş hafta",
    cancelled: "Önceki tarih aralığı · geçmiş kayıt",
  };
  const chip = (run: TopicWeek[]) => {
    const first = run[0].week,
      last = run.at(-1)!.week,
      state = run[0].state;
    return (
      <span
        key={state + first.key}
        className="project-info-week"
        data-state={state}
        // Only the topic's current dates frame this week; an old week that
        // happens to be this week stays a plain red box.
        data-current={
          (state === "current" && first.key === thisWeek.key) || undefined
        }
        data-selected={
          run.some(({ week }) => selected.has(week.key)) || undefined
        }
        title={
          notes[state] +
          " · " +
          (run.length > 1
            ? `${weekDates(first)} … ${weekDates(last)}`
            : weekDates(first))
        }
      >
        {run.length > 1
          ? `${weekLabel(first, year)}–${weekLabel(last, year)} · ${run.length} hafta`
          : weekLabel(first, year)}
      </span>
    );
  };
  const runs = [
    ...cancelled.map((week) => [week]),
    ...weekRuns(current, thisWeek.key),
  ];
  // Long lists keep the first boxes plus this week and selected weeks.
  const keep = (run: TopicWeek[], index: number) =>
    expanded ||
    runs.length <= MAX_VISIBLE_CHIPS ||
    index < FOLDED_SHOWN ||
    run.some(
      ({ week, state }) =>
        selected.has(week.key) ||
        (state === "current" && week.key === thisWeek.key),
    );
  const visibleRuns = runs.filter(keep);
  const hiddenRuns = runs.filter((run, index) => !keep(run, index));
  // Historical weeks first; the current range follows. The colour says it,
  // the screen-reader label spells it out.
  return (
    <span
      className="project-info-weeks"
      aria-label={[
        weeks.some((w) => w.state === "late")
          ? "Gecikmiş haftalar: " +
            weeks
              .filter((w) => w.state === "late")
              .map((w) => weekLabel(w.week, year))
              .join(", ")
          : "",
        cancelled.length
          ? "Eski haftalar: " +
            cancelled.map((w) => weekLabel(w.week, year)).join(", ")
          : "",
        current.length
          ? "Haftalar: " +
            current.map((w) => weekLabel(w.week, year)).join(", ")
          : "",
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {visibleRuns.map(chip)}
      {hiddenRuns.length > 0 && (
        <button
          type="button"
          className="project-info-week project-info-week-more"
          title={hiddenRuns
            .map((run) => weekLabel(run[0].week, year))
            .join(", ")}
          onClick={() => setExpanded(true)}
        >
          +{hiddenRuns.reduce((n, run) => n + run.length, 0)} hafta
        </button>
      )}
    </span>
  );
}
