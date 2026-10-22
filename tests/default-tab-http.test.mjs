import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";

const PASSWORD = "Default-tab-test-only-1!";

async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-default-tab-"));
  const file = path.join(dir, "test.sqlite");
  const env = { NODE_ENV: "test", DB_PROVIDER: "sqljs", SQLJS_FILE: file };
  let store = new Store({ env });
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  let app = createApp(store, { origin });
  server.on("request", (req, res) => app(req, res));
  t.after(async () => {
    app.locals.close();
    await new Promise((resolve) => server.close(resolve));
    await store.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  await store.connect();
  await store.bootstrapUser({
    _id: "tab-user",
    username: "qa.tab",
    name: "QA Tab",
    role: "manager",
    resourceId: "",
    leaders: [],
    active: true,
    password: await hashPassword(PASSWORD),
    revision: 1,
    version: 1,
  });
  async function request(url, body, auth = {}) {
    const response = await fetch(origin + "/api" + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: auth.cookie || "",
        ...(body === undefined
          ? {}
          : {
              Origin: origin,
              "Content-Type": "application/json",
              "X-Requested-With": "KaynakPortal",
              "X-CSRF-Token": auth.csrf || "",
            }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json(), response };
  }
  async function login() {
    const result = await request("/auth/login", {
      username: "qa.tab",
      password: PASSWORD,
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    return {
      cookie: result.response.headers.get("set-cookie").split(";")[0],
      csrf: result.json.csrf,
      user: result.json.user,
    };
  }
  async function restart() {
    app.locals.close();
    await store.close();
    store = new Store({ env });
    await store.connect();
    app = createApp(store, { origin });
  }
  return { store: () => store, request, login, restart };
}

test("every account opens on Ana Sayfa until the user picks another screen; the choice survives a restart", async (t) => {
  const { store, request, login, restart } = await setup(t);
  const auth = await login();
  // No stored preference: the client opens Ana Sayfa.
  assert.equal(auth.user.defaultTab, undefined);
  const chosen = await request(
    "/auth/preferences",
    { defaultTab: "plan" },
    auth,
  );
  assert.equal(chosen.status, 200, JSON.stringify(chosen.json));
  assert.equal(chosen.json.user.defaultTab, "plan");
  // A preference closes no session and does not bump the account revision.
  const me = await request("/auth/me", undefined, auth);
  assert.equal(me.status, 200);
  assert.equal(me.json.user.defaultTab, "plan");
  const stored = await store().findUser({ id: "tab-user" });
  assert.equal(stored.revision, 1);
  assert.equal(stored.version, 1);
  await restart();
  const again = await login();
  assert.equal(again.user.defaultTab, "plan");
  // Choosing Ana Sayfa clears the stored value.
  const home = await request(
    "/auth/preferences",
    { defaultTab: "home" },
    again,
  );
  assert.equal(home.status, 200);
  assert.equal(home.json.user.defaultTab, undefined);
  assert.equal(
    (await store().findUser({ id: "tab-user" })).defaultTab,
    undefined,
  );
});

test("unknown screens, extra fields and requests without CSRF are refused", async (t) => {
  const { request, login } = await setup(t);
  const auth = await login();
  for (const body of [
    { defaultTab: "nowhere" },
    { defaultTab: "plan", role: "admin" },
    {},
  ])
    assert.equal(
      (await request("/auth/preferences", body, auth)).status,
      400,
      JSON.stringify(body),
    );
  assert.equal(
    (
      await request(
        "/auth/preferences",
        { defaultTab: "plan" },
        { cookie: auth.cookie },
      )
    ).status,
    403,
  );
});
