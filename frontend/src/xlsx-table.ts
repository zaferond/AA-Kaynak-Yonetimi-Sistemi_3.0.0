import { columnName, excelCellText, EXCEL_MAX_ROWS } from "./xlsx-cells.ts";
import { createWorkbook, downloadWorkbook } from "./xlsx-workbook.ts";
import { SYSTEM_NAME } from "./settings.ts";

export type TableCellValue = string | number | null;

/** One plain sheet: bold frozen header row, autofilter, numbers kept as
 * numbers. For list screens whose export mirrors the table on screen. */
export function tableWorkbook({
  sheet,
  title,
  header,
  rows,
  widths = [],
}: {
  sheet: string;
  title: string;
  header: string[];
  rows: TableCellValue[][];
  widths?: number[];
}) {
  if (rows.length + 1 > EXCEL_MAX_ROWS)
    throw Error("Excel satır sınırı aşıldı; filtreleri daraltın.");
  const cell = (value: TableCellValue, ref: string, style: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${excelCellText(value ?? "")}</t></is></c>`;
  const all = [header, ...rows];
  const cols = header
    .map(
      (_, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${widths[i] || 18}" customWidth="1"/>`,
    )
    .join("");
  const last = columnName(header.length - 1);
  const xml = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${all
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row.map((value, j) => cell(value, columnName(j) + (i + 1), i === 0 ? 1 : 0)).join("")}</row>`,
    )
    .join(
      "",
    )}</sheetData><autoFilter ref="A1:${last}${all.length}"/></worksheet>`;
  const styles =
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF234F7A"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fontId="1" fillId="2" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs></styleSheet>';
  return createWorkbook({
    sheets: [{ name: sheet, xml, printTitleRows: 1 }],
    styles,
    properties: { title, creator: SYSTEM_NAME },
  });
}

export function downloadTable(
  file: string,
  options: Parameters<typeof tableWorkbook>[0],
) {
  downloadWorkbook(tableWorkbook(options), file);
}
