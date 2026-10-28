// Extract the standalone matrix from the same source as the complete manual.
import fs from "node:fs/promises";
const here = new URL("./", import.meta.url);
const text = await fs.readFile(new URL("manual.html", here), "utf8");
const head = text.slice(0, text.indexOf("<body>") + "<body>".length);
// Version and date come from the manual's cover table only.
const cover = (label) =>
  new RegExp("<td>" + label + "</td><td>([^<]+)</td>").exec(text)?.[1];
const version = cover("Belge sürümü"),
  date = cover("Tarih");
if (!version || !date) throw Error("Kapakta sürüm veya tarih bulunamadı.");
const start = text.indexOf("<!-- 13 -->"),
  end = text.indexOf("<!-- 14 -->");
const scope = text.indexOf(
  "<h2>Aktivite Giriş ve Aktivite Raporu kapsamı</h2>",
);
if (start < 0 || end < start || scope < 0)
  throw Error("Manuel bölüm sınırları bulunamadı.");
const activityStart = text.lastIndexOf("<section", scope);
const activityEnd = text.indexOf("</section>", scope) + "</section>".length;
const matrix = text
  .slice(start, end)
  .replace("13. Yetki matrisi", "Yetki Matrisi")
  .replace("13.1 Ekran erişimi", "1. Ekran erişimi")
  .replace("13.2 İşlem yetkileri", "2. İşlem yetkileri")
  .replace(
    "<h1>Yetki Matrisi</h1>",
    `<h1>Yetki Matrisi</h1><p>Belge sürümü ${version} · ${date}. Uygulama rolü ekran erişimini; kaynak görevi aktivite kişi kapsamını belirler.</p>`,
  );
const activity = text
  .slice(activityStart, activityEnd)
  .replace(
    "Aktivite Giriş ve Aktivite Raporu kapsamı</h2>",
    "3. Aktivite kişi kapsamı</h2>",
  );
await fs.writeFile(
  new URL("yetki-matrisi.html", here),
  head + matrix + activity + "</body></html>\n",
);
