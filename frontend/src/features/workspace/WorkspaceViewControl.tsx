/** The layout choice of a screen ("Proje Bazlı" / "Takım Bazlı"), drawn like
 * the density list so the page actions read as one row. */
export default function WorkspaceViewControl({
  label = "Görünüm",
  ariaLabel = label,
  id,
  value,
  options,
  onChange,
}: {
  label?: string;
  ariaLabel?: string;
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="densitycontrol workspace-view-control">
      {label}
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
