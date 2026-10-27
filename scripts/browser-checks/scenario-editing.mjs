import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { openScenarioEntry, selectWorkspaceTab } from "./fixture.mjs";

export async function checkScenarioEditing(f) {
  const scenario = (id, name, months) => ({
    id,
    name,
    status: "draft",
    includeTimeline: true,
    shifts: [{ projectId: "p-a", months, fromMonth: "2026-10" }],
    createdBy: "root-admin",
    createdByName: "",
    createdAt: new Date().toISOString(),
  });
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      {
        kind: "scenario",
        id: "edit-a",
        value: scenario("edit-a", "Editable A", 3),
        revision: 0,
      },
      {
        kind: "scenario",
        id: "edit-b",
        value: scenario("edit-b", "Editable B", 5),
        revision: 0,
      },
    ]),
  );
  const { page } = await f.client("root-admin");
  const saved = () =>
    page.locator(".saved-scenarios li").filter({ hasText: "Editable A" });
  const card = () => page.locator(".schedule-scenario-card[data-editing]");
  const open = async () => {
    await selectWorkspaceTab(page, "Projeler");
    await page.getByRole("tab", { name: /^Proje Takvimi Güncelle/ }).click();
    await openScenarioEntry(page);
  };
  try {
    await f.check(
      "scenario editing: name remains visible and editable beside actions on desktop, tablet and phone without horizontal scrolling",
      async () => {
        await open();
        await saved()
          .getByRole("button", { name: "Düzenle", exact: true })
          .click();
        const name = card().getByLabel("Senaryo İsmi", { exact: true });
        for (const width of [1600, 1366, 1280, 1024, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const closeMenu = page.getByRole("button", {
            name: "Sol menüyü kapat",
            exact: true,
          });
          if (width < 1100 && (await closeMenu.isVisible()))
            await closeMenu.click();
          await card()
            .locator(".schedule-card-action-row")
            .evaluate((row) => {
              row.scrollLeft = 0;
            });
          const geometry = await card()
            .locator(".schedule-card-action-row")
            .evaluate((row) => {
              const input = row.querySelector("input").getBoundingClientRect();
              const buttons = row
                .querySelector(".schedule-card-buttons")
                .getBoundingClientRect();
              const box = row.getBoundingClientRect();
              return {
                input: {
                  x: input.x,
                  y: input.y,
                  width: input.width,
                  right: input.right,
                },
                buttons: { y: buttons.y, right: buttons.right },
                left: box.x,
                right: box.right,
                clientWidth: row.clientWidth,
                scrollWidth: row.scrollWidth,
              };
            });
          assert(
            geometry.input.width >= 60,
            `name usable at ${width}: ${JSON.stringify(geometry)}`,
          );
          assert(
            geometry.input.x >= geometry.left - 1 &&
              geometry.input.right <= geometry.right + 1,
            `name within card at ${width}: ${JSON.stringify(geometry)}`,
          );
          assert(
            geometry.buttons.right <= geometry.right + 1,
            `actions within card at ${width}`,
          );
          assert(
            geometry.scrollWidth <= geometry.clientWidth + 1,
            `no horizontal form scroll at ${width}: ${JSON.stringify(geometry)}`,
          );
          if (width >= 390)
            assert(
              Math.abs(geometry.input.y - geometry.buttons.y) < 3,
              `single row at ${width}: ${JSON.stringify(geometry)}`,
            );
          if (width === 390)
            await f.capture(page, "scenario-editing-phone-name");
          await name.fill("Editable A");
        }
        // Browser/page scaling can make a desktop half-pane narrower than a
        // phone layout. Measure before typing/focus can scroll hidden content.
        for (const zoom of [1, 1.1, 1.25]) {
          await page.locator(".app").evaluate((el, value) => {
            el.style.zoom = String(value);
          }, zoom);
          for (const width of [1366, 1280, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            const bounds = await card().evaluate((element) => {
              const field = element.querySelector(
                'input[aria-label="Senaryo İsmi"]',
              );
              const row = field.closest(".schedule-card-action-row");
              row.scrollLeft = 0;
              const input = field.getBoundingClientRect(),
                box = element.getBoundingClientRect();
              return {
                x: input.x,
                right: input.right,
                width: input.width,
                cardX: box.x,
                cardRight: box.right,
                rowWidth: row.clientWidth,
                rowContent: row.scrollWidth,
              };
            });
            assert(
              bounds.width >= 60 &&
                bounds.x >= bounds.cardX &&
                bounds.right <= bounds.cardRight &&
                bounds.right <= width,
              `visible name at ${width}/${zoom}: ${JSON.stringify(bounds)}`,
            );
            assert(
              bounds.rowContent <= bounds.rowWidth + 1,
              `no hidden name at ${width}/${zoom}: ${JSON.stringify(bounds)}`,
            );
          }
        }
        await page.locator(".app").evaluate((el) => {
          el.style.zoom = "";
        });
        await card()
          .getByRole("button", {
            name: "Editable A senaryo düzenlemesini iptal et",
            exact: true,
          })
          .click();
        await page.setViewportSize({ width: 1600, height: 1000 });
      },
    );
    await f.check(
      "scenario editing: Edit precedes Delete, opens all fields, saves the same record and preserves its creator",
      async () => {
        await open();
        const row = saved();
        const buttons = await row
          .locator(".saved-scenario-actions button")
          .allTextContents();
        assert.equal(buttons[buttons.indexOf("Sil") - 1], "Düzenle");
        const before = (await f.state()).scheduleScenarios.find(
          (s) => s.id === "edit-a",
        );
        await row.getByRole("button", { name: "Düzenle", exact: true }).click();
        assert.equal(
          await card().getByLabel("Senaryo İsmi").inputValue(),
          "Editable A",
        );
        assert.equal(await card().getByLabel("Süre (Ay)").inputValue(), "3");
        await card().getByLabel("Süre (Ay)").fill("4");
        await card()
          .getByRole("button", {
            name: "Editable A senaryosunu kaydet",
            exact: true,
          })
          .click();
        await page
          .getByRole("status")
          .filter({ hasText: "“Editable A” güncellendi." })
          .waitFor();
        const all = (await f.state()).scheduleScenarios;
        assert.equal(all.length, 2);
        const after = all.find((s) => s.id === "edit-a");
        assert.equal(after.shifts[0].months, 4);
        assert.equal(after.createdAt, before.createdAt);
        assert.equal(after.createdBy, before.createdBy);
        assert.equal(await card().count(), 0);
      },
    );
    await f.check(
      "scenario editing: cancel changes nothing; duplicate edits cannot save",
      async () => {
        await saved()
          .getByRole("button", { name: "Düzenle", exact: true })
          .click();
        await card().getByLabel("Senaryo İsmi").fill("Editable B");
        assert(
          await card()
            .getByRole("button", {
              name: "Editable B senaryosunu kaydet",
              exact: true,
            })
            .isDisabled(),
        );
        await card()
          .getByRole("button", {
            name: "Editable B senaryo düzenlemesini iptal et",
            exact: true,
          })
          .click();
        assert.equal(
          (await f.state()).scheduleScenarios.find((s) => s.id === "edit-a")
            .name,
          "Editable A",
        );
      },
    );
    await f.check(
      "scenario editing: page refresh and background data updates do not rebase the opening revision",
      async () => {
        await saved()
          .getByRole("button", { name: "Düzenle", exact: true })
          .click();
        await card().getByLabel("Süre (Ay)").fill("6");
        await page.reload();
        await open();
        assert.equal(await card().getByLabel("Süre (Ay)").inputValue(), "6");
        const d = await f.state(),
          value = d.scheduleScenarios.find((s) => s.id === "edit-a");
        await f.store.mutate(f.actor, (draft, u) =>
          applyChanges(draft, u, [
            {
              kind: "scenario",
              id: value.id,
              value: { ...value, shifts: [{ ...value.shifts[0], months: 7 }] },
              revision: d.revisions["scenario:" + value.id],
            },
          ]),
        );
        await page.reload();
        await open();
        await card()
          .getByRole("button", {
            name: "Editable A senaryosunu kaydet",
            exact: true,
          })
          .click();
        await page
          .locator('.schedule-scenario-actions [role="alert"]')
          .waitFor();
        assert.equal(await card().getByLabel("Süre (Ay)").inputValue(), "6");
        assert.equal(
          (await f.state()).scheduleScenarios.find((s) => s.id === "edit-a")
            .shifts[0].months,
          7,
        );
        await card()
          .getByRole("button", {
            name: "Editable A senaryo düzenlemesini iptal et",
            exact: true,
          })
          .click();
      },
    );
    await f.check(
      "scenario editing: approved records have no Edit action until approval is withdrawn",
      async () => {
        await saved()
          .getByRole("button", { name: "Onayla", exact: true })
          .click();
        await saved()
          .getByRole("button", { name: "Onayı Geri Çek", exact: true })
          .waitFor();
        assert.equal(
          await saved()
            .getByRole("button", { name: "Düzenle", exact: true })
            .count(),
          0,
        );
      },
    );
  } finally {
    await page.close();
  }
  const manager = await f.client("manager");
  try {
    await selectWorkspaceTab(manager.page, "Projeler");
    await manager.page
      .getByRole("tab", { name: /^Proje Takvimi Güncelle/ })
      .click();
    assert.equal(
      await manager.page
        .locator(".saved-scenarios")
        .getByRole("button", { name: "Düzenle", exact: true })
        .count(),
      0,
    );
  } finally {
    await manager.page.close();
  }
}
