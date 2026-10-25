import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { checkSecrets } from "../scripts/check-secrets.mjs";

test("shared ignore policy protects real env variants and keeps examples trackable in a clean repository", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aa-secrets-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  await fs.copyFile(
    new URL("../.gitignore", import.meta.url),
    path.join(root, ".gitignore"),
  );
  for (const name of [
    ".env",
    ".env.demo",
    ".env.local",
    ".env.production",
    ".env.mssql",
  ]) {
    await fs.writeFile(path.join(root, name), "SYNTHETIC_ONLY=1");
    execFileSync("git", ["check-ignore", "--quiet", name], { cwd: root });
  }
  await fs.writeFile(path.join(root, ".env.example"), "PASSWORD=\n");
  execFileSync("git", ["add", ".gitignore", ".env.example"], { cwd: root });
  assert.deepEqual(await checkSecrets(root), []);
  execFileSync("git", ["add", "--force", ".env.demo"], { cwd: root });
  assert(
    (await checkSecrets(root)).some((issue) => issue.file === ".env.demo"),
  );
  const synthetic = "ghp_" + "A".repeat(40);
  await fs.writeFile(path.join(root, "leak.js"), JSON.stringify(synthetic));
  execFileSync("git", ["add", "leak.js"], { cwd: root });
  const issues = await checkSecrets(root);
  assert(issues.some((issue) => issue.file === "leak.js"));
  assert(
    !JSON.stringify(issues).includes(synthetic),
    "a failed check must never echo its matched secret",
  );
});
