// Renders manual.html to an A4 PDF with Chrome.
// Usage (project root): node docs/kullanici-manueli/v3/pdf.mjs <out.pdf>
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const { chromium } = await import(
  path.join(root, "node_modules/playwright/index.mjs")
);
const out = process.argv[2];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(here, "manual.html")).href, {
  waitUntil: "networkidle",
});
await page.evaluate(() => document.fonts.ready);
const font =
  "font-family:'IBM Plex Sans',Arial;font-size:7.5pt;color:#7b8794;width:100%;padding:0 15mm";
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="${font}">Askeri Araçlar Kaynak Yönetimi Sistemi · Kullanıcı Manueli ve Yetki Matrisi · Sürüm 3.2</div>`,
  footerTemplate: `<div style="${font};text-align:right"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
});
await browser.close();
