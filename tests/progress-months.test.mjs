import test from "node:test";
import assert from "node:assert/strict";
import {
  entryMonths,
  defaultEntryMonth,
} from "../frontend/src/features/project-progress/progress-months.ts";

test("entry selection opens October in November while report selection keeps the current month", () => {
  assert.equal(entryMonths("2026-10", undefined, true).at(-1), "2026-09");
  assert(!entryMonths("2026-10", undefined, true).includes("2026-10"));
  assert.equal(entryMonths("2026-11", undefined, true).at(-1), "2026-10");
  assert(!entryMonths("2026-11", undefined, true).includes("2026-11"));
  assert(
    entryMonths("2026-10").includes("2026-10"),
    "Report choices remain unchanged",
  );
  assert.equal(defaultEntryMonth("2026-10"), "2026-09");
});
test("year rollover keeps December available and never opens the new January early", () => {
  const records = [{ baselines: [{ openingMonth: "2026-11" }] }];
  assert.deepEqual(entryMonths("2027-01", records, true), ["2026-12"]);
  assert.equal(defaultEntryMonth("2027-01", records), "2026-12");
});
test("entry selection respects tracking start and has no phantom month before the first month completes", () => {
  const records = [{ baselines: [{ openingMonth: "2026-08" }] }];
  assert.deepEqual(entryMonths("2026-09", records, true), []);
  assert.deepEqual(entryMonths("2026-10", records, true), ["2026-09"]);
  assert.deepEqual(entryMonths("2026-08", records, true), []);
});
