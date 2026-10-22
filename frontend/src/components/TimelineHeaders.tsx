import { TableHead, TableRow } from "@/components/ui/table";
import { monthLabel, shortDateFormat } from "../format";

const YEAR_COLOR_COUNT = 6;
export const yearBandClass = (index: number) =>
  "year-band-" + (index % YEAR_COLOR_COUNT);

export function TimelineYearRow({
  years,
  labelColumns = 1,
  label = "",
}: {
  years: string[];
  labelColumns?: number;
  /** Caption over the label columns; empty by default, the years speak for
   * themselves. */
  label?: string;
}) {
  const bands: { year: string; count: number }[] = [];
  for (const year of years) {
    const last = bands.at(-1);
    if (last?.year === year) last.count++;
    else bands.push({ year, count: 1 });
  }
  return (
    <TableRow className="yearrow">
      <TableHead colSpan={labelColumns}>{label}</TableHead>
      {bands.map((band, index) => (
        <TableHead
          key={band.year}
          colSpan={band.count}
          className={yearBandClass(index)}
        >
          {band.year}
        </TableHead>
      ))}
    </TableRow>
  );
}

export function TimelineMonthHead({
  month,
  years,
  withYear = false,
}: {
  month: string;
  years: string[];
  /** "Oca 26": the month carries its year where the table has no year row. */
  withYear?: boolean;
}) {
  const name = shortDateFormat.format(new Date(month + "-01T12:00:00"));
  return (
    <TableHead
      data-month={month}
      className={"monthhead " + yearBandClass(years.indexOf(month.slice(0, 4)))}
      title={monthLabel(month)}
    >
      <span>{withYear ? name + " " + month.slice(2, 4) : name}</span>
    </TableHead>
  );
}
