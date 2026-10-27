import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";
export async function checkProjectCompletion(f) {
  const { page, context } = await f.client("root-admin");
  try {
    await selectWorkspaceTab(page, "Projeler");
    const row = () => page.locator('[data-project-heading="p-a"]');
    await f.check(
      "completed projects: metadata checkbox moves the project between identical timeline tabs and persists",
      async () => {
        await row().locator(".project-name-copy button").click();
        const editor = page.getByRole("dialog", {
          name: "Proje Bilgilerini Düzenle",
          exact: true,
        });
        const status = editor.getByRole("group", {
          name: "Proje Durumu",
          exact: true,
        });
        const layout = await status
          .locator(".project-completed-field")
          .evaluate((label) => {
            const check = label.querySelector("input").getBoundingClientRect(),
              text = label.querySelector("span").getBoundingClientRect();
            return {
              horizontal:
                check.right <= text.x &&
                Math.abs(
                  check.y + check.height / 2 - text.y - text.height / 2,
                ) < 2,
              framed:
                getComputedStyle(label.closest("fieldset")).borderTopStyle ===
                "solid",
            };
          });
        assert(layout.horizontal && layout.framed);
        await editor
          .getByRole("checkbox", { name: "Tamamlandı", exact: true })
          .check();
        await editor
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await editor.waitFor({ state: "hidden" });
        await row().waitFor({ state: "detached" });
        assert.equal(
          (await f.state()).projects.find((p) => p.id === "p-a").completed,
          true,
        );
        await page
          .getByRole("tab", { name: "Tamamlanan Projeler", exact: true })
          .click();
        await row().waitFor();
        assert.equal(
          await page.locator('[data-project-heading="p-b"]').count(),
          0,
        );
        await page.reload();
        await selectWorkspaceTab(page, "Projeler");
        assert.equal(await row().count(), 0);
        await page
          .getByRole("tab", { name: "Tamamlanan Projeler", exact: true })
          .click();
        await row().waitFor();
        await f.capture(page, "completed-projects-timeline");
        await row().locator(".project-name-copy button").click();
        await editor
          .getByRole("checkbox", { name: "Tamamlandı", exact: true })
          .uncheck();
        await editor
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await editor.waitFor({ state: "hidden" });
        await row().waitFor({ state: "detached" });
        await page
          .getByRole("tablist", { name: "Proje görünümü", exact: true })
          .getByRole("tab", { name: "Projeler", exact: true })
          .click();
        await row().waitFor();
        assert.equal(
          !!(await f.state()).projects.find((p) => p.id === "p-a").completed,
          false,
        );
      },
    );
    await f.check(
      "scenario entry: starts closed, opens explicitly, closes on save and opens saved drafts for editing",
      async () => {
        await page
          .getByRole("tab", { name: /^Proje Takvimi Güncelle/ })
          .click();
        const create = page.getByRole("button", {
          name: "Senaryo Oluştur",
          exact: true,
        });
        await create.waitFor();
        assert.equal(await page.locator(".schedule-scenario-card").count(), 0);
        await create.click();
        const card = page.locator(".schedule-scenario-card").first();
        await card
          .getByLabel("Senaryo İsmi", { exact: true })
          .fill("Explicit create");
        await card.getByLabel("Proje", { exact: true }).selectOption("p-a");
        await card.locator(".schedule-card-buttons .flow-button").click();
        await page
          .locator(".scenario-message")
          .filter({ hasText: "“Explicit create” eklendi." })
          .waitFor();
        await create.waitFor();
        assert.equal(await page.locator(".schedule-scenario-card").count(), 0);
        await page
          .locator(".saved-scenarios li")
          .filter({ hasText: "Explicit create" })
          .getByRole("button", { name: "Düzenle", exact: true })
          .click();
        await card.waitFor();
        assert.equal(
          await card.getByLabel("Senaryo İsmi", { exact: true }).inputValue(),
          "Explicit create",
        );
        await card.getByLabel("Süre (Ay)", { exact: true }).fill("4");
        await card.locator(".schedule-card-buttons .flow-button").click();
        await page
          .locator(".scenario-message")
          .filter({ hasText: "“Explicit create” güncellendi." })
          .waitFor();
        await create.waitFor();
        await create.click();
        await card.getByLabel("Senaryo İsmi", { exact: true }).fill("");
        await card.locator(".schedule-card-buttons .flow-button").click();
        assert.equal(await card.isVisible(), true);
      },
    );
  } finally {
    await context.close();
  }
}
