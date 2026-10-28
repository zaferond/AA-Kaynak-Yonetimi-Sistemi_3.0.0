import assert from "node:assert/strict";
import { selectWorkspaceTab, selectProgressMonth } from "./fixture.mjs";
import { applyChanges } from "../../backend/operations.mjs";
import { seedCalendarWarningReview } from "./calendar-warning-review.mjs";

export async function checkProgressFilterDraftGuard(f) {
  await f.store.mutate(f.actor, (d, u) =>
    applyChanges(d, u, [
      ...["2026-09", "2026-10", "2026-11", "2026-12"].map((month) => ({
        kind: "allocation",
        id: `${f.teamA.id}|p-a|${month}`,
        value: 0.2,
        revision: 0,
      })),
      {
        kind: "progress",
        id: "guard-progress",
        revision: 0,
        value: {
          id: "guard-progress",
          projectId: "p-a",
          leader: f.teamA.lead,
          baselines: [],
          actuals: {},
          createdBy: "root-admin",
          createdByName: "Synthetic",
          createdAt: "2026-10-01",
          proposal: {
            status: "approved",
            openingMonth: "2026-08",
            openingPct: 0,
            targets: {
              "2026-09": 50,
              "2026-10": 70,
              "2026-11": 85,
              "2026-12": 100,
            },
          },
        },
      },
      {
        kind: "project",
        id: "p-b",
        revision: d.revisions["project:p-b"],
        value: {
          ...d.projects.find((p) => p.id === "p-b"),
          responsibleName: "Other owner",
        },
      },
    ]),
  );
  const { page, context } = await f.client("root-admin");
  try {
    await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
    await selectProgressMonth(page, "2026-09");
    const field = page
      .locator(".progress-card")
      .first()
      .getByLabel(/Eyl 2026 gerçekleşen %/);
    await f.check(
      "progress draft: every removing filter asks before discard; declining preserves fields and accepting discards explicitly",
      async () => {
        await field.fill("37");
        await page
          .locator(".progress-card")
          .first()
          .getByLabel(/ · açıklama$/)
          .fill("Protected filter draft");
        const plan = page.locator('[data-waiting="planApproval"]');
        const cancel = async (action) => {
          let prompted = false;
          page.once("dialog", async (dialog) => {
            prompted = true;
            await dialog.dismiss();
          });
          await action();
          assert(prompted);
          assert.equal(await field.inputValue(), "37");
        };
        await cancel(() => plan.click());
        assert.equal(await plan.getAttribute("aria-pressed"), "false");
        await cancel(() => page.locator('[data-waiting="evaluation"]').click());
        await cancel(() =>
          page
            .getByRole("combobox", { name: "Proje Sorumlusu", exact: true })
            .selectOption("name:Other owner"),
        );
        await cancel(() =>
          page.locator('[data-waiting="planApproval"]').click(),
        );
        await cancel(() =>
          page
            .getByRole("button", { name: "Filtreleri Sıfırla", exact: true })
            .click(),
        );
        page.once("dialog", (dialog) => dialog.accept());
        await plan.click();
        await field.waitFor({ state: "detached" });
        await plan.click();
        await field.waitFor();
        assert.equal(await field.inputValue(), "");
        assert.equal(
          (await f.state()).projectProgress.find(
            (r) => r.id === "guard-progress",
          ).actuals["2026-09"],
          undefined,
        );
      },
    );
    await f.check(
      "session warning: no dead close icon, explicit return works and never extends absolute expiry",
      async () => {
        const expires = new Date(Date.now() + 4 * 60000).toISOString();
        await f.store.transaction((c) =>
          c.query("UPDATE kp_sessions SET expires_at=@p0", [expires]),
        );
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        const dialog = page
          .getByRole("dialog")
          .filter({ hasText: "Oturumunuz sona ermek üzere" });
        await dialog.waitFor();
        assert.equal(
          await dialog
            .getByRole("button", { name: "Close", exact: true })
            .count(),
          0,
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await f.capture(page, "session-warning-safe-close");
        await dialog
          .getByRole("button", {
            name: "Çalışmayı Kaydetmek İçin Dön",
            exact: true,
          })
          .click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal(
          (await f.store.db.query("SELECT expires_at FROM kp_sessions")).rows[0]
            .expires_at,
          expires,
        );
      },
    );
  } catch (error) {
    await f.capture(page, "draft-fix-failure");
    throw error;
  } finally {
    await context.close();
  }
}

export async function checkWarningActionDraftGuard(f) {
  await seedCalendarWarningReview(f);
  const { page, context } = await f.client("root-admin");
  try {
    await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
    await page
      .getByRole("tab", { name: "Proje Takvimi Uyarıları", exact: true })
      .click();
    const panel = page.getByRole("region", {
      name: "Proje Takvimi Uyarıları",
      exact: true,
    });
    const row = (name) =>
      panel.locator("tr[data-warning-id]").filter({ hasText: name });
    const a = row("Review attention"),
      b = row("Review information");
    await a
      .getByRole("button", { name: "Görüldü İşaretle", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Görüldü İşaretle", exact: true })
      .click();
    const form = () =>
      panel.getByRole("form", { name: "Aksiyon girişi", exact: true });
    await f.check(
      "warning drafts: switching rows preserves all fields, leave cancellation preserves them, remote updates cannot rebase the draft",
      async () => {
        await a
          .getByRole("button", { name: "Aksiyon Gir", exact: true })
          .click();
        await form()
          .getByLabel("Aksiyon açıklaması", { exact: true })
          .fill("Protected action draft");
        await form()
          .getByLabel("Aksiyon sorumlusu", { exact: true })
          .fill("Synthetic owner");
        await form()
          .getByLabel("Hedef aksiyon tarihi", { exact: true })
          .fill("2026-10-30");
        await b
          .getByRole("button", { name: "Aksiyon Gir", exact: true })
          .click();
        await form()
          .getByLabel("Aksiyon açıklaması", { exact: true })
          .fill("Other draft");
        await a
          .getByRole("button", { name: "Aksiyon Gir", exact: true })
          .click();
        assert.equal(
          await form()
            .getByLabel("Aksiyon açıklaması", { exact: true })
            .inputValue(),
          "Protected action draft",
        );
        assert.equal(
          await form()
            .getByLabel("Aksiyon sorumlusu", { exact: true })
            .inputValue(),
          "Synthetic owner",
        );
        assert.equal(
          await form()
            .getByLabel("Hedef aksiyon tarihi", { exact: true })
            .inputValue(),
          "2026-10-30",
        );
        page.once("dialog", (dialog) => dialog.dismiss());
        await selectWorkspaceTab(page, "Projeler");
        assert.equal(await form().isVisible(), true);
        await f.store.mutate(f.actor, (d, u) => {
          const key = `${f.teamA.id}|review-attention|2026-10`;
          return applyChanges(d, u, [
            {
              kind: "allocation",
              id: key,
              revision: d.revisions["allocation:" + key],
              value: d.allocations[key] + 0.001,
            },
          ]);
        });
        const conflict = page.waitForResponse(
          (r) => r.url().endsWith("/api/changes") && r.status() === 409,
        );
        await form()
          .getByRole("button", { name: "Aksiyon Alındı", exact: true })
          .click();
        await conflict;
        assert.equal(
          await form()
            .getByLabel("Aksiyon açıklaması", { exact: true })
            .inputValue(),
          "Protected action draft",
        );
        assert.equal(
          (await f.state()).scenarioWarnings.find(
            (w) => w.projectId === "review-attention",
          ).status,
          "seen",
        );
        await f.capture(page, "warning-draft-conflict-preserved");
        await form()
          .getByRole("button", { name: "Vazgeç", exact: true })
          .click();
        await b
          .getByRole("button", { name: "Aksiyon Gir", exact: true })
          .click();
        assert.equal(
          await form()
            .getByLabel("Aksiyon açıklaması", { exact: true })
            .inputValue(),
          "Other draft",
        );
        await form()
          .getByRole("button", { name: "Vazgeç", exact: true })
          .click();
        await selectWorkspaceTab(page, "Projeler");
        await page
          .getByRole("tablist", { name: "Proje görünümü", exact: true })
          .waitFor();
      },
    );
  } catch (error) {
    await f.capture(page, "draft-fix-failure");
    throw error;
  } finally {
    await context.close();
  }
}
