// Renders manual.html to an A4 PDF with Chrome.
// Usage (project root): node docs/kullanici-manueli/v3/pdf.mjs <out.pdf>
// Every .page section must fit on one printed page; an overflowing section
// fails the run with its heading instead of silently adding a page.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const { chromium } = await import(
  path.join(root, "node_modules/playwright/index.mjs")
);
const out = process.argv[2];
const source = process.argv[3] || "manual.html";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(here, source)).href, {
  waitUntil: "networkidle",
});
await page.evaluate(() => document.fonts.ready);
const missingImages = await page
  .locator("img")
  .evaluateAll((images) =>
    images
      .filter((image) => !image.complete || !image.naturalWidth)
      .map((image) => image.getAttribute("src")),
  );
if (missingImages.length)
  throw Error("Belge görselleri eksik: " + missingImages.join(", "));
const version = await page.evaluate(
  () =>
    [...document.querySelectorAll("td")]
      .find((cell) => cell.textContent.trim() === "Belge sürümü")
      ?.nextElementSibling?.textContent.trim() ||
    /Belge sürümü ([\d.]+)/.exec(document.body.textContent)?.[1] ||
    "",
);
if (!version) throw Error("Belge sürümü bulunamadı.");
const font =
  "font-family:'IBM Plex Sans',Arial;font-size:7.5pt;color:#7b8794;width:100%;padding:0 15mm";
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="${font}">Askeri Araçlar Kaynak Yönetimi Sistemi · Kullanıcı Manueli ve Yetki Matrisi · Sürüm ${version}</div>`,
  footerTemplate: `<div style="${font};text-align:right"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
});
const expected = await page.evaluate(() => {
  const sections = document.querySelectorAll(".page");
  const first = sections[0];
  // Content before the first .page section (the cover) is one page.
  const cover = [...document.body.children].some(
    (node) =>
      first &&
      node !== first &&
      !node.contains(first) &&
      node.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING &&
      node.textContent.trim(),
  );
  return {
    pages: sections.length + (cover ? 1 : 0),
    headings: [...sections].map(
      (section) =>
        section.querySelector("h1, h2")?.textContent.trim() || "(başlıksız)",
    ),
  };
});
await browser.close();
const pdf = await fs.readFile(out, "latin1");
const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages !== expected.pages)
  throw Error(
    `${out}: ${pages} sayfa üretildi, ${expected.pages} bekleniyordu. Bir bölüm sayfasına sığmıyor; görsel yüksekliğini veya metni kısaltın. Bölümler: ` +
      expected.headings.join(" | "),
  );
console.log(`${path.basename(out)}: ${pages} sayfa, sürüm ${version}.`);
