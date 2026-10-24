import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAdminPassword,
  assertNewPasswordStrength,
} from "../backend/admin-credentials.mjs";

test("admin bootstrap rejects empty, example and username-equal passwords", () => {
  for (const value of [
    undefined,
    "",
    "   ",
    "EN_AZ_10_KARAKTER_SIZE_OZEL_SIFRE",
    "'ILK_KURULUM_ICIN_SIZE_OZEL_SIFRE'".slice(1, -1),
    "ilk_kurulum_icin_size_ozel_sifre",
    "yalnizca-ilk-kurulumda-gereken-portal-sifresi",
    "yeni-sifreniz",
    "<en-az-10-karakterlik-kendi-sifreniz>",
  ])
    assert.throws(() => assertAdminPassword(value, "admin"), /ADMIN_PASSWORD/);
  assert.throws(
    () => assertAdminPassword("Admin.Kurum", "admin.kurum"),
    /kullanıcı adıyla aynı/,
  );
  assert.throws(
    () => assertAdminPassword("", "", "NEW_ADMIN_PASSWORD"),
    /^Error: NEW_ADMIN_PASSWORD/,
  );
});

test("admin bootstrap accepts an operator-chosen password", () => {
  assert.doesNotThrow(() =>
    assertAdminPassword("Kurum-2026!Planlama", "admin.kurum"),
  );
});

test("new local passwords need a letter and a digit and must not be a run or a repeat", () => {
  for (const [value, pattern] of [
    ["1231231234", /harf/],
    ["aaaaaaaaaa", /rakam/],
    ["1111111111aaa", /tekrar/],
    ["aaaaaaaaaaaa111", /tekrar/],
    ["abcdefgh123", /ardışık/],
    ["0123456789abc", /ardışık/],
    ["hgfedcba987", /ardışık/],
  ])
    assert.throws(() => assertNewPasswordStrength(value), pattern, value);
  for (const value of ["Kurum-2026!Planlama", "Temporary-password-test-1!"])
    assert.doesNotThrow(() => assertNewPasswordStrength(value));
});
