import { selectWorkspaceTab, selectWorkspaceView } from "./fixture.mjs";
import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

export async function checkTeamCapacityHeader(f) {
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      ...[
        ["p-a", "2026-01", 0.6],
        ["p-b", "2026-01", 0.5],
        ["p-a", "2026-03", 1.11],
      ].map(([p, m, value]) => ({
        kind: "allocation",
        id: `${f.teamA.id}|${p}|${m}`,
        value,
        revision: 0,
      })),
    ]),
  );
  const { page } = await f.client("root-admin");
  try {
    await selectWorkspaceTab(page, "Kaynak Planlama");
    await selectWorkspaceView(page, "Takım Bazlı");
    await page.getByRole("button", { name: "Takım", exact: true }).click();
    const teamPicker = page.locator('.pickerpanel[data-state="open"]');
    await teamPicker
      .getByRole("button", { name: "Seçimleri Kaldır", exact: true })
      .click();
    await teamPicker
      .getByRole("checkbox", { name: f.teamA.name, exact: true })
      .check();
    await page.keyboard.press("Escape");
    const table = page.locator(
      ".workspace-dock > [data-slot=table-container] > .allocation-grid",
    );
    const row = table.locator(`[data-planning-group="${f.teamA.id}"]`);
    await row.scrollIntoViewIfNeeded();
    // Monthly capacity lives in the Kalan Kaynak report above the table.
    const summary = (kind, month) =>
      page.locator(".capacitystrip .summary.s" + kind + " td").nth(month);
    await f.check(
      "team capacity header: the team row carries only the team identity; monthly capacity and its threshold colours are in the Kalan Kaynak report",
      async () => {
        assert.deepEqual(
          await row
            .locator("[data-team-capacity-month]")
            .evaluateAll((cells) =>
              cells.map((cell) => cell.textContent + cell.children.length),
            ),
          Array(12).fill("0"),
        );
        assert.equal(await page.locator(".capacity-legend").count(), 0);
        assert.equal(await summary(0, 1).innerText(), "1");
        assert.equal(await summary(2, 1).innerText(), "1,1");
        assert.equal(await summary(3, 1).innerText(), "-0,1");
        assert(
          (await summary(3, 1).getAttribute("class")).includes("over-warning"),
        );
        assert(
          (await summary(3, 3).getAttribute("class")).includes("over-critical"),
        );
        assert.equal(
          await table.locator(".summary").count(),
          0,
          "Old bottom summaries are removed in team view",
        );
        const position = await row.evaluate((row) => ({
          heading: row.rowIndex,
          next: row.nextElementSibling.rowIndex,
        }));
        assert(position.next > position.heading);
        await f.capture(page, "team-capacity-header");
      },
    );
    await f.check(
      "team capacity header: resource entry updates the Kalan Kaynak report; a project filter narrows its allocated row",
      async () => {
        const input = table.locator(
          `[data-plan-cell="${f.teamA.id}|p-a|2026-01"] input`,
        );
        await input.fill("0,75");
        await input.press("Enter");
        await f.wait(
          async () => (await summary(3, 1).innerText()) === "-0,25",
          "report reflects saved allocation",
        );
        assert.equal(await summary(2, 1).innerText(), "1,25");
        await page.getByRole("button", { name: "Proje", exact: true }).click();
        const picker = page.locator('.pickerpanel[data-state="open"]');
        await picker
          .getByRole("button", { name: "Seçimleri Kaldır", exact: true })
          .click();
        await picker
          .getByRole("checkbox", { name: "Browser Project A", exact: true })
          .check();
        await page.keyboard.press("Escape");
        await f.wait(
          async () => (await summary(2, 1).innerText()) === "0,75",
          "report shows the selected project's allocation",
        );
        assert.equal(await summary(3, 1).innerText(), "0,25");
      },
    );
    await f.check(
      "team capacity header: compact team rows stay short and keep the team label inside its cell",
      async () => {
        // Kaynak Planlama is always compact; there is no density choice.
        assert.equal(
          await page
            .getByRole("combobox", { name: "Takvim yoğunluğu", exact: true })
            .count(),
          0,
        );
        assert(await page.locator(".app.dense-compact").count());
        await row.scrollIntoViewIfNeeded();
        const layout = await row.evaluate((row) => ({
          height: row.getBoundingClientRect().height,
          labelFits: row.cells[0].scrollWidth <= row.cells[0].clientWidth,
        }));
        await f.capture(page, "team-capacity-compact");
        assert(layout.height < 85, `compact header height: ${layout.height}`);
        assert(layout.labelFits, JSON.stringify(layout));
      },
    );
  } finally {
    await page.close();
  }
}
