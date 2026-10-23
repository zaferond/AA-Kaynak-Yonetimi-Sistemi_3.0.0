import test from "node:test";
import assert from "node:assert/strict";
import { tableWorkbook } from "../frontend/src/xlsx-table.ts";

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

test("table export: styled header, numbers as numbers, text escaped, filter over all rows", () => {
  const bytes = tableWorkbook({
    sheet: "İzin ve Eğitim",
    title: "Çalışan İzin ve Eğitim Kayıtları",
    header: ["Çalışan", "Tür", "Toplam Saat"],
    rows: [
      ["Ayşe <Yılmaz>", "İzin", 13.5],
      ["=SUM(A1)", "Eğitim", 9],
    ],
    widths: [26, 10],
  });
  const sheet = zipEntry(bytes, "xl/worksheets/sheet1.xml");
  const workbook = zipEntry(bytes, "xl/workbook.xml");
  assert.match(workbook, /<sheet name="İzin ve Eğitim"/);
  assert.match(
    sheet,
    /<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Çalışan<\/t>/,
  );
  assert.match(sheet, /<c r="C2" s="0"><v>13.5<\/v><\/c>/);
  assert.match(sheet, /Ayşe &lt;Yılmaz&gt;/);
  // Formula-like text stays text, never a live formula.
  assert.doesNotMatch(sheet, /<f>/);
  assert.match(sheet, /<autoFilter ref="A1:C3"\/>/);
  assert.match(sheet, /<col min="1" max="1" width="26"/);
  assert.match(sheet, /<col min="3" max="3" width="18"/);
});
