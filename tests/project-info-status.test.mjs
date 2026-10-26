import test from "node:test";
import assert from "node:assert/strict";
import {
  filterReportGroups,
  topicFilterCounts,
  topicStatus,
  topicWeeks,
} from "../frontend/src/project-info-status.ts";

const topic = (start, end, completed, rangeIndex = 0) => ({
  text: start,
  start,
  end,
  rangeIndex,
  noteIndex: 0,
  completed,
});
const today = "2026-10-16";

test("unfinished weeks before this week are late; current, future and completed weeks are neutral", () => {
  const value = {
    ...topic("2026-10-05", "2026-10-25", false),
    weekHistory: ["2026-W39", "2026-W41"],
  };
  const states = (completed, date) =>
    topicWeeks({ ...value, completed }, date).map(({ week, state }) => [
      week.key,
      state,
    ]);
  assert.deepEqual(states(false, "2026-10-18"), [
    ["2026-W41", "late"],
    ["2026-W42", "current"],
    ["2026-W43", "current"],
    ["2026-W39", "cancelled"],
  ]);
  assert.deepEqual(
    states(false, "2026-10-19")
      .slice(0, 3)
      .map(([, state]) => state),
    ["late", "late", "current"],
  );
  assert.deepEqual(
    states(true, "2026-10-26").map(([, state]) => state),
    ["current", "current", "current", "cancelled"],
  );
  assert.deepEqual(
    states(false, "2026-10-26")
      .slice(0, 3)
      .map(([, state]) => state),
    ["late", "late", "late"],
  );
});

test("critical topic status follows completion and today's date", () => {
  assert.equal(
    topicStatus(topic("2026-01-01", "2026-02-01", true), today),
    "done",
  );
  assert.equal(topicStatus(topic("2026-09-01", "2026-10-15"), today), "late");
  assert.equal(topicStatus(topic("2026-10-16", "2026-10-16"), today), "active");
  assert.equal(topicStatus(topic("2026-10-01", "2026-11-01"), today), "active");
  assert.equal(
    topicStatus(topic("2026-10-17", "2026-11-01"), today),
    "planned",
  );
});

test("critical topic filters count and keep original heading numbers", () => {
  const groups = [
    {
      id: "p1",
      name: "P1",
      responsibleName: "",
      infos: [
        {
          id: "a",
          name: "A",
          topics: [topic("2026-01-01", "2026-02-01", true)],
        },
        {
          id: "b",
          name: "B",
          topics: [
            topic("2026-09-01", "2026-10-01", false, 0),
            topic("2027-01-01", "2027-02-01", false, 1),
          ],
        },
      ],
    },
    {
      id: "p2",
      name: "P2",
      responsibleName: "",
      infos: [
        {
          id: "c",
          name: "C",
          topics: [topic("2026-01-01", "2026-01-02", true)],
        },
      ],
    },
  ];
  assert.deepEqual(topicFilterCounts(groups, today), {
    all: 4,
    open: 2,
    late: 1,
    done: 2,
  });
  const late = filterReportGroups(groups, "late", today);
  assert.deepEqual(
    late.map((p) => [
      p.id,
      p.infos.map((i) => [i.id, i.index, i.topics.length]),
    ]),
    [["p1", [["b", 1, 1]]]],
  );
  assert.equal(filterReportGroups(groups, "all", today)[0].infos.length, 2);
  assert.equal(filterReportGroups(groups, "open", today).length, 1);
});
