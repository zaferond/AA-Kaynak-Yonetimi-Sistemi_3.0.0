// Computed-style snapshot of every screen, for CSS clean-ups that must not
// change what users see. Uses a temporary copy of the demo database.
//
//   node scripts/style-snapshot.mjs <out.json>            take a snapshot
//   node scripts/style-snapshot.mjs --diff <a.json> <b.json>  compare two
//
// Set MANUAL_DB to snapshot another demo file (e.g. a backup).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv[2] === "--diff") {
  const [a, b] = await Promise.all(
    process.argv.slice(3, 5).map(async (f) => JSON.parse(await fs.readFile(f))),
  );
  let differences = 0;
  for (const screen of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[screen] || [],
      right = b[screen] || [];
    if (left.length !== right.length) {
      differences++;
      console.log(`${screen}: ${left.length} → ${right.length} öğe`);
      continue;
    }
    for (let i = 0; i < left.length; i++) {
      if (left[i][1] === right[i][1]) continue;
      differences++;
      if (differences <= 40) {
        const before = JSON.parse(left[i][1]),
          after = JSON.parse(right[i][1]);
        const changed = Object.keys(before).filter(
          (key) => before[key] !== after[key],
        );
        console.log(
          `${screen} ${left[i][0]}: ` +
            changed.map((k) => `${k} ${before[k]} → ${after[k]}`).join("; "),
        );
      }
    }
  }
  console.log(differences ? `${differences} fark` : "Fark yok");
  process.exit(differences ? 1 : 0);
}

const out = process.argv[2];
if (!out) throw Error("Kullanım: node scripts/style-snapshot.mjs <out.json>");
const { chromium } = await import(
  path.join(root, "node_modules/playwright/index.mjs")
);
const { selectWorkspaceTab } = await import(
  path.join(root, "scripts/browser-checks/fixture.mjs")
);
const { startManualServer, ACCOUNTS, PASSWORD } = await import(
  path.join(root, "docs/kullanici-manueli/v3/server.mjs")
);

/** Visual properties compared per element (computed values). */
const PROPS = [
  "display",
  "position",
  "top",
  "left",
  "z-index",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "outline",
  "box-shadow",
  "background-color",
  "background-image",
  "color",
  "opacity",
  "visibility",
  "overflow-x",
  "overflow-y",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration-line",
  "white-space",
  "vertical-align",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "justify-content",
  "align-items",
  "gap",
  "grid-template-columns",
  "cursor",
  "transform",
];
/** Large tables repeat the same rows; the first part covers every style. */
const MAX_ELEMENTS = 4000;

const running = await startManualServer();
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const snapshot = {};
async function capture(page, key) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  snapshot[key] = await page.evaluate(
    ([props, max]) => {
      const path = (el) => {
        const parts = [];
        for (let n = el; n && n.nodeType === 1 && n !== document.body;) {
          const parent = n.parentElement;
          parts.unshift(
            n.tagName.toLowerCase() +
              (parent ? ":" + [...parent.children].indexOf(n) : ""),
          );
          n = parent;
        }
        return parts.join(">");
      };
      return [...document.body.querySelectorAll("*")]
        .slice(0, max)
        .map((el) => {
          const style = getComputedStyle(el);
          return [
            path(el),
            JSON.stringify(
              Object.fromEntries(
                props.map((p) => [
                  p,
                  // Each run has its own port; asset URLs compare by path.
                  style.getPropertyValue(p).replaceAll(location.origin, ""),
                ]),
              ),
            ),
          ];
        });
    },
    [PROPS, MAX_ELEMENTS],
  );
  console.log("ok", key, snapshot[key].length);
}
async function login(username) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    locale: "tr-TR",
  });
  // Fixed clock and photo so snapshots are comparable.
  await context.addInitScript(() => (Math.random = () => 0.05));
  const response = await context.request.post(
    running.origin + "/api/auth/login",
    {
      headers: { Origin: running.origin, "X-Requested-With": "KaynakPortal" },
      data: { username, password: PASSWORD },
    },
  );
  if (response.status() !== 200) throw Error(username + " giriş");
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-23T09:00:00Z"));
  await page.goto(running.origin);
  await page.getByRole("button", { name: /^Sol menüyü (aç|kapat)$/ }).waitFor();
  return { context, page };
}
const section = (page, name) =>
  page.getByRole("tab", { name, exact: true }).first().click();

try {
  {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
    });
    await context.addInitScript(() => (Math.random = () => 0.05));
    const page = await context.newPage();
    await page.goto(running.origin);
    await page.locator("#login-username").waitFor();
    await capture(page, "giris");
    await context.close();
  }
  for (const [role, username] of Object.entries(ACCOUNTS)) {
    const { context, page } = await login(username);
    const tabs = (
      await page.locator("#workspace-main-menu [role=tab]").allTextContents()
    ).map((t) => t.trim().replace(/\s+/g, " "));
    for (const tab of tabs) {
      await selectWorkspaceTab(page, tab);
      await page.waitForTimeout(1200);
      await capture(page, `${role}/${tab}`);
      const subtabs = (
        await page
          .locator(
            ".section-tabs [role=tab], [aria-label$='görünümü'] [role=tab]",
          )
          .allTextContents()
      ).map((t) => t.trim().replace(/\s+\d+$/, ""));
      for (const sub of subtabs.slice(1)) {
        await section(page, sub).catch(() => {});
        await page.waitForTimeout(1000);
        await capture(page, `${role}/${tab}/${sub}`);
      }
    }
    if (role === "admin") {
      await page.locator(".mastuser-trigger").click();
      await capture(page, "admin/kullanici-menusu");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+k");
      await page.keyboard.type("a");
      await capture(page, "admin/arama");
      await page.keyboard.press("Escape");
      await page.locator(".mast-bell").click();
      await capture(page, "admin/bildirimler");
      await page.keyboard.press("Escape");
    }
    await context.close();
  }
  await fs.writeFile(out, JSON.stringify(snapshot));
} finally {
  await browser.close();
  await running.close();
}
