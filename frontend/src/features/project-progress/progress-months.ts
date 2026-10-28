import {
  earliestOpening,
  monthsAfter,
  previousMonth,
  type ProjectProgress,
} from "../../../../shared/project-progress.ts";

/** Reports may show the current month; entry selection uses completed months. */
export function entryMonths(
  current: string,
  records?: ProjectProgress[],
  completedOnly = false,
) {
  return monthsAfter(
    earliestOpening(records, current),
    completedOnly ? previousMonth(current) : current,
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
