import { useState } from "react";
import { X } from "lucide-react";
import type { PickerItem } from "../components/FilterPicker";

export type TokenGroup = {
  label: string;
  value: string[];
  items: readonly PickerItem[];
  onChange: (value: string[]) => void;
};

const VISIBLE = 3;

/** Applied selections as removable tokens; clearing empties only the groups shown. */
export default function FilterTokens({
  groups,
  onClear,
}: {
  groups: TokenGroup[];
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const active = groups.filter((group) => group.value.length);
  if (!active.length) return null;
  return (
    <div className="filter-tokens" aria-label="Uygulanan filtreler">
      {active.map((group) => {
        const chosen = group.value.map(
          (id) =>
            group.items.find((item) => item.id === id) ?? { id, name: id },
        );
        const open = expanded.includes(group.label);
        const shown = open ? chosen : chosen.slice(0, VISIBLE);
        return (
          <div
            key={group.label}
            className="filter-token-group"
            data-filter={group.label}
          >
            <span>{group.label}</span>
            {shown.map((item) => (
              <button
                key={item.id}
                type="button"
                className="filter-token"
                title={item.description ? item.description : undefined}
                aria-label={`${group.label} filtresinden ${item.name} kaldır`}
                onClick={() =>
                  group.onChange(group.value.filter((id) => id !== item.id))
                }
              >
                {item.name}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            {chosen.length > VISIBLE && (
              <button
                type="button"
                className="filter-token-more"
                aria-expanded={open}
                onClick={() =>
                  setExpanded(
                    open
                      ? expanded.filter((label) => label !== group.label)
                      : [...expanded, group.label],
                  )
                }
              >
                {open ? "Daha az" : `+${chosen.length - VISIBLE}`}
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="filter-tokens-clear"
        onClick={() => {
          for (const group of active) group.onChange([]);
          onClear();
        }}
      >
        Seçimleri temizle
      </button>
    </div>
  );
}
