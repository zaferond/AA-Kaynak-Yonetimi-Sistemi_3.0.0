import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkCalendarWarningReview(f) {
  const cases = [
    ["normal", 50],
    ["critical", 20],
    ["attention", 40],
    ["information", 70],
    ["missing", null],
  ];
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(
      d,
      u,
      cases.flatMap(([id, pct]) => {
        const projectId = "review-" + id;
        return [
          {
            kind: "project",
            id: projectId,
            revision: 0,
            value: {
              id: projectId,
              name: "Review " + id,
              start: "2026-01",
              end: "2026-12",
              phases: {},
            },
          },
          ...["2026-01", "2026-10"].map((month) => ({
            kind: "allocation",
            id: `${f.teamA.id}|${projectId}|${month}`,
            revision: 0,
            value: 0.1,
          })),
          ...(pct === null
            ? []
            : [
                {
                  kind: "progress",
                  id: projectId,
                  revision: 0,
                  value: {
                    id: projectId,
                    projectId,
                    leader: f.teamA.lead,
                    baselines: [],
                    actuals: {},
                    createdBy: "root-admin",
                    createdByName: "Browser root-admin",
                    createdAt: "2026-10-01",
                    proposal: {
                      status: "approved",
                      openingMonth: "2025-12",
                      openingPct: 0,
                      targets: { "2026-09": 50, "2026-12": 100 },
                    },
                  },
                },
              ]),
        ];
      }),
    ),
  );
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(
      d,
      u,
      cases
        .filter(([, pct]) => pct !== null)
        .map(([id, pct]) => ({
          kind: "progress",
          id: "review-" + id,
          revision: d.revisions["progress:review-" + id],
          value: {
            ...d.projectProgress.find((r) => r.id === "review-" + id),
            actuals: { "2026-09": { pct, note: "Review test" } },
          },
        })),
    ),
  );
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      {
        kind: "progressLock",
        id: "2026-09",
        value: { id: "2026-09" },
        revision: 0,
      },
    ]),
  );
  const { page, context } = await f.client("root-admin");
  const open = async () => {
    await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
    await page
      .getByRole("tab", { name: "Proje Takvimi Uyarıları", exact: true })
      .click();
  };
  const panel = page.getByRole("region", {
    name: "Proje Takvimi Uyarıları",
    exact: true,
  });
  const rows = panel.locator("tr[data-warning-id]");
  try {
    await open();
    await f.check(
      "calendar warnings: priorities and evidence are shown; healthy and incomplete projects do not produce warnings",
      async () => {
        await rows.first().waitFor();
        assert.equal(await rows.count(), 3);
        assert.match(await rows.first().innerText(), /Review critical/);
        assert.equal(
          await rows.filter({ hasText: "Review normal" }).count(),
          0,
        );
        for (const label of [
          "Öncelik",
          "Tespit",
          "Dayanak",
          "Önerilen Aksiyon",
          "Aksiyon Takibi",
        ])
          await panel
            .getByRole("columnheader", { name: label, exact: true })
            .waitFor();
        assert.match(
          await rows.first().innerText(),
          /Hedef %50 · Gerçekleşen %20 · Sapma -30 puan/,
        );
        await panel
          .getByRole("combobox", { name: "Öncelik", exact: true })
          .selectOption("information");
        assert.equal(await rows.count(), 1);
        assert.match(await rows.first().innerText(), /Bilgilendirme/);
        await panel
          .getByRole("combobox", { name: "Öncelik", exact: true })
          .selectOption("");
        await f.capture(page, "calendar-warning-review");
      },
    );
    await f.check(
      "calendar warnings: action owner and valid target date persist with the action",
      async () => {
        const row = rows.filter({ hasText: "Review critical" });
        await row
          .getByRole("button", { name: "Görüldü İşaretle", exact: true })
          .click();
        await row
          .getByRole("button", { name: "Aksiyon Gir", exact: true })
          .click();
        const form = panel.getByRole("form", {
          name: "Aksiyon girişi",
          exact: true,
        });
        const save = form.getByRole("button", {
          name: "Aksiyon Alındı",
          exact: true,
        });
        await form
          .getByLabel("Aksiyon açıklaması", { exact: true })
          .fill("Kaynak ve takvim seçenekleri görüşülecek.");
        assert.equal(await save.isEnabled(), false);
        await form
          .getByLabel("Aksiyon sorumlusu", { exact: true })
          .fill("Proje Sorumlusu");
        assert.equal(await save.isEnabled(), false);
        await form
          .getByLabel("Hedef aksiyon tarihi", { exact: true })
          .fill("2026-10-30");
        await save.click();
        await row
          .getByText("Sorumlu: Proje Sorumlusu", { exact: true })
          .waitFor();
        assert.match(await row.innerText(), /30 Eki 2026/);
        const saved = (await f.state()).scenarioWarnings.find(
          (w) => w.projectId === "review-critical",
        );
        assert.equal(saved.history.at(-1).responsible, "Proje Sorumlusu");
        assert.equal(saved.history.at(-1).targetDate, "2026-10-30");
        await page.reload();
        await open();
        await rows
          .filter({ hasText: "Review critical" })
          .getByText("Sorumlu: Proje Sorumlusu", { exact: true })
          .waitFor();
        await f.capture(page, "calendar-warning-action-tracking");
      },
    );
    await f.check(
      "calendar warnings: outdated evaluations are excluded without erasing action history",
      async () => {
        await page.clock.setFixedTime(new Date("2026-11-02T09:00:00Z"));
        await page.reload();
        await open();
        await panel
          .getByText("Takip gerektiren uyarı yok", { exact: true })
          .waitFor();
        assert.equal(await rows.count(), 0);
        assert.equal(
          (await f.state()).scenarioWarnings
            .find((w) => w.projectId === "review-critical")
            .history.at(-1).responsible,
          "Proje Sorumlusu",
        );
        await f.capture(page, "calendar-warning-pending-data");
      },
    );
  } finally {
    await context.close();
  }
}
