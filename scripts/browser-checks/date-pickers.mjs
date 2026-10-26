import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";

async function anchored(f, trigger, popup) {
  await f.wait(async () => {
    const a = await trigger.boundingBox(),
      b = await popup.boundingBox();
    return (
      a &&
      b &&
      Math.abs(a.x - b.x) < 2 &&
      b.y >= a.y + a.height &&
      b.y - a.y - a.height < 8
    );
  }, "popup starts directly below its field");
}

export async function checkDatePickers(f) {
  const { page } = await f.client("root-admin");
  try {
    await f.check(
      "date pickers: month keyboard selection and anchored period/responsible menus preserve native values",
      async () => {
        await selectWorkspaceTab(page, "Kaynak Planlama");
        const input = page.locator('.planning-filterbar input[type="month"]');
        await input.fill("2026-01");
        const field = page.locator(".planning-filterbar .date-field");
        await field.locator("button").click();
        const popup = page.locator(".date-calendar");
        await popup.waitFor();
        await anchored(f, field, popup);
        await popup.locator('[data-date="2026-01"]').press("ArrowRight");
        await f.wait(
          () =>
            page
              .locator('[data-date="2026-02"]')
              .evaluate((el) => el === document.activeElement),
          "month focus moves",
        );
        await page.keyboard.press("Enter");
        assert.equal(await input.inputValue(), "2026-02");
        const period = page.locator(".period select");
        await period.click();
        const menu = page.locator(".filter-select-panel");
        await menu.waitFor();
        await anchored(f, period, menu);
        await menu
          .getByRole("option", { name: "2 yıl (24 ay)", exact: true })
          .click();
        assert.equal(await period.inputValue(), "24");
        await period.focus();
        await period.press("ArrowDown");
        await menu.waitFor();
        await menu
          .getByRole("option", { name: "2 yıl (24 ay)", exact: true })
          .focus();
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("Enter");
        assert.equal(await period.inputValue(), "12");
        await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
        const responsible = page.locator(".progress-responsible-filter select");
        await responsible.click();
        await menu.waitFor();
        await anchored(f, responsible, menu);
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "detached" });
        await f.wait(
          () => responsible.evaluate((el) => el === document.activeElement),
          "focus returns to filter",
        );
      },
    );
    await f.check(
      "date pickers: touch month popup stays within the viewport",
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await selectWorkspaceTab(page, "Kaynak Planlama");
        const close = page.getByRole("button", {
          name: "Sol menüyü kapat",
          exact: true,
        });
        if (await close.isVisible()) await close.click();
        await page.locator(".planning-filterbar .date-field button").click();
        const popup = page.locator(".date-calendar");
        await popup.waitFor();
        await f.wait(async () => {
          const b = await popup.boundingBox();
          return (
            b &&
            b.x >= 0 &&
            b.x + b.width <= 391 &&
            b.y >= 0 &&
            b.y + b.height <= 845
          );
        }, "mobile calendar fits");
        await page.keyboard.press("Escape");
        await page.setViewportSize({ width: 1600, height: 920 });
      },
    );
  } finally {
    await page.close();
  }
  const { page: p } = await f.client("employee");
  try {
    await f.check(
      "date pickers: leap day, date constraints, nested year/month menus, range and Escape work inside a dialog",
      async () => {
        await selectWorkspaceTab(p, "Aktivite Giriş");
        await p
          .getByRole("button", {
            name: "Browser Employee izin ve eğitim takvimini aç",
            exact: true,
          })
          .first()
          .click();
        const form = p.locator(".work-calendar-personal-fields");
        const from = form.locator('input[type="date"]').first(),
          to = form.locator('input[type="date"]').nth(1);
        await from.fill("2028-02-28");
        await to.fill("2028-03-02");
        await form.locator(".date-field-toggle").first().click();
        const calendar = p.locator(".date-calendar");
        await calendar.waitFor();
        assert.equal(
          await calendar.locator('[data-date="2028-02-29"]').count(),
          1,
        );
        assert.equal(await calendar.locator("[data-range]").count(), 4);
        await calendar.locator('[data-date="2028-02-29"]').click();
        assert.equal(await from.inputValue(), "2028-02-29");
        await form.locator(".date-field-toggle").nth(1).click();
        await calendar.waitFor();
        assert(await calendar.locator('[data-date="2028-02-28"]').isDisabled());
        await calendar.getByLabel("Takvim ayı", { exact: true }).click();
        const options = p.locator(".filter-select-panel");
        await options.waitFor();
        await options
          .getByRole("option", { name: "Mart", exact: true })
          .click();
        await calendar.waitFor();
        await calendar.getByLabel("Takvim yılı", { exact: true }).click();
        await options.waitFor();
        await options
          .getByRole("option", { name: "2028", exact: true })
          .click();
        await calendar.waitFor();
        await p.keyboard.press("Escape");
        assert(await p.locator(".work-calendar-personal").isVisible());
        await calendar.waitFor({ state: "detached" });
        await form.locator(".date-field-toggle").first().click();
        await calendar.waitFor();
        await calendar
          .getByRole("button", { name: "Temizle", exact: true })
          .click();
        assert.equal(await from.inputValue(), "");
      },
    );
  } finally {
    await p.close();
  }
}
