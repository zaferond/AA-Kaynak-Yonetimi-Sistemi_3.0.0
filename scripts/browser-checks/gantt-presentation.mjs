import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkGanttPresentation(f) {
  const original = (await f.state()).projects.find((p) => p.id === "p-a");
  const note = (text, start, end, completed = false) => ({
    text,
    start,
    end,
    completed,
    includeInReport: true,
  });
  const value = {
    ...original,
    milestones: [
      {
        id: "gantt-shared",
        name: "Shared dated notes",
        start: "2026-03-02",
        end: "2026-03-20",
        barStyle: "solid",
        barColor: "blue",
        barNotes: [
          note("Design documents", "2026-03-02", "2026-03-20", true),
          note("Interface review", "2026-03-02", "2026-03-20"),
          note("Customer presentation", "2026-03-02", "2026-03-20"),
        ],
        additionalRanges: [
          {
            displayKind: "milestone",
            start: "2026-03-13",
            end: "2026-03-13",
            color: "blue",
            notes: [
              note("Technical sign off", "2026-03-13", "2026-03-13", true),
            ],
          },
          {
            displayKind: "milestone",
            start: "2026-03-13",
            end: "2026-03-13",
            color: "red",
            notes: [note("Customer sign off", "2026-03-13", "2026-03-13")],
          },
        ],
      },
      {
        id: "gantt-distinct",
        name: "Different dated notes",
        start: "2026-03-09",
        end: "2026-04-10",
        barStyle: "outline",
        barColor: "amber",
        barNotes: [
          note("First separate note", "2026-03-09", "2026-03-20"),
          note("Second separate note", "2026-03-16", "2026-04-10"),
        ],
      },
    ],
  };
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      {
        kind: "project",
        id: value.id,
        revision: d.revisions["project:" + value.id],
        value,
      },
    ]),
  );
  const { page } = await f.client("root-admin");
  try {
    await selectWorkspaceTab(page, "Projeler");
    await page
      .getByRole("switch", { name: "Detayları Göster", exact: true })
      .check();
    await page
      .locator('.planning-filterbar input[type="month"]')
      .fill("2026-03");
    await page.locator(".planning-filterbar .period select").selectOption("6");
    const rows = page.locator('[data-project-group="p-a"] .milestone-row');
    const shared = rows.first(),
      distinct = rows.nth(1);
    for (const weekly of [false, true]) {
      await f.check(
        `Gantt presentation: ${weekly ? "weekly" : "monthly"} groups shared dates, retains every note date and separates same-day milestone labels`,
        async () => {
          await page
            .getByRole("switch", {
              name: "Haftalık proje görünümü",
              exact: true,
            })
            .setChecked(weekly);
          const group = shared
            .locator(weekly ? ".weekly-note-box" : ".gantt-bar")
            .first();
          await group.waitFor();
          assert.equal(await group.locator("li").count(), 3);
          assert.equal(await group.locator("li time").count(), 6);
          for (const li of await group.locator("li").all())
            assert.match(await li.innerText(), /02.03.2026.*20.03.2026/s);
          assert.equal(await group.locator("li.completed").count(), 1);
          assert.equal(await distinct.locator(".weekly-note-box").count(), 2);
          for (const text of await distinct
            .locator(".weekly-note-text, .gantt-note-dates")
            .all())
            assert(await text.isVisible());
          const points = shared.locator(".milestone-point");
          assert.equal(await points.count(), 2);
          assert.deepEqual(
            await points
              .locator(".milestone-point-label time")
              .allTextContents(),
            ["13.03.2026", "13.03.2026"],
          );
          await f.wait(async () => {
            const labels = await points
              .locator(".milestone-point-label")
              .evaluateAll((els) =>
                els.map((el) => el.getBoundingClientRect().toJSON()),
              );
            return (
              labels.length === 2 &&
              (labels[0].bottom <= labels[1].top ||
                labels[1].bottom <= labels[0].top)
            );
          }, "same-day milestone labels do not overlap");
          assert.equal(
            await points.locator(".milestone-diamond.completed").count(),
            1,
          );
          if (weekly)
            assert.equal(await group.locator(".weekly-note-resize").count(), 0);
          await points.first().focus();
          await page
            .getByRole("tooltip")
            .filter({ hasText: "Technical sign off" })
            .waitFor();
          await points.first().evaluate((element) => element.blur());
          await page.mouse.move(400, 80);
          await page.getByRole("tooltip").waitFor({ state: "detached" });
          await f.capture(
            page,
            weekly
              ? "gantt-weekly-shared-milestones"
              : "gantt-monthly-shared-milestones",
          );
        },
      );
    }
  } finally {
    await page.close();
  }
}
