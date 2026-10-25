// Takes the manual's screenshots from a temporary demo copy (server.mjs).
// Usage (project root): node docs/kullanici-manueli/v3/shots.mjs <out-dir> [name,name]
// Writes PNG files; the PDF uses JPEG copies in v3/shots/.
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startManualServer, ACCOUNTS, PASSWORD } from "./server.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const { chromium } = await import(
  path.join(root, "node_modules/playwright/index.mjs")
);
const { selectWorkspaceTab } = await import(
  path.join(root, "scripts/browser-checks/fixture.mjs")
);
const out = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(",") : null;
await fs.mkdir(out, { recursive: true });
const running = await startManualServer();
const URL = running.origin;
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const viewport = { width: 1440, height: 860 };

async function login(username) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1.5,
    locale: "tr-TR",
  });
  const response = await ctx.request.post(URL + "/api/auth/login", {
    headers: { Origin: URL, "X-Requested-With": "KaynakPortal" },
    data: { username, password: PASSWORD },
  });
  if (response.status() !== 200)
    throw Error(username + " giriş " + response.status());
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(URL);
  await page.getByRole("button", { name: /^Sol menüyü (aç|kapat)$/ }).waitFor();
  await page.waitForTimeout(800);
  return { ctx, page };
}
const open = async (page, name) => {
  await selectWorkspaceTab(page, name);
  await page.waitForTimeout(1500);
};
const section = async (page, name) => {
  await page
    .getByRole("tab", { name: new RegExp("^" + name), exact: false })
    .first()
    .click();
  await page.waitForTimeout(1500);
};
const shot = async (page, name, opts = {}) => {
  await page.mouse.move(0, viewport.height - 1);
  await page.screenshot({
    path: path.join(out, name + ".png"),
    animations: "disabled",
    ...opts,
  });
  console.log("ok", name);
};
const failures = [];
const want = (n) => !only || only.includes(n);
async function run(name, fn) {
  if (!want(name)) return;
  try {
    await fn();
  } catch (e) {
    failures.push(name);
    console.log("HATA", name, e.message.split("\n")[0]);
  }
}

