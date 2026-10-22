import { selectWorkspaceTab, selectWorkspaceView } from "./fixture.mjs";
import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

// "Kişi Bazlı" layout: a person row with month totals, then all visible
// projects, including empty rows for new entries. The screen opens in
// "Proje Bazlı"; the person layout is one choice away.
export async function checkActualPersonLayout(f) {
  await f.store.mutate(f.actor, (data, actor) =>
    applyChanges(data, actor, [
      { kind: "actual", id: "r-own|p-a|2026-01", value: 0.5, revision: 0 },
    ]),
  );
  const { page, context } = await f.client("root-admin", {
    actualLayout: null,
  });
  const heading = () => page.locator('[data-person-heading="r-own"]');
  const projectRow = (id) =>
    page.locator(
      `[data-project-group="person:r-own"] [data-person-project="${id}"]`,
    );
  const amount = (project, month) =>
    page.getByRole("textbox", {
      name: `Browser Employee / ${project} / ${month} / %`,
      exact: true,
    });
  try {
    await selectWorkspaceTab(page, "Aktivite Giriş");
    await f.check(
      "actual person layout: opens in Proje Bazlı; Kişi Bazlı lists all visible projects under each person",
      async () => {
        assert.equal(
          await page.getByLabel("Görünüm", { exact: true }).inputValue(),
          "project",
        );
        await selectWorkspaceView(page, "Kişi Bazlı");
        await page.getByLabel("Kişi ara").fill("browser employee");
        await heading().waitFor();
        assert.equal(await projectRow("p-a").count(), 1);
        assert.equal(await projectRow("p-b").count(), 1);
        const total = heading().locator(
          '[data-person-month="r-own|2026-01"] strong',
        );
        const before = await total.textContent();
        await amount("Browser Project A", "2026-01").fill("60");
        await amount("Browser Project A", "2026-01").press("Enter");
        await f.wait(
          async () => (await total.textContent()) !== before,
          "person month total follows the entry",
        );
      },
    );
    await f.check(
      "actual person layout: + opens a project row that saves; rows fold and search narrows",
      async () => {
        await page
          .getByRole("switch", { name: "Sadece veri olanlar", exact: true })
          .click();
        assert.equal(await projectRow("p-b").count(), 0);
        await heading()
          .getByRole("combobox", { name: "Browser Employee için proje ekle" })
          .selectOption({ label: "Browser Project B" });
        await projectRow("p-b").waitFor();
        await amount("Browser Project B", "2026-01").fill("10");
        await amount("Browser Project B", "2026-01").press("Enter");
        await f.wait(
          async () =>
            ((await f.state()).actualAllocations["r-own|p-b|2026-01"] || 0) > 0,
          "added project row saves",
        );
        const toggle = heading().getByRole("button", {
          name: "Browser Employee projelerini daralt",
        });
        await toggle.click();
        assert.equal(await projectRow("p-a").count(), 0);
        await heading()
          .getByRole("button", { name: "Browser Employee projelerini aç" })
          .click();
        await projectRow("p-a").waitFor();
        await page.getByLabel("Kişi ara").fill("bulunmayan kişi");
        await page
          .getByText("“bulunmayan kişi” ile eşleşen kişi yok.")
          .waitFor();
        assert.equal(await page.locator("[data-person-heading]").count(), 0);
      },
    );
    await f.check(
      "actual person layout: the chosen layout is remembered after a reload",
      async () => {
        // Kişi Bazlı is not the default, so it proves the choice is kept.
        await selectWorkspaceView(page, "Kişi Bazlı");
        await page.reload();
        await selectWorkspaceTab(page, "Aktivite Giriş");
        await page
          .locator('[data-project-group="person:r-own"]')
          .first()
          .waitFor();
        assert.equal(
          await page.getByLabel("Görünüm", { exact: true }).inputValue(),
          "person",
        );
      },
    );
  } finally {
    await context.close();
  }
}
