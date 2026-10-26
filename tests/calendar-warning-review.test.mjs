import test from "node:test";
import assert from "node:assert/strict";
import { warningFixture } from "./scenario-warning-fixture.mjs";
import { synchronizeScenarioWarnings } from "../backend/scenario-warning-engine.mjs";
import { assessProjectWarning } from "../shared/scenario-warnings.ts";
import {
  pendingAssessmentReason,
  warningPriority,
  warningFinding,
  warningEvidence,
  warningRecommendation,
} from "../shared/calendar-warning-review.ts";
import { scenarioWarningSchema } from "../shared/scenario-warning-schema.ts";

test("normal projects retain their assessment but do not create warnings; resolved warnings close without losing history", () => {
  const d = warningFixture();
  d.projectProgress[0].actuals["2026-09"].pct = 40;
  synchronizeScenarioWarnings(d);
  assert.equal(d.warningAssessments[0].progressState, "onTrack");
  assert.equal(d.scenarioWarnings.length, 0);
  d.projectProgress[0].actuals["2026-09"].pct = 32;
  synchronizeScenarioWarnings(d);
  const id = d.scenarioWarnings[0].id;
  assert.equal(d.scenarioWarnings[0].status, "open");
  d.projectProgress[0].actuals["2026-09"].pct = 40;
  synchronizeScenarioWarnings(d);
  assert.equal(d.scenarioWarnings.length, 1);
  assert.equal(d.scenarioWarnings[0].id, id);
  assert.equal(d.scenarioWarnings[0].status, "closed");
  assert.equal(d.scenarioWarnings[0].history.length, 2);
  assert.equal(synchronizeScenarioWarnings(d), 0);
});
test("unmapped critical and unplanned conditions get a priority and an actionable recommendation", () => {
  const d = warningFixture();
  d.allocations["t|p|2026-10"] = 200;
  d.projectProgress[0].actuals["2026-09"].pct = 20;
  const a = assessProjectWarning(d, d.projects[0]);
  assert.equal(a.progressState, "critical");
  assert.equal(a.code, null);
  assert.equal(warningPriority(a), "critical");
  assert.match(a.warning2, /incelenmeli/);
  synchronizeScenarioWarnings(d);
  assert.equal(d.scenarioWarnings.length, 1);
  assert.equal(d.scenarioWarnings[0].ruleKey, "P-critical");
  assert.match(warningRecommendation("ahead", "unplanned"), /kaynak planı/);
  assert.equal(
    warningPriority({
      ...a,
      progressState: "onTrack",
      resourceState: "excess",
    }),
    "information",
  );
  assert.equal(
    warningPriority({
      ...a,
      progressState: "ahead",
      resourceState: "insufficient",
    }),
    "attention",
  );
});
test("stale or missing data is pending separately; completion and not-yet-started projects do not become pending", () => {
  const d = warningFixture(),
    a = assessProjectWarning(d, d.projects[0]);
  assert.equal(pendingAssessmentReason(a, "2026-10-31"), "");
  assert.match(pendingAssessmentReason(a, "2026-11-01"), /güncel değil/);
  assert.match(
    pendingAssessmentReason(
      { ...a, status: "missing", reason: "Eksik liderlik: A" },
      "2026-10-26",
    ),
    /Eksik liderlik/,
  );
  assert.equal(
    pendingAssessmentReason({ ...a, status: "completed" }, "2026-11-01"),
    "",
  );
  assert.equal(
    pendingAssessmentReason({ ...a, status: "notStarted" }, "2026-11-01"),
    "",
  );
  assert.match(
    pendingAssessmentReason({ ...a, month: "2025-12" }, "2026-02-01"),
    /güncel değil/,
  );
  assert.match(warningFinding(a), /İzleyen|kaynak|Kaynak/);
  assert.match(
    warningEvidence(a),
    /Hedef %40 · Gerçekleşen %32 · Sapma -8 puan/,
  );
});
test("legacy action history remains valid, new structured dates reject impossible dates", () => {
  const d = warningFixture();
  synchronizeScenarioWarnings(d);
  const w = d.scenarioWarnings[0];
  assert(scenarioWarningSchema.safeParse(w).success);
  w.history.push({
    status: "acted",
    explanation: "Aksiyon",
    at: "2026-10-26",
    byId: "a",
    byName: "A",
    responsible: "Sorumlu",
    targetDate: "2026-02-30",
  });
  assert.equal(scenarioWarningSchema.safeParse(w).success, false);
  w.history.at(-1).targetDate = "2026-10-30";
  assert(scenarioWarningSchema.safeParse(w).success);
});
