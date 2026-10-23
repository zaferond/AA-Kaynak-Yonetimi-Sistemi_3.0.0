import { activityValue, type ActivityMonth } from "./activity-report-data.ts";

export type ActivityBand = "over" | "full" | "good" | "low" | "very-low";

/** Utilisation band of a finished month, read from the percentage whatever
 * the unit shown. The running month stays neutral: its total is partial. */
export function activityBand(
  cell: ActivityMonth,
  currentMonth: string,
): ActivityBand | undefined {
  if (cell.totalFte <= 0 || cell.month >= currentMonth) return undefined;
  const percent = activityValue(cell, "percent");
  if (percent === null) return undefined;
  return percent > 100
    ? "over"
    : percent >= 90
      ? "full"
      : percent >= 70
        ? "good"
        : percent >= 50
          ? "low"
          : "very-low";
}

export const BAND_LABELS: Record<ActivityBand, string> = {
  over: "%100 üstü",
  full: "%90–100",
  good: "%70–90",
  low: "%50–70",
  "very-low": "%50 altı",
};

/** Same tints as the screen (technical-tables.css), for the Excel copy. */
export const BAND_FILLS: Record<ActivityBand, string> = {
  over: "FBE2DA",
  full: "E1F0E7",
  good: "F0F7F2",
  low: "FDF3DF",
  "very-low": "F9E1BD",
};
