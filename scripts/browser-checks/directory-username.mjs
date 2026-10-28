import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkDirectoryUsername(f) {
  const existing = {
    _id: "username-existing",
    username: "qa.existing",
    name: "Synthetic Existing",
    authSource: "ldap",
    directoryId: "1".repeat(32),
    role: "normal",
    leaders: [],
    active: false,
    version: 1,
    revision: 1,
    password: (await f.store.findUser({ id: "root-admin" })).password,
  };
  await f.store.bootstrapUser(existing);
  f.addDirectoryUser({
    id: "2".repeat(32),
    username: " QA.EXISTING ",
    name: "Synthetic Duplicate",
    email: "duplicate@example.invalid",
  });
  f.addDirectoryUser({
    id: "3".repeat(32),
    username: "qa.unique",
    name: "Synthetic Unique",
    email: "unique@example.invalid",
  });
  const { page, context } = await f.client("root-admin");
  const form = page.locator('.employee-access-editor[data-state="open"]');
  const account = form.locator(".resource-account-section");
  try {
    await selectWorkspaceTab(page, "Çalışan & Yetki Tanımlama");
    await page
      .getByRole("button", { name: "Kaynak Ekle / Yetki Tanımla", exact: true })
      .click();
    await f.check(
      "AD username: a different GUID with an existing inactive username cannot be selected",
      async () => {
        await account
          .getByLabel("Kullanıcı Ara", { exact: true })
          .fill("Synthetic");
        await account
          .getByRole("button", { name: "Kullanıcı Ara", exact: true })
          .click();
        const duplicate = account.getByRole("button", {
          name: "Synthetic Duplicate kullanıcısını seç",
          exact: true,
        });
        await duplicate.waitFor();
        assert(await duplicate.isDisabled());
        assert(
          await account
            .getByText(/Bu kullanıcı adı veya AD hesabı zaten kayıtlı/)
            .count(),
        );
      },
    );
    await f.check(
      "AD username: no employee-number field; single selection and read-only directory identity remain",
      async () => {
        await account
          .getByRole("button", {
            name: "Synthetic Unique kullanıcısını seç",
            exact: true,
          })
          .click();
        assert.equal(
          await form.getByLabel("Sicil No", { exact: true }).count(),
          0,
        );
        assert.equal(
          await account
            .getByLabel("Kullanıcı Adı", { exact: true })
            .inputValue(),
          "qa.unique",
        );
        assert.equal(
          await account
            .getByLabel("Kullanıcı Adı", { exact: true })
            .getAttribute("readonly"),
          "",
        );
        assert.equal(
          await account.getByRole("button", { name: / seçildi$/ }).count(),
          1,
        );
        await f.capture(page, "ad-username-selection");
      },
    );
  } finally {
    await context.close();
  }
}
