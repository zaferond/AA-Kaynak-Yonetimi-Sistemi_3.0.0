import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkWorkspaceMenu(f) {
  const { page, context } = await f.client("root-admin");
  const menu = page.locator("#workspace-main-menu");
  const isOpen = async () => (await menu.getAttribute("data-open")) === "true";
  async function setOpening(label) {
    await page.getByRole("button", { name: /^Kullanıcı menüsü: / }).click();
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/auth/preferences"),
    );
    await page.getByLabel("Varsayılan Sekme").selectOption({ label });
    assert.equal((await response).status(), 200);
    await page.keyboard.press("Escape");
  }
  try {
    await f.check(
      "sol menü: Ana Sayfa'da kapalı açılır; bir ekran seçilince açılır, Ana Sayfa seçilince kapanır",
      async () => {
        await page.locator(".app.tab-home").waitFor();
        assert.equal(await isOpen(), false);
        // A card chooses a screen like the menu does.
        await page
          .locator(".home-card")
          .filter({ hasText: "Kaynak Planlama" })
          .click();
        await page.locator(".app.tab-plan").waitFor();
        await f.wait(isOpen, "choosing a screen opens the menu");
        await menu.getByRole("tab", { name: "Ana Sayfa", exact: true }).click();
        await page.locator(".app.tab-home").waitFor();
        await f.wait(async () => !(await isOpen()), "Ana Sayfa closes it");
        await page
          .locator(".home-card")
          .filter({ hasText: "Projeler" })
          .first()
          .click();
        await f.wait(isOpen, "menu open for the next checks");
      },
    );
    await f.check(
      "sol menü: dar ve sabit açık başlar, çalışma alanını örtmez, başlık metni kaldırılmıştır",
      async () => {
        assert.equal(await isOpen(), true);
        assert.equal(
          await menu.getByText("Çalışma alanı", { exact: true }).count(),
          0,
        );
        assert.equal(
          await menu
            .getByRole("button", {
              name: /Menüyü sabitle|Menüyü serbest bırak/,
            })
            .count(),
          0,
        );
        assert(
          Math.abs(
            (await menu.evaluate((el) =>
              parseFloat(getComputedStyle(el).width),
            )) - 244,
          ) < 1,
        );
        const panel = await menu.boundingBox();
        const main = await page.locator(".app > main").boundingBox();
        assert(
          main.x >= panel.x + panel.width - 1,
          "docked menu must not cover content",
        );
        const header = await page.locator("header.mast").boundingBox();
        assert(Math.abs(panel.y - header.y) < 2);
        assert(header.x >= panel.x + panel.width - 1);
        assert.equal(
          await menu
            .getByRole("heading", {
              name: "Askeri Araçlar Kaynak Yönetimi Sistemi",
              exact: true,
            })
            .count(),
          1,
        );
        assert.equal(await page.locator("header.mast h1").count(), 0);
        assert.equal(
          await page
            .getByRole("img", { name: "Otokar", exact: true })
            .evaluate((el) => el.complete && el.naturalWidth > 0),
          true,
        );
        await page.mouse.move(1000, 500);
        await page.waitForTimeout(300);
        assert.equal(
          await isOpen(),
          true,
          "pointer leave does not close a fixed menu",
        );
        await selectWorkspaceTab(page, "Projeler");
        await page.locator(".projectmatrix").waitFor();
        assert.equal(
          await isOpen(),
          true,
          "section changes leave the menu open",
        );
        await f.capture(page, "sabit-dar-sol-menu");
      },
    );
    await f.check(
      "sol menü ve üst bar: sayfanın en altında da sabit kalır, içerikle çakışmaz",
      async () => {
        const beforeHeader = await page.locator("header.mast").boundingBox();
        const beforeMenu = await menu.boundingBox();
        await page.evaluate(() => {
          const space = document.createElement("div");
          space.dataset.menuScrollFixture = "true";
          space.style.height = "1200px";
          document.body.append(space);
          window.scrollTo(0, 300);
        });
        await page.waitForTimeout(100);
        const header = await page.locator("header.mast").boundingBox();
        const panel = await menu.boundingBox();
        assert(Math.abs(header.y - beforeHeader.y) < 2);
        assert(Math.abs(panel.y - beforeMenu.y) < 2);
        assert(panel.y >= -1);
        assert(panel.y + panel.height <= page.viewportSize().height + 2);
        assert(panel.x + panel.width <= header.x + 1);
        assert.equal(
          await page
            .locator(".workspace-sidebar-host")
            .evaluate((el) => getComputedStyle(el).position),
          "fixed",
        );
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        assert(Math.abs((await menu.boundingBox()).y - beforeMenu.y) < 2);
        assert(
          Math.abs(
            (await page.locator("header.mast").boundingBox()).y -
              beforeHeader.y,
          ) < 2,
        );
        await page.evaluate(() => {
          document.querySelector("[data-menu-scroll-fixture]").remove();
          window.scrollTo(0, 0);
        });
        const viewport = page.viewportSize();
        await page.setViewportSize({ width: 1280, height: 320 });
        const list = menu.getByRole("tablist");
        assert(await list.evaluate((el) => el.scrollHeight > el.clientHeight));
        const lastTab = list.getByRole("tab").last();
        await lastTab.scrollIntoViewIfNeeded();
        const last = await lastTab.boundingBox();
        assert(last.y >= 0 && last.y + last.height <= 321);
        const close = await menu
          .getByRole("button", { name: "Sol menüyü kapat", exact: true })
          .boundingBox();
        assert(close.y >= 0 && close.y + close.height <= 321);
        await page.setViewportSize(viewport);
      },
    );
    await f.check(
      "aktivite ekranları: üst boşluk projelerle aynı, giriş araçları başlık satırında",
      async () => {
        const positions = [];
        for (const name of ["Projeler", "Aktivite Giriş", "Aktivite Raporu"]) {
          await selectWorkspaceTab(page, name);
          await page.evaluate(() => window.scrollTo(0, 0));
          await f.wait(async () => {
            const mast = await page.locator("header.mast").boundingBox();
            const main = await page.locator(".app > main").boundingBox();
            return Math.abs(main.y - mast.y - mast.height) < 2;
          }, "content starts immediately after mast: " + name);
          positions.push(
            (await page.locator(".workspace-section-heading").boundingBox()).y,
          );
          if (name === "Aktivite Giriş") {
            // A single section has no tab row; its tools sit in the heading.
            assert.equal(
              await page.locator(".workspace-section-tabs").count(),
              0,
            );
            assert.equal(
              await page
                .locator(".workspace-section-heading .workspace-nav-actions")
                .count(),
              1,
            );
          }
          await f.capture(
            page,
            name === "Aktivite Giriş"
              ? "aktivite-giris-ust-alan"
              : name === "Aktivite Raporu"
                ? "aktivite-raporu-ust-alan"
                : "projeler-ust-alan",
          );
        }
        assert(Math.max(...positions) - Math.min(...positions) < 2);
      },
    );
    await f.check(
      "sol menü: açık/kapalı tercihi hatırlanır; kapalıyken fareyle kendiliğinden açılmaz",
      async () => {
        // The choice applies when the account opens on a screen.
        await setOpening("Projeler");
        const before = await page.locator(".app > main").boundingBox();
        await menu
          .getByRole("button", { name: "Sol menüyü kapat", exact: true })
          .click();
        await f.wait(async () => !(await isOpen()), "explicit close");
        assert.equal(await menu.getAttribute("inert"), "");
        assert(
          (await page.locator(".app > main").boundingBox()).width >
            before.width,
        );
        await page.locator(".workspace-menu-edge").hover();
        await page.waitForTimeout(300);
        assert.equal(await isOpen(), false);
        await page.reload();
        await page
          .getByRole("button", { name: "Sol menüyü aç", exact: true })
          .waitFor();
        assert.equal(await isOpen(), false);
        await page
          .getByRole("button", { name: "Sol menüyü aç", exact: true })
          .click();
        await f.wait(isOpen, "edge click reopens");
        await page.reload();
        await page
          .getByRole("button", { name: "Sol menüyü kapat", exact: true })
          .waitFor();
        assert.equal(await isOpen(), true);
        await setOpening("Ana Sayfa");
      },
    );
    await f.check(
      "sol menü: klavyeyle açma, dikey gezinme ve Escape ile kapatma",
      async () => {
        await selectWorkspaceTab(page, "Projeler");
        await page.locator(".app.tab-projects").waitFor();
        await page
          .getByRole("button", { name: "Sol menüyü kapat", exact: true })
          .click();
        const trigger = page.getByRole("button", {
          name: "Sol menüyü aç",
          exact: true,
        });
        await trigger.focus();
        await page.keyboard.press("Enter");
        const current = menu.locator('[role="tab"][aria-selected="true"]');
        await f.wait(
          async () =>
            await current.evaluate((el) => document.activeElement === el),
          "active tab receives keyboard focus",
        );
        await page.keyboard.press("ArrowDown");
        const planning = menu.getByRole("tab", {
          name: "Kaynak Planlama",
          exact: true,
        });
        await f.wait(
          async () =>
            await planning.evaluate((el) => document.activeElement === el),
          "resource planning follows projects",
        );
        await page.keyboard.press("ArrowDown");
        const progress = menu.getByRole("tab", {
          name: "Proje ve Kaynak Değerlendirme",
          exact: true,
        });
        await f.wait(
          async () =>
            await progress.evaluate((el) => document.activeElement === el),
          "vertical arrow navigation",
        );
        await page.keyboard.press("Enter");
        await page.locator(".app.tab-progress").waitFor();
        assert.equal(await isOpen(), true);
        await page.keyboard.press("Escape");
        await f.wait(
          async () => !(await isOpen()),
          "Escape closes focused navigation",
        );
        await f.wait(
          async () =>
            await trigger.evaluate((el) => document.activeElement === el),
          "focus restored to trigger",
        );
      },
    );
    await f.check(
      "sol menü: küçük ekranda panel ve kapatma düğmesi erişilebilir",
      async () => {
        await page.setViewportSize({ width: 320, height: 480 });
        await page
          .getByRole("button", { name: "Sol menüyü aç", exact: true })
          .click();
        await f.wait(async () => {
          const b = await menu.boundingBox();
          return b.x >= 0 && b.x + b.width <= 320;
        }, "narrow panel fits");
        const list = menu.getByRole("tablist");
        assert((await list.getByRole("tab").count()) > 0);
        await menu
          .getByRole("tab", {
            name: "Organizasyon & Çalışan & Yetki",
            exact: true,
          })
          .scrollIntoViewIfNeeded();
        await menu
          .getByRole("button", { name: "Sol menüyü kapat", exact: true })
          .click();
        assert.equal(await isOpen(), false);
        await f.capture(page, "sabit-dar-sol-menu-mobile");
      },
    );
  } finally {
    await context.close();
  }
  for (const role of ["manager", "employee"]) {
    const client = await f.client(role);
    try {
      await f.check(
        `sol menü: ${role} rolünde yetki sınırları korunur`,
        async () => {
          const navigation = client.page.locator("#workspace-main-menu");
          // A new session opens on Ana Sayfa, where the menu is closed.
          assert.equal(await navigation.getAttribute("data-open"), "false");
          assert.equal(
            await navigation
              .getByRole("tab", {
                name: "Organizasyon & Çalışan & Yetki",
                exact: true,
              })
              .count(),
            0,
          );
          if (role === "employee")
            assert.equal(
              await navigation
                .getByRole("tab", {
                  name: "Proje ve Kaynak Değerlendirme",
                  exact: true,
                })
                .count(),
              0,
            );
          await selectWorkspaceTab(client.page, "Projeler");
          await client.page.locator(".projectmatrix").waitFor();
        },
      );
    } finally {
      await client.context.close();
    }
  }
}
