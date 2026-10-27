import test from "node:test";
import assert from "node:assert/strict";
import { createHealthCheck } from "../backend/health-check.mjs";

test("health shares and briefly caches a successful probe, then refreshes", async () => {
  let clock = 0,
    calls = 0;
  const check = createHealthCheck(
    {
      generation: async () => {
        calls++;
        return 1;
      },
    },
    { now: () => clock },
  );
  assert(
    (await Promise.all(Array.from({ length: 20 }, () => check()))).every(
      Boolean,
    ),
  );
  assert.equal(calls, 1);
  clock = 999;
  assert.equal(await check(), true);
  assert.equal(calls, 1);
  clock = 1000;
  assert.equal(await check(), true);
  assert.equal(calls, 2);
});

test("late rejection after a deadline is observed; failed cache expires and a fresh probe recovers", async () => {
  let clock = 0,
    calls = 0,
    reject;
  const held = new Promise((_, fail) => {
    reject = fail;
  });
  const store = {
    generation: () => {
      calls++;
      return held;
    },
  };
  const check = createHealthCheck(store, { timeoutMs: 15, now: () => clock });
  assert.equal(await check(), false);
  assert.equal(await check(), false);
  assert.equal(calls, 1);
  reject(Error("synthetic late DB error"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await check(), false);
  assert.equal(calls, 1);
  clock = 1000;
  store.generation = () => {
    calls++;
    throw Error("synthetic sync error");
  };
  assert.equal(await check(), false);
  clock = 2000;
  store.generation = async () => {
    calls++;
    return 1;
  };
  assert.equal(await check(), true);
  assert.equal(calls, 3);
});
