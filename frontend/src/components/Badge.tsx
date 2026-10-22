import type { HTMLAttributes, ReactNode } from "react";
import type { ScenarioStatus } from "../../../shared/schedule-shift.ts";
import { isWorkingStatus } from "../model";

/** The one badge of the interface: five tones, three forms. Tone carries
 * meaning (warning = someone has to act); the form says what it is. */
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
/** label: role or kind · status: a record's state (leading dot) · count. */
export type BadgeVariant = "label" | "status" | "count";

/** The badge attributes, for an element that must stay a button. */
export const badgeAttrs = (
  tone: BadgeTone = "neutral",
  variant: BadgeVariant = "label",
  className = "",
) => ({
  className: ("ui-badge " + className).trim(),
  "data-tone": tone,
  "data-variant": variant,
});

export default function Badge({
  tone,
  variant,
  className,
  children,
  ...rest
}: {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className">) {
  return (
    <span {...rest} {...badgeAttrs(tone, variant, className)}>
      {children}
    </span>
  );
}

export const resourceStatusTone = (status: string): BadgeTone =>
  isWorkingStatus(status)
    ? "success"
    : status === "Aktif İlan"
      ? "info"
      : "neutral";

export const scenarioStatusTone = (status: ScenarioStatus): BadgeTone =>
  status === "approved" ? "info" : status === "applied" ? "success" : "neutral";

/** Evaluation badge: progress state first, then the assessment status. */
export const progressTone = (state: string | undefined): BadgeTone =>
  state === "critical"
    ? "danger"
    : state === "behind" || state === "missing"
      ? "warning"
      : state === "onTrack" || state === "completed"
        ? "success"
        : state === "ahead"
          ? "info"
          : "neutral";
