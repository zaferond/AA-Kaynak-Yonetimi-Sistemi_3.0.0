import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const patterns = [
  /\b(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  /\b(?:sk-(?:proj-)?[a-zA-Z0-9_-]{30,}|AIza[0-9A-Za-z_-]{30,})\b/,
];
const ENV_SECRET_KEYS = ["ADMIN_PASSWORD", "NEW_ADMIN_PASSWORD"];
/** Values of local password keys in root/.env (the file is never tracked). */
async function localEnvSecrets(root) {
  const text = await fs
    .readFile(path.join(root, ".env"), "utf8")
    .catch(() => "");
  const values = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || !ENV_SECRET_KEYS.includes(match[1])) continue;
    const value = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (value.length >= 8) values.push({ key: match[1], value });
  }
  return values;
}
export async function checkSecrets(root) {
  const envSecrets = await localEnvSecrets(root);
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const failures = [];
  for (const file of files) {
    const name = path.basename(file);
    if (name.startsWith(".env") && !/^\.env(?:\.[^.]+)*\.example$/.test(name)) {
      failures.push({ file, reason: "Tracked real environment file" });
      continue;
    }
    const stat = await fs.lstat(path.join(root, file)).catch(() => null);
    if (!stat?.isFile() || stat.size > 2_000_000) continue;
    const bytes = await fs.readFile(path.join(root, file));
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    if (patterns.some((pattern) => pattern.test(text)))
      failures.push({ file, reason: "Potential secret or private key" });
    for (const { key, value } of envSecrets)
      if (text.includes(value))
        failures.push({
          file,
          reason: "Local .env " + key + " value is tracked in",
        });
  }
  return failures;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const failures = await checkSecrets(process.cwd());
  // Never print a matched secret, even on failure.
  for (const { file, reason } of failures) console.error(reason + ": " + file);
  if (failures.length) process.exitCode = 1;
  else console.log("Tracked environment and secret-pattern checks passed.");
}
