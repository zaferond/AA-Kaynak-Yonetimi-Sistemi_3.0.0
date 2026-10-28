import {
  earliestOpening,
  lastActualEntryMonth,
  monthsAfter,
  previousMonth,
  type ProjectProgress,
} from "../../../../shared/project-progress.ts";

/** Completed projects no longer widen the month strip back to their start. */
export function activeProgressRecords(data: {
  projects: { id: string; completed?: boolean }[];
  projectProgress?: ProjectProgress[];
}) {
  const completed = new Set(
    data.projects.filter((p) => p.completed).map((p) => p.id),
  );
  return (data.projectProgress || []).filter(
    (record) => !completed.has(record.projectId),
  );
}
/** Reports may show the current month; entry selection uses completed months. */
export function entryMonths(
  current: string,
  records?: ProjectProgress[],
  completedOnly = false,
) {
  return monthsAfter(
    earliestOpening(records, current),
    completedOnly ? lastActualEntryMonth(current) : current,
  );
}
export function defaultEntryMonth(
  current: string,
  records?: ProjectProgress[],
) {
  const months = entryMonths(current, records);
  const previous = previousMonth(current);
  return months.includes(previous) ? previous : months.at(-1) || "";
}
/** Only this and last year stay open; older years sit behind a toggle so the
 * strip keeps one height however long a project has been tracked. The year of
 * the selected month always stays visible. */
export function monthStripYears(
  months: string[],
  current: string,
  selected: string,
  showOlder: boolean,
) {
  const years = [
    ...new Set([...months.map((m) => m.slice(0, 4)), current.slice(0, 4)]),
  ];
  const recentFrom = String(Number(current.slice(0, 4)) - 1);
  const olderYears = years.filter(
    (year) => year < recentFrom && year !== selected.slice(0, 4),
  );
  const shownYears = showOlder
    ? years
    : years.filter((year) => !olderYears.includes(year));
  return { olderYears, shownYears };
}
