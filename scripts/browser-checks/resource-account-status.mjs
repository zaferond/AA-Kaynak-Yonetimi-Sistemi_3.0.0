import assert from "node:assert/strict";
import { statuses } from "../../shared/model.ts";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkResourceAccountStatus(f) {
  const { page, context } = await f.client("root-admin");
  const form = page.locator('.employee-access-editor[data-state="open"]');
  const account = form.locator(".resource-account-section");
  async function choose(label, name) {
    await form.getByRole("button", { name: label, exact: true }).click();
    await page
      .locator('.pickerpanel[data-state="open"]')
      .getByRole("button", { name, exact: true })
      .click();
  }
  try {
    await selectWorkspaceTab(page, "Çalışan & Yetki Tanımlama");
    await page
      .getByRole("button", { name: "Kaynak Ekle / Yetki Tanımla", exact: true })
      .click();
    await f.check(
      "resource account: AD opens automatically; both posting statuses discard an unsaved AD choice and hide account fields",
      async () => {
        assert.equal(
          await account
            .getByLabel("Hesap Eşleştirmesi", { exact: true })
            .inputValue(),
          "Active Directory",
        );
        assert.equal(
          await account
            .locator('select[aria-label="Hesap Eşleştirmesi"]')
            .count(),
          0,
        );
        await form.getByRole("button", { name: "Kaydet", exact: true }).click();
        await form
          .getByText("Active Directory kullanıcısı seçin.", { exact: true })
          .waitFor();
        await account
          .getByRole("button", {
            name: "Directory New Account kullanıcısını seç",
            exact: true,
          })
          .click();
        assert.equal(
          await form
            .locator(".employee-resource-fields")
            .getByLabel("Ad Soyad", { exact: true })
            .inputValue(),
          "Directory New Account",
        );
        for (const status of ["Aktif İlan", "Pasif İlan"]) {
          await choose("Statü", status);
          await account
            .getByText("İlan kaydına hesap tanımlanamaz.", { exact: true })
            .waitFor();
          assert.equal(
            await account
              .getByLabel("Hesap Eşleştirmesi", { exact: true })
              .count(),
            0,
          );
          assert.equal(
            await account.locator(".access-directory-results").count(),
            0,
          );
          await choose("Statü", "Aktif Çalışan");
          assert.equal(
            await account
              .getByLabel("Hesap Eşleştirmesi", { exact: true })
              .inputValue(),
            "Active Directory",
          );
          assert.equal(
            await account
              .getByLabel("Kullanıcı Adı", { exact: true })
              .inputValue(),
            "",
          );
          await account
            .getByRole("button", {
              name: "Directory New Account kullanıcısını seç",
              exact: true,
            })
            .click();
        }
        for (const status of statuses.filter((s) => !s.includes("İlan"))) {
          await choose("Statü", status);
          assert.equal(
            await account
              .getByLabel("Hesap Eşleştirmesi", { exact: true })
              .inputValue(),
            "Active Directory",
          );
        }
      },
    );
    await f.check(
      "resource account: saving a posting after an AD selection creates no account or stale permission request",
      async () => {
        const usersBefore = (await f.store.users()).map((u) => u._id).sort();
        await choose("Statü", "Aktif İlan");
        await choose("Takım", f.teamA.name);
        let accountWrites = 0;
        page.on("request", (r) => {
          if (r.url().endsWith("/api/employees/save")) accountWrites++;
        });
        const saved = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/changes") && r.request().method() === "POST",
        );
        await form.getByRole("button", { name: "Kaydet", exact: true }).click();
        assert.equal((await saved).status(), 200);
        await form.waitFor({ state: "hidden" });
        assert.equal(accountWrites, 0);
        assert.deepEqual(
          (await f.store.users()).map((u) => u._id).sort(),
          usersBefore,
        );
        assert.equal(
          (await f.state()).resources.filter((r) =>
            r.versions.some((v) => v.status === "Aktif İlan"),
          ).length,
          1,
        );
      },
    );
  } finally {
    await context.close();
  }
}
