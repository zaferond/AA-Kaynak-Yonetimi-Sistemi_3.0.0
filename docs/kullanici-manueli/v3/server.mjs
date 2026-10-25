// Starts the app on a temporary copy of the demo database with the manual's
// screenshot accounts; the real database is never opened.
// Usage (project root): [MANUAL_DB=<demo.sqlite>] node docs/kullanici-manueli/v3/server.mjs
// Prints the origin; stops on Ctrl+C and removes the copy.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const { Store } = await import(path.join(root, "backend/store.mjs"));
const { createApp } = await import(path.join(root, "backend/app.mjs"));
const { hashPassword } = await import(path.join(root, "backend/auth.mjs"));

export const PASSWORD = "Manuel-Gorsel-2026!";
export const ACCOUNTS = {
  admin: "sistem.admin",
  manager: "genel.mudur",
  normal: "muhendis.detay",
  projectEditor: "proje.ofisi",
};

export async function startManualServer({ port = 0 } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aa-manuel-"));
  const file = path.join(dir, "demo.sqlite");
  // MANUAL_DB picks another demo file (e.g. a backup); the default is the
  // demo database. Either way only a copy is opened.
  await fs.copyFile(
    process.env.MANUAL_DB || path.join(root, "data/demo-sunum.sqlite"),
    file,
  );
  const store = new Store({
    env: { NODE_ENV: "test", DB_PROVIDER: "sqljs", SQLJS_FILE: file },
  });
  await store.connect();
  const password = await hashPassword(PASSWORD);
  const base = {
    active: true,
    password,
    version: 1,
    revision: 1,
    leaders: [],
    resourceId: "",
  };
  await store.bootstrapUser({
    ...base,
    _id: "manual-admin",
    username: ACCOUNTS.admin,
    name: "Sistem Yöneticisi",
    role: "admin",
  });
  // The demo manager and employee keep their scope; only the copy's
  // password changes.
  for (const username of [ACCOUNTS.manager, ACCOUNTS.normal]) {
    const user = await store.findUser({ username });
    await store.transaction((c) =>
      store.saveUser({ ...user, password, mustChangePassword: false }, c),
    );
  }
  await store.bootstrapUser({
    ...base,
    _id: "manual-proje",
    username: ACCOUNTS.projectEditor,
    name: "Proje Ofisi",
    role: "normal",
    projectEditor: true,
  });
  const server = http.createServer();
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const origin = "http://127.0.0.1:" + server.address().port;
  const app = createApp(store, { origin });
  server.on("request", app);
  return {
    origin,
    async showIdleWarning() {
      await store.transaction((c) =>
        c.query("UPDATE kp_sessions SET last_activity_at=@p0", [
          new Date(Date.now() - 26 * 60000).toISOString(),
        ]),
      );
    },
    async close() {
      app.locals.close();
      server.closeAllConnections();
      server.close();
      await store.close();
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const running = await startManualServer({
    port: Number(process.env.PORT) || 0,
  });
  console.log(running.origin);
  process.on("SIGINT", async () => {
    await running.close();
    process.exit(0);
  });
}
