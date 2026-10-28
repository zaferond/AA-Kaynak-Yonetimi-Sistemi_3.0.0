import test from "node:test";
import assert from "node:assert/strict";
import {
  activeProgressRecords,
  entryMonths,
  defaultEntryMonth,
  monthStripYears,
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
test("completed projects no longer reach back the month strip", () => {
  const data = {
    projects: [{ id: "old", completed: true }, { id: "live" }],
    projectProgress: [
      { projectId: "old", baselines: [{ openingMonth: "2026-03" }] },
      { projectId: "live", baselines: [{ openingMonth: "2029-05" }] },
    ],
  };
  const records = activeProgressRecords(data);
  assert.deepEqual(entryMonths("2030-02", records, true), [
    "2029-06",
    "2029-07",
    "2029-08",
    "2029-09",
    "2029-10",
    "2029-11",
    "2029-12",
    "2030-01",
  ]);
});
test("completed-only tracking falls back to an empty strip without inventing months", () => {
  const data = {
    projects: [{ id: "old", completed: true }],
    projectProgress: [
      { projectId: "old", baselines: [{ openingMonth: "2024-03" }] },
    ],
  };
  const records = activeProgressRecords(data);
  assert.deepEqual(records, []);
  assert.deepEqual(
    entryMonths("2026-11", records, true),
    entryMonths("2026-11", undefined, true),
  );
});
test("month strip shows this and last year, hides older years behind the toggle", () => {
  const months = entryMonths("2027-02", [
    { baselines: [{ openingMonth: "2024-11" }] },
  ]);
  assert.deepEqual(monthStripYears(months, "2027-02", "2027-01", false), {
    olderYears: ["2024", "2025"],
    shownYears: ["2026", "2027"],
  });
  assert.deepEqual(
    monthStripYears(months, "2027-02", "2027-01", true).shownYears,
    ["2024", "2025", "2026", "2027"],
  );
});
test("the selected month's older year stays visible while the toggle is closed", () => {
  const months = ["2024-12", "2025-01", "2026-12", "2027-01"];
  assert.deepEqual(monthStripYears(months, "2027-02", "2024-12", false), {
    olderYears: ["2025"],
    shownYears: ["2024", "2026", "2027"],
  });
  assert.deepEqual(monthStripYears(months, "2027-02", "", false).olderYears, [
    "2024",
    "2025",
  ]);
});
test("year rollover: January keeps December's year in the recent strip", () => {
  const months = ["2025-12", "2026-01", "2026-12"];
  assert.deepEqual(monthStripYears(months, "2027-01", "2026-12", false), {
    olderYears: ["2025"],
    shownYears: ["2026", "2027"],
  });
});
