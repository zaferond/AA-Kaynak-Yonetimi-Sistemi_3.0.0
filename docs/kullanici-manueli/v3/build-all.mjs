// One command for the published manual: matrix extract, both PDFs (each with
// the one-section-per-page check) and the versioned share copies.
// Usage (project root): npm run docs:manual
// Screenshots are separate (they need the demo server): see ../README.md.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const docs = path.resolve(here, "..");
const run = (script, ...args) =>
  execFileSync(process.execPath, [path.join(here, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
const text = await fs.readFile(path.join(here, "manual.html"), "utf8");
const version = /<td>Belge sürümü<\/td><td>([^<]+)<\/td>/.exec(text)?.[1];
if (!version) throw Error("Kapakta belge sürümü bulunamadı.");
const manual = path.join(
  docs,
  "AA-Kaynak-Planlama-Sistemi-Kullanici-Manueli-ve-Yetki-Matrisi.pdf",
);
const matrix = path.join(docs, "AA-Kaynak-Planlama-Sistemi-Yetki-Matrisi.pdf");
run("build-matrix.mjs");
run("pdf.mjs", manual);
run("pdf.mjs", matrix, "yetki-matrisi.html");
const share = path.join(root, "output/pdf");
await fs.mkdir(share, { recursive: true });
await fs.copyFile(
  manual,
  path.join(share, `AA-Kullanici-Manueli-ve-Yetki-Matrisi-${version}.pdf`),
);
await fs.copyFile(matrix, path.join(share, `AA-Yetki-Matrisi-${version}.pdf`));
console.log(`Manuel ${version} hazır; paylaşım kopyaları output/pdf altında.`);
