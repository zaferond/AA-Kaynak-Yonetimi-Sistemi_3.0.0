import assert from "node:assert/strict";
import { applyChanges } from "../../backend/operations.mjs";
import {
  selectWorkspaceTab,
  revealTableItem,
  chooseTestDirectoryUser,
} from "./fixture.mjs";

export async function checkPlanningDraftVisibility(f) {
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(
      d,
      u,
      Array.from({ length: 19 }, (_, i) => ({
        kind: "project",
        id: "draft-boundary-" + i,
        revision: 0,
        value: {
          id: "draft-boundary-" + i,
          name: "Draft Boundary " + i,
          completed: i === 0,
          start: "2026-01",
          end: "2026-12",
          phases: {},
          milestones: [],
        },
      })),
    ),
  );
  const target = (await f.state()).projects[20];
  assert(!target.completed);
  const { page, context } = await f.client("root-admin");
  try {
    await page.goto(
      f.origin +
        "/?" +
        new URLSearchParams({
          allocation: "full",
          view: "team",
          start: "2026-10",
          count: "6",
          team: f.teamA.id,
        }),
    );
    const toggle = page.getByRole("switch", {
      name: "Tamamlanan Projeleri Göster",
      exact: true,
    });
    await toggle.waitFor();
    await toggle.click();
    const input = page.locator(
      `[data-plan-cell="${f.teamA.id}|${target.id}|2026-11"] input`,
    );
    const container = page.locator(".planning-grid").last().locator("..");
    await f.check(
      "planning draft: an active row at the chunk boundary retains its failed draft when hiding completed projects",
      async () => {
        await revealTableItem(container, input);
        await input.fill("0,7");
        await page.route(
          "**/api/changes",
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic draft rejection" }),
            }),
          { times: 1 },
        );
        await input.press("Enter");
        await input
          .locator("..")
          .getByText("Synthetic draft rejection", { exact: true })
          .waitFor();
        const section = await input.evaluate(
          (node) => node.closest("tbody").dataset.windowKey,
        );
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-checked"), "true");
        assert.equal(await input.inputValue(), "0,7");
        assert.equal(
          await input.evaluate(
            (node) => node.closest("tbody").dataset.windowKey,
          ),
          section,
        );
        assert.equal(
          (await f.state()).allocations[`${f.teamA.id}|${target.id}|2026-11`] ||
            0,
          0,
        );
        await input.press("Escape");
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-checked"), "false");
      },
    );
    await f.check(
      "planning draft: showing completed projects also preserves an active failed draft until cancelled",
      async () => {
        await revealTableItem(container, input);
        await input.fill("0,6");
        await page.route(
          "**/api/changes",
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic reverse rejection" }),
            }),
          { times: 1 },
        );
        await input.press("Enter");
        await input
          .locator("..")
          .getByText("Synthetic reverse rejection", { exact: true })
          .waitFor();
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-checked"), "false");
        assert.equal(await input.inputValue(), "0,6");
        await input.press("Escape");
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-checked"), "true");
      },
    );
  } finally {
    await context.close();
  }
}

export async function checkPlanningScopeOrder(f) {
  const { page, context } = await f.client("root-admin");
  const saved = [];
  try {
    for (const order of [
      "team-first",
      "AD-first",
      "manual-clear",
      "manual-team",
    ]) {
      await f.check(
        "planning scope: " +
          order +
          " saves deterministic defaults and preserves explicit permission choices",
        async () => {
          await selectWorkspaceTab(page, "Çalışan & Yetki Tanımlama");
          await page
            .getByRole("button", {
              name: "Kaynak Ekle / Yetki Tanımla",
              exact: true,
            })
            .click();
          const modal = page.locator(
            '.employee-access-editor[data-state="open"]',
          );
          const account = modal.locator(".resource-account-section");
          async function team(value) {
            await modal
              .getByRole("button", { name: "Takım", exact: true })
              .click();
            const picker = page.locator('.pickerpanel[data-state="open"]');
            await picker.getByRole("textbox").fill(value.name);
            await picker
              .getByRole("button", { name: value.name, exact: true })
              .click();
          }
          const name = "Scope Order " + order;
          if (order === "team-first") {
            await team(f.teamA);
            await chooseTestDirectoryUser(f, page, name);
          } else {
            await chooseTestDirectoryUser(f, page, name);
            await team(f.teamA);
          }
          await account
            .getByLabel("Rol", { exact: true })
            .selectOption("manager");
          let expected = { leaders: [f.teamA.lead], planningTeams: [] };
          if (order.startsWith("manual-")) {
            await account
              .getByRole("button", { name: "Seçimi Temizle", exact: true })
              .click();
            expected = { leaders: [], planningTeams: [] };
            if (order === "manual-team") {
              await account
                .getByRole("checkbox", {
                  name: f.teamA.name + " takımı",
                  exact: true,
                })
                .check();
              expected.planningTeams = [f.teamA.id];
            }
            await team(f.teamB);
            await team(f.teamA);
            // Replacing the unsaved AD choice must not reset explicit scope.
            await chooseTestDirectoryUser(f, page, name + " Replacement");
          }
          const response = page.waitForResponse(
            (r) =>
              r.url().endsWith("/api/employees/save") &&
              r.request().method() === "POST",
          );
          await modal
            .getByRole("button", { name: "Kaydet", exact: true })
            .click();
          assert.equal((await response).status(), 200);
          await modal.waitFor({ state: "hidden" });
          const resource = (await f.state()).resources.find(
            (r) =>
              r.name ===
              (order.startsWith("manual-") ? name + " Replacement" : name),
          );
          assert(resource);
          const user = (await f.store.users()).find(
            (u) => u.resourceId === resource.id,
          );
          assert(user);
          const scope = {
            leaders: user.leaders,
            planningTeams: user.planningTeams || [],
          };
          assert.deepEqual(scope, expected);
          saved.push(scope);
        },
      );
    }
    assert.deepEqual(saved[0], saved[1]);
  } finally {
    await context.close();
  }
}
