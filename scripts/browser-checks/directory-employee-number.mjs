import assert from "node:assert/strict";
import { selectWorkspaceTab } from "./fixture.mjs";

export async function checkDirectoryEmployeeNumber(f) {
  const employeeNumber = "00042";
  const existing = {
    _id: "sicil-existing",
    username: "sicil.existing",
    name: "Synthetic Existing",
    authSource: "ldap",
    directoryId: "1".repeat(32),
    employeeNumber,
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
    username: "sicil.duplicate",
    name: "Synthetic Duplicate",
    email: "duplicate@example.invalid",
    employeeNumber: " ０００４２ ",
  });
  f.addDirectoryUser({
    id: "3".repeat(32),
    username: "sicil.missing",
    name: "Synthetic Missing",
    email: "missing@example.invalid",
    employeeNumber: "",
  });
  f.addDirectoryUser({
    id: "4".repeat(32),
    username: "sicil.unique",
    name: "Synthetic Unique",
    email: "unique@example.invalid",
    employeeNumber: "00043",
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
      "Sicil No: duplicates including revoked accounts and missing numbers cannot be selected",
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
            .getByRole("button", {
              name: "Synthetic Missing kullanıcısını seç",
              exact: true,
            })
            .isDisabled(),
        );
        assert(await account.getByText(/Sicil No zaten eşleştirilmiş/).count());
      },
    );
    await f.check(
      "Sicil No: AD value is read only above Ad Soyad in both identity panels",
      async () => {
        await account
          .getByRole("button", {
            name: "Synthetic Unique kullanıcısını seç",
            exact: true,
          })
          .click();
        const numbers = form.getByLabel("Sicil No", { exact: true });
        assert.equal(await numbers.count(), 2);
        for (const field of await numbers.all()) {
          assert.equal(await field.inputValue(), "00043");
          assert.equal(await field.getAttribute("readonly"), "");
          assert(
            await field.evaluate((input) => {
              const next = input.closest("label").nextElementSibling;
              return next?.textContent.includes("Ad Soyad");
            }),
          );
        }
        await f.capture(page, "sicil-no-ad-selection.png");
      },
    );
  } finally {
    await context.close();
  }
}
