import { useState, type PointerEvent } from "react";

export type TooltipRow = {
  name: string;
  value: string;
  color?: string;
  dashed?: boolean;
};

/** Tracks the month under the pointer; columns are equal bands from `left` to `right`. */
export function useChartHover(
  count: number,
  left: number,
  right: number,
  centered = true,
) {
  const [active, setActive] = useState<number | null>(null);
  const band = (right - left) / Math.max(1, centered ? count : count - 1);
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - box.left - left;
    const index = centered
      ? Math.floor(offset / band)
      : Math.round(offset / band);
    setActive(index < 0 || index >= count ? null : index);
  };
  return {
    active,
    setActive,
    svgProps: { onPointerMove, onPointerLeave: () => setActive(null) },
  };
}

/** Card beside the crosshair; flips to the left near the right edge. */
export default function ChartTooltip({
  x,
  width,
  title,
  rows,
  note,
}: {
  x: number;
  width: number;
  title: string;
  rows: TooltipRow[];
  note?: string;
}) {
  const flip = x > width - 240;
  return (
    <div
      className="chart-tooltip"
      aria-hidden="true"
      style={{
        left: x,
        transform: flip ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
      }}
    >
      <strong>{title}</strong>
      {rows.map((row) => (
        <span key={row.name}>
          {row.color && (
            <i
              className={row.dashed ? "dashed" : undefined}
              style={{ borderColor: row.color }}
            />
          )}
          {row.name}
          <b>{row.value}</b>
        </span>
      ))}
      {note && <small>{note}</small>}
    </div>
  );
}
