import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { gzipSync } from "node:zlib";
import express from "express";
import { staticSite } from "../backend/static-site.mjs";

test("precompressed static files honor negotiation, MIME, HEAD, variant ETags and traversal policy", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aa-static-site-"));
  await fs.mkdir(path.join(root, "assets"));
  const content = Buffer.from(
      'console.log("synthetic static fixture");'.repeat(20),
    ),
    gz = gzipSync(content);
  await fs.writeFile(path.join(root, "assets", "app.123abc.js"), content);
  await fs.writeFile(path.join(root, "assets", "app.123abc.js.gz"), gz);
  await fs.writeFile(path.join(root, "index.html"), "<html>synthetic</html>");
  await fs.writeFile(
    path.join(root, "index.html.gz"),
    gzipSync("<html>synthetic</html>"),
  );
  await fs.writeFile(
    path.join(root, "assets", "style.123abc.css"),
    "body{color:red}",
  );
  await fs.writeFile(path.join(root, ".env"), "synthetic-only");
  const app = express();
  app.use(staticSite(root));
  app.use((_req, res) => res.sendStatus(404));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const request = (url, headers = {}, method = "GET") =>
    new Promise((resolve, reject) => {
      const r = http.request(
        {
          hostname: "127.0.0.1",
          port: server.address().port,
          path: url,
          headers,
          method,
        },
        (res) => {
          const chunks = [];
          res.on("data", (x) => chunks.push(x));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      r.on("error", reject);
      r.end();
    });
  const compressed = await request("/assets/app.123abc.js?x=1", {
    "Accept-Encoding": "gzip",
  });
  assert.equal(compressed.status, 200);
  assert.equal(compressed.headers["content-encoding"], "gzip");
  assert.match(compressed.headers["content-type"], /javascript/);
  assert.match(compressed.headers.vary, /Accept-Encoding/);
  assert.deepEqual(compressed.body, gz);
  assert.match(compressed.headers["cache-control"], /immutable/);
  const raw = await request("/assets/app.123abc.js", {
    "Accept-Encoding": "gzip;q=0, identity;q=1",
  });
  assert.equal(raw.headers["content-encoding"], undefined);
  assert.deepEqual(raw.body, content);
  assert.match(raw.headers.vary, /Accept-Encoding/);
  assert.deepEqual((await request("/assets/app.123abc.js")).body, content);
  const head = await request(
    "/assets/app.123abc.js",
    { "Accept-Encoding": "gzip" },
    "HEAD",
  );
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(Number(head.headers["content-length"]), gz.length);
  assert.equal(
    (
      await request("/assets/app.123abc.js", {
        "Accept-Encoding": "gzip",
        "If-None-Match": compressed.headers.etag,
      })
    ).status,
    304,
  );
  assert.equal(
    (
      await request("/assets/app.123abc.js", {
        "Accept-Encoding": "identity",
        "If-None-Match": compressed.headers.etag,
      })
    ).status,
    200,
  );
  const html = await request("/", { "Accept-Encoding": "gzip" });
  assert.equal(html.headers["content-encoding"], "gzip");
  assert.match(html.headers["content-type"], /html/);
  assert.equal(html.headers["cache-control"], "no-cache");
  const fallback = await request("/assets/style.123abc.css", {
    "Accept-Encoding": "gzip",
  });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers["content-encoding"], undefined);
  assert.match(fallback.headers["content-type"], /css/);
  for (const url of ["/.env", "/assets/%2e%2e/.env", "/assets/missing.abc.js"])
    assert.equal(
      (await request(url, { "Accept-Encoding": "gzip" })).status,
      404,
    );
});
