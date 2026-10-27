import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import {
  SCENARIO_STATUS_LABELS,
  type ShiftScenario,
} from "../../../../shared/schedule-shift.ts";
import type { Data } from "../../model";

type Props = {
  data: Data;
  scenarios: ShiftScenario[];
  activeId: string | null;
  onChange: (id: string | null) => void;
  onEdit: () => void;
  /** Takes the scenarios off the reports; saved records stay. */
  onClear: () => void;
};

/** Which plan the resource reports are drawn for: the current one or a
 * delay scenario (a what-if; the records stay as they are). */
export default function ScenarioReportBar({
  data,
  scenarios,
  activeId,
  onChange,
  onEdit,
  onClear,
}: Props) {
  if (!scenarios.length) return null;
  const active = scenarios.find((s) => s.id === activeId);
  // Saved scenarios show their decision status next to the name.
  const status = (scenario: ShiftScenario) => {
    const saved = data.scheduleScenarios?.find((s) => s.id === scenario.id);
    return saved
      ? " · " + SCENARIO_STATUS_LABELS[saved.status]
      : " · kaydedilmedi";
  };
  const describe = (scenario: ShiftScenario) =>
    scenario.shifts
      .filter((s) => s.projectId && s.months)
      .map((s) => {
        const name = data.projects.find((p) => p.id === s.projectId)?.name;
        return `${name} ${s.months > 0 ? "+" : ""}${s.months} ay`;
      })
      .join(", ");
  return (
    <div
      className={"scenario-report-bar" + (active ? " is-active" : "")}
      role="group"
      aria-label="Rapor senaryosu"
    >
      <CalendarClock size={16} aria-hidden="true" />
      <span className="scenario-report-label">Raporlar:</span>
      <div className="scenario-report-options">
        <button
          type="button"
          className={"button" + (!active ? " primary" : "")}
          aria-pressed={!active}
          onClick={() => onChange(null)}
        >
          Mevcut
        </button>
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={"button" + (scenario.id === activeId ? " primary" : "")}
            aria-pressed={scenario.id === activeId}
            title={describe(scenario)}
            onClick={() => onChange(scenario.id)}
          >
            {scenario.name}
            {status(scenario)}
          </button>
        ))}
      </div>
      <span className="scenario-report-note">
        {active
          ? `Senaryo görünümü: ${describe(active)}. Aşağıdaki raporlar bu senaryoya göredir (üstteki özet kartları mevcut durum); kayıtlar değişmedi, çerçeveli hücreler mevcut duruma göre değişenlerdir.`
          : "Bir senaryo seçerek aşağıdaki raporları yeni takvimle görebilirsiniz."}
      </span>
      <div className="scenario-report-actions">
        <button type="button" className="button" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" />
          Senaryo Düzenle
        </button>
        <button
          type="button"
          className="button danger"
          title="Senaryoları raporlardan kaldırır; kayıtlı senaryolar Proje Takvimi Güncelle ekranında kalır."
          onClick={() => {
            if (
              confirm(
                "Senaryolar raporlardan kaldırılsın mı? Kayıtlı senaryolar silinmez; Proje Takvimi Güncelle ekranından yeniden açılabilir.",
              )
            )
              onClear();
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
          Kaldır
        </button>
      </div>
    </div>
  );
}
