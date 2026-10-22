import type { Data } from "../../model";
import type { WarningAssessment } from "../../../../shared/scenario-warnings.ts";
import { monthLabel } from "../../format";
import { ScenarioWarningStatus } from "./ScenarioWarningStatus";
export type ProgressBadgeInfo = WarningAssessment;
export function progressBadgeIndex(data: Data) {
  return new Map((data.warningAssessments || []).map((a) => [a.id, a]));
}
export default function ProgressBadge({
  badge,
}: {
  badge: ProgressBadgeInfo | undefined;
}) {
  // Only an actual evaluation is worth a badge here; "Eksik Hedef Plan",
  // "Değerlendirme bekliyor" and the like stay on the evaluation screens.
  if (!badge || !["ready", "completed"].includes(badge.status)) return null;
  const text = `${badge.month ? monthLabel(badge.month) + ": " : ""}${badge.warning1}${badge.warning2 ? " · " + badge.warning2 : ""}`;
  return (
    <span
      className="progress-badge-chip scenario-project-chip"
      data-progress={badge.progressState || badge.status}
      title={text}
      aria-label={text}
    >
      <ScenarioWarningStatus compact assessment={badge} />
    </span>
  );
}
