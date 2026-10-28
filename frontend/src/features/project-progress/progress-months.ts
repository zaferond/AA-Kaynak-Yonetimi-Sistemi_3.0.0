import {
  earliestOpening,
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
