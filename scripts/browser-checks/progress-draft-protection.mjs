import assert from "node:assert/strict";
import { selectWorkspaceTab, selectProgressMonth } from "./fixture.mjs";
import { applyChanges } from "../../backend/operations.mjs";

export async function checkProgressDraftProtection(f) {
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
        id: "protected-progress",
        revision: 0,
        value: {
          id: "protected-progress",
          projectId: "p-a",
          leader: f.teamA.lead,
          baselines: [],
          actuals: {},
          createdBy: "root-admin",
          createdByName: "Synthetic",
          createdAt: "2026-10-01T00:00:00.000Z",
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
    ]),
  );
  const { page } = await f.client("root-admin");
  try {
    await f.check(
      "progress drafts: background changes cannot erase or rebase a local entry; stale save conflicts and explicit cancel loads the remote record",
      async () => {
        await selectWorkspaceTab(page, "Proje ve Kaynak Değerlendirme");
        await selectProgressMonth(page, "2026-09");
        const card = page.locator(".progress-card").first();
        const field = card.getByLabel(/Eyl 2026 gerçekleşen %/);
        await field.fill("37");
        await card.getByLabel(/ · açıklama$/).fill("Synthetic local draft");
        await card.locator(".progress-card-title").click();
        await f.store.mutate(f.actor, (d, u) => {
          const record = d.projectProgress.find(
            (r) => r.id === "protected-progress",
          );
          applyChanges(d, u, [
            {
              kind: "progress",
              id: record.id,
              revision: d.revisions["progress:" + record.id],
              value: {
                ...record,
                actuals: {
                  "2026-09": {
                    pct: 25,
                    note: "Synthetic remote entry",
                    byName: "Synthetic",
                    at: "2026-10-01T00:00:00.000Z",
                  },
                },
              },
            },
          ]);
        });
        let reads = 0;
        const observe = (request) => {
          if (request.url() === f.origin + "/api/data") reads++;
        };
        page.on("request", observe);
        await page.evaluate(() =>
          window.dispatchEvent(
            new StorageEvent("storage", { key: "kaynak-planlama-offline-v1" }),
          ),
        );
        await page.waitForTimeout(150);
        assert.equal(reads, 0, "dirty progress blocks background full reads");
        assert.equal(await field.inputValue(), "37");
        const response = page.waitForResponse(
          (r) => r.url().endsWith("/api/changes") && r.status() === 409,
        );
        await card
          .getByRole("button", { name: "Gerçekleşen % Gönder", exact: true })
          .click();
        await response;
        assert.equal(await field.inputValue(), "37");
        assert.equal(
          (await f.state()).projectProgress.find(
            (r) => r.id === "protected-progress",
          ).actuals["2026-09"].pct,
          25,
        );
        page.once("dialog", (dialog) => dialog.dismiss());
        await selectWorkspaceTab(page, "Projeler");
        assert.equal(
          await field.inputValue(),
          "37",
          "declined navigation retains the draft",
        );
        const refresh = page.waitForResponse(
          (r) => r.url() === f.origin + "/api/data" && r.status() === 200,
        );
        await page
          .getByRole("button", { name: "Taslağı İptal Et", exact: true })
          .click();
        await refresh;
        await card
          .getByRole("button", { name: "Gerçekleşen % Revize Et", exact: true })
          .waitFor();
        assert.equal(await page.locator(".progress-draft-notice").count(), 0);
        // A lock changes independently of the record revision. The server must
        // reject the held edit, without removing the user's unsaved input.
        await card
          .getByRole("button", { name: "Gerçekleşen % Revize Et", exact: true })
          .click();
        await field.fill("39");
        await card.getByLabel(/ · açıklama$/).fill("Draft before remote lock");
        await f.store.mutate(f.actor, (d, u) =>
          applyChanges(d, u, [
            {
              kind: "progressLock",
              id: "2026-09",
              revision: 0,
              value: { id: "2026-09" },
            },
          ]),
        );
        const notify = () =>
          page.evaluate(() =>
            window.dispatchEvent(
              new StorageEvent("storage", {
                key: "kaynak-planlama-offline-v1",
              }),
            ),
          );
        await notify();
        const lockedResponse = page.waitForResponse(
          (r) => r.url().endsWith("/api/changes") && r.status() === 409,
        );
        await card
          .getByRole("button", { name: "Gerçekleşen % Gönder", exact: true })
          .click();
        assert.match((await (await lockedResponse).json()).error, /kilitli/);
        assert.equal(await field.inputValue(), "39");
        assert.equal(
          (await f.state()).projectProgress.find(
            (r) => r.id === "protected-progress",
          ).actuals["2026-09"].pct,
          25,
        );
        const lockedRefresh = page.waitForResponse(
          (r) => r.url() === f.origin + "/api/data" && r.status() === 200,
        );
        await page
          .getByRole("button", { name: "Taslağı İptal Et", exact: true })
          .click();
        await lockedRefresh;
        await f.wait(
          async () => (await field.count()) === 0,
          "remote month lock is displayed after explicit cancel",
        );

        // Target plan drafts use the same frozen revision as actual entries.
        await card
          .getByRole("button", { name: "Hedef Plan Revize Et", exact: true })
          .click();
        const target = card.getByLabel(/Eki 2026 hedef %/);
        await target.fill("77");
        await card
          .getByLabel(/ · revizyon gerekçesi$/)
          .fill("Local target plan draft");
        await f.store.mutate(f.actor, (d, u) => {
          const record = d.projectProgress.find(
            (r) => r.id === "protected-progress",
          );
          applyChanges(d, u, [
            {
              kind: "progress",
              id: record.id,
              revision: d.revisions["progress:" + record.id],
              // Any remote edit bumps the revision; the weight does not depend
              // on today's date (actuals only open for finished months).
              value: { ...record, weight: 3 },
            },
          ]);
        });
        await notify();
        assert.equal(await target.inputValue(), "77");
        const targetResponse = page.waitForResponse(
          (r) => r.url().endsWith("/api/changes") && r.status() === 409,
        );
        await card
          .getByRole("button", { name: "Taslağı Kaydet", exact: true })
          .click();
        await targetResponse;
        assert.equal(await target.inputValue(), "77");
        assert.equal(
          await card.getByLabel(/ · revizyon gerekçesi$/).inputValue(),
          "Local target plan draft",
        );
        const targetRefresh = page.waitForResponse(
          (r) => r.url() === f.origin + "/api/data" && r.status() === 200,
        );
        await page
          .getByRole("button", { name: "Taslağı İptal Et", exact: true })
          .click();
        await targetRefresh;
        await f.wait(
          async () => (await target.count()) === 0,
          "explicit target cancel returns to the approved plan",
        );
        assert.equal(
          (await f.state()).projectProgress.find(
            (r) => r.id === "protected-progress",
          ).weight,
          3,
        );
        page.off("request", observe);
      },
    );
  } finally {
    await page.close();
  }
}

