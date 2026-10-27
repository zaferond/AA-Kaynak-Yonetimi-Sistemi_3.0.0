import test from "node:test";
import assert from "node:assert/strict";
import {
  visiblePlanningProjects,
  completedPlanningCount,
} from "../frontend/src/features/planned-allocation/completed-projects.ts";

const projects = [
  { id: "active" },
  { id: "done", name: "Done", completed: true },
  { id: "old", name: "Old", completed: true },
];
const allocations = {
  "a|active|2026-11": 1,
  "a|done|2026-09": 2,
  "a|done|2026-10": 0.1,
  "a|done|2026-11": 0.2,
  "a|done|2026-12": 0,
  "b|done|2026-11": 4,
  "a|old|2026-08": 3,
};
const options = {
  allocations,
  projects,
  teamIds: ["a"],
  months: ["2026-11"],
  onlyDataRows: false,
};

test("completed project visibility leaves the projects and all saved allocations intact", () => {
  const before = structuredClone({ projects, allocations });
  assert.deepEqual(
    visiblePlanningProjects(projects, false).map((p) => p.id),
    ["active"],
  );
  assert.equal(visiblePlanningProjects(projects, true), projects);
  assert.deepEqual({ projects, allocations }, before);
});

test("completed count follows the selected projects and requires a selected team", () => {
  assert.equal(completedPlanningCount(options), 2);
  assert.equal(
    completedPlanningCount({ ...options, projects: [projects[0]] }),
    0,
  );
  assert.equal(
    completedPlanningCount({ ...options, projects: [projects[2]] }),
    1,
  );
  assert.equal(completedPlanningCount({ ...options, teamIds: [] }), 0);
});

test("data-only count follows selected teams and visible months, including historical records", () => {
  assert.equal(completedPlanningCount({ ...options, onlyDataRows: true }), 1);
  assert.equal(
    completedPlanningCount({
      ...options,
      onlyDataRows: true,
      months: ["2027-01"],
    }),
    0,
  );
  assert.equal(
    completedPlanningCount({
      ...options,
      onlyDataRows: true,
      months: ["2026-08"],
    }),
    1,
  );
  assert.equal(
    completedPlanningCount({ ...options, onlyDataRows: true, teamIds: ["c"] }),
    0,
  );
});
