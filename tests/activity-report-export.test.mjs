import test from "node:test";
import assert from "node:assert/strict";
import { buildActivityWorkbook } from "../frontend/src/features/activity-report/activity-report-export.ts";
import {
  activityBand,
  BAND_FILLS,
} from "../frontend/src/features/activity-report/activity-band.ts";
import { activityValue } from "../shared/activity-report.ts";

function zipEntry(bytes, name) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    decode = new TextDecoder();
  for (let offset = 0; offset < bytes.length;) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const size = view.getUint32(offset + 18, true),
      filenameLength = view.getUint16(offset + 26, true),
      extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + filenameLength + extraLength;
    const filename = decode.decode(
      bytes.subarray(offset + 30, offset + 30 + filenameLength),
    );
    if (filename === name)
      return decode.decode(bytes.subarray(start, start + size));
    offset = start + size;
  }
  throw Error(name + " bulunamadı");
}
const cell = (month, totalFte, state = "working") => ({
  month,
  state,
  totalFte,
  projectFte: totalFte,
  trainingHours: 0,
  effectiveHours: 180,
  start: "",
  end: "",
});
const months = ["2026-08", "2026-09", "2026-10"];
const rows = [
  {
    key: "a",
    resourceId: "a",
    name: "Ayşe & Yılmaz",
    teamId: "t1",
    team: "Kule Takımı",
    lead: "Alt Sistemler Liderliği",
    cells: [cell("2026-08", 0.95), cell("2026-09", 0.4), cell("2026-10", 0.3)],
  },
  {
    key: "b",
    resourceId: "b",
    name: "Burak",
    teamId: "t1",
    team: "Kule Takımı",
    lead: "Alt Sistemler Liderliği",
    cells: [
      cell("2026-08", 0, "before-start"),
      cell("2026-09", 0.8),
      cell("2026-10", 0.2),
    ],
  },
];
const sheet = (projectFiltered = false, unit = "percent") =>
  zipEntry(
    buildActivityWorkbook({
      rows,
      months,
      unit,
      todayDate: "2026-10-23",
      filterLabel: "Liderlik: Tümü",
      projectFiltered,
    }),
    "xl/worksheets/sheet1.xml",
  );
const cellXml = (xml, ref) =>
  xml.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>.*?</c>)`))?.[0] || "";
const textOf = (xml, ref) =>
  cellXml(xml, ref).match(/<t xml:space="preserve">(.*?)<\/t>/)?.[1];
const styleOf = (xml, ref) => Number(cellXml(xml, ref).match(/ s="(\d+)"/)[1]);
const valueOf = (xml, ref) =>
  Number(cellXml(xml, ref).match(/<v>(.*?)<\/v>/)[1]);
const bands = Object.keys(BAND_FILLS);

test("activity export: Liderlik, Takım, Çalışan, then one column per month", () => {
  const xml = sheet();
  assert.deepEqual(
    ["A4", "B4", "C4"].map((ref) => textOf(xml, ref)),
    ["Liderlik", "Takım", "Çalışan"],
  );
  assert.match(textOf(xml, "D4"), /^Ağu/);
  assert.match(textOf(xml, "F4"), /^Eki/);
  assert.deepEqual(
    ["A5", "B5", "C5"].map((ref) => textOf(xml, ref)),
    ["Alt Sistemler Liderliği", "Kule Takımı", "Ayşe &amp; Yılmaz"],
  );
  assert.equal(textOf(xml, "C6"), "Burak");
  // Frozen labels and header; an autofilter over the table.
  assert.match(xml, /xSplit="3" ySplit="4"/);
  assert.match(xml, /<autoFilter ref="A4:F6"\/>/);
});

test("activity export: percentages match the screen and carry its tints", () => {
  const xml = sheet();
  const first = rows[0].cells[0];
  assert.equal(
    valueOf(xml, "D5"),
    Math.round((activityValue(first, "percent") / 100) * 10000) / 10000,
  );
  assert.equal(
    styleOf(xml, "D5"),
    6 + bands.indexOf(activityBand(first, "2026-10")),
  );
  assert.equal(
    styleOf(xml, "E5"),
    6 + bands.indexOf(activityBand(rows[0].cells[1], "2026-10")),
  );
  // The running month is neutral; before the start date reads as text.
  assert.equal(styleOf(xml, "F5"), 4);
  assert.equal(textOf(xml, "D6"), "İşbaşı öncesi");
});

test("activity export: a project filter leaves months uncoloured; hours stay hours", () => {
  const filtered = sheet(true);
  for (const ref of ["D5", "E5", "E6"]) assert.equal(styleOf(filtered, ref), 4);
  const hours = sheet(false, "hours");
  assert.equal(
    valueOf(hours, "D5"),
    Math.round(activityValue(rows[0].cells[0], "hours") * 10000) / 10000,
  );
});
