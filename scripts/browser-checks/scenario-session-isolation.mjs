import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";
import { loginUI } from "./access.mjs";

export async function checkScenarioSessionIsolation(f) {
  const { page } = await f.client("root-admin");
  const open = async () => {
    await selectWorkspaceTab(page, "Projeler");
    await page.getByRole("tab", { name: /^Proje Takvimi Güncelle/ }).click();
    await page.getByLabel("Senaryo adı", { exact: true }).first().waitFor();
  };
  const name = () => page.getByLabel("Senaryo adı", { exact: true }).first();
  const switchTo = async (id) => {
    await page.getByRole("button", { name: "Çıkış", exact: true }).click();
    await loginUI(page, id, f.password);
    await open();
  };
  try {
    await f.check(
      "scenario session: legacy shared drafts are discarded and each account keeps only its own draft through reload and account switching",
      async () => {
        await page.evaluate(() => {
          sessionStorage.setItem(
            "aa.scenarioCards",
            JSON.stringify([
              {
                id: "legacy",
                name: "UNKNOWN_OWNER_PRIVATE_DRAFT",
                includeTimeline: true,
                shifts: [{ projectId: "p-a", months: 7, fromMonth: "2026-10" }],
              },
            ]),
          );
          sessionStorage.setItem("aa.scenarioCompared", '["legacy"]');
        });
        await page.reload();
        await open();
        assert.equal(await name().inputValue(), "Senaryo A");
        assert.deepEqual(
          await page.evaluate(() => [
            sessionStorage.getItem("aa.scenarioCards"),
            sessionStorage.getItem("aa.scenarioCompared"),
          ]),
          [null, null],
        );
        await name().fill("SYNTHETIC_PRIVATE_ADMIN_DRAFT");
        await page
          .getByLabel("Proje", { exact: true })
          .first()
          .selectOption("p-a");
        await page
          .getByLabel("Kaydırılacak ay", { exact: true })
          .first()
          .fill("5");
        await f.wait(
          async () =>
            (
              await page.evaluate(() =>
                sessionStorage.getItem("aa.scenarioCards:root-admin"),
              )
            )?.includes("SYNTHETIC_PRIVATE_ADMIN_DRAFT"),
          "admin's owned draft is stored",
        );
        await page.reload();
        await open();
        assert.equal(
          await name().inputValue(),
          "SYNTHETIC_PRIVATE_ADMIN_DRAFT",
        );
        await switchTo("manager");
        assert.equal(await name().inputValue(), "Senaryo A");
        assert.equal(
          await page.getByLabel("Proje", { exact: true }).first().inputValue(),
          "",
        );
        await name().fill("SYNTHETIC_PRIVATE_MANAGER_DRAFT");
        await page.reload();
        await open();
        assert.equal(
          await name().inputValue(),
          "SYNTHETIC_PRIVATE_MANAGER_DRAFT",
        );
        await switchTo("root-admin");
        assert.equal(
          await name().inputValue(),
          "SYNTHETIC_PRIVATE_ADMIN_DRAFT",
        );
        assert.equal(
          await page.getByLabel("Proje", { exact: true }).first().inputValue(),
          "p-a",
        );
        assert.equal(
          await page
            .getByLabel("Kaydırılacak ay", { exact: true })
            .first()
            .inputValue(),
          "5",
        );
      },
    );
  } finally {
    await page.close();
  }
}
