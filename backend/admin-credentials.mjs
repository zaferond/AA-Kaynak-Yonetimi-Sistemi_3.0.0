// Dependency-free: setup.mjs imports this before npm packages are installed.
import { randomInt } from "node:crypto";
// Placeholders that shipped in example files or guides; a copied example must
// never become a publicly known root admin password.
const PASSWORD_PLACEHOLDERS = new Set(
  [
    "EN_AZ_10_KARAKTER_SIZE_OZEL_SIFRE",
    "ILK_KURULUM_ICIN_SIZE_OZEL_SIFRE",
    "yalnizca-ilk-kurulumda-gereken-portal-sifresi",
    "yeni-sifreniz",
  ].map((value) => value.toLowerCase()),
);
// Literal passwords that were committed in tests; they stay in git history, so
// they must never be accepted for a real account. Tests now generate theirs.
const EXPOSED_PASSWORDS = new Set(
  [
    "Kurum-2026!Planlama",
    "Temporary-password-test-1!",
    "Chosen-password-test-2!",
  ].map((value) => value.toLowerCase()),
);
/** Rejects empty, placeholder or username-equal admin passwords from .env. */
export function assertAdminPassword(
  password,
  username = "",
  name = "ADMIN_PASSWORD",
) {
  const value = typeof password === "string" ? password.trim() : "";
  if (!value)
    throw Error(
      name + " boş. .env içine en az 10 karakterlik kendi şifrenizi yazın.",
    );
  const lower = value.toLowerCase();
  if (
    PASSWORD_PLACEHOLDERS.has(lower) ||
    /size_ozel_sifre/.test(lower) ||
    /^<.*>$/.test(value) ||
    (username && lower === username.trim().toLowerCase())
  )
    throw Error(
      name +
        " örnek dosyadaki yer tutucu veya kullanıcı adıyla aynı. Kendi şifrenizi yazın.",
    );
  if (EXPOSED_PASSWORDS.has(lower))
    throw Error(
      name + " kaynak kodda açıkça yer almış bir değer. Kendi şifrenizi yazın.",
    );
  if (password.length < 10 || password.length > 256)
    throw Error(name + " 10–256 karakter olmalıdır.");
  assertNewPasswordStrength(password, name);
}
/** Newly chosen local passwords (POST /api/auth/password): at least one letter
 * and one digit, and not made up only of repeated characters or ascending/
 * descending runs (aaaa, 1234, dcba). Stored passwords and AD are unaffected. */
export function assertNewPasswordStrength(password, name = "Yeni şifre") {
  const value = String(password || "").toLocaleLowerCase("tr");
  if (!/\p{L}/u.test(value) || !/\p{N}/u.test(value))
    throw Error(name + " en az bir harf ve bir rakam içermeli.");
  const chars = [...value].map((char) => char.codePointAt(0));
  let weak = chars.length > 0;
  for (let i = 0; weak && i < chars.length;) {
    const step = chars[i + 1] - chars[i];
    let j = i + 1;
    if (Math.abs(step) <= 1)
      while (j + 1 < chars.length && chars[j + 1] - chars[j] === step) j++;
    if (j - i + 1 < 3 || Math.abs(step) > 1) weak = false;
    i = j + 1;
  }
  if (weak)
    throw Error(
      name +
        " yalnız tekrar eden karakterlerden veya ardışık dizilerden (ör. aaaa, 1234, abcd) oluşamaz.",
    );
}
// No 0/O, 1/I/L: the code is read off a console and typed once.
const SETUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** One-time root admin code, printed to the server console only. It never
 * lives in .env; the first login replaces it (mustChangePassword). */
export function generateSetupCode() {
  while (true) {
    const groups = Array.from({ length: 4 }, () =>
      Array.from(
        { length: 5 },
        () => SETUP_ALPHABET[randomInt(SETUP_ALPHABET.length)],
      ).join(""),
    );
    const code = "Kurulum-" + groups.join("-");
    if (/\d/.test(code)) return code;
  }
}
