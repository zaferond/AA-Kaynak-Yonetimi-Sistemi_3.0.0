import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { verifyPassword } from "../backend/auth.mjs";
import { ROOT_ADMIN_ID } from "../shared/access.ts";
import {
  assertNewPasswordStrength,
  generateSetupCode,
} from "../backend/admin-credentials.mjs";
import { ensureRootAdmin } from "../backend/root-admin-bootstrap.mjs";

async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-root-bootstrap-"));
  const store = new Store({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(dir, "test.sqlite"),
    },
  });
  t.after(async () => {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  const lines = [];
  const start = (env) =>
    ensureRootAdmin(store, env, (line) => lines.push(line));
  const root = () => store.findUser({ id: ROOT_ADMIN_ID });
  const printedCode = () =>
    /Tek kullanımlık kurulum kodu: (\S+)/.exec(lines.at(-1))?.[1];
  return { store, lines, start, root, printedCode };
}

test("setup codes are readable, strong and unique", () => {
  const codes = new Set(Array.from({ length: 50 }, generateSetupCode));
  assert.equal(codes.size, 50);
  for (const code of codes) {
    assert.match(code, /^Kurulum-([A-HJKMNP-Z2-9]{5}-){3}[A-HJKMNP-Z2-9]{5}$/);
    assert.doesNotThrow(() => assertNewPasswordStrength(code));
  }
});

test("first start without ADMIN_PASSWORD prints a one-time code and forces a new password", async (t) => {
  const f = await setup(t);
  await f.start({ ADMIN_USERNAME: " Root.Admin " });
  const code = f.printedCode();
  assert(code, "the code is printed to the console");
  const root = await f.root();
  assert.equal(root.username, "root.admin");
  assert.equal(root.mustChangePassword, true);
  assert(await verifyPassword(code, root.password));
  assert(
    !JSON.stringify(root.password).includes(code),
    "only the hash is stored",
  );
});

test("an unclaimed root admin gets a fresh code on every start; the old one stops working", async (t) => {
  const f = await setup(t);
  await f.start({ ADMIN_USERNAME: "root.admin" });
  const first = f.printedCode();
  await f.start({ ADMIN_USERNAME: "root.admin" });
  const second = f.printedCode();
  assert.notEqual(first, second);
  const root = await f.root();
  assert(!(await verifyPassword(first, root.password)));
  assert(await verifyPassword(second, root.password));
});

test("a claimed root admin is left alone and no code is printed", async (t) => {
  const f = await setup(t);
  await f.start({ ADMIN_USERNAME: "root.admin" });
  const claimed = { ...(await f.root()), mustChangePassword: false };
  await f.store.transaction((c) => f.store.saveUser(claimed, c));
  const before = (await f.root()).password;
  const count = f.lines.length;
  await f.start({ ADMIN_USERNAME: "root.admin" });
  assert.equal(f.lines.length, count);
  assert.deepEqual((await f.root()).password, before);
});

test("ADMIN_PASSWORD still bootstraps existing installs and later only warns", async (t) => {
  const f = await setup(t);
  const password = "Kurum-" + Date.now() + "-x9!";
  await f.start({ ADMIN_USERNAME: "root.admin", ADMIN_PASSWORD: password });
  assert.equal(f.printedCode(), undefined);
  assert(await verifyPassword(password, (await f.root()).password));
  await f.start({ ADMIN_USERNAME: "root.admin", ADMIN_PASSWORD: password });
  assert.match(f.lines.at(-1), /ADMIN_PASSWORD satırı artık kullanılmıyor/);
  assert(await verifyPassword(password, (await f.root()).password));
});
