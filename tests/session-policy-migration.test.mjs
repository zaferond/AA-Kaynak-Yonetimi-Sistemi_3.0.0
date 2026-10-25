import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword, digest } from "../backend/auth.mjs";

test("session policy upgrade revokes legacy sessions, preserves business data/accounts and does not revoke new sessions on restart", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-session-upgrade-"));
  const env = {
    NODE_ENV: "test",
    DB_PROVIDER: "sqljs",
    SQLJS_FILE: path.join(dir, "synthetic.sqlite"),
  };
  let store = new Store({ env });
  t.after(async () => {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  await store.bootstrapUser({
    _id: "synthetic",
    username: "synthetic.upgrade",
    name: "Synthetic",
    role: "admin",
    leaders: [],
    active: true,
    password: await hashPassword("Synthetic-upgrade-284!"),
    version: 1,
    revision: 1,
  });
  const session = {
    _id: digest("synthetic-token"),
    userId: "synthetic",
    userVersion: 1,
    csrf: "synthetic-csrf",
    expiresAt: new Date(Date.now() + 3600000),
  };
  await store.createSession(session);
  const before = await store.read(),
    user = await store.findUser({ id: "synthetic" });
  // Reconstruct the immediately preceding schema, including its still-active session.
  await store.transaction((c) =>
    c.batch(
      "ALTER TABLE kp_sessions DROP COLUMN last_activity_at; DELETE FROM kp_schema_migrations WHERE version=46;",
    ),
  );
  await store.close();
  store = new Store({ env });
  await store.connect();
  assert.deepEqual(await store.read(), before);
  assert.deepEqual(await store.findUser({ id: "synthetic" }), user);
  assert.equal(
    (await store.db.query("SELECT COUNT(*) AS n FROM kp_sessions")).rows[0].n,
    0,
  );
  await store.createSession(session);
  await store.close();
  store = new Store({ env });
  await store.connect();
  assert(await store.session(session._id), "migration must run only once");
  assert.equal(
    (
      await store.db.query(
        "SELECT COUNT(*) AS n FROM kp_schema_migrations WHERE version=46",
      )
    ).rows[0].n,
    1,
  );
});
