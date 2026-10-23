import {
  assertExcelRowCount,
  columnName,
  excelCellText,
  spreadsheetNamespace,
} from "../../xlsx-cells.ts";
import { createWorkbook, downloadWorkbook } from "../../xlsx-workbook.ts";
import { SYSTEM_NAME } from "../../settings.ts";
import { monthLabel } from "../../format.ts";
import type { ActualUnit } from "../../actual-units.ts";
import {
  activityValue,
  type ActivityMonth,
  type ActivityRow,
} from "./activity-report-data.ts";
import {
  activityBand,
  BAND_FILLS,
  BAND_LABELS,
  type ActivityBand,
} from "./activity-band.ts";

const BANDS = Object.keys(BAND_FILLS) as ActivityBand[];
const STATE_TEXT: Partial<Record<ActivityMonth["state"], string>> = {
  "before-start": "İşbaşı öncesi",
  departed: "İşten ayrıldı",
  "other-team": "Başka takımda",
  future: "Gelecek ay",
};
// Fills: 0 none, 1 gray125 (required), 2 header, then one per band.
// Cell styles: 0 text, 1 title, 2 header, 3 note, 4 value, 5 empty value,
// 6.. value in band order.
const styles = (
  percent: boolean,
) => `<styleSheet xmlns="${spreadsheetNamespace}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="${percent ? "0.00%" : "0.00"}"/></numFmts>
<fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font></fonts>
<fills count="${3 + BANDS.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F6"/></patternFill></fill>${BANDS.map((band) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${BAND_FILLS[band]}"/></patternFill></fill>`).join("")}</fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD3DAE3"/></left><right style="thin"><color rgb="FFD3DAE3"/></right><top style="thin"><color rgb="FFD3DAE3"/></top><bottom style="thin"><color rgb="FFD3DAE3"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${6 + BANDS.length}">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
${BANDS.map((_, i) => `<xf numFmtId="164" fontId="0" fillId="${3 + i}" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>`).join("\n")}
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Aktivite Raporu as one sheet: Liderlik, Takım, Çalışan, then one column
 * per month in the chosen unit. Finished months carry the screen's
 * utilisation tint unless a project filter makes the totals partial. */
export function buildActivityWorkbook({
  rows,
  months,
  unit,
  todayDate,
  filterLabel,
  projectFiltered,
}: {
  rows: ActivityRow[];
  months: string[];
  unit: ActualUnit;
  todayDate: string;
  filterLabel: string;
  projectFiltered: boolean;
}): Uint8Array {
  const percent = unit === "percent";
  const currentMonth = todayDate.slice(0, 7);
  const last = columnName(2 + months.length);
  const text = (r: number, c: number, value: string, style: number) =>
    `<c r="${columnName(c)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${excelCellText(value)}</t></is></c>`;
  const number = (r: number, c: number, value: number, style: number) =>
    `<c r="${columnName(c)}${r}" s="${style}"><v>${value}</v></c>`;
  const lines: string[] = [];
  let r = 0;
  const row = (cells: string[], height?: number) => {
    r++;
    assertExcelRowCount(r);
    lines.push(
      `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells.join("")}</row>`,
    );
  };
  row([text(1, 0, "Aktivite Raporu", 1)], 24);
  row([
    text(
      2,
      0,
      [
        months.length
          ? monthLabel(months[0]) + " – " + monthLabel(months.at(-1)!)
          : "",
        "Birim: " + (percent ? "Yüzde (%)" : "Saat"),
        filterLabel,
      ]
        .filter(Boolean)
        .join(" · "),
      3,
    ),
  ]);
  row([
    text(
      3,
      0,
      projectFiltered
        ? "Proje filtresi seçili: aylar kısmi olduğundan renklendirilmedi."
        : "Renkler (bitmiş aylar): " +
            BANDS.map((band) => BAND_LABELS[band]).join(", ") +
            ". İçinde bulunulan ay renklendirilmez.",
      3,
    ),
  ]);
  const header = r + 1;
  row(
    [
      text(header, 0, "Liderlik", 2),
      text(header, 1, "Takım", 2),
      text(header, 2, "Çalışan", 2),
      ...months.map((month, i) => text(header, 3 + i, monthLabel(month), 2)),
    ],
    22,
  );
  for (const item of rows) {
    const at = r + 1;
    row([
      text(at, 0, item.lead, 0),
      text(at, 1, item.team, 0),
      text(at, 2, item.name, 0),
      ...months.map((month, i) => {
        const cell = item.cells.find((c) => c.month === month);
        const value = cell ? activityValue(cell, unit) : null;
        if (!cell || value === null)
          return text(at, 3 + i, (cell && STATE_TEXT[cell.state]) || "—", 5);
        const band = projectFiltered
          ? undefined
          : activityBand(cell, currentMonth);
        const style = band ? 6 + BANDS.indexOf(band) : 4;
        return number(
          at,
          3 + i,
          Math.round((percent ? value / 100 : value) * 10000) / 10000,
          style,
        );
      }),
    ]);
  }
  const xml = `<worksheet xmlns="${spreadsheetNamespace}"><sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="${header}" topLeftCell="D${header + 1}" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="46" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/><col min="4" max="${3 + months.length}" width="11" customWidth="1"/></cols><sheetData>${lines.join("")}</sheetData><autoFilter ref="A${header}:${last}${Math.max(header, r)}"/></worksheet>`;
  return createWorkbook({
    sheets: [{ name: "Aktivite Raporu", xml, printTitleRows: header }],
    styles: styles(percent),
    properties: { title: "Aktivite Raporu", creator: SYSTEM_NAME },
  });
}

export function downloadActivityReport(
  options: Parameters<typeof buildActivityWorkbook>[0],
) {
  downloadWorkbook(
    buildActivityWorkbook(options),
    `Aktivite-Raporu-${options.todayDate}.xlsx`,
  );
}
