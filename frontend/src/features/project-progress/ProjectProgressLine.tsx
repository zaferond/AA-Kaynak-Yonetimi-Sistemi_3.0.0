import type { WarningAssessment } from "../../../../shared/scenario-warnings.ts";
import { WARNING_PROGRESS_LABELS } from "../../../../shared/scenario-warning-policy.ts";
import { fmt, monthLabel } from "../../format";

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const round = (value: number) => Math.round(value * 10) / 10;

/** Under the project name on Projeler: the last evaluated month's actual
 * progress as a fill, the target as a tick, coloured by the deviation state.
 * Shown only for an actual evaluation (same rule as the progress badge). */
export default function ProjectProgressLine({
  assessment: a,
}: {
  assessment: WarningAssessment | undefined;
}) {
  if (
    !a ||
    !["ready", "completed"].includes(a.status) ||
    a.planned === null ||
    a.actual === null
  )
    return null;
  const state = a.progressState ? WARNING_PROGRESS_LABELS[a.progressState] : "";
  const deviation =
    a.deviation === null
      ? ""
      : ` · Sapma ${a.deviation > 0 ? "+" : ""}${fmt(a.deviation)} puan`;
  const title =
    `${a.month ? monthLabel(a.month) + ": " : ""}Gerçekleşen %${fmt(a.actual)}` +
    ` · Hedef %${fmt(a.planned)}${deviation}${state ? " · " + state : ""}`;
  return (
    <span
      className="project-progress-line"
      data-progress={a.progressState || a.status}
      title={title}
      aria-label={"İlerleme, " + title}
      role="img"
    >
      <span className="project-progress-track" aria-hidden="true">
        <span
          className="project-progress-fill"
          style={{ width: clamp(a.actual) + "%" }}
        />
        <span
          className="project-progress-target"
          style={{ left: clamp(a.planned) + "%" }}
        />
      </span>
      <small aria-hidden="true">
        {a.month ? monthLabel(a.month) + " · " : ""}%{fmt(round(a.actual))}
        <span> / %{fmt(round(a.planned))}</span>
      </small>
    </span>
  );
}
