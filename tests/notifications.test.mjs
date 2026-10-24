import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { applyChanges } from "../backend/operations.mjs";
import {
  buildNotifications,
  notificationSummary,
} from "../backend/notifications.mjs";

const password = hashPassword("Notification-test-only-731!");

async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-notifications-"));
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
  const data = (await store.read()).data;
  const lead = data.teams.find((team) => team.lead).lead;
  const users = {};
  for (const [id, role, leaders] of [
    ["admin", "admin", []],
    ["editor", "admin", []],
    ["manager", "manager", [lead]],
    ["normal", "normal", []],
  ]) {
    await store.bootstrapUser({
      _id: id,
      username: "notify." + id,
      name: "Synthetic " + id,
      role,
      leaders,
      resourceId: "",
      active: true,
      password: await password,
      revision: 1,
      version: 1,
    });
    users[id] = await store.findUser({ id });
  }
  return { store, users };
}
const project = (id, extra = {}) => ({
  id,
  name: "Project " + id,
  start: "2026-01",
  end: "2026-12",
  phases: { "2026-01": "SECRET-PHASE-" + id },
  milestones: [],
  ...extra,
});

test("others' changes reach each reader within their own scope only", async (t) => {
  const { store, users } = await setup(t);
  // Visible to everyone, and one only ordinary users may view.
  const open = project("open");
  const hidden = project("hidden", {
    access: { roles: ["normal"], leaders: [], teams: [], people: [] },
  });
  await store.mutate(users.editor, (d, u) =>
    applyChanges(d, u, [
      { kind: "project", id: open.id, value: open, revision: 0 },
      { kind: "project", id: hidden.id, value: hidden, revision: 0 },
      {
        kind: "progressLock",
        id: "2026-09",
        value: { id: "2026-09", lockedByName: "", lockedAt: "" },
        revision: 0,
      },
    ]),
  );
  const read = async (id) =>
    (await store.notifications(users[id])).notifications;

  const admin = await read("admin");
  assert.deepEqual(admin.map((n) => n.summary).sort(), [
    "Eylül 2026 kilitlendi",
    "Yeni proje eklendi",
    "Yeni proje eklendi",
  ]);
  assert(admin.every((n) => n.actor === "Synthetic editor"));

  // The author is not notified of their own work.
  assert.deepEqual(await read("editor"), []);

  // A manager cannot view the restricted project, so it is not mentioned.
  const manager = await read("manager");
  assert.deepEqual(manager.map((n) => n.record || n.summary).sort(), [
    "Eylül 2026 kilitlendi",
    "Project open",
  ]);

  // Ordinary users have no Değerlendirme screen: no month locks.
  const normal = await read("normal");
  assert(normal.every((n) => n.kind === "project"));
  assert(!normal.some((n) => n.summary.includes("kilit")));

  // Field values never leave the server.
  for (const list of [admin, manager, normal])
    assert.doesNotMatch(JSON.stringify(list), /SECRET-PHASE/);
});

test("summaries come from field names; unlisted kinds are dropped", () => {
  const changes = (...list) => JSON.stringify(list);
  assert.equal(
    notificationSummary({
      kind: "progress",
      action: "update",
      record_id: "x",
      changes: changes({
        path: ["proposal", "status"],
        before: "draft",
        after: "pending",
      }),
    }),
    "Hedef plan onaya gönderildi",
  );
  assert.equal(
    notificationSummary({
      kind: "progress",
      action: "update",
      record_id: "x",
      changes: changes({
        path: ["actuals", "2026-09", "pct"],
        before: null,
        after: 35,
      }),
    }),
    "Eylül 2026 gerçekleşeni girildi",
  );
  assert.equal(
    notificationSummary({
      kind: "project",
      action: "update",
      record_id: "p",
      changes: changes({
        path: ["milestones", 0, "barNotes"],
        before: [],
        after: [1],
      }),
    }),
    "Kilometre taşı veya kritik konu güncellendi",
  );
  const row = (kind, record_id) => ({
    id: kind + record_id,
    occurred_at: "2026-10-01T00:00:00Z",
    actor_name: "A",
    kind,
    record_id,
    record_name: "R",
    action: "update",
    changes: "[]",
  });
  const data = { projects: [{ id: "p" }], risks: [], scheduleScenarios: [] };
  assert.deepEqual(
    buildNotifications(
      [
        row("allocation", "t|p|2026-01"),
        row("resource", "r"),
        row("project", "p"),
      ],
      data,
      "admin",
      30,
    ).map((n) => n.kind),
    ["project"],
  );
  // Back-to-back identical saves fold into one item with a count; the
  // limit counts folded items, not rows.
  const folded = buildNotifications(
    [row("project", "p"), row("project", "p"), row("project", "p")],
    { ...data, projects: [{ id: "p" }, { id: "q" }] },
    "admin",
    1,
  );
  assert.deepEqual(
    folded.map((n) => [n.kind, n.count, "recordId" in n]),
    [["project", 3, false]],
  );
  const split = buildNotifications(
    [row("project", "p"), row("project", "q"), row("project", "p")],
    { ...data, projects: [{ id: "p" }, { id: "q" }] },
    "admin",
    30,
  );
  assert.deepEqual(
    split.map((n) => n.count),
    [1, 1, 1],
  );
});

test("a narrow reader still gets older in-scope changes behind many hidden ones", async (t) => {
  const { store, users } = await setup(t);
  const open = project("open");
  const hidden = project("hidden", {
    access: { roles: ["normal"], leaders: [], teams: [], people: [] },
  });
  await store.mutate(users.editor, (d, u) =>
    applyChanges(d, u, [
      { kind: "project", id: open.id, value: open, revision: 0 },
      { kind: "project", id: hidden.id, value: hidden, revision: 0 },
    ]),
  );
  const insert = (i, recordId, at) =>
    store.db.query(
      "INSERT INTO kp_audit_events(id,occurred_at,actor_id,actor_name,kind,record_id,record_name,action,changes) VALUES(@p0,@p1,'editor',@p2,'project',@p3,@p4,'update','[]')",
      [
        "synthetic-" + recordId + "-" + i,
        at,
        "Synthetic actor " + i,
        recordId,
        "Project " + recordId,
      ],
    );
  // Five visible changes, then 700 newer ones the manager cannot see.
  for (let i = 0; i < 5; i++)
    await insert(i, "open", `2027-01-01T00:00:0${i}.000Z`);
  for (let i = 0; i < 700; i++)
    await insert(
      i,
      "hidden",
      `2027-02-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
    );
  const manager = (await store.notifications(users.manager)).notifications;
  assert.equal(
    manager.filter((n) => n.actor.startsWith("Synthetic actor")).length,
    5,
  );
  assert(manager.every((n) => n.recordId !== "hidden"));
  // Ordinary users may view the hidden project: they still get the limit.
  assert.equal(
    (await store.notifications(users.normal)).notifications.length,
    30,
  );
});
