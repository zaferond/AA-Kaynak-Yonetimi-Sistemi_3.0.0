import {
  excelCellText,
  excelTextLines,
  splitExcelText,
  EXCEL_MAX_ROWS,
  columnName as column,
} from "./xlsx-cells.ts";
import type { ReportProject } from "./project-info-report";
import { createWorkbook, downloadWorkbook } from "./xlsx-workbook.ts";
import {
  isoWeek,
  shiftWeek,
  weekLabel,
  type IsoWeek,
} from "../../shared/iso-week.ts";
import type { ReportTopic } from "../../shared/project-info-report.ts";
import { currentPlanningDate } from "../../shared/resource-dates.ts";

/** Week columns on the right: last week, this week and three ahead. */
const WEEK_OFFSETS = [-1, 0, 1, 2, 3];

/**
 * The mark of one topic in one week. The target week is the week of the
 * topic's end date. An open topic whose target has passed shows NOK in every
 * missed week and X in the current week, so the X moves on week by week until
 * the topic is completed; a completed topic shows OK in its target week.
 */
export function topicWeekMark(
  topic: Pick<ReportTopic, "end" | "completed">,
  week: IsoWeek,
  thisWeek: IsoWeek,
): "" | "X" | "NOK" | "OK" {
  const target = isoWeek(topic.end).key;
  if (topic.completed) return week.key === target ? "OK" : "";
  if (target >= thisWeek.key) return week.key === target ? "X" : "";
  if (week.key === thisWeek.key) return "X";
  return week.key >= target && week.key < thisWeek.key ? "NOK" : "";
}

const sheetNamespace =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const dateLabel = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
    : value;

function cell(row: number, index: number, value: string, style: number) {
  return `<c r="${column(index)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${excelCellText(value)}</t></is></c>`;
}

export function projectInfoReportSheet(
  projects: ReportProject[],
  today = currentPlanningDate(),
): string {
  const thisWeek = isoWeek(today);
  const weeks = WEEK_OFFSETS.map((offset) => shiftWeek(thisWeek, offset));
  const headers = [
    "Proje",
    "Başlık",
    "Detay Açıklama",
    "Başlangıç",
    "Hedef Bitiş",
    "Durum",
    ...weeks.map(
      (week) =>
        weekLabel(week, thisWeek.year) +
        (week.key === thisWeek.key ? " (bu hafta)" : ""),
    ),
  ];
  const last = column(headers.length - 1);
  const rows: string[] = [];
  rows.push(
    `<row r="1" ht="29" customHeight="1">${cell(1, 0, "AA Mühendislik | Haftalık Kritik Konular", 1)}</row>`,
  );
  rows.push(
    `<row r="2" ht="22" customHeight="1">${cell(2, 0, `Kritik Konulara Ekle seçili açıklamalar · ${new Date(today + "T12:00:00").toLocaleDateString("tr-TR")} · X: hedef hafta, NOK: hedef haftada tamamlanmadı, OK: tamamlandı`, 2)}</row>`,
  );
  rows.push(
    `<row r="3" ht="24" customHeight="1">${headers.map((header, index) => cell(3, index, header, 3)).join("")}</row>`,
  );
  const markStyle = { X: 5, NOK: 6, OK: 7, "": 8 } as const;
  let rowNumber = 4;
  // Rows of one project (column A) and of one heading (column B) merge.
  const merges: string[] = [];
  const merge = (col: string, from: number) => {
    if (rowNumber - 1 > from)
      merges.push(`${col}${from}:${col}${rowNumber - 1}`);
  };
  for (const project of projects) {
    const projectStart = rowNumber;
    for (const info of project.infos) {
      const infoStart = rowNumber;
      for (const topic of info.topics) {
        const late = !topic.completed && isoWeek(topic.end).key < thisWeek.key;
        const text = topic.text;
        for (const [part, continuation] of splitExcelText(text).entries()) {
          if (rowNumber > EXCEL_MAX_ROWS)
            throw Error(
              "Excel satır sınırı aşıldı. Daha az proje seçerek tekrar aktarın.",
            );
          const base = rowNumber % 2 ? 0 : 4;
          const values = [
            project.name,
            info.name,
            continuation,
            dateLabel(topic.start),
            dateLabel(topic.end),
            topic.completed ? "Tamamlandı" : late ? "Gecikti" : "Açık",
          ];
          const marks = part
            ? weeks.map(() => "" as const)
            : weeks.map((week) => topicWeekMark(topic, week, thisWeek));
          const height = Math.max(24, excelTextLines(continuation) * 15 + 10);
          rows.push(
            `<row r="${rowNumber}" ht="${height}" customHeight="1">${[
              ...values.map((value, index) =>
                cell(rowNumber, index, value, base),
              ),
              ...marks.map((mark, index) =>
                cell(rowNumber, values.length + index, mark, markStyle[mark]),
              ),
            ].join("")}</row>`,
          );
          rowNumber++;
        }
      }
      merge("B", infoStart);
    }
    merge("A", projectStart);
  }
  const lastRow = Math.max(3, rowNumber - 1);
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${sheetNamespace}"><dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="2" width="28" customWidth="1"/><col min="3" max="3" width="60" customWidth="1"/><col min="4" max="5" width="13" customWidth="1"/><col min="6" max="6" width="12" customWidth="1"/><col min="7" max="${headers.length}" width="11" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A3:${last}${lastRow}"/><mergeCells count="${2 + merges.length}"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/>${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape"/></worksheet>`;
}

const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${sheetNamespace}"><fonts count="6"><font><sz val="10"/><color rgb="FF243B53"/><name val="Arial"/></font><font><sz val="15"/><color rgb="FFFFFFFF"/><name val="Arial"/><b/></font><font><sz val="10"/><color rgb="FF173F66"/><name val="Arial"/><b/></font><font><b/><sz val="11"/><color rgb="FF173F66"/><name val="Arial"/></font><font><b/><strike/><sz val="10"/><color rgb="FFB42318"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FF1F6B3A"/><name val="Arial"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F66"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFEAF3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F8FC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EEF6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBE2DA"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE1F0E7"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function projectInfoReportWorkbook(
  projects: ReportProject[],
  today = currentPlanningDate(),
): Uint8Array {
  if (
    !projects.some((project) =>
      project.infos.some((info) => info.topics.length),
    )
  )
    throw Error("Kritik konulara eklenecek açıklama bulunamadı.");
  return createWorkbook({
    sheets: [
      {
        name: "Haftalık Kritik Konular",
        xml: projectInfoReportSheet(projects, today),
      },
    ],
    styles,
  });
}

export function downloadProjectInfoReport(projects: ReportProject[]) {
  const bytes = projectInfoReportWorkbook(projects);
  downloadWorkbook(
    bytes,
    `AA-Kritik-Proje-Konulari-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
