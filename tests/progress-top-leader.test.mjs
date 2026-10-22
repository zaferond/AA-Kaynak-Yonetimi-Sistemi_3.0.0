import test from "node:test";
import assert from "node:assert/strict";
import {
  isTopLeader,
  topLeaderResourceByMonth,
} from "../shared/project-progress.ts";

test("progress resource rolls sub-leaderships up into the top leadership", () => {
  const data = {
    leaderParents: { Alt: "Üst", "Alt Alt": "Alt" },
    teams: [
      { id: "u", lead: "Üst" },
      { id: "a", lead: "Alt" },
      { id: "aa", lead: "Alt Alt" },
      { id: "x", lead: "Bağımsız" },
    ],
  };
  const planned = topLeaderResourceByMonth(
    data,
    {
      "u|p|2026-01": 1,
      "a|p|2026-01": 0.5,
      "aa|p|2026-02": 2,
      "x|p|2026-01": 3,
      "u|q|2026-01": 9,
    },
    "p",
  );
  assert.deepEqual([...planned.keys()].sort(), ["Bağımsız", "Üst"]);
  assert.deepEqual(planned.get("Üst"), { "2026-01": 1.5, "2026-02": 2 });
  assert.equal(isTopLeader(data, "Üst"), true);
  assert.equal(isTopLeader(data, "Alt"), false);
  assert.equal(isTopLeader(data, ""), false);
});
