import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { gzipSync } from "node:zlib";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";

test("compressed login and authenticated JSON bodies are refused without crashing or mutating data", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-compression-"));
  const store = new Store({
    env: {
      NODE_ENV: "test",
      DB_PROVIDER: "sqljs",
      SQLJS_FILE: path.join(dir, "synthetic.sqlite"),
    },
  });
  await store.connect();
  const password = "Synthetic-compression-only-284!";
  await store.bootstrapUser({
    _id: "root-admin",
    username: "qa.compression",
    name: "Synthetic",
    role: "admin",
    leaders: [],
    active: true,
    password: await hashPassword(password),
    version: 1,
    revision: 1,
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
  const credentials = JSON.stringify({ username: "qa.compression", password });
  const headers = {
    Origin: origin,
    "X-Requested-With": "KaynakPortal",
    "Content-Type": "application/json",
  };
  const attack = Buffer.concat([
    gzipSync(Buffer.from(credentials)),
    Buffer.from([0]),
    Buffer.alloc(100 * 1024, 0x58),
  ]);
  const refused = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { ...headers, "Content-Encoding": "gzip" },
    body: attack,
  });
  assert.equal(refused.status, 415);
  await refused.text();
  assert.equal((await fetch(origin + "/api/health")).status, 200);
  const login = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers,
    body: credentials,
  });
  assert.equal(login.status, 200);
  const session = await login.json();
  const before = await store.read();
  for (const route of ["/auth/preferences", "/changes", "/restore"]) {
    const response = await fetch(origin + "/api" + route, {
      method: "POST",
      headers: {
        ...headers,
        Cookie: login.headers.get("set-cookie").split(";")[0],
        "X-CSRF-Token": session.csrf,
        "Content-Encoding": "gzip",
      },
      body: gzipSync(Buffer.from("{}")),
    });
    assert.equal(response.status, 415, route);
    await response.text();
  }
  assert.deepEqual(await store.read(), before);
  assert.equal((await fetch(origin + "/api/health")).status, 200);
});
