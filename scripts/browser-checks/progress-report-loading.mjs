import { selectWorkspaceTab } from "./fixture.mjs";
import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

export async function checkProgressReportLoading(f) {
  const ids = Array.from({ length: 24 }, (_, i) => "qa-progress-load-" + i);
  await f.store.mutate(f.actor, (data, actor) =>
    applyChanges(data, actor, [
      ...ids.map((id, i) => ({
        kind: "project",
        id,
        revision: 0,
        value: {
          id,
          name: "Synthetic progress project " + String(i).padStart(2, "0"),
          start: "2026-01",
          end: "2026-12",
          phases: { "2026-01": "Design" },
          milestones: [],
        },
      })),
      // The report lists projects a leadership has planned resource for.
      ...ids.map((id) => ({
        kind: "allocation",
        id: `${f.teamA.id}|${id}|2026-01`,
        value: 0.5,
        revision: 0,
      })),
    ]),
  );
  const { page } = await f.client("root-admin");
  try {
    await f.check(
      "progress report: all projects load in batches of ten as the table is scrolled",
      async () => {
        await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
        await page
          .getByRole("tab", {
            name: "Proje ve Kaynak Değerlendirme Raporu",
            exact: true,
          })
          .click();
        const region = page.getByRole("region", {
          name: "Aylık ilerleme tablosu",
        });
        const rows = region.locator("tr.progress-project-row");
        await rows.first().waitFor();
        // No count line above the table; the total is in the filter.
        const total = Number(
          (
            await page
              .locator(".progress-decision-filter option")
              .first()
              .innerText()
          ).match(/\((\d+)\)/)[1],
        );
        assert(total > 20, `projects in the report: ${total}`);
        assert.equal(await rows.count(), 10);
        assert.equal(await page.locator(".progress-matrix-toolbar").count(), 0);
        assert.equal(
          await page.locator(".progress-report-pages").count(),
          0,
          "no page buttons",
        );
        for (let step = 0; step < 10 && (await rows.count()) < total; step++) {
          const before = await rows.count();
          await region.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          await f.wait(
            async () => (await rows.count()) > before,
            "next batch after scrolling",
          );
          assert((await rows.count()) - before <= 10, "batches of ten");
        }
        assert.equal(await rows.count(), total);
        assert.equal(await region.locator(".progress-matrix-more").count(), 0);
      },
    );
  } finally {
    await page.close();
  }
}
