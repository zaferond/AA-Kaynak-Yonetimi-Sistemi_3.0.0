import test from "node:test";
import { randomUUID } from "node:crypto";
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
    assertAdminPassword("Kurum-" + randomUUID() + "!", "admin.kurum"),
  );
});

test("passwords once committed in tests are rejected for every account path", () => {
  for (const value of [
    "Kurum-2026!Planlama",
    "temporary-password-test-1!",
    " Chosen-password-test-2! ",
  ])
    for (const name of ["ADMIN_PASSWORD", "NEW_ADMIN_PASSWORD", "Yeni şifre"])
      assert.throws(
        () => assertAdminPassword(value, "admin.kurum", name),
        /kaynak kodda/,
      );
});

test("bootstrap and CLI reset reject the same weak temporary passwords as interactive changes", () => {
  for (const password of [
    "aaaaaaaaaa",
    "!!!!!!!!!!",
    "9876543210",
    "abc123",
    "abc".repeat(100),
  ])
    for (const name of ["ADMIN_PASSWORD", "NEW_ADMIN_PASSWORD"])
      assert.throws(
        () => assertAdminPassword(password, "synthetic.root", name),
        new RegExp(name),
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
  for (const value of ["Kurum-" + randomUUID() + "!", "Gecici-sifre-ornek-7!"])
    assert.doesNotThrow(() => assertNewPasswordStrength(value));
});
