import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkGlowFlow(f) {
  const { page } = await f.client("root-admin", { login: false });
  try {
    await f.check(
      "Flow login: accessible name stays clean; native submit, busy state and reduced motion prevent duplicate requests",
      async () => {
        const login = page.getByRole("button", {
          name: "Giriş Yap",
          exact: true,
        });
        await login.waitFor();
        await page
          .getByLabel("Kullanıcı Adı", { exact: true })
          .fill("qa.root-admin");
        await page.getByLabel("Şifre", { exact: true }).fill(f.password);
        await page.emulateMedia({ reducedMotion: "reduce" });
        let held,
          count = 0;
        await page.route("**/api/auth/login", (route) => {
          count++;
          held = route;
        });
        await page.getByLabel("Şifre", { exact: true }).press("Enter");
        await f.wait(async () => !!held, "native form submitted");
        const pending = page.getByRole("button", {
          name: "Giriş Yapılıyor…",
          exact: true,
        });
        assert(await pending.isDisabled());
        assert.equal(await pending.getAttribute("aria-busy"), "true");
        assert.equal(
          await pending
            .locator(".flow-button-indicator")
            .getAttribute("aria-hidden"),
          "true",
        );
        assert.equal(
          await pending
            .locator(".flow-button-spinner")
            .evaluate((e) => getComputedStyle(e).animationName),
          "none",
        );
        await page.keyboard.press("Enter");
        assert.equal(count, 1);
        await held.continue();
        await page
          .getByRole("button", { name: /^Sol menüyü (aç|kapat)$/ })
          .waitFor();
        await page.unroute("**/api/auth/login");
      },
    );
    await f.check(
      "Glow navigation and Flow actions: keyboard reaches the project form; tab semantics and compact table tools stay intact",
      async () => {
        await selectWorkspaceTab(page, "Projeler");
        const create = page.getByRole("button", {
          name: "Yeni Proje",
          exact: true,
        });
        assert(
          await create.evaluate((e) => e.classList.contains("flow-button")),
        );
        await create.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        assert(await create.evaluate((e) => e.matches(":focus-visible")));
        assert.notEqual(
          await create.evaluate((e) => getComputedStyle(e).outlineStyle),
          "none",
        );
        assert.equal(
          await create.evaluate((e) => getComputedStyle(e).transitionDuration),
          "0s",
        );
        const active = page.locator(
          '#workspace-main-menu [role="tab"][data-state="active"]',
        );
        assert.equal(await active.innerText(), "Projeler");
        assert.equal(
          await active.evaluate((e) => getComputedStyle(e).transitionDuration),
          "0s",
        );
        assert.equal(
          await page
            .locator(
              "td .flow-button,th .flow-button,.report-download-button.flow-button",
            )
            .count(),
          0,
        );
        await page.keyboard.press("Enter");
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await f.capture(page, "glow-flow-projects");
      },
    );
    await f.check(
      "Glow menu: narrow view retains readable labels, scrolling and a reachable close control",
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        const menu = page.locator("#workspace-main-menu");
        const last = menu.getByRole("tab").last();
        await last.scrollIntoViewIfNeeded();
        assert(await last.isVisible());
        const close = page.getByRole("button", {
          name: "Sol menüyü kapat",
          exact: true,
        });
        await close.click();
        await f.wait(
          async () => (await menu.getAttribute("data-open")) === "false",
          "mobile menu closes",
        );
        await page
          .getByRole("button", { name: "Yeni Proje", exact: true })
          .waitFor();
        await f.capture(page, "glow-flow-mobile");
      },
    );
  } finally {
    await page.close();
  }
}
