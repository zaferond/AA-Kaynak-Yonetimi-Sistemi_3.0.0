import assert from "node:assert/strict";

export async function checkNotifications(f) {
  const manager = await f.client("manager");
  try {
    await f.check(
      "notifications: the bell counts others' changes and closing marks them read",
      async () => {
        const { page } = manager;
        const bell = page.locator(".mast-bell");
        // The fixture's projects were created by another account.
        await f.wait(
          async () =>
            /yeni$/.test((await bell.getAttribute("aria-label")) || ""),
          "unread notifications",
        );
        await bell.click();
        const panel = page.locator(".notification-panel");
        await panel.waitFor();
        assert.ok((await panel.locator("li").count()) > 0);
        assert.ok((await panel.locator("[data-unread]").count()) > 0);
        await page.keyboard.press("Escape");
        await panel.waitFor({ state: "detached" });
        assert.equal(await bell.getAttribute("aria-label"), "Bildirimler");
        await page.reload();
        await bell.waitFor();
        await page.waitForTimeout(300);
        assert.equal(await bell.getAttribute("aria-label"), "Bildirimler");
      },
    );
    await f.check(
      "notifications: an item opens the screen it is about",
      async () => {
        const { page } = manager;
        await page.locator(".mast-bell").click();
        const item = page
          .locator(".notification-panel li button")
          .filter({ hasText: "Yeni proje eklendi" })
          .first();
        await item.waitFor();
        assert.equal(await item.getAttribute("data-unread"), null);
        await item.click();
        await page.locator(".app.tab-projects").waitFor();
      },
    );
  } finally {
    await manager.page.close();
  }
}
