import assert from "node:assert/strict";
import path from "node:path";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab, selectWorkspaceView } from "./fixture.mjs";
import { download, zipEntries } from "./files.mjs";

export async function checkCompletedActual(f) {
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      {
        kind: "project",
        id: "p-b",
        revision: d.revisions["project:p-b"],
        value: { ...d.projects.find((p) => p.id === "p-b"), completed: true },
      },
      { kind: "actual", id: "r-own|p-a|2026-01", revision: 0, value: 0.2 },
      { kind: "actual", id: "r-own|p-b|2026-01", revision: 0, value: 0.3 },
      { kind: "actual", id: "r-other|p-b|2026-01", revision: 0, value: 0.4 },
    ]),
  );
  const original = structuredClone((await f.state()).actualAllocations);
  const { page, context } = await f.client("employee", { actualLayout: null });
  const toggle = () =>
    page.getByRole("switch", {
      name: "Tamamlanan Projeleri Göster",
      exact: true,
    });
  const amount = (project) =>
    page.getByRole("textbox", {
      name: `Browser Employee / Browser Project ${project} / 2026-01 / %`,
      exact: true,
    });
  const xml = async (name) =>
    Object.entries(
      zipEntries(
        await download(
          page,
          page.getByRole("button", { name: "Excel'e Aktar", exact: true }),
          path.join(f.dir, name),
        ),
      ),
    )
      .filter(([n]) => n.startsWith("xl/worksheets/"))
      .map(([, v]) => v)
      .join("\n");
  try {
    await selectWorkspaceTab(page, "Aktivite Giriş");
    await toggle().waitFor();
    await amount("A").waitFor();
    await f.check(
      "completed actual: default hidden; visible toggle sits beside data-only and exposes only the authorized person's history",
      async () => {
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        assert.equal(await amount("B").count(), 0);
        const previous = await page
            .getByRole("switch", { name: "Sadece Veri Olanlar", exact: true })
            .boundingBox(),
          next = await toggle().boundingBox();
        assert(next.x > previous.x && Math.abs(next.y - previous.y) < 3);
        const total = await page
          .locator('[data-actual-total="r-own|2026-01"]')
          .first()
          .getAttribute("data-value");
        await toggle().click();
        await amount("B").waitFor();
        assert.equal(
          await page
            .locator('[data-actual-total="r-own|2026-01"]')
            .first()
            .getAttribute("data-value"),
          total,
        );
        assert.equal(
          await page
            .getByRole("textbox", { name: /Browser Other Employee/ })
            .count(),
          0,
        );
        await toggle().click();
        assert.equal(await amount("B").count(), 0);
        assert.deepEqual((await f.state()).actualAllocations, original);
      },
    );
    await f.check(
      "completed actual: person and data-only modes retain hidden-project totals and never offer a hidden completed project for new entry",
      async () => {
        await selectWorkspaceView(page, "Kişi Bazlı");
        const total = page.locator(
          '[data-person-month="r-own|2026-01"] strong',
        );
        await total.waitFor();
        const before = await total.innerText();
        assert.equal(
          await page.locator('[data-person-project="p-b"]').count(),
          0,
        );
        await page
          .getByRole("switch", { name: "Sadece Veri Olanlar", exact: true })
          .click();
        await toggle().click();
        await amount("B").waitFor();
        assert.equal(await total.innerText(), before);
        await toggle().click();
        assert.equal(await amount("B").count(), 0);
        assert.equal(await total.innerText(), before);
        await toggle().click();
        await amount("B").waitFor();
        await f.capture(page, "completed-actual-person");
        await page
          .getByRole("switch", { name: "Sadece Veri Olanlar", exact: true })
          .click();
      },
    );
    await f.check(
      "completed actual: Excel follows visible projects and hiding does not remove stored entries",
      async () => {
        await toggle().click();
        let sheet = await xml("completed-actual-hidden.xlsx");
        assert(!sheet.includes("Browser Project B"));
        await toggle().click();
        sheet = await xml("completed-actual-visible.xlsx");
        assert(sheet.includes("Browser Project B"));
        assert.deepEqual((await f.state()).actualAllocations, original);
      },
    );
    await f.check(
      "completed actual: failed active and completed cell drafts block both visibility directions until explicitly cancelled",
      async () => {
        for (const project of ["A", "B"]) {
          await page.route(
            "**/api/changes",
            (r) =>
              r.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  error: "Synthetic held activity draft",
                }),
              }),
            { times: 1 },
          );
          await amount(project).fill("15");
          await amount(project).press("Enter");
          await amount(project).locator("..").getByRole("alert").waitFor();
          await toggle().click();
          assert.equal(await toggle().getAttribute("aria-checked"), "true");
          assert.equal(await amount(project).inputValue(), "%15");
          await page.locator(".completed-planning-error").waitFor();
          await amount(project).press("Escape");
          await f.wait(
            async () =>
              !(await page
                .locator('.person-allocation [data-window-keep="true"]')
                .count()),
            "Activity draft cancelled",
          );
        }
        await toggle().click();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        await page.route(
          "**/api/changes",
          (r) =>
            r.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic held activity draft" }),
            }),
          { times: 1 },
        );
        await amount("A").fill("15");
        await amount("A").press("Enter");
        await amount("A").locator("..").getByRole("alert").waitFor();
        await toggle().click();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        assert.equal(await amount("A").inputValue(), "%15");
        await amount("A").press("Escape");
        assert.deepEqual((await f.state()).actualAllocations, original);
      },
    );
    await f.check(
      "completed actual: failed worked-hours draft stays selected and blocks visibility change",
      async () => {
        await amount("A").click();
        const hours = page.getByRole("textbox", {
          name: "Browser Employee / 2026-01 çalışılan saat",
          exact: true,
        });
        await hours.waitFor();
        await page.route(
          "**/api/changes",
          (r) =>
            r.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic held hours draft" }),
            }),
          { times: 1 },
        );
        await hours.fill("150");
        await hours.press("Enter");
        await page.locator(".worked-hours-input").getByRole("alert").waitFor();
        await toggle().click();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        assert.equal(await hours.inputValue(), "150");
        await hours.press("Escape");
        await toggle().click();
        assert.equal(await toggle().getAttribute("aria-checked"), "true");
      },
    );
    await f.check(
      "completed actual: a completed-only filter offers a clear reveal action and reload resets visibility",
      async () => {
        await toggle().click();
        await page.getByRole("button", { name: "Proje", exact: true }).click();
        await page
          .locator('.pickerpanel[data-state="open"]')
          .getByRole("checkbox", { name: "Browser Project B", exact: true })
          .check();
        await page.keyboard.press("Escape");
        await page
          .getByText("Tamamlanan projeler gizli", { exact: true })
          .waitFor();
        await page
          .getByRole("button", {
            name: "Tamamlanan Projeleri Göster",
            exact: true,
          })
          .click();
        await amount("B").waitFor();
        await f.capture(page, "completed-actual-visible");
        await page.reload();
        await selectWorkspaceTab(page, "Aktivite Giriş");
        await toggle().waitFor();
        assert.equal(await toggle().getAttribute("aria-checked"), "false");
        assert.deepEqual((await f.state()).actualAllocations, original);
      },
    );
  } finally {
    await context.close();
  }
}
