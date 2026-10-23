import { monthLabel } from "./format";
import { useId, useMemo } from "react";
import { areaPath, niceScale, smoothPath } from "./chart-geometry";
import ChartTooltip, {
  useChartHover,
} from "./features/resource-reports/ChartTooltip";
import useChartWidth from "./features/resource-reports/useChartWidth";
import type { Data } from "./model";
import { buildHeadcountTrend } from "./headcount-trend";

const numberFormat = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});
const fmt = (value: number) => numberFormat.format(value);

type Props = {
  data: Data;
  teamIds: string[];
  leads: string[];
  months: string[];
};

export default function HeadcountTrend({
  data,
  teamIds,
  leads,
  months,
}: Props) {
  const teamKey = teamIds.join("|"),
    leadKey = leads.join("|");
  const points = useMemo(
    () => buildHeadcountTrend(data, teamIds, leads, months),
    [data, teamKey, leadKey, months],
  );
  const lastActual = [...points].reverse().find((point) => !point.future);
  const lastProjected = [...points].reverse().find((point) => point.future);
  const previousActual = [...points]
    .reverse()
    .filter((point) => !point.future)[1];
  const change =
    lastActual && previousActual
      ? lastActual.actualAverage! - previousActual.actualAverage!
      : null;
  const { ref, width: available } = useChartWidth();
  const scale = niceScale(
    Math.max(
      1,
      ...points.map(
        (point) => point.actualAverage ?? point.projectedAverage ?? 0,
      ),
    ) * 1.04,
  );
  const width = Math.max(available, 540, points.length * 64),
    height = 252;
  const left = 56,
    right = width - 26,
    top = 40,
    bottom = 194;
  const x = (index: number) =>
    left + (index * (right - left)) / Math.max(1, points.length - 1);
  const y = (value: number) => bottom - (value / scale.top) * (bottom - top);
  const actual = points.flatMap((point, index) =>
    point.actualAverage === null
      ? []
      : [{ x: x(index), y: y(point.actualAverage) }],
  );
  const projected = points.flatMap((point, index) =>
    point.projectedAverage === null
      ? []
      : [{ x: x(index), y: y(point.projectedAverage) }],
  );
  if (projected.length && actual.length)
    projected.unshift(actual[actual.length - 1]);
  const firstFuture = points.findIndex((point) => point.future);
  const divider =
    firstFuture > 0 ? (x(firstFuture - 1) + x(firstFuture)) / 2 : null;
  const lastActualIndex = points.indexOf(lastActual!),
    lastProjectedIndex = points.indexOf(lastProjected!);
  const gradient = useId();
  const { active, svgProps } = useChartHover(points.length, left, right, false);
  const activePoint = active == null ? null : points[active];
  const tickStep =
    points.length > 36
      ? 6
      : points.length > 18
        ? 3
        : points.length > 12
          ? 2
          : 1;
  return (
    <section id="rapor-calisan" className="panel trend headcount-trend">
      <div className="panelhead">
        <div>
          <h2>Aylık Ortalama Çalışan Sayısı ve Öngörü Grafiği</h2>
          <p>Aktif Çalışan, Gear Up ve Saat Ücretli · seçili takımlar</p>
        </div>
        <div className="headcount-metrics">
          {lastActual && (
            <div>
              <span>Gerçekleşen Ortalama</span>
              <strong>
                {fmt(lastActual.actualAverage!)} <small>kişi</small>
              </strong>
              {change != null && (
                <em
                  className="chart-change"
                  data-trend={change > 0 ? "up" : change < 0 ? "down" : "flat"}
                >
                  {change > 0 ? "▲ +" : change < 0 ? "▼ " : ""}
                  {fmt(change)} kişi · önceki aya göre
                </em>
              )}
            </div>
          )}
          {lastProjected && (
            <div>
              <span>Dönem Sonu Öngörüsü</span>
              <strong>
                {fmt(lastProjected.projectedAverage!)} <small>kişi</small>
              </strong>
              {lastActual && (
                <em className="chart-change" data-trend="forecast">
                  {monthLabel(lastProjected.month)} sonu ·{" "}
                  {lastProjected.projectedAverage! >= lastActual.actualAverage!
                    ? "+"
                    : ""}
                  {fmt(
                    lastProjected.projectedAverage! - lastActual.actualAverage!,
                  )}{" "}
                  kişi
                </em>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="headcount-legend">
        <span>
          <i className="headcount-key actual" />
          Gerçekleşen Birikimli Ortalama
        </span>
        {lastProjected && (
          <span>
            <i className="headcount-key projected" />
            Aktif İlanlar Dahil Öngörü
          </span>
        )}
      </div>
      <div className="chartscroll" ref={ref}>
        <div className="chart-frame" style={{ width }}>
          <svg
            role="img"
            aria-label="Aylara göre birikimli ortalama çalışan sayısı ve gelecek ayların aktif ilanlar dahil öngörüsü"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            {...svgProps}
          >
            <title>Aylık ortalama çalışan sayısı ve öngörü</title>
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0"
                  stopColor="var(--report-current-color, #087f6a)"
                  stopOpacity={0.16}
                />
                <stop
                  offset="1"
                  stopColor="var(--report-current-color, #087f6a)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            {divider != null && (
              <rect
                x={divider}
                y={top - 12}
                width={right + 12 - divider}
                height={bottom - top + 12}
                className="chart-forecast-zone"
              />
            )}
            {scale.ticks.map((value) => (
              <g key={value}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(value)}
                  y2={y(value)}
                  className={value ? "chart-grid" : "chart-baseline"}
                />
                <text
                  x={left - 10}
                  y={y(value) + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--report-label-color, #6d8092)"
                >
                  {fmt(value)}
                </text>
              </g>
            ))}
            {divider != null && (
              <text
                x={divider + 8}
                y={top - 18}
                fontSize={12}
                fill="var(--report-forecast-color, #b45309)"
              >
                Öngörü
              </text>
            )}
            {actual.length > 1 && (
              <path d={areaPath(actual, bottom)} fill={`url(#${gradient})`} />
            )}
            {active != null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={top - 12}
                y2={bottom}
                className="chart-crosshair"
              />
            )}
            {actual.length > 0 && (
              <path
                d={smoothPath(actual)}
                fill="none"
                stroke="var(--report-current-color, #087f6a)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {projected.length > 0 && (
              <path
                d={smoothPath(projected)}
                fill="none"
                stroke="var(--report-forecast-color, #b45309)"
                strokeWidth={2.5}
                strokeDasharray="6 5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {points.map((point, index) => {
              const value = point.future
                ? point.projectedAverage
                : point.actualAverage;
              return (
                <g key={point.month}>
                  <circle
                    className="chart-dot"
                    data-active={active === index || undefined}
                    data-keep={
                      index === lastActualIndex ||
                      index === lastProjectedIndex ||
                      undefined
                    }
                    cx={x(index)}
                    cy={y(value ?? 0)}
                    r={4.5}
                    fill="#fff"
                    stroke={
                      point.future
                        ? "var(--report-forecast-color, #b45309)"
                        : "var(--report-current-color, #087f6a)"
                    }
                    strokeWidth={2.5}
                  >
                    <title>
                      {monthLabel(point.month)} · Aktif Çalışan:{" "}
                      {fmt(point.active)} · Gear Up: {fmt(point.gearUp)} · Saat
                      Ücretli: {fmt(point.hourly)}
                      {point.future
                        ? ` · Aktif İlan: ${fmt(point.postings)} · Öngörülen Aylık Sayı: ${fmt(point.projectedCount)} · Birikimli ortalama: ${fmt(point.projectedAverage ?? 0)}`
                        : ` · Aylık Sayı: ${fmt(point.actualCount)} · Birikimli ortalama: ${fmt(point.actualAverage ?? 0)}`}
                    </title>
                  </circle>
                  {(index % tickStep === 0 || index === points.length - 1) && (
                    <text
                      x={x(index)}
                      y={225}
                      textAnchor="middle"
                      fontSize={12}
                      fill="var(--report-label-color, #61758b)"
                    >
                      {monthLabel(point.month)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {activePoint && (
            <ChartTooltip
              x={x(active!)}
              width={width}
              title={
                monthLabel(activePoint.month) +
                (activePoint.future ? " · öngörü" : "")
              }
              rows={[
                activePoint.future
                  ? {
                      name: "Birikimli ortalama",
                      value: fmt(activePoint.projectedAverage ?? 0) + " kişi",
                      color: "var(--report-forecast-color, #b45309)",
                      dashed: true,
                    }
                  : {
                      name: "Birikimli ortalama",
                      value: fmt(activePoint.actualAverage ?? 0) + " kişi",
                      color: "var(--report-current-color, #087f6a)",
                    },
                {
                  name: activePoint.future ? "Öngörülen aylık" : "Aylık sayı",
                  value: fmt(
                    activePoint.future
                      ? activePoint.projectedCount
                      : activePoint.actualCount,
                  ),
                },
                { name: "Aktif Çalışan", value: fmt(activePoint.active) },
                { name: "Gear Up", value: fmt(activePoint.gearUp) },
                { name: "Saat Ücretli", value: fmt(activePoint.hourly) },
                ...(activePoint.future
                  ? [{ name: "Aktif İlan", value: fmt(activePoint.postings) }]
                  : []),
              ]}
            />
          )}
        </div>
      </div>
    </section>
  );
}
