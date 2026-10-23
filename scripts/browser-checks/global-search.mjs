import assert from "node:assert/strict";

export async function checkGlobalSearch(f) {
  const admin = await f.client("root-admin");
  const employee = await f.client("employee");
  try {
    await f.check(
      "search: Ctrl+K finds a team and opens Kaynak Planlama filtered to it",
      async () => {
        const { page } = admin;
        await page.keyboard.press("Control+k");
        const dialog = page.locator(".global-search");
        await dialog.waitFor();
        await page.keyboard.type(f.teamA.name.slice(0, 12));
        const team = dialog
          .getByRole("option")
          .filter({ hasText: f.teamA.name });
        await team.first().waitFor();
        await team.first().click();
        await dialog.waitFor({ state: "detached" });
        await page.locator(".app.tab-plan").waitFor();
        assert.equal(
          await page
            .locator('.filter-token-group[data-filter="Takım"] .filter-token')
            .innerText(),
          f.teamA.name,
        );
      },
    );
    await f.check(
      "search: the top bar button opens it; arrows and Enter open a screen",
      async () => {
        const { page } = admin;
        await page.locator(".mast-search").click();
        const dialog = page.locator(".global-search");
        await dialog.waitFor();
        await page.keyboard.type("aktivite rap");
        assert.equal(
          await dialog.locator('[aria-selected="true"] strong').innerText(),
          "Aktivite Raporu",
        );
        await page.keyboard.press("Enter");
        await page.locator(".app.tab-activity").waitFor();
        await page.keyboard.press("Control+k");
        await dialog.waitFor();
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
      },
    );
    await f.check(
      "search: an employee only finds screens and records they may open",
      async () => {
        const { page } = employee;
        await page.keyboard.press("Control+k");
        const dialog = page.locator(".global-search");
        await dialog.waitFor();
        await page.keyboard.type(f.teamA.name.slice(0, 12));
        await page.waitForTimeout(150);
        assert.equal(
          await dialog.getByRole("group", { name: "Takımlar" }).count(),
          0,
        );
        assert.equal(
          await dialog.getByRole("group", { name: "Kişiler" }).count(),
          0,
        );
        await page.keyboard.press("Escape");
      },
    );
  } finally {
    await admin.page.close();
    await employee.page.close();
  }
}
