import { useId, type CSSProperties } from "react";
import useChartWidth from "./useChartWidth";
import ChartTooltip, { useChartHover } from "./ChartTooltip";
import { fmt, monthLabel } from "../../format";
import { areaPath, niceScale, smoothPath } from "../../chart-geometry";

type Series = {
  name: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
};

/** Shared chart geometry keeps month labels legible on both long and narrow views. */
export default function MonthlyComparison({
  title,
  months,
  series,
  unit = "fte",
  reference,
}: {
  title: string;
  months: string[];
  series: Series[];
  unit?: "fte" | "percent";
  reference?: number;
}) {
  const { ref, width } = useChartWidth();
  const w = Math.max(width, 540, months.length * 78 + 60),
    h = 254;
  const left = 58,
    top = 28,
    bottom = 210,
    right = w - 28;
  const formatValue = (value: number | null | undefined) =>
    value == null
      ? "Hesaplanamaz"
      : unit === "percent"
        ? "%" + fmt(value)
        : fmt(value) + " kişi eşdeğeri";
  const max = Math.max(
    1,
    reference || 0,
    ...series.flatMap((item) =>
      item.values.filter((value): value is number => value != null),
    ),
  );
  const scale = niceScale(max * 1.04);
  const ceiling = scale.top;
  const band = (right - left) / Math.max(1, months.length);
  const x = (i: number) => left + band * (i + 0.5);
  const y = (value: number) => bottom - (value / ceiling) * (bottom - top);
  const gradient = useId();
  const { active, setActive, svgProps } = useChartHover(
    months.length,
    left,
    right,
  );
  // Each unbroken run of months is drawn as its own smooth segment.
  const runs = (item: Series) =>
    item.values.reduce<{ x: number; y: number }[][]>(
      (all, value, i) => {
        if (value == null) all.push([]);
        else all[all.length - 1].push({ x: x(i), y: y(value) });
        return all;
      },
      [[]],
    );
  return (
    <>
      <div className="resource-chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i
              className={item.dashed ? "dashed" : undefined}
              style={{ "--series-color": item.color } as CSSProperties}
            />
            {item.name}
          </span>
        ))}
        <small>
          Birim: {unit === "percent" ? "yüzde (%)" : "kişi eşdeğeri (FTE)"}
        </small>
      </div>
      <div
        ref={ref}
        className="resource-chart-scroll"
        tabIndex={0}
        role="region"
        aria-label={title + " grafiği"}
      >
        <div className="chart-frame" style={{ width: w }}>
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label={title}
            {...svgProps}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0"
                  stopColor={series[0]?.color}
                  stopOpacity={0.16}
                />
                <stop offset="1" stopColor={series[0]?.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <text x={left} y={14} className="resource-chart-axis">
              {unit === "percent" ? "Etkinlik (%)" : "Kişi eşdeğeri"}
            </text>
            {scale.ticks.map((value) => (
              <g key={value}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(value)}
                  y2={y(value)}
                  className={
                    value ? "resource-chart-grid" : "resource-chart-baseline"
                  }
                />
                <text
                  x={left - 10}
                  y={y(value) + 4}
                  textAnchor="end"
                  className="resource-chart-axis"
                >
                  {unit === "percent" ? "%" + fmt(value) : fmt(value)}
                </text>
              </g>
            ))}
            {reference != null && (
              <g className="resource-chart-reference">
                <line
                  x1={left}
                  x2={right}
                  y1={y(reference)}
                  y2={y(reference)}
                  stroke="var(--report-forecast-color, #b45309)"
                  strokeDasharray="6 5"
                />
                <text
                  x={right}
                  y={y(reference) - 6}
                  textAnchor="end"
                  className="resource-chart-axis"
                >
                  {formatValue(reference)} · plana eşit
                </text>
              </g>
            )}
            {series[0] &&
              runs(series[0]).map((run, i) => (
                <path
                  key={i}
                  d={areaPath(run, bottom)}
                  fill={`url(#${gradient})`}
                  className="resource-chart-area"
                />
              ))}
            {active != null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={top}
                y2={bottom}
                className="chart-crosshair"
              />
            )}
            {series.map((item) =>
              runs(item).map((run, i) => (
                <path
                  key={item.name + i}
                  d={smoothPath(run)}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={item.dashed ? "6 5" : undefined}
                />
              )),
            )}
            {months.map((month, i) => {
              const label =
                monthLabel(month) +
                " · " +
                series
                  .map((item) => item.name + ": " + formatValue(item.values[i]))
                  .join(" · ");
              return (
                <g
                  key={month}
                  tabIndex={0}
                  aria-label={label}
                  className="resource-chart-point"
                  data-active={active === i || undefined}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <title>{label}</title>
                  <rect
                    x={x(i) - band / 2}
                    y={top}
                    width={band}
                    height={bottom - top}
                    fill="transparent"
                  />
                  {series
                    .filter((item) => item.values[i] != null)
                    .map((item) => (
                      <circle
                        key={item.name}
                        cx={x(i)}
                        cy={y(item.values[i]!)}
                        r={4.5}
                        fill="white"
                        stroke={item.color}
                        strokeWidth={2.5}
                      />
                    ))}
                  <text
                    x={x(i)}
                    y={234}
                    textAnchor="middle"
                    className="resource-chart-axis"
                  >
                    {monthLabel(month)}
                  </text>
                </g>
              );
            })}
          </svg>
          {active != null && (
            <ChartTooltip
              x={x(active)}
              width={w}
              title={monthLabel(months[active])}
              rows={series.map((item) => ({
                name: item.name,
                value: formatValue(item.values[active]),
                color: item.color,
                dashed: item.dashed,
              }))}
            />
          )}
        </div>
      </div>
      <details className="resource-chart-values">
        <summary>Aylık değerleri göster</summary>
        <div className="resource-chart-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Ay</th>
                {series.map((item) => (
                  <th scope="col" key={item.name}>
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((month, i) => (
                <tr key={month}>
                  <th scope="row">{monthLabel(month)}</th>
                  {series.map((item) => (
                    <td key={item.name}>{formatValue(item.values[i])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
