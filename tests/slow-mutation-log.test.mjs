import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { applyChanges } from "../backend/operations.mjs";

async function open(t, options) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-slow-mutation-"));
  const store = new Store({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(dir, "test.sqlite"),
    },
    ...options,
  });
  t.after(async () => {
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  await store.bootstrapUser({
    _id: "admin",
    username: "slow.admin",
    name: "Synthetic admin",
    role: "admin",
    leaders: [],
    resourceId: "",
    active: true,
    password: await hashPassword("Slow-mutation-test-only-517!"),
    revision: 1,
    version: 1,
  });
  return { store, admin: await store.findUser({ id: "admin" }) };
}
const project = {
  id: "secret-project-id",
  name: "SECRET PROJECT NAME",
  responsibleName: "Secret Owner",
  start: "2026-01",
  end: "2026-12",
  phases: {},
  phaseColors: {},
  milestones: [],
};
const addProject = (d, u) =>
  applyChanges(d, u, [
    { kind: "project", id: project.id, value: project, revision: 0 },
  ]);

test("a slow write is logged with phase times and counts only", async (t) => {
  const lines = [];
  const { store, admin } = await open(t, {
    slowMutationMs: 0,
    log: (...args) => lines.push(args),
  });
  await store.mutate(admin, addProject, { returnView: true });
  assert.equal(lines.length, 1);
  const [label, json] = lines[0];
  assert.equal(label, "Slow mutation");
  const entry = JSON.parse(json);
  for (const key of [
    "totalMs",
    "lockMs",
    "readMs",
    "commandMs",
    "validateMs",
    "persistMs",
    "viewMs",
    "commitMs",
  ])
    assert(Number.isInteger(entry[key]) && entry[key] >= 0, key);
  assert.equal(entry.size.projects, 1);
  assert.equal(typeof entry.size.allocations, "number");
  // No names, ids or values of the written records.
  assert.doesNotMatch(json, /SECRET|secret-project-id|Secret Owner/);
});

test("writes under the threshold and failed writes are not logged", async (t) => {
  const lines = [];
  const { store, admin } = await open(t, {
    slowMutationMs: 60_000,
    log: (...args) => lines.push(args),
  });
  await store.mutate(admin, addProject);
  await assert.rejects(
    store.mutate(admin, () => {
      throw Object.assign(Error("rejected"), { status: 409 });
    }),
  );
  assert.equal(lines.length, 0);
});

test("the threshold comes from SLOW_MUTATION_MS and must be a number", () => {
  const env = (value) => ({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(os.tmpdir(), "unused.sqlite"),
      SLOW_MUTATION_MS: value,
    },
  });
  assert.equal(new Store(env("250")).slowMutationMs, 250);
  assert.throws(() => new Store(env("-1")), /SLOW_MUTATION_MS/);
  assert.throws(() => new Store(env("x")), /SLOW_MUTATION_MS/);
});