try {
  await run("giris", async () => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5 });
    const page = await ctx.newPage();
    // The login photo is random; fix it for a stable picture.
    await page.addInitScript(() => (Math.random = () => 0.05));
    await page.goto(URL);
    await page.locator("#login-username").waitFor();
    await page.waitForTimeout(800);
    await shot(page, "giris");
    await ctx.close();
  });

  await run("admin", async () => {
    const { ctx, page } = await login(ACCOUNTS.admin);
    await shot(page, "ana-sayfa");
    await page.keyboard.press("Control+k");
    await page.locator(".global-search").waitFor();
    await page.keyboard.type("kule");
    await page.waitForTimeout(400);
    await shot(page, "arama");
    await page.keyboard.press("Escape");
    await page.locator(".mastuser-trigger").click();
    await page.waitForTimeout(400);
    await shot(page, "kullanici-menusu", {
      clip: { x: 1000, y: 0, width: 440, height: 360 },
    });
    await page.keyboard.press("Escape");

    await open(page, "Projeler");
    await shot(page, "projeler");
    await page
      .getByRole("switch", { name: "Detayları Göster", exact: true })
      .check();
    await page.waitForTimeout(1200);
    await shot(page, "proje-detay");
    await page
      .getByRole("switch", { name: "Detayları Göster", exact: true })
      .uncheck();
    await page
      .locator("[data-project-heading] .project-name-copy .textbutton")
      .first()
      .click();
    await page
      .getByText("Görüntüleme yetkisi")
      .first()
      .waitFor({ timeout: 4000 });
    await page.getByText("Yalnızca seçilenler").click();
    await page.waitForTimeout(400);
    await shot(page, "proje-yetki");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await section(page, "Proje Takvimi Güncelle");
    // A +3 month comparison of one project.
    const card = page.locator(".schedule-scenario-card").first();
    await card
      .getByLabel("Proje", { exact: true })
      .selectOption({ label: "BOZKURT Paletli Piyade Muharebe Aracı" });
    // Saved only in the temporary copy.
    await card.getByRole("button", { name: /senaryosunu ekle$/ }).click();
    await page.locator(".schedule-comparison").waitFor();
    await page.waitForTimeout(1200);
    console.log(
      "senaryo:",
      await page
        .locator(".schedule-comparison")
        .innerText()
        .then((t) => t.slice(0, 200)),
    );
    await page.waitForTimeout(800);
    await shot(page, "proje-takvimi");

    await open(page, "Kaynak Planlama");
    await shot(page, "kaynak-planlama");

    await open(page, "Proje ve Kaynak Değerlendirme");
    await shot(page, "hedef-plan");
    await page
      .getByRole("button", { name: "Gerçekleşen % Revize Et", exact: true })
      .first()
      .click();
    const draftField = page
      .locator('.progress-card input[inputmode="decimal"]:not([disabled])')
      .first();
    await draftField.fill("37");
    await page
      .locator(".progress-card")
      .first()
      .getByLabel(/ · açıklama$/)
      .fill("Eylül ayı ilerleme taslağı; henüz gönderilmedi.");
    await page.locator(".progress-draft-notice").first().waitFor();
    await shot(page, "degerlendirme-taslagi");
    await page
      .getByRole("button", { name: "Taslağı İptal Et", exact: true })
      .first()
      .click();
    await section(page, "Proje ve Kaynak Değerlendirme Raporu");
    await shot(page, "degerlendirme-raporu");
    await section(page, "Senaryo Uyarıları");
    await shot(page, "senaryo-uyarilari");
    await section(page, "Uyarı Ayarları");
    await shot(page, "uyari-ayarlari");

    await open(page, "Haftalık Kritik Konular");
    await shot(page, "kritik-konular");

    await open(page, "Raporlar");
    await shot(page, "raporlar");
    await section(page, "Head Count");
    await shot(page, "headcount");

    await open(page, "Organizasyon & Çalışan & Yetki");
    await shot(page, "organizasyon");
    await page
      .getByRole("button", { name: /Kaynak Ekle \/ Yetki Tanımla/ })
      .click();
    await page.waitForTimeout(900);
    await shot(page, "kaynak-ekle");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "Değişiklik Geçmişi", exact: true })
      .click();
    await page.waitForTimeout(1500);
    await shot(page, "degisiklik-gecmisi");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await section(page, "Organizasyon Yapısı");
    await shot(page, "organizasyon-yapisi");
    await page.waitForLoadState("networkidle");
    await running.showIdleWarning();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const idleDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Oturumunuz sona ermek üzere" });
    await idleDialog.waitFor();
    await page.waitForTimeout(350);
    await shot(page, "oturum-uyarisi", {
      clip: { x: 350, y: 220, width: 740, height: 430 },
    });
    await idleDialog
      .getByRole("button", { name: "Oturumu Sürdür", exact: true })
      .click();
    await idleDialog.waitFor({ state: "detached" });
    await ctx.close();
  });

  await run("yonetici", async () => {
    const { ctx, page } = await login(ACCOUNTS.manager);
    await page.locator(".mast-bell").click();
    await page.locator(".notification-panel").waitFor();
    await page.waitForTimeout(500);
    await shot(page, "bildirimler", {
      clip: { x: 760, y: 0, width: 680, height: 600 },
    });
    await page.keyboard.press("Escape");
    await open(page, "Aktivite Raporu");
    await shot(page, "aktivite-raporu");
    await ctx.close();
  });

  await run("normal", async () => {
    const { ctx, page } = await login(ACCOUNTS.normal);
    await open(page, "Aktivite Giriş");
    await shot(page, "aktivite-giris");
    await page.locator(".person-calendar-trigger").first().click();
    await page.waitForTimeout(1000);
    await shot(page, "kisisel-takvim");
    await ctx.close();
  });

  await run("normalproje", async () => {
    const { ctx, page } = await login(ACCOUNTS.projectEditor);
    await open(page, "Projeler");
    await shot(page, "normal-proje", {
      clip: { x: 0, y: 0, width: 1440, height: 430 },
    });
    await ctx.close();
  });
} finally {
  await browser.close();
  await running.close();
}

if (failures.length)
  throw Error("Ekran görüntüleri tamamlanamadı: " + failures.join(", "));
