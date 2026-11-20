import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { valid } from "../server/auth.mjs";
import app from "../api/app.js";
import loginHandler from "../api/login.js";
import logoutHandler from "../api/logout.js";
const password = randomBytes(20).toString("hex"),
  salt = randomBytes(16).toString("hex");
process.env.PASSWORD_VERIFIER =
  salt + ":" + scryptSync(password, salt, 64).toString("hex");
process.env.SESSION_SECRET = randomBytes(48).toString("hex");
function response() {
  return {
    headers: {},
    writeHead(status, headers = {}) {
      this.status = status;
      Object.assign(this.headers, headers);
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(body) {
      this.body = body;
    },
  };
}
async function post(path, body, headers = {}) {
  const res = response();
  const handler = path.startsWith("/api/logout") ? logoutHandler : loginHandler;
  await handler(
    {
      method: "POST",
      url: path,
      headers: {
        origin: "https://planner.test",
        host: "planner.test",
        "content-type": "application/x-www-form-urlencoded",
        ...headers,
      },
      socket: { remoteAddress: "localhost" },
      body,
    },
    res,
  );
  return res;
}
test("production login signs an expiring secure cookie and logout clears it", async () => {
  const login = await post("/api/login", { password });
  const cookie = login.headers["Set-Cookie"];
  assert.equal(login.status, 303);
  assert.match(cookie, /^__Host-planner_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert(valid(cookie));
  assert(!valid(cookie, Date.now() + 13 * 3600000));
  assert(!valid(cookie.replace(/=\d/, "=0")));
  assert(!valid(cookie.replace("__Host-", "")));
  assert(!valid(cookie + "; " + cookie));
  const logout = await post("/api/logout", {}, { cookie });
  assert.match(logout.headers["Set-Cookie"], /Max-Age=0/);
});
test("application requires authentication and fails closed without secrets", () => {
  const res = response();
  app({ method: "GET", url: "/", headers: {} }, res);
  assert.match(res.body, /Shared password/);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(res.headers["Referrer-Policy"], "same-origin");
  assert.match(
    res.headers["Content-Security-Policy"],
    /frame-ancestors 'none'/,
  );
  const key = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  app({ method: "GET", url: "/", headers: {} }, res);
  assert.equal(res.statusCode, 503);
  process.env.SESSION_SECRET = key;
});
test("login limits concurrent attempts and rejects cross-origin requests and aliases", async () => {
  assert.equal(
    (await post("/api/login", { password }, { origin: "https://other.test" }))
      .status,
    403,
  );
  assert.equal((await post("/api/login/", { password })).status, 404);
  assert.equal(
    (
      await post(
        "/api/login",
        { password },
        { "content-type": "application/json" },
      )
    ).status,
    415,
  );
  assert.equal(
    (await post("/api/login", { password }, { "content-length": "2049" }))
      .status,
    413,
  );
  const attempts = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      post(
        "/api/login",
        { password: "incorrect" },
        { "x-vercel-forwarded-for": "10.0.0." + (i + 1) },
      ),
    ),
  );
  assert.equal(
    attempts.filter((res) => res.headers.Location === "/?login=failed").length,
    8,
  );
  assert.equal(
    attempts.filter(
      (res) => res.status === 429 && Number(res.headers["Retry-After"]) > 0,
    ).length,
    2,
  );
  assert.equal(
    (await post("/api/login", { password: "incorrect" })).status,
    429,
  );
});
