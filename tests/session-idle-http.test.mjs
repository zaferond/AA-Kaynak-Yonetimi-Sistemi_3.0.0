import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { SESSION_IDLE_MS } from "../backend/session-policy.mjs";

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-idle-"));
  const store = new Store({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(dir, "synthetic.sqlite"),
    },
  });
  await store.connect();
  const password = "Synthetic-idle-test-284!",
    hash = await hashPassword(password);
  for (const role of ["admin", "normal"])
    await store.bootstrapUser({
      _id: role,
      username: "synthetic." + role,
      name: role,
      role,
      leaders: [],
      active: true,
      version: 1,
      revision: 1,
      password: hash,
    });
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const app = createApp(store, { origin });
  server.on("request", app);
  t.after(async () => {
    app.locals.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const request = async (route, auth = {}, body) => {
    const res = await fetch(origin + "/api" + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: auth.cookie || "",
        Origin: origin,
        "X-Requested-With": "KaynakPortal",
        "X-CSRF-Token": auth.csrf || "",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json, headers: res.headers };
  };
  const login = async (role = "admin", remember = true) => {
    const result = await request(
      "/auth/login",
      {},
      { username: "synthetic." + role, password, remember },
    );
    assert.equal(result.status, 200);
    return {
      ...result,
      cookie: result.headers.get("set-cookie").split(";")[0],
      csrf: result.json.csrf,
    };
  };
  return { store, request, login };
}
test("polling does not renew idle time and expired sessions cannot be revived by activity", async (t) => {
  const f = await fixture(t),
    now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  const auth = await f.login();
  for (const minutes of [10, 20, 29]) {
    t.mock.timers.setTime(now + minutes * 60000);
    assert.equal((await f.request("/version", auth)).status, 200);
    assert.equal((await f.request("/auth/me", auth)).status, 200);
  }
  t.mock.timers.setTime(now + SESSION_IDLE_MS);
  assert.equal((await f.request("/version", auth)).status, 401);
  assert.equal((await f.request("/auth/activity", auth, {})).status, 401);
});
test("explicit CSRF-protected activity renews idle time without changing business generation", async (t) => {
  const f = await fixture(t),
    now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  const auth = await f.login(),
    generation = await f.store.generation();
  t.mock.timers.setTime(now + 29 * 60000);
  assert.equal(
    (await f.request("/auth/activity", { ...auth, csrf: "wrong" }, {})).status,
    403,
  );
  const active = await f.request("/auth/activity", auth, {});
  assert.equal(active.status, 200);
  assert.equal(active.json.idleExpiresAt, now + 59 * 60000);
  assert.equal(await f.store.generation(), generation);
  await f.store.close();
  await f.store.connect();
  t.mock.timers.setTime(now + 50 * 60000);
  assert.equal((await f.request("/version", auth)).status, 200);
  t.mock.timers.setTime(now + 59 * 60000);
  assert.equal((await f.request("/version", auth)).status, 401);
});
test("privileged sessions have no persistent cookie and keep their eight-hour absolute limit", async (t) => {
  const f = await fixture(t),
    now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  const admin = await f.login(),
    normal = await f.login("normal");
  assert(!/Max-Age=/i.test(admin.headers.get("set-cookie")));
  assert(/Max-Age=2592000/i.test(normal.headers.get("set-cookie")));
  for (let minute = 25; minute < 480; minute += 25) {
    t.mock.timers.setTime(now + minute * 60000);
    assert.equal((await f.request("/auth/activity", admin, {})).status, 200);
  }
  t.mock.timers.setTime(now + 8 * 3600000);
  assert.equal((await f.request("/version", admin)).status, 401);
});

test("an older activity timestamp cannot rewind a newer persisted heartbeat", async (t) => {
  const f = await fixture(t),
    now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  const auth = await f.login();
  t.mock.timers.setTime(now + 60000);
  const newer = await f.request("/auth/activity", auth, {});
  t.mock.timers.setTime(now + 30000);
  const older = await f.request("/auth/activity", auth, {});
  assert.equal(older.status, 200);
  assert.equal(older.json.idleExpiresAt, newer.json.idleExpiresAt);
});
