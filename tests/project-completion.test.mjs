import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { applyChanges } from "../backend/operations.mjs";

test("v47 adds project completion without changing existing projects; completion persists and unauthorized edits fail", async (t) => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "aa-project-completion-"),
  );
  const env = {
    NODE_ENV: "test",
    DB_PROVIDER: "sqljs",
    SQLJS_FILE: path.join(dir, "test.sqlite"),
  };
  let store = new Store({ env });
  t.after(async () => {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  await store.bootstrapUser({
    _id: "admin",
    username: "completion.admin",
    role: "admin",
    name: "Admin",
    active: true,
    leaders: [],
    password: await hashPassword("Completion-only-test-284!"),
    revision: 1,
    version: 1,
  });
  const actor = await store.findUser({ id: "admin" });
  const value = {
    id: "completion-p",
    name: "Completion project",
    start: "2026-01",
    end: "2026-12",
    phases: { "2026-03": "Design" },
  };
  await store.mutate(actor, (d, u) =>
    applyChanges(d, u, [{ kind: "project", id: value.id, revision: 0, value }]),
  );
  const before = (await store.read()).data;
  await store.transaction((c) =>
    c.batch(
      "ALTER TABLE kp_projects DROP COLUMN completed; DELETE FROM kp_schema_migrations WHERE version=47;",
    ),
  );
  await store.close();
  store = new Store({ env });
  await store.connect();
  assert.deepEqual((await store.read()).data, before);
  const save = async (completed, user = actor) =>
    store.mutate(user, (d, u) =>
      applyChanges(d, u, [
        {
          kind: "project",
          id: value.id,
          revision: d.revisions["project:" + value.id],
          value: { ...d.projects.find((p) => p.id === value.id), completed },
        },
      ]),
    );
  await save(true);
  await store.close();
  store = new Store({ env });
  await store.connect();
  let p = (await store.read()).data.projects.find((p) => p.id === value.id);
  assert.equal(p.completed, true);
  assert.deepEqual(p.phases, value.phases);
  await store.bootstrapUser({
    ...actor,
    _id: "manager-completion",
    username: "completion.manager",
    role: "manager",
  });
  await assert.rejects(
    save(false, await store.findUser({ id: "manager-completion" })),
    { status: 403 },
  );
  await save(false);
  p = (await store.read()).data.projects.find((p) => p.id === value.id);
  assert.equal(!!p.completed, false);
  assert.equal(p.name, value.name);
});
