import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkScenarioLayout(f) {
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(
      d,
      u,
      Array.from({ length: 5 }, (_, i) => ({
        kind: "scenario",
        id: "layout-" + i,
        revision: 0,
        value: {
          id: "layout-" + i,
          name: "Layout scenario " + (i + 1),
          status: "draft",
          includeTimeline: true,
          shifts: [{ projectId: "p-a", months: i + 1, fromMonth: "2026-10" }],
          createdBy: u._id,
          createdByName: "",
          createdAt: new Date().toISOString(),
        },
      })),
    ),
  );
  const { page } = await f.client("root-admin");
  try {
    await selectWorkspaceTab(page, "Projeler");
    await page.getByRole("tab", { name: /^Proje Takvimi Güncelle/ }).click();
    const top = page.locator(".schedule-scenario-top"),
      left = top.locator(".schedule-scenario-cards"),
      right = top.locator(".saved-scenarios"),
      list = right.locator("ul"),
      card = left.locator(".schedule-scenario-card").first();
    await f.check(
      "scenario layout: entry and saved records share the top row, actions stay on one line, and the list has its own scroll",
      async () => {
        await page.setViewportSize({ width: 1600, height: 1000 });
        await f.wait(async () => {
          const l = await left.boundingBox(),
            r = await right.boundingBox();
          return l && r && l.x + l.width <= r.x && Math.abs(l.y - r.y) < 2;
        }, "two-column layout");
        const leftBox = await left.boundingBox(),
          rightBox = await right.boundingBox();
        assert(Math.abs(leftBox.height - rightBox.height) < 1);
        assert.equal(
          await card.locator(".schedule-field-months > span").innerText(),
          "Süre (Ay)",
        );
        const row = card.locator(".schedule-shift-row").first();
        const fields = row.locator(".schedule-field");
        assert.deepEqual(
          await fields.evaluateAll((labels) =>
            labels.map((label) => label.firstElementChild.textContent),
          ),
          ["Başlangıç Ayı", "Süre (Ay)", "Proje"],
        );
        const boxes = await fields.evaluateAll((labels) =>
          labels.map((label) => {
            const text = label.querySelector("span").getBoundingClientRect();
            const control = label
              .querySelector("input, select")
              .getBoundingClientRect();
            return {
              x: text.x,
              y: control.y,
              inline:
                text.right <= control.x + 1 &&
                Math.abs(
                  text.y + text.height / 2 - (control.y + control.height / 2),
                ) < 2,
            };
          }),
        );
        assert(boxes.every((box) => box.inline));
        assert(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x);
        assert(Math.abs(boxes[0].y - boxes[2].y) < 2);
        const buttons = await card
            .locator(".schedule-card-buttons")
            .boundingBox(),
          name = await card.getByLabel("Senaryo İsmi").boundingBox();
        assert(buttons && name && Math.abs(buttons.y - name.y) < 3);
        const option = await card
            .locator(".schedule-timeline-option")
            .boundingBox(),
          add = await card
            .getByRole("button", { name: "Proje Ekle", exact: true })
            .boundingBox();
        assert(option && add && option.y + option.height <= add.y);
        assert(await list.evaluate((el) => el.scrollHeight > el.clientHeight));
        const header = await right
          .locator(".saved-scenarios-head")
          .boundingBox();
        await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
        assert(await list.evaluate((el) => el.scrollTop > 0));
        const afterHeader = await right
          .locator(".saved-scenarios-head")
          .boundingBox();
        assert(Math.abs(header.y - afterHeader.y) < 1);
      },
    );
    await f.check(
      "scenario layout: a newly saved scenario is first and visible without increasing the saved-panel height",
      async () => {
        const before = await right.boundingBox();
        await card.getByLabel("Senaryo İsmi").fill("Newest layout scenario");
        await card.getByLabel("Proje", { exact: true }).selectOption("p-b");
        await card.getByLabel("Süre (Ay)").fill("6");
        await card.locator(".schedule-card-buttons .flow-button").click();
        await page
          .locator(".scenario-message")
          .filter({ hasText: "“Newest layout scenario” eklendi." })
          .waitFor();
        assert.equal(
          await list.locator(".saved-scenario-main strong").first().innerText(),
          "Newest layout scenario",
        );
        await f.wait(
          () => list.evaluate((el) => el.scrollTop === 0),
          "new record scrolls into view",
        );
        const after = await right.boundingBox();
        assert(Math.abs(after.height - before.height) < 1);
        const report = await page.locator(".schedule-comparison").boundingBox();
        assert(report.width > after.width * 1.8);
        await f.capture(page, "scenario-two-panes");
      },
    );
    await f.check(
      "scenario layout: narrow screens stack both panes and keep every action on the same scrollable line",
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await f.wait(async () => {
          const l = await left.boundingBox(),
            r = await right.boundingBox();
          return l && r && r.y >= l.y + l.height;
        }, "stacked layout");
        const buttons = await card
            .locator(".schedule-card-buttons")
            .boundingBox(),
          name = await card.getByLabel("Senaryo İsmi").boundingBox();
        assert(Math.abs(buttons.y - name.y) < 3);
        assert(
          await card
            .locator(".schedule-card-action-row")
            .evaluate((el) => getComputedStyle(el).overflowX === "auto"),
        );
        for (const pane of [left, right])
          assert(
            await pane.evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
          );
      },
    );
  } finally {
    await page.close();
  }
}
