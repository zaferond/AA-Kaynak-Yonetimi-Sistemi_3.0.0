import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

/** Keep raw and precompressed representations distinct in caches and ETags. */
export function staticSite(root) {
  const headers = (res, file) =>
    res.setHeader(
      "Cache-Control",
      file.endsWith(".html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    );
  const raw = express.static(root, {
    index: "index.html",
    dotfiles: "deny",
    setHeaders: headers,
  });
  const gzip = express.static(root, {
    index: false,
    dotfiles: "deny",
    setHeaders(res, file) {
      const original = file.slice(0, -3);
      headers(res, original);
      res.type(path.extname(original));
      res.setHeader("Content-Encoding", "gzip");
    },
  });
  return async (req, res, next) => {
    const pathname = req.path === "/" ? "/index.html" : req.path;
    // Only generated flat assets/HTML are candidates. express.static owns
    // all other paths, dotfile policy, decoding and traversal checks.
    if (
      !["GET", "HEAD"].includes(req.method) ||
      !/^\/(?:index\.html|assets\/[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.(?:js|css|svg))$/.test(
        pathname,
      )
    )
      return raw(req, res, next);
    res.vary("Accept-Encoding");
    if (req.acceptsEncodings("gzip", "identity") !== "gzip")
      return raw(req, res, next);
    try {
      const stat = await fs.stat(path.join(root, pathname.slice(1) + ".gz"));
      if (!stat.isFile()) return raw(req, res, next);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR")
        return raw(req, res, next);
      return next(error);
    }
    const original = req.url;
    req.url =
      pathname +
      ".gz" +
      (original.includes("?") ? original.slice(original.indexOf("?")) : "");
    gzip(req, res, (error) => {
      req.url = original;
      if (error) return next(error);
      res.removeHeader("Content-Encoding");
      raw(req, res, next);
    });
  };
}
