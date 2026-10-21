import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

/** Shares the workspace filter surface, inline labels and reset control. */
export default function ProgressFilters({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset: () => void;
}) {
  return (
    <div
      className="planning-filterbar progress-filterbar"
      role="group"
      aria-label="İlerleme filtreleri"
    >
      <div className="filterbar-title">
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Filtreler</span>
      </div>
      <div className="filters">{children}</div>
      <div className="filteractions">
        <button type="button" className="button resetfilters" onClick={onReset}>
          Filtreleri Sıfırla
        </button>
      </div>
    </div>
  );
}
