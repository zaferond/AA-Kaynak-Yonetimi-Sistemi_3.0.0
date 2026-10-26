import type { WarningAssessment } from "./scenario-warnings.ts";
import {
  matchWarningRule,
  WARNING_PROGRESS_LABELS,
  type WarningProgressState,
  type WarningResourceState,
} from "./scenario-warning-policy.ts";
import { previousMonth } from "./project-progress.ts";

export type WarningPriority = "critical" | "attention" | "information";
export const WARNING_PRIORITY_LABELS: Record<WarningPriority, string> = {
  critical: "Kritik",
  attention: "Dikkat",
  information: "Bilgilendirme",
};
export function warningPriority(a: WarningAssessment): WarningPriority | null {
  if (a.status !== "ready") return null;
  if (a.progressState === "critical") return "critical";
  if (
    a.progressState === "behind" ||
    a.resourceState === "unplanned" ||
    a.resourceState === "insufficient"
  )
    return "attention";
  if (a.resourceState === "excess") return "information";
  return null;
}
export function warningRecommendation(
  progress: WarningProgressState,
  resource: WarningResourceState | null,
) {
  const rule = resource && matchWarningRule(progress, resource);
  if (rule) return rule.uyari2;
  if (resource === "unplanned")
    return "Yakın dönem kaynak planı ve işlerin devamlılığı proje sorumlusuyla değerlendirilmeli.";
  if (progress === "critical" || progress === "behind")
    return "Gecikmenin nedenleri ve kaynakların zaman içindeki dağılımı incelenmeli; takvim revizyonu ihtiyacı değerlendirilmeli.";
  return "";
}
export function warningFinding(a: WarningAssessment) {
  if (a.status !== "ready") return a.reason || "Değerlendirme bekliyor.";
  const resource =
    a.resourceState === "unplanned"
      ? `İzleyen ${a.horizonMonths} aylık dönemde kaynak planı bulunmuyor`
      : a.resourceState === "insufficient"
        ? "Kalan iş için kaynak karşılama tahmini düşük"
        : a.resourceState === "excess"
          ? "Kalan işe göre kaynak karşılama tahmini yüksek"
          : "Kaynak karşılama tahmini tanımlı aralıkta";
  return `${a.progressState ? WARNING_PROGRESS_LABELS[a.progressState] : "İlerleme değerlendirilemedi"}. ${resource}.`;
}
export function warningEvidence(a: WarningAssessment) {
  const number = (n: number | null) =>
    n === null
      ? "—"
      : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n);
  return `Hedef %${number(a.planned)} · Gerçekleşen %${number(a.actual)} · Sapma ${number(a.deviation)} puan · Kaynak karşılama ${a.coverage === null ? "—" : "%" + number(a.coverage * 100)}`;
}
/** Only completed calendar months are expected to have a locked evaluation. */
export function pendingAssessmentReason(a: WarningAssessment, today: string) {
  if (a.status === "completed" || a.status === "notStarted") return "";
  if (a.status !== "ready")
    return (
      a.reason || "Hedef, gerçekleşen ve ay kilidi bilgileri tamamlanmalı."
    );
  if (a.month && a.month < previousMonth(today.slice(0, 7)))
    return "Son değerlendirme güncel değil. Son tamamlanan ayın gerçekleşen girişleri ve ay kilidi bekleniyor.";
  return "";
}
