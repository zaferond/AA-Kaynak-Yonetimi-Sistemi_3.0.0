import test from "node:test";
import assert from "node:assert/strict";
import { recalculateSuggestedTargets } from "../shared/project-progress.ts";
const input = {
  openingMonth: "2026-08",
  openingPct: 0,
  month: "2026-10",
  value: 80,
  projectEnd: "2026-12",
  targets: { "2026-09": 33.3, "2026-10": 66.7, "2026-11": 80, "2026-12": 100 },
  planned: { "2026-09": 1, "2026-10": 1, "2026-11": 1, "2026-12": 1 },
};
test("a fixed edit redistributes earlier and later suggested months even below the following target", () => {
  assert.deepEqual(recalculateSuggestedTargets(input), {
    "2026-09": 40,
    "2026-10": 80,
    "2026-11": 90,
    "2026-12": 100,
  });
  assert.deepEqual(recalculateSuggestedTargets({ ...input, value: 40 }), {
    "2026-09": 20,
    "2026-10": 40,
    "2026-11": 70,
    "2026-12": 100,
  });
});
test("resource weights and locked targets stay authoritative on both sides", () => {
  assert.deepEqual(
    recalculateSuggestedTargets({
      ...input,
      planned: { "2026-09": 1, "2026-10": 3, "2026-11": 3, "2026-12": 1 },
    }),
    { "2026-09": 20, "2026-10": 80, "2026-11": 95, "2026-12": 100 },
  );
  assert.deepEqual(
    recalculateSuggestedTargets({ ...input, lockedThrough: "2026-09" }),
    { "2026-09": 33.3, "2026-10": 80, "2026-11": 90, "2026-12": 100 },
  );
  assert.equal(
    recalculateSuggestedTargets({ ...input, lockedThrough: "2026-10" }),
    null,
  );
});
test("completion, zero resources and invalid edits preserve the fixed value and validation boundary", () => {
  assert.deepEqual(
    recalculateSuggestedTargets({ ...input, value: 100, planned: {} }),
    { "2026-09": 50, "2026-10": 100 },
  );
  assert.equal(recalculateSuggestedTargets({ ...input, value: NaN }), null);
  assert.equal(
    recalculateSuggestedTargets({ ...input, openingPct: 50, value: 40 }),
    null,
  );
  assert.equal(
    recalculateSuggestedTargets({ ...input, month: "2026-12", value: 90 })[
      "2026-12"
    ],
    90,
  );
});
