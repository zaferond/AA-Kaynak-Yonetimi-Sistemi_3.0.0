import test from "node:test";
import assert from "node:assert/strict";
import {
  actualEntryScope,
  activityReportScope,
  canEnterActual,
  canManagePersonalCalendar,
} from "../shared/actual-entry-access.ts";

const version = (team, lead, assignmentRole, patch = {}) => ({
  effective: "2026-01",
  start: "2026-01-01",
  end: "",
  team,
  lead,
  status: "Aktif Çalışan",
  included: true,
  amount: 1,
  assignmentRole,
  ...patch,
});
const person = (id, ...versions) => ({ id, name: id, note: "", versions });
// Root leadership with a sub-leadership (Child); "other" is outside.
const data = {
  leaders: ["Root", "Child", "Other"],
  leaderParents: { Child: "Root" },
  teams: [
    { id: "root", name: "Root", lead: "Root", kind: "leadership" },
    { id: "a", name: "A", lead: "Root" },
    { id: "b", name: "B", lead: "Root" },
    { id: "c", name: "C", lead: "Child" },
    { id: "other", name: "Other", lead: "Other" },
  ],
  resources: [
    person("leader", version("root", "Root", "leader")),
    person("po", version("a", "Root", "productOwner")),
    person("member", version("a", "Root", "member")),
    person("coe", version("a", "Root", "coe")),
    person("b-member", version("b", "Root", "member")),
    person("c-member", version("c", "Child", "member")),
    person("outsider", version("other", "Other", "member")),
    // In team "a" until September, in "b" from October.
    person(
      "mover",
      version("a", "Root", "member"),
      version("b", "Root", "member", { effective: "2026-10" }),
    ),
  ],
};
const date = "2026-10-15";
const user = (resourceId, role = "normal") => ({ role, resourceId });
const editable = (u, month = "2026-10") => {
  const scope = actualEntryScope(data, u, date);
  return data.resources
    .map((r) => r.id)
    .filter((id) => canEnterActual(data, u, scope, id, month));
};

test("Team Member and CoE enter only their own activity", () => {
  assert.deepEqual(editable(user("member")), ["member"]);
  assert.deepEqual(editable(user("coe")), ["coe"]);
});

test("Product Owner enters their own team, month by month", () => {
  assert.deepEqual(editable(user("po"), "2026-09"), [
    "po",
    "member",
    "coe",
    "mover",
  ]);
  // The mover left team "a" in October.
  assert.deepEqual(editable(user("po"), "2026-10"), ["po", "member", "coe"]);
});

test("Lider enters every team under the leadership, sub-leaderships included", () => {
  assert.deepEqual(editable(user("leader")), [
    "leader",
    "po",
    "member",
    "coe",
    "b-member",
    "c-member",
    "mover",
  ]);
});

test("the app role does not decide: a manager grant alone gives nothing, admin gives everything", () => {
  assert.deepEqual(
    editable({ role: "manager", resourceId: "", leaders: ["Root"] }),
    [],
  );
  assert.deepEqual(
    editable(user("member", "manager")),
    ["member"],
    "a Team Member stays a Team Member with a manager account",
  );
  assert.equal(editable({ role: "admin", resourceId: "" }).length, 8);
});

test("leave days follow the same people, by the day's team", () => {
  const po = user("po");
  const scope = actualEntryScope(data, po, date);
  const can = (id, day) => canManagePersonalCalendar(data, po, scope, id, day);
  assert(can("member", "2026-10-05"));
  assert(can("mover", "2026-09-30"));
  assert(!can("mover", "2026-10-01"));
  assert(!can("b-member", "2026-10-05"));
  assert(!can("outsider", "2026-10-05"));
  const member = user("member");
  const own = actualEntryScope(data, member, date);
  assert(canManagePersonalCalendar(data, member, own, "member", "2026-10-05"));
  assert(!canManagePersonalCalendar(data, member, own, "po", "2026-10-05"));
});

test("a departed or not yet started Lider manages nobody", () => {
  for (const patch of [
    { status: "İşten Ayrıldı", end: "2026-10-01" },
    { start: "2026-11-01" },
  ]) {
    const d = structuredClone(data);
    d.resources[0].versions = [version("root", "Root", "leader", patch)];
    const scope = actualEntryScope(d, user("leader"), date);
    assert.equal(scope.teamIds.size, 0);
  }
});

test("Aktivite Raporu shows Aktivite Giriş people plus a member's own team", async () => {
  const { activityReport } = await import("../backend/activity-report.mjs");
  const d = { ...structuredClone(data), projects: [], actualAllocations: {} };
  const query = { start: "2026-10", count: 1, projects: [] };
  const seen = (u) =>
    activityReport(d, u, query, "2026-10")
      .rows.map((row) => row.resourceId)
      .sort();
  // The report is read only: members and CoE also see their teammates.
  const teamA = ["coe", "member", "po"];
  assert.deepEqual(seen(user("member")), teamA);
  assert.deepEqual(seen(user("coe")), teamA);
  assert.deepEqual(
    seen(user("member", "manager")),
    teamA,
    "a manager account does not widen a Team Member",
  );
  assert.deepEqual(seen(user("po")), ["coe", "member", "po"]);
  assert.deepEqual(seen(user("leader")), [
    "b-member",
    "c-member",
    "coe",
    "leader",
    "member",
    "mover",
    "po",
  ]);
  assert.deepEqual(
    seen({ role: "manager", resourceId: "", leaders: ["Root"] }),
    [],
  );
  assert.equal(seen({ role: "admin", resourceId: "" }).length, 8);
});

test("activity report keeps an explicit reference date across month rollover for starters and transfers", async (t) => {
  const { activityReport } = await import("../backend/activity-report.mjs");
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-10-31T21:00:00Z"),
  });
  const d = { ...structuredClone(data), projects: [], actualAllocations: {} };
  d.resources.push(
    person("starter", version("a", "Root", "member", { start: "2026-10-31" })),
    person(
      "transfer",
      version("a", "Root", "member"),
      version("b", "Root", "member", { effective: "2026-11" }),
    ),
  );
  const query = { start: "2026-10", count: 2, projects: [] };
  for (const id of ["starter", "transfer"]) {
    const scope = activityReportScope(d, user(id), "2026-10", "2026-10-31");
    assert.deepEqual(
      scope.teams.map((team) => team.id),
      ["a"],
    );
    const rows = activityReport(
      d,
      user(id),
      query,
      "2026-10",
      "2026-10-31",
    ).rows;
    assert.deepEqual(
      new Set(rows.map((row) => row.resourceId)),
      new Set(["po", "member", "coe", "starter", "transfer"]),
    );
    assert(rows.every((row) => row.teamId === "a"));
    assert(rows.every((row) => row.cells[1].projectFte === 0));
  }
  const november = activityReport(
    d,
    user("transfer"),
    query,
    "2026-11",
    "2026-11-01",
  );
  assert.deepEqual(
    new Set(november.rows.map((row) => row.resourceId)),
    new Set(["b-member", "mover", "transfer"]),
  );
  assert(november.rows.every((row) => row.teamId === "b"));
});