export async function checkSessionIdleWarning(f) {
  const { page } = await f.client("root-admin");
  try {
    await f.check(
      "idle session: warns before expiration, continues on explicit action and signs out an expired server session",
      async () => {
        await page.waitForLoadState("networkidle");
        await f.store.transaction((c) =>
          c.query("UPDATE kp_sessions SET last_activity_at=@p0", [
            new Date(Date.now() - 26 * 60000).toISOString(),
          ]),
        );
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        const dialog = page
          .getByRole("dialog")
          .filter({ hasText: "Oturumunuz sona ermek üzere" });
        await dialog.waitFor();
        await dialog
          .getByRole("button", { name: "Oturumu Sürdür", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        await f.wait(async () => {
          const row = (
            await f.store.db.query(
              "SELECT last_activity_at FROM kp_sessions WHERE user_id=@p0",
              ["root-admin"],
            )
          ).rows[0];
          return row && Date.parse(row.last_activity_at) > Date.now() - 60000;
        }, "explicit continue renews the server activity timestamp");
        await f.store.transaction((c) =>
          c.query("UPDATE kp_sessions SET last_activity_at=@p0", [
            new Date(Date.now() - 31 * 60000).toISOString(),
          ]),
        );
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await page.getByLabel("Kullanıcı Adı", { exact: true }).waitFor();
      },
    );
  } finally {
    await page.close();
  }
}
