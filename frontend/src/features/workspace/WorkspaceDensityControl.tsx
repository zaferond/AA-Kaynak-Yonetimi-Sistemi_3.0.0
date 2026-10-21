import type { WorkspaceDensity } from "../WorkspaceNavigation";

export default function WorkspaceDensityControl({
  value,
  onChange,
}: {
  value: WorkspaceDensity;
  onChange: (value: WorkspaceDensity) => void;
}) {
  return (
    <label className="densitycontrol">
      Görünüm
      <select
        aria-label="Takvim yoğunluğu"
        value={value}
        onChange={(event) => onChange(event.target.value as WorkspaceDensity)}
      >
        <option value="detail">Ayrıntılı</option>
        <option value="compact">Kompakt</option>
        <option value="overview">5 Yıllık Genel Bakış</option>
      </select>
    </label>
  );
}
