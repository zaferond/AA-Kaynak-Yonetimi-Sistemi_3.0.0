import test from "node:test";
import assert from "node:assert/strict";
import { stageChanges } from "../backend/operations.mjs";
import { validate } from "../shared/server-domain.ts";
import { numericRecordSchema } from "../shared/numeric-record-schema.ts";
import { validationFixture } from "./snapshot-validation-suite.mjs";
import { boundedRecord } from "../shared/bounded-record-schema.ts";
import { calendarDaySchema } from "../shared/calendar-rules.ts";
import { z } from "zod";

test("large invalid command arrays stop at the first element and oversized arrays stop before element validation", () => {
  assert.throws(
    () =>
      stageChanges(
        {},
        { role: "admin" },
        Array.from({ length: 5000 }, () => ({})),
      ),
    (error) =>
      error.issues.length <= 3 &&
      error.issues.every((issue) => issue.path[0] === 0),
  );
  assert.throws(
    () => stageChanges({}, { role: "admin" }, Array(100001).fill(null)),
    (error) => error.issues.length === 1 && error.issues[0].code === "too_big",
  );
});

test("large invalid calendar records have a bounded error count and valid records remain lossless", () => {
  for (const field of ["workCalendar", "personCalendar"]) {
    const input = validationFixture();
    input[field] = Object.fromEntries(
      Array.from({ length: 5000 }, (_, i) => ["invalid-date-" + i, {}]),
    );
    assert.throws(
      () => validate(input),
      (error) => error.issues.length < 10 && error.issues[0].path[0] === field,
    );
  }
  const valid = Object.fromEntries(
    Array.from({ length: 5000 }, (_, i) => [
      new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10),
      { type: "company", label: "Synthetic holiday", fraction: 1 },
    ]),
  );
  const bounded = boundedRecord(z.string(), calendarDaySchema);
  assert.deepEqual(
    bounded.parse(valid),
    z.record(z.string(), calendarDaySchema).parse(valid),
  );
  assert.deepEqual(Object.keys(bounded.parse(valid)), Object.keys(valid));
});
test("large invalid snapshots and numeric dictionaries do not accumulate an error for every entry", () => {
  const input = validationFixture();
  input.resources = Array.from({ length: 5000 }, () => ({}));
  assert.throws(
    () => validate(input),
    (error) =>
      error.issues.length < 10 && error.issues[0].path[0] === "resources",
  );
  const numbers = Object.fromEntries(
    Array.from({ length: 5000 }, (_, i) => ["r" + i, "invalid"]),
  );
  const parsed = numericRecordSchema({ max: 100 }).safeParse(numbers);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.issues.length, 1);
  assert.deepEqual(parsed.error.issues[0].path, ["r0"]);
});
