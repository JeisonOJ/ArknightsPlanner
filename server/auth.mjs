import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isIP } from "node:net";
const derive = promisify(scrypt);
const attempts = new Map();
const ttl = 12 * 3600;
const attemptWindow = 600000;
const bodyLimit = 2048;
const cookieName = (local) =>
  local ? "planner_session" : "__Host-planner_session";
export function configured() {
  return (
    /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.PASSWORD_VERIFIER || "") &&
    (process.env.SESSION_SECRET || "").length >= 32
  );
}
export function mint(now = Date.now()) {
  const payload =
    Math.floor(now / 1000) + ttl + "." + randomBytes(16).toString("hex");
  return payload + "." + signature(payload);
}
function signature(payload) {
  return createHmac("sha256", process.env.SESSION_SECRET)
    .update(payload)
    .digest("hex");
}
export function valid(cookie = "", now = Date.now(), local = false) {
  const prefix = cookieName(local) + "=";
  const cookies = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  const token =
    cookies.length === 1 &&
    cookies[0]
      .slice(prefix.length)
      .match(/^(\d{10}\.[a-f0-9]{32})\.([a-f0-9]{64})$/);
  return Boolean(
    configured() &&
      token &&
      Number(token[1].split(".")[0]) > now / 1000 &&
      timingSafeEqual(Buffer.from(signature(token[1])), Buffer.from(token[2])),
  );
}
export async function authenticate(req, res, action, local = false) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST" });
    return res.end();
  }
  if (req.url.split("?")[0] !== "/api/" + action) {
    res.writeHead(404);
    return res.end();
  }
  if (!configured()) {
    res.writeHead(503);
    return res.end("Authentication needs configuration.");
  }
  const origin = (local ? "http://" : "https://") + req.headers.host;
  if (req.headers.origin !== origin) {
    res.writeHead(403);
    return res.end("Invalid request origin.");
  }
  const logout = action === "logout";
  let value = "";
  if (!logout) {
    if (
      req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
      "application/x-www-form-urlencoded"
    ) {
      res.writeHead(415);
      return res.end("Use the planner sign-in form.");
    }
    if (Number(req.headers["content-length"]) > bodyLimit) {
      res.writeHead(413);
      return res.end();
    }
    const forwarded = String(
      req.headers["x-vercel-forwarded-for"] ?? "",
    ).trim();
    const ip =
      !local && process.env.VERCEL === "1" && isIP(forwarded)
        ? forwarded
        : req.socket.remoteAddress;
    const now = Date.now();
    for (const [key, entry] of attempts)
      if (entry.until <= now) attempts.delete(key);
    const entry = attempts.get(ip) || { count: 0, until: now + attemptWindow };
    if (entry.count >= 8) {
      res.writeHead(429, {
        "Retry-After": Math.ceil((entry.until - now) / 1000),
      });
      return res.end("Too many attempts. Try again in ten minutes.");
    }
    // Reserve the attempt before reading the body or awaiting the password hash.
    entry.count++;
    attempts.set(ip, entry);
    const body = await readLoginForm(req);
    if (body === null) {
      res.writeHead(413);
      return res.end();
    }
    const [salt, hex] = process.env.PASSWORD_VERIFIER.split(":");
    const hash = await derive(
      new URLSearchParams(body).get("password") || "",
      salt,
      64,
    );
    if (!timingSafeEqual(hash, Buffer.from(hex, "hex"))) {
      res.writeHead(303, { Location: "/?login=failed" });
      return res.end();
    }
    if (attempts.get(ip) === entry) attempts.delete(ip);
    value = mint();
  }
  res.writeHead(303, {
    Location: "/",
    "Cache-Control": "no-store",
    "Set-Cookie":
      cookieName(local) +
      "=" +
      value +
      "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
      (logout ? 0 : ttl) +
      (local ? "" : "; Secure"),
  });
  res.end();
}

async function readLoginForm(req) {
  const parsed = req.body;
  if (parsed !== undefined) {
    const body =
      typeof parsed === "string"
        ? parsed
        : new URLSearchParams(parsed).toString();
    return Buffer.byteLength(body) <= bodyLimit ? body : null;
  }
  const chunks = [];
  let bytes = 0;
  const stream = req.iterator({ destroyOnReturn: false });
  for await (const chunk of stream) {
    bytes += chunk.length;
    if (bytes > bodyLimit) {
      req.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function loginPage(failed = false) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Arknights Planner</title><style>*{box-sizing:border-box}body{margin:0;background:#10161c;color:#eff5f9;font:16px system-ui;min-height:100vh;display:grid;place-items:center;background-image:linear-gradient(#202a3233 1px,transparent 1px),linear-gradient(90deg,#202a3233 1px,transparent 1px);background-size:36px 36px}main{width:min(92%,440px);padding:38px;background:#182129;border:1px solid #3d4d59;border-top:4px solid #ecc95a}small{color:#e8ca67;letter-spacing:.16em}h1{font-size:36px;margin:18px 0 32px}input,button{font:inherit;width:100%;padding:13px;margin-top:8px;border-radius:5px}input{color:white;background:#10181e;border:1px solid #607482}button{margin-top:18px;border:0;background:#efd16e;font-weight:bold;color:#151b20;cursor:pointer}p{color:#f2af8b}</style><main><small>PRIVATE WORKSPACE</small><h1>Arknights Planner</h1><form method="post" action="/api/login"><label>Shared password<input name="password" type="password" autocomplete="current-password" required autofocus maxlength="256"></label>${failed ? "<p>Incorrect password. Try again.</p>" : ""}<button>Sign in</button></form></main></html>`;
}
