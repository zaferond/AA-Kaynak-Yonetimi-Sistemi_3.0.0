import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkScenarioBulk(f) {
  const make = (id, name, projectId, months) => ({
    id,
    name,
    status: "draft",
    shifts: [{ projectId, months, fromMonth: "2026-10" }],
    includeTimeline: true,
    createdBy: "client",
    createdByName: "",
    createdAt: new Date().toISOString(),
  });
  const rootScenarios = [
    make("bulk-a", "Bulk A", "p-a", 1),
    make("bulk-b", "Bulk B", "p-a", 2),
    make("bulk-history", "Calendar history", "p-b", 3),
  ];
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(
      d,
      u,
      rootScenarios.map((value) => ({
        kind: "scenario",
        id: value.id,
        value,
        revision: 0,
      })),
    ),
  );
  const manager = await f.store.findUser({ id: "manager" });
  const own = make("bulk-own", "Manager own", "p-a", 4);
  await f.store.mutate(manager, (d, u) =>
    applyChanges(d, u, [
      { kind: "scenario", id: own.id, value: own, revision: 0 },
    ]),
  );
  const { page } = await f.client("root-admin");
  const row = (name) =>
    page
      .locator(".saved-scenarios li")
      .filter({ has: page.getByText(name, { exact: true }) });
  const current = () =>
    page.getByRole("tab", { name: /^Proje Takvimi Güncelle/ }).click();
  const history = () =>
    page
      .getByRole("tab", {
        name: "Onaylanan Takvim Güncellemeleri",
        exact: true,
      })
      .click();
  try {
    await selectWorkspaceTab(page, "Projeler");
    await current();
    await f.check(
      "scenario bulk: transferred records move to the named history tab and cannot be selected or deleted",
      async () => {
        await row("Calendar history")
          .getByRole("button", { name: "Onayla", exact: true })
          .click();
        page.once("dialog", (d) => d.accept());
        await row("Calendar history")
          .getByRole("button", { name: "Takvime Aktar", exact: true })
          .click();
        await f.wait(
          async () =>
            (await f.state()).scheduleScenarios.find(
              (s) => s.id === "bulk-history",
            )?.status === "applied",
          "scenario transferred",
        );
        await row("Calendar history").waitFor({ state: "hidden" });
        await history();
        await row("Calendar history").waitFor();
        assert.equal(await page.locator(".schedule-scenario-card").count(), 0);
        assert.equal(await page.locator(".scenario-bulk-actions").count(), 0);
        assert.equal(
          await row("Calendar history")
            .getByRole("button", { name: "Sil", exact: true })
            .count(),
          0,
        );
        await row("Calendar history")
          .getByRole("button", { name: "Geri Al", exact: true })
          .waitFor();
        await f.capture(page, "scenario-history-tab");
        await current();
        await f.capture(page, "scenario-bulk-selection");
      },
    );
    await f.check(
      "scenario bulk: cancellation preserves selected records; confirming sends one batch and preserves the active calendar transfer",
      async () => {
        const projectBefore = (await f.state()).projects.find(
          (p) => p.id === "p-b",
        );
        await row("Bulk A").getByLabel("Bulk A senaryosunu seç").check();
        await row("Bulk B").getByLabel("Bulk B senaryosunu seç").check();
        page.once("dialog", (d) => d.dismiss());
        await page
          .getByRole("button", { name: "Seçilenleri Sil (2)", exact: true })
          .click();
        assert.equal((await f.state()).scheduleScenarios.length, 4);
        const writes = [];
        const listener = (request) => {
          if (request.url().endsWith("/api/changes"))
            writes.push(request.postDataJSON());
        };
        page.on("request", listener);
        page.once("dialog", (d) => d.accept());
        await page
          .getByRole("button", { name: "Seçilenleri Sil (2)", exact: true })
          .click();
        await page
          .locator(".scenario-message")
          .filter({ hasText: "2 senaryo silindi." })
          .waitFor();
        page.off("request", listener);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].changes.length, 2);
        const data = await f.state();
        assert.deepEqual(data.scheduleScenarios.map((s) => s.id).sort(), [
          "bulk-history",
          "bulk-own",
        ]);
        assert.deepEqual(
          data.projects.find((p) => p.id === "p-b"),
          projectBefore,
        );
        assert.equal(
          data.scheduleScenarios.find((s) => s.id === "bulk-history").status,
          "applied",
        );
        assert(
          await page
            .getByRole("button", { name: "Seçilenleri Sil (0)", exact: true })
            .isDisabled(),
        );
      },
    );
    await f.check(
      "scenario bulk: a stale revision rejects the entire batch without deleting another selected record",
      async () => {
        await f.store.mutate(f.actor, (d, u) =>
          applyChanges(
            d,
            u,
            rootScenarios.slice(0, 2).map((value) => ({
              kind: "scenario",
              id: value.id,
              value,
              revision: d.revisions["scenario:" + value.id] || 0,
            })),
          ),
        );
        await page.reload();
        await selectWorkspaceTab(page, "Projeler");
        await current();
        await row("Bulk A").getByLabel("Bulk A senaryosunu seç").check();
        await row("Bulk B").getByLabel("Bulk B senaryosunu seç").check();
        const intercept = async (route) => {
          const data = await f.state(),
            value = data.scheduleScenarios.find((s) => s.id === "bulk-b");
          await f.store.mutate(f.actor, (d, u) =>
            applyChanges(d, u, [
              {
                kind: "scenario",
                id: value.id,
                value: { ...value, name: "Bulk B remote" },
                revision: data.revisions["scenario:" + value.id],
              },
            ]),
          );
          await route.continue();
        };
        await page.route("**/api/changes", intercept);
        page.once("dialog", (d) => d.accept());
        await page
          .getByRole("button", { name: "Seçilenleri Sil (2)", exact: true })
          .click();
        await page
          .locator('.schedule-scenario-actions [role="alert"]')
          .waitFor();
        await page.unroute("**/api/changes", intercept);
        const data = await f.state();
        assert(data.scheduleScenarios.some((s) => s.id === "bulk-a"));
        assert(data.scheduleScenarios.some((s) => s.name === "Bulk B remote"));
      },
    );
  } finally {
    await page.close();
  }
  const client = await f.client("manager");
  try {
    await selectWorkspaceTab(client.page, "Projeler");
    await client.page
      .getByRole("tab", { name: /^Proje Takvimi Güncelle/ })
      .click();
    await client.page.getByLabel("Tüm silinebilir senaryoları seç").check();
    assert.equal(
      await client.page.locator(".scenario-row-select:checked").count(),
      1,
    );
    assert(
      await client.page.getByLabel("Manager own senaryosunu seç").isChecked(),
    );
  } finally {
    await client.page.close();
  }
}
