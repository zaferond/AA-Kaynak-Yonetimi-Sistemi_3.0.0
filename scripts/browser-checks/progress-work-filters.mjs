import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkProgressWorkFilters(f) {
  const prototype = (await f.state()).projects.find((p) => p.id === "p-a");
  const proposal = (id, projectId, leader, status) => ({
    kind: "progress",
    id,
    revision: 0,
    value: {
      id,
      projectId,
      leader,
      baselines: [],
      actuals: {},
      createdBy: "root-admin",
      createdByName: "Synthetic",
      createdAt: "2026-10-01",
      proposal: {
        status,
        openingMonth: "2026-07",
        openingPct: 0,
        targets: {
          "2026-08": 25,
          "2026-09": 50,
          "2026-10": 70,
          "2026-11": 85,
          "2026-12": 100,
        },
      },
    },
  });
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      ...["p-c", "p-d"].map((id) => ({
        kind: "project",
        id,
        revision: 0,
        value: { ...prototype, id, name: "Filter Project " + id },
      })),
      ...[f.teamA, f.teamB].flatMap((team) =>
        (team.id === f.teamA.id
          ? ["p-a", "p-b", "p-c", "p-d"]
          : ["p-a", "p-c"]
        ).flatMap((projectId) =>
          ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map(
            (month) => ({
              kind: "allocation",
              id: `${team.id}|${projectId}|${month}`,
              revision: 0,
              value: 0.1,
            }),
          ),
        ),
      ),
      proposal("filter-a", "p-a", f.teamA.lead, "approved"),
      proposal("filter-b", "p-b", f.teamA.lead, "approved"),
      proposal("filter-d", "p-d", f.teamA.lead, "pending"),
      proposal("filter-outside", "p-a", f.teamB.lead, "approved"),
    ]),
  );
  await f.store.mutate(f.actor, (d, u) => {
    const record = d.projectProgress.find((r) => r.id === "filter-a");
    applyChanges(d, u, [
      {
        kind: "progress",
        id: record.id,
        revision: d.revisions["progress:" + record.id],
        value: {
          ...record,
          actuals: { "2026-09": { pct: 50, note: "Synthetic monthly entry" } },
        },
      },
    ]);
  });
  const { page, context } = await f.client("manager");
  const pressed = () =>
    page.locator('.progress-waiting-strip [data-waiting][aria-pressed="true"]');
  const button = (key) => page.locator(`[data-waiting="${key}"]`);
  const summary = (kind) =>
    page.locator(`.progress-work-count[data-kind="${kind}"]`);
  try {
    await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
    await page.locator(".progress-work-count").first().waitFor();
    await f.check(
      "work filters: current names, removed status selects and All, scoped and distinct waiting totals",
      async () => {
        assert.equal(
          await page
            .getByRole("combobox", { name: "Hedef Plan", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await page
            .getByRole("combobox", { name: "Gerçekleşen Plan", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await page
            .locator(".progress-waiting-strip")
            .getByRole("button", { name: /^Tümü/ })
            .count(),
          0,
        );
        for (const label of [
          "Hedef Plan-Yönetici Girişi Bekleyen",
          "Hedef Plan-Proje Onayı Bekleyen",
          "Gerçekleşen Plan-Yönetici Girişi Bekleyen",
          "Değerlendirme Bekliyor",
        ])
          assert.equal(
            await page
              .locator(".progress-waiting-strip")
              .getByRole("button", { name: new RegExp("^" + label) })
              .count(),
            1,
          );
        assert.equal(await summary("plan").innerText(), "2");
        assert.equal(await summary("actual").innerText(), "1");
        assert.equal(await page.locator(".progress-month-strip").count(), 0);
        const colors = await page
          .locator(".progress-work-count")
          .evaluateAll((nodes) =>
            nodes.map((n) => getComputedStyle(n).backgroundColor),
          );
        assert.notEqual(colors[0], colors[1]);
        assert.equal(await page.locator(".progress-work-summary").count(), 0);
        assert.equal(
          await page
            .getByRole("tab", { name: /^Hedef Plan \/ Gerçekleşen Plan Giriş/ })
            .locator(".progress-work-count")
            .count(),
          2,
        );
      },
    );
    await f.check(
      "work filters: single selection and conditional month row; evaluation resets to processing month",
      async () => {
        await button("planEntry").click();
        assert.equal(await pressed().count(), 1);
        assert.equal(await page.locator(".progress-card").count(), 1);
        await button("planApproval").click();
        assert.equal(await pressed().count(), 1);
        assert.equal(
          await button("planEntry").getAttribute("aria-pressed"),
          "false",
        );
        assert.equal(await page.locator(".progress-month-strip").count(), 0);
        await button("actualEntry").click();
        await page
          .getByRole("group", { name: "Ay seçimi", exact: true })
          .waitFor();
        assert.equal(
          await page
            .locator(".progress-month-strip [data-month^='2026-']")
            .count(),
          12,
        );
        await page
          .locator('.progress-month-strip [data-month="2026-08"]')
          .click();
        assert(
          await page
            .locator('.progress-month-strip [data-month="2026-10"]')
            .isDisabled(),
        );
        await button("evaluation").click();
        assert.equal(await pressed().count(), 1);
        assert.equal(
          await page
            .locator('.progress-month-strip [data-month="2026-09"]')
            .getAttribute("aria-pressed"),
          "true",
        );
        assert.equal(await page.locator(".progress-card").count(), 1);
        await button("evaluation").click();
        assert.equal(await pressed().count(), 0);
        assert.equal(await page.locator(".progress-month-strip").count(), 0);
        assert.equal(
          await page.locator(".progress-card").count(),
          4,
          "Clear the active category to review all authorized cards",
        );
      },
    );
    await f.check(
      "work filters: changing month or category cannot discard a rejected draft",
      async () => {
        await button("actualEntry").click();
        const field = page
          .locator(".progress-card")
          .getByLabel(/Eyl 2026 gerçekleşen %/);
        await field.fill("37");
        await page
          .locator(".progress-card")
          .getByLabel(/ · açıklama$/)
          .fill("Protected new filter draft");
        for (const action of [
          () => button("planApproval").click(),
          () =>
            page
              .locator('.progress-month-strip [data-month="2026-08"]')
              .click(),
          () => button("evaluation").click(),
        ]) {
          let asked = false;
          page.once("dialog", async (d) => {
            asked = true;
            await d.dismiss();
          });
          await action();
          assert(asked);
          assert.equal(await field.inputValue(), "37");
          assert.equal(
            await button("actualEntry").getAttribute("aria-pressed"),
            "true",
          );
          assert.equal(
            await page
              .locator('.progress-month-strip [data-month="2026-09"]')
              .getAttribute("aria-pressed"),
            "true",
          );
        }
        await page
          .getByRole("button", { name: "Taslağı İptal Et", exact: true })
          .click();
        await field.waitFor();
        await f.capture(page, "progress-work-filters-desktop");
      },
    );
    await f.check(
      "work filters: all four long category labels stay visible on a narrow screen",
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        const menu = page.getByRole("button", {
          name: "Sol menüyü kapat",
          exact: true,
        });
        if (await menu.count()) await menu.click();
        const geometry = await page
          .locator(".progress-waiting-filter")
          .first()
          .evaluate((n) => ({
            box: n.getBoundingClientRect().toJSON(),
            buttons: [...n.querySelectorAll("button")].map((b) =>
              b.getBoundingClientRect().toJSON(),
            ),
          }));
        for (const box of geometry.buttons) {
          assert(box.bottom <= geometry.box.bottom + 1);
          assert(box.right <= geometry.box.right + 1);
          assert(box.right <= 391 && box.left >= -1);
        }
        await f.capture(page, "progress-work-filters-mobile");
      },
    );
  } finally {
    await context.close();
  }
  const admin = await f.client("root-admin");
  try {
    await selectWorkspaceTab(admin.page, "Proje ve Kaynak Değerlendirme");
    await admin.page.locator(".progress-work-count").first().waitFor();
    await f.check(
      "work filters: admin totals include both leaderships; manager totals excluded the other unit",
      async () => {
        assert.equal(
          await admin.page
            .locator('.progress-work-count[data-kind="plan"]')
            .innerText(),
          "3",
        );
        assert.equal(
          await admin.page
            .locator('.progress-work-count[data-kind="actual"]')
            .innerText(),
          "2",
        );
      },
    );
    await f.check(
      "work filters: tab counts follow leadership and completed entry months, including report view",
      async () => {
        await admin.page
          .getByRole("combobox", { name: "Liderlik", exact: true })
          .selectOption(f.teamA.lead);
        await f.wait(
          async () =>
            (await admin.page
              .locator('.progress-work-count[data-kind="plan"]')
              .innerText()) === "2",
          "Leadership count updated",
        );
        assert.equal(
          await admin.page
            .locator('.progress-work-count[data-kind="actual"]')
            .innerText(),
          "1",
        );
        await admin.page
          .getByRole("tab", {
            name: "Proje ve Kaynak Değerlendirme Raporu",
            exact: true,
          })
          .click();
        await admin.page
          .getByRole("combobox", { name: "Ay", exact: true })
          .selectOption("2026-10");
        assert.equal(
          await admin.page
            .getByRole("combobox", { name: "Ay", exact: true })
            .inputValue(),
          "2026-10",
        );
        assert.equal(
          await admin.page
            .locator('.progress-work-count[data-kind="actual"]')
            .innerText(),
          "1",
          "The entry-tab count stays on the latest completed month",
        );
        await admin.page
          .getByRole("tab", { name: /^Hedef Plan \/ Gerçekleşen Plan Giriş/ })
          .click();
        await admin.page.locator('[data-waiting="actualEntry"]').click();
        assert(
          await admin.page
            .locator('.progress-month-strip [data-month="2026-10"]')
            .isDisabled(),
        );
        assert.equal(
          await admin.page
            .locator('.progress-month-strip [data-month="2026-09"]')
            .getAttribute("aria-pressed"),
          "true",
        );
        assert.equal(
          await admin.page
            .getByRole("tab", { name: /^Hedef Plan \/ Gerçekleşen Plan Giriş/ })
            .locator(".progress-work-count")
            .count(),
          2,
        );
      },
    );
  } finally {
    await admin.context.close();
  }
}
