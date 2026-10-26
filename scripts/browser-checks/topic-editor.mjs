import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkTopicEditor(f) {
  const project = (await f.state()).projects.find((p) => p.id === "p-a");
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      {
        kind: "project",
        id: project.id,
        revision: d.revisions["project:" + project.id],
        value: {
          ...project,
          milestones: [
            {
              id: "topic-panel",
              name: "Panel heading",
              start: "2026-03-02",
              end: "2026-03-20",
              barColor: "blue",
              barStyle: "solid",
              barNotes: [
                {
                  text: "Panel note",
                  start: "2026-03-02",
                  end: "2026-03-20",
                  includeInReport: true,
                },
              ],
              additionalRanges: [
                {
                  displayKind: "milestone",
                  start: "2026-03-13",
                  end: "2026-03-13",
                  notes: [{ text: "Panel milestone", includeInReport: true }],
                },
              ],
            },
          ],
        },
      },
    ]),
  );
  const { page } = await f.client("root-admin");
  const dialog = page.getByRole("dialog", {
    name: "Başlık Düzenle",
    exact: true,
  });
  try {
    await selectWorkspaceTab(page, "Projeler");
    await page
      .getByRole("switch", { name: "Detayları Göster", exact: true })
      .check();
    const row = page
      .locator('[data-project-group="p-a"] .milestone-row')
      .first();
    await f.check(
      "topic sheet: clicking a bar opens two sections; switching preserves draft and the appearance preview updates",
      async () => {
        await row.locator(".gantt-bar").first().click();
        await dialog.waitFor();
        const tabs = dialog.getByRole("tablist", {
          name: "Başlık düzenleme bölümleri",
        });
        assert.deepEqual(await tabs.getByRole("tab").allTextContents(), [
          "Başlık ve Detaylar",
          "Görünüm",
        ]);
        assert.equal(
          await tabs
            .getByRole("tab", { name: "Başlık ve Detaylar", exact: true })
            .getAttribute("aria-selected"),
          "true",
        );
        await dialog
          .getByLabel("Başlık", { exact: true })
          .fill("Updated panel heading");
        await dialog.locator("textarea").first().fill("Updated panel note");
        await tabs.getByRole("tab", { name: "Görünüm", exact: true }).click();
        await dialog
          .getByRole("button", { name: "Çerçeveli", exact: true })
          .click();
        assert.equal(
          await dialog.locator(".topic-preview-bar.outline").count(),
          1,
        );
        assert.match(
          await dialog
            .getByRole("region", { name: "Takvim ön izlemesi" })
            .innerText(),
          /Updated panel note/,
        );
        assert.match(
          await dialog.locator(".topic-preview-point").innerText(),
          /13.03.2026/,
        );
        await tabs
          .getByRole("tab", { name: "Başlık ve Detaylar", exact: true })
          .click();
        assert.equal(
          await dialog.getByLabel("Başlık", { exact: true }).inputValue(),
          "Updated panel heading",
        );
        assert.equal(
          await dialog.locator("textarea").first().inputValue(),
          "Updated panel note",
        );
      },
    );
    await f.check(
      "topic sheet: footer stays in view when contents scroll and on a narrow screen; dates open within the modal",
      async () => {
        for (const size of [
          { width: 1600, height: 900 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewportSize(size);
          await dialog
            .locator('.topic-editor-section[data-state="active"]')
            .evaluate((el) => (el.scrollTop = el.scrollHeight));
          await f.wait(async () => {
            const button = await dialog
              .getByRole("button", { name: "Kaydet", exact: true })
              .boundingBox();
            return (
              button &&
              button.y >= 0 &&
              button.y + button.height <= size.height + 1
            );
          }, "footer stays within resized viewport");
          const tabs = await dialog.getByRole("tablist").boundingBox();
          assert(tabs && tabs.y >= 0);
        }
        await page.setViewportSize({ width: 1600, height: 900 });
        await dialog.locator(".date-field-toggle").first().click();
        await page.locator(".date-calendar").waitFor();
        await page.keyboard.press("Escape");
        await page.locator(".date-calendar").waitFor({ state: "detached" });
        assert(await dialog.isVisible());
        await f.capture(page, "topic-sheet-details");
        await dialog.getByRole("tab", { name: "Görünüm", exact: true }).click();
        await f.capture(page, "topic-sheet-appearance");
        await dialog
          .getByRole("button", { name: "Kaydet", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        const saved = (await f.state()).projects.find((p) => p.id === "p-a")
          .milestones[0];
        assert.equal(saved.name, "Updated panel heading");
        assert.equal(saved.barStyle, "outline");
        assert.equal(saved.barNotes[0].text, "Updated panel note");
        await row.locator(".milestone-point").first().click();
        await dialog.waitFor();
        assert.equal(
          await dialog
            .getByRole("tab", { name: "Başlık ve Detaylar", exact: true })
            .getAttribute("aria-selected"),
          "true",
        );
        await dialog
          .getByRole("button", { name: "Vazgeç", exact: true })
          .click();
      },
    );
  } finally {
    await page.close();
  }
}
