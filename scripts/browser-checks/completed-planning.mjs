import assert from "node:assert/strict";
import path from "node:path";
import { applyChanges } from "../../backend/operations.mjs";
import { download, zipEntries } from "./files.mjs";
import { selectWorkspaceView } from "./fixture.mjs";

export async function checkCompletedPlanning(f) {
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      {
        kind: "project",
        id: "p-b",
        revision: d.revisions["project:p-b"],
        value: { ...d.projects.find((p) => p.id === "p-b"), completed: true },
      },
      ...[
        ["p-a", "2026-10", 0.5],
        ["p-a", "2026-11", 0.5],
        ["p-b", "2026-11", 0.4],
        ["p-b", "2026-12", 0.2],
        ["p-b", "2026-09", 0.8],
      ].map(([project, month, value]) => ({
        kind: "allocation",
        id: f.teamA.id + "|" + project + "|" + month,
        value,
        revision: 0,
      })),
    ]),
  );
  const { page, context } = await f.client("root-admin");
  const url =
    f.origin +
    "/?" +
    new URLSearchParams({
      allocation: "full",
      view: "project",
      start: "2026-10",
      count: "6",
      team: f.teamA.id,
    });
  const toggle = () =>
    page.getByRole("switch", {
      name: "Tamamlanan Projeleri Göster",
      exact: true,
    });
  const doneCells = () => page.locator('[data-plan-cell*="|p-b|"]');
  const summary = () => page.locator(".planned-capacity-summary");
  async function start() {
    await page.goto(url);
    await toggle().waitFor();
    if ((await summary().getAttribute("open")) === null)
      await summary().locator("summary").click();
    await summary().locator(".table-value").first().waitFor();
  }
  async function xml(name) {
    const bytes = await download(
      page,
      page.getByRole("button", { name: "Excel'e Aktar", exact: true }),
      path.join(f.dir, name),
    );
    return Object.entries(zipEntries(bytes))
      .filter(([file]) => file.startsWith("xl/worksheets/"))
      .map(([, value]) => value)
      .join("\n");
  }
  try {
    await start();
    await f.check(
      "completed planning: default hidden, left control opens tagged projects and leaves capacity and saved allocations unchanged",
      async () => {
        const original = structuredClone((await f.state()).allocations);
        const totals = await summary().innerText();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        assert.equal(await doneCells().count(), 0);
        assert.equal(
          await page.locator(".completed-planning-warning").count(),
          0,
        );
        const previous = await page
            .getByRole("switch", { name: "Sadece Veri Olanlar", exact: true })
            .boundingBox(),
          next = await toggle().boundingBox();
        assert(next.x > previous.x && Math.abs(next.y - previous.y) < 3);
        await toggle().click();
        await page
          .locator('[data-project-heading="p-b"] .completed-planning-badge')
          .waitFor();
        assert.equal(await summary().innerText(), totals);
        await toggle().click();
        assert.equal(await doneCells().count(), 0);
        assert.equal(await summary().innerText(), totals);
        assert.deepEqual((await f.state()).allocations, original);
        await toggle().click();
        assert.equal(await toggle().getAttribute("aria-checked"), "true");
        await f.capture(page, "completed-planning-open");
      },
    );
    await f.check(
      "completed planning: team/data-only layouts and a completed-only project filter retain the intended totals",
      async () => {
        await selectWorkspaceView(page, "Takım Bazlı");
        await page
          .locator(
            'tr[data-completed-project="true"] .completed-planning-badge',
          )
          .waitFor();
        await page
          .getByRole("switch", { name: "Sadece Veri Olanlar", exact: true })
          .click();
        await toggle().click();
        assert.equal(await doneCells().count(), 0);
        await page.getByRole("button", { name: "Proje", exact: true }).click();
        const picker = page.locator('.pickerpanel[data-state="open"]');
        await picker
          .getByRole("checkbox", { name: "Browser Project B", exact: true })
          .check();
        await page.keyboard.press("Escape");
        await page
          .getByText("Tamamlanan projeler gizli", { exact: true })
          .waitFor();
        const totals = await summary().innerText();
        await page
          .getByRole("button", {
            name: "Tamamlanan Projeleri Göster",
            exact: true,
          })
          .click();
        assert.equal(await toggle().getAttribute("aria-checked"), "true");
        assert.equal(await summary().innerText(), totals);
        assert(await doneCells().count());
      },
    );
    await f.check(
      "completed planning: Excel follows visibility and reload defaults to hidden",
      async () => {
        await start();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        let sheet = await xml("completed-hidden.xlsx");
        assert(sheet.includes("Browser Project A"));
        assert(!sheet.includes("Browser Project B"));
        await toggle().click();
        sheet = await xml("completed-shown.xlsx");
        assert(sheet.includes("Browser Project B"));
      },
    );
    await f.check(
      "completed planning: a failed completed-project cell draft cannot be hidden or discarded by the visibility control",
      async () => {
        const input = page.locator(
          `[data-plan-cell="${f.teamA.id}|p-b|2026-11"] input`,
        );
        await input.fill("0,7");
        await page.route(
          "**/api/changes",
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic busy: draft retained" }),
            }),
          { times: 1 },
        );
        await toggle().click();
        await page
          .getByText("Synthetic busy: draft retained", { exact: true })
          .waitFor();
        assert.equal(await toggle().getAttribute("aria-checked"), "true");
        assert.equal(await input.inputValue(), "0,7");
        assert.equal(
          (await f.state()).allocations[f.teamA.id + "|p-b|2026-11"],
          0.4,
        );
        await input.press("Escape");
        await toggle().click();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
      },
    );
  } finally {
    await context.close();
  }
}
