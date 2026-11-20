import { configured, valid, loginPage } from "../server/auth.mjs";
import { readFileSync } from "node:fs";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Same-origin form posts must retain their Origin for the CSRF check.
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join("; "),
  );
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  if (!configured()) {
    res.statusCode = 503;
    return res.end("Configure authentication to open this planner.");
  }
  res.end(
    valid(req.headers.cookie)
      ? readFileSync(process.cwd() + "/server/app.html", "utf8")
      : loginPage(req.url.includes("login=failed")),
  );
}
