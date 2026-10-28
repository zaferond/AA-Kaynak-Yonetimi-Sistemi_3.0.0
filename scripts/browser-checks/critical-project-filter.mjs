import { selectWorkspaceTab } from "./fixture.mjs";
import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";

// Critical topics: the project filter keeps its choice, lists only that
// project, scopes the status counts to it and clears back to all projects.
export async function checkCriticalProjectFilter(f) {
  const before = (await f.state()).projects;
  const topic = (id, text) => ({
    id: "filter-topic-" + id,
    name: "QA Filter Heading " + id,
    start: "2026-03-01",
    end: "2026-03-20",
    barStyle: "solid",
    barColor: "blue",
    hasCriticalTopics: true,
    barNotes: [
      { text, includeInReport: true, start: "2026-03-02", end: "2026-03-05" },
    ],
  });
  async function setTopics(values) {
    await f.store.mutate(f.actor, (d, u) =>
      applyChanges(
        d,
        u,
        values.map((value) => ({
          kind: "project",
          id: value.id,
          revision: d.revisions["project:" + value.id],
          value,
        })),
      ),
    );
  }
  await setTopics(
    before.map((project) =>
      project.id === "p-a"
        ? { ...project, milestones: [topic("a", "QA Topic Alpha")] }
        : project.id === "p-b"
          ? {
              ...project,
              milestones: [
                topic("b", "QA Topic Beta"),
                topic("c", "QA Topic Gamma"),
              ],
            }
          : project,
    ),
  );
  const { page, context } = await f.client("root-admin");
  const groups = page.locator(".project-info-group");
  const picker = page.getByRole("combobox", {
    name: "Proje süzgeci",
    exact: true,
  });
  try {
    await f.check(
      "critical topics: the project filter keeps its choice and shows only that project",
      async () => {
        await selectWorkspaceTab(page, "Haftalık Kritik Konular");
        await page.getByText("QA Topic Alpha", { exact: true }).waitFor();
        assert.equal(await groups.count(), 2);
        const statusBox = await page
          .locator(".project-info-filter")
          .boundingBox();
        const projectBox = await page
          .locator(".project-info-project-filter")
          .boundingBox();
        assert(
          statusBox &&
            projectBox &&
            statusBox.x + statusBox.width <= projectBox.x,
        );
        assert(
          statusBox && projectBox && Math.abs(statusBox.y - projectBox.y) < 4,
        );
        assert.deepEqual(await picker.locator("option").allTextContents(), [
          "Tüm projeler (2)",
          "Browser Project A (1)",
          "Browser Project B (2)",
        ]);
        await picker.selectOption({ label: "Browser Project B (2)" });
        assert.equal(await picker.inputValue(), "p-b");
        assert.equal(await groups.count(), 1);
        await page.getByText("QA Topic Gamma", { exact: true }).waitFor();
        assert.equal(
          await page.getByText("QA Topic Alpha", { exact: true }).count(),
          0,
        );
        // Status counts follow the chosen project.
        assert.match(
          await page
            .getByRole("group", { name: "Konu durumu", exact: true })
            .getByRole("button", { name: /^Tümü/ })
            .innerText(),
          /2$/,
        );
        await page
          .getByRole("button", { name: "Proje süzgecini kaldır", exact: true })
          .click();
        assert.equal(await picker.inputValue(), "");
        assert.equal(await groups.count(), 2);
      },
    );
    await f.check(
      "critical topics: managers edit dates, notes and headings while project metadata stays read only",
      async () => {
        const manager = await f.client("manager");
        try {
          await selectWorkspaceTab(manager.page, "Haftalık Kritik Konular");
          const entry = manager.page
            .locator(".project-info-entry")
            .filter({ hasText: "QA Filter Heading a" });
          await entry
            .getByRole("button", { name: "Düzenle", exact: true })
            .click();
          const dialog = manager.page.getByRole("dialog", {
            name: "Kritik Detay Konuyu Düzenle",
            exact: true,
          });
          await dialog
            .getByLabel("Kritik detay konu açıklaması")
            .fill("Manager updated topic");
          await dialog
            .getByLabel("Kritik detay konu başlangıç tarihi")
            .fill("2026-03-09");
          await dialog
            .getByLabel("Kritik detay konu bitiş tarihi")
            .fill("2026-03-12");
          await dialog
            .getByRole("button", { name: "Kaydet", exact: true })
            .click();
          await dialog.waitFor({ state: "hidden" });
          await entry
            .getByText("Manager updated topic", { exact: true })
            .waitFor();
          const oldWeek = entry.locator(
            '.project-info-week[data-state="cancelled"]',
          );
          assert.equal(await oldWeek.innerText(), "W10");
          assert.match(
            await oldWeek.getAttribute("title"),
            /Önceki tarih aralığı · geçmiş kayıt/,
          );
          assert.equal(
            await oldWeek.evaluate(
              (element) => getComputedStyle(element).borderStyle,
            ),
            "solid",
          );
          const colors = (chip) =>
            chip.evaluate((element) => {
              const style = getComputedStyle(element);
              return [style.backgroundColor, style.color];
            });
          assert.deepEqual(await colors(oldWeek), [
            "rgb(253, 236, 234)",
            "rgb(180, 35, 24)",
          ]);
          const currentWeek = entry.locator(
            '.project-info-week[data-state="late"]',
          );
          assert.equal(await currentWeek.innerText(), "W11");
          assert.match(
            await currentWeek.getAttribute("title"),
            /Mevcut tarih aralığı · gecikmiş hafta/,
          );
          assert.equal(
            await currentWeek.evaluate(
              (element) => getComputedStyle(element).borderStyle,
            ),
            "solid",
          );
          assert.deepEqual(await colors(currentWeek), await colors(oldWeek));
          await entry
            .getByRole("button", { name: "Düzenle", exact: true })
            .click();
          await dialog.waitFor();
          assert.deepEqual(
            await colors(
              dialog.locator('.project-info-week[data-state="cancelled"]'),
            ),
            await colors(oldWeek),
          );
          await dialog
            .getByRole("button", { name: "Vazgeç", exact: true })
            .click();
          await manager.page
            .getByRole("combobox", { name: "Hafta Ekle", exact: true })
            .selectOption("2026-W10");
          await manager.page.waitForFunction(() =>
            document.querySelector(
              '.project-info-week[data-state="cancelled"][data-selected]',
            ),
          );
          assert.deepEqual(await colors(oldWeek), [
            "rgb(180, 35, 24)",
            "rgb(255, 255, 255)",
          ]);
          await f.capture(manager.page, "critical-historical-week-colors");
          await entry
            .getByRole("button", { name: "Tamamlandı", exact: true })
            .click();
          await entry
            .getByRole("button", { name: "Geri Al", exact: true })
            .waitFor();
          assert.equal(
            await entry
              .locator('.project-info-week[data-state="late"]')
              .count(),
            0,
          );
          assert.equal(await oldWeek.count(), 1);
          await entry
            .getByRole("button", { name: "Başlık Düzenle", exact: true })
            .click();
          const heading = manager.page.getByRole("dialog", {
            name: "Başlık Düzenle",
            exact: true,
          });
          await heading
            .getByLabel("Başlık", { exact: true })
            .fill("Manager updated heading");
          await heading
            .getByRole("button", { name: "Kaydet", exact: true })
            .click();
          await heading.waitFor({ state: "hidden" });
          await manager.page
            .getByText("Manager updated heading", { exact: true })
            .waitFor();
          const saved = (await f.state()).projects.find((p) => p.id === "p-a");
          assert.equal(saved.name, before.find((p) => p.id === "p-a").name);
          await selectWorkspaceTab(manager.page, "Projeler");
          assert.equal(
            await manager.page
              .getByRole("button", { name: "Yeni Proje", exact: true })
              .count(),
            0,
          );
          await f.capture(manager.page, "manager-critical-project-readonly");
        } finally {
          await manager.context.close();
        }
      },
    );
  } finally {
    await context.close();
    const current = (await f.state()).projects;
    await setTopics(
      before.filter((project) =>
        current.some((item) => item.id === project.id),
      ),
    );
  }
}
