import test from "node:test";
import assert from "node:assert/strict";
import {
  duplicateScenario,
  DUPLICATE_SCENARIO_MESSAGE,
} from "../shared/schedule-shift.ts";
import { stageScenarioChange } from "../backend/scenario-commands.mjs";

const scenario = (id, name, months, status = "draft") => ({
  id,
  name,
  includeTimeline: true,
  shifts: [{ projectId: "p", months, fromMonth: "2026-10" }],
  status,
  createdBy: "u",
  createdByName: "U",
  createdAt: "2026-10-22T00:00:00.000Z",
});

test("a scenario may not repeat a saved name or the shifts of an open one", () => {
  const saved = [scenario("a", "Senaryo A", 3)];
  assert.equal(
    duplicateScenario(scenario("b", " senaryo a ", 5), saved)?.id,
    "a",
  );
  assert.equal(
    duplicateScenario(scenario("b", "Senaryo B", 3), saved)?.id,
    "a",
  );
  assert.equal(
    duplicateScenario(scenario("b", "Senaryo B", 5), saved),
    undefined,
  );
  // History keeps its name but frees its shifts.
  const old = [scenario("a", "Senaryo A", 3, "reverted")];
  assert.equal(
    duplicateScenario(scenario("b", "Senaryo B", 3), old),
    undefined,
  );
  assert.equal(duplicateScenario(scenario("b", "Senaryo A", 5), old)?.id, "a");
  // A card without a project repeats nothing but a name.
  const blank = {
    ...scenario("b", "Senaryo B", 3),
    shifts: [{ projectId: "", months: 3, fromMonth: "2026-10" }],
  };
  assert.equal(
    duplicateScenario(blank, [{ ...blank, id: "c", name: "Senaryo C" }]),
    undefined,
  );
});

test("the server refuses to add a repeated scenario", () => {
  const d = {
    projects: [{ id: "p" }],
    revisions: {},
    scheduleScenarios: [scenario("a", "Senaryo A", 3)],
  };
  const user = { _id: "u", role: "admin", name: "U" };
  assert.throws(
    () =>
      stageScenarioChange(
        d,
        user,
        { id: "b", value: scenario("b", "Senaryo A", 5) },
        undefined,
        () => true,
      ),
    new RegExp(DUPLICATE_SCENARIO_MESSAGE),
  );
});
