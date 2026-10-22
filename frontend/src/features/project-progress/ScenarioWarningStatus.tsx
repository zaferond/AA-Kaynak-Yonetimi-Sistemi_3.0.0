import type { WarningAssessment } from "../../../../shared/scenario-warnings.ts";
import Badge, { progressTone } from "../../components/Badge";
import {
  WARNING_PROGRESS_LABELS,
  WARNING_RESOURCE_LABELS,
} from "../../../../shared/scenario-warning-policy.ts";
import { monthLabel, monthName } from "../../format";
import { pctLabel } from "./progress-view";

export function ScenarioWarningStatus({
  assessment,
  compact = false,
  awaiting,
}: {
  assessment?: WarningAssessment;
  compact?: boolean;
  /** No month is locked yet: the month waiting to be evaluated and the
   * leaderships that have not entered its actual. */
  awaiting?: { month: string; leaders: string[] };
}) {
  const waiting =
    !!awaiting?.month && (!assessment || assessment.status === "unlocked");
  return (
    <div
      className="scenario-warning-status"
      data-compact={compact || undefined}
    >
      <Badge
        variant="status"
        tone={progressTone(
          waiting
            ? "unlocked"
            : assessment?.progressState || assessment?.status || "unlocked",
        )}
        className="scenario-progress-badge"
        data-progress={
          assessment?.progressState || assessment?.status || "unlocked"
        }
      >
        {waiting
          ? awaiting!.leaders.length
            ? `${monthName(awaiting!.month)} - Gerçekleşen Planların Tamamlanması Bekleniyor`
            : `${monthName(awaiting!.month)} Ayı Kilitlenmesi Bekleniyor`
          : assessment?.warning1 || "Değerlendirme bekliyor"}
      </Badge>
      {waiting && !!awaiting!.leaders.length && (
        <ul
          className="scenario-missing-leaders"
          aria-label="Gerçekleşen girişi eksik liderlikler"
        >
          {awaiting!.leaders.map((leader) => (
            <li key={leader}>{leader}</li>
          ))}
        </ul>
      )}
      {assessment?.warning2 && (
        <span className="scenario-warning-action">{assessment.warning2}</span>
      )}
      {!compact && !!assessment?.missingLeaders?.length && (
        <ul
          className="scenario-missing-leaders"
          aria-label="Hedef planı eksik liderlikler"
        >
          {assessment.missingLeaders.map((leader) => (
            <li key={leader}>{leader}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WarningCalculationSummary({
  assessment: a,
}: {
  assessment?: WarningAssessment;
}) {
  if (!a)
    return (
      <p className="emptymsg">
        Henüz kilitlenmiş ay yok; değerlendirme bekliyor.
      </p>
    );
  const percent = (n: number | null) => (n === null ? "—" : `%${pctLabel(n)}`);
  return (
    <div className="scenario-calculation">
      <p>
        <strong>Hesap özeti</strong> ·{" "}
        {a.month ? monthLabel(a.month) + " (son kilitli ay)" : "Kilitli ay yok"}
      </p>
      {a.reason && <p>{a.reason}</p>}
      <dl>
        <div>
          <dt>Kümülatif Hedeflenen %</dt>
          <dd>{percent(a.planned)}</dd>
        </div>
        <div>
          <dt>Kümülatif Gerçekleşen %</dt>
          <dd>{percent(a.actual)}</dd>
        </div>
        <div>
          <dt>Sapma</dt>
          <dd>
            {a.deviation === null
              ? "—"
              : `${a.deviation > 0 ? "+" : ""}${pctLabel(a.deviation)} puan`}
          </dd>
        </div>
        <div>
          <dt>İlerleme Durumu</dt>
          <dd>
            {a.progressState
              ? WARNING_PROGRESS_LABELS[a.progressState]
              : "Değerlendirme bekliyor"}
          </dd>
        </div>
        <div>
          <dt>Kalan İş %</dt>
          <dd>{percent(a.remaining)}</dd>
        </div>
        <div>
          <dt>Gelecek Planlı %</dt>
          <dd>{percent(a.futurePlanned)}</dd>
        </div>
        <div>
          <dt>Karşılama</dt>
          <dd>{percent(a.coverage === null ? null : a.coverage * 100)}</dd>
        </div>
        <div>
          <dt>Kaynak Durumu</dt>
          <dd>
            {a.resourceState ? WARNING_RESOURCE_LABELS[a.resourceState] : "—"}
          </dd>
        </div>
      </dl>
      {a.trendEscalated && (
        <p>
          Ardışık kilitli aylarda planın gerisinde kalındığı için Kritik Gecikme
          durumuna yükseltildi.
        </p>
      )}
      {a.status === "ready" && (
        <p>
          Gelecek Planlı %, son kilitli aydan proje bitişine kadar ayrılan
          kaynağın onay anında sabitlenen kaynak/hedef oranıyla hesaplanır.
          Sonraki {a.horizonMonths} ayda kaynak planı:{" "}
          {a.nextResources > 0 ? "Var" : "Yok"}.
        </p>
      )}
      {a.migratedReference && (
        <p className="scenario-reference-note">
          Bu eski planın kaynak referansı, yeni uyarı sistemine geçişteki
          dağılımdan bir kez oluşturuldu.
        </p>
      )}
    </div>
  );
}
