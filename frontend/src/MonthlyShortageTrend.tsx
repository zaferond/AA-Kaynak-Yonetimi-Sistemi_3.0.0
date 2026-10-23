import { monthLabel } from "./format";
import { useMemo } from "react";
import { niceScale } from "./chart-geometry";
import ChartTooltip, {
  useChartHover,
} from "./features/resource-reports/ChartTooltip";
import useChartWidth from "./features/resource-reports/useChartWidth";
import type { Metric } from "./metrics";
import {
  buildMonthlyShortageTrend,
  summarizeMonthlyShortage,
} from "./monthly-shortage-trend";
import EmptyState from "./components/EmptyState";

const numberFormat = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});
const fmt = (value: number) => numberFormat.format(value);

type Props = {
  capacity: Record<string, Metric>;
  teamIds: string[];
  months: string[];
  filterLabel: string;
};

export default function MonthlyShortageTrend({
  capacity,
  teamIds,
  months,
  filterLabel,
}: Props) {
  const teamKey = teamIds.join("|");
  const points = useMemo(
    () => buildMonthlyShortageTrend(capacity, teamIds, months),
    [capacity, teamKey, months],
  );
  const summary = summarizeMonthlyShortage(points);
  const scale = niceScale(
    Math.max(1, ...points.map((point) => point.total)) * 1.04,
  );
  const { ref, width: available } = useChartWidth();
  const width = Math.max(available, 540, points.length * 56 + 78),
    height = 274;
  const left = 58,
    right = width - 24,
    baseline = 214,
    chartHeight = 164;
  const band = (right - left) / Math.max(1, points.length);
  const barWidth = Math.min(28, Math.max(10, band * 0.42));
  const center = (index: number) => left + (index + 0.5) * band;
  const y = (value: number) => baseline - (value / scale.top) * chartHeight;
  const { active, svgProps } = useChartHover(points.length, left, right);
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
    <section
      id="rapor-aylik-eksik"
      className="panel trend monthly-shortage-trend"
    >
      <div className="panelhead">
        <div>
          <h2>Aylık Eksik Kaynak Grafiği</h2>
          <p>
            {filterLabel} · {teamIds.length} takım
            {points.length > 0 && (
              <>
                {" "}
                · {monthLabel(points[0].month)} –{" "}
                {monthLabel(points[points.length - 1].month)} ·{" "}
                {summary.monthCount} ay
              </>
            )}
          </p>
        </div>
        <div className="shortage-summary">
          <span>Aylık Ortalama Eksik Kaynak</span>
          <strong>
            {fmt(summary.average)} <small>kişi eşdeğeri</small>
          </strong>
          <small>
            {fmt(summary.total)} kişi-ay / {summary.monthCount} ay
          </small>
        </div>
      </div>
      {teamIds.length && points.length ? (
        <div className="chartscroll" ref={ref}>
          <div className="chart-frame" style={{ width }}>
            <svg
              role="img"
              aria-label="Aylık eksik kaynak sayısı"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              {...svgProps}
            >
              <title>Aylık eksik kaynak sayısı</title>
              {active != null && (
                <rect
                  x={center(active) - band / 2}
                  y={baseline - chartHeight - 8}
                  width={band}
                  height={chartHeight + 8}
                  className="chart-band"
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
              {summary.average > 0 && (
                <g className="chart-average">
                  <line
                    x1={left}
                    x2={right}
                    y1={y(summary.average)}
                    y2={y(summary.average)}
                  />
                  <text
                    x={right}
                    y={y(summary.average) - 6}
                    textAnchor="end"
                    fontSize={12}
                  >
                    Ortalama {fmt(summary.average)}
                  </text>
                </g>
              )}
              {points.map((point, index) => {
                const x = center(index),
                  label = monthLabel(point.month);
                return (
                  <g key={point.month}>
                    <rect
                      x={x - barWidth / 2}
                      y={y(point.total)}
                      width={barWidth}
                      height={Math.max(0, baseline - y(point.total))}
                      rx={2}
                      className="chart-bar"
                      data-active={active === index || undefined}
                      data-dim={
                        (active != null && active !== index) || undefined
                      }
                      fill="var(--report-shortage-color, #c2410c)"
                    >
                      <title>
                        {label} · Eksik kaynak: {fmt(point.total)} kişi eşdeğeri
                        · Takım sayısı: {point.teamCount}
                      </title>
                    </rect>
                    {(index % tickStep === 0 ||
                      index === points.length - 1) && (
                      <text
                        x={x}
                        y={239}
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
                x={center(active!)}
                width={width}
                title={monthLabel(activePoint.month)}
                rows={[
                  {
                    name: "Eksik kaynak",
                    value: fmt(activePoint.total) + " kişi eşdeğeri",
                    color: "var(--report-shortage-color, #c2410c)",
                  },
                  {
                    name: "Kapsamdaki takım",
                    value: String(activePoint.teamCount),
                  },
                  {
                    name: "Ortalamaya göre",
                    value:
                      (activePoint.total >= summary.average ? "+" : "") +
                      fmt(activePoint.total - summary.average),
                  },
                ]}
              />
            )}
          </div>
        </div>
      ) : (
        <EmptyState title="Grafik için takım yok">
          Liderlik veya takım seçimine uyan takım bulunamadı.
        </EmptyState>
      )}
    </section>
  );
}
