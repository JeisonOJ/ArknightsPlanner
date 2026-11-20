import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
const file = process.argv.includes("--production")
  ? ".env.vercel.local"
  : ".env.local";
if (existsSync(file))
  throw Error(file + " already exists. Existing credentials were kept.");
if (process.stdin.isTTY)
  throw Error(
    "Pipe a masked password prompt into this command. See the README.",
  );
process.stdin.setEncoding("utf8");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 258) throw Error("Password is too long.");
}
const password = input.replace(/\r?\n$/, "");
if (
  password.length < 20 ||
  password.length > 256 ||
  /[\r\n]/.test(password) ||
  new URLSearchParams({ password }).toString().length > 2048
)
  throw Error(
    "Use a strong single-line password between 20 and 256 characters that fits the sign-in form.",
  );
const salt = randomBytes(16).toString("hex");
writeFileSync(
  file,
  "PASSWORD_VERIFIER=" +
    salt +
    ":" +
    scryptSync(password, salt, 64).toString("hex") +
    "\nSESSION_SECRET=" +
    randomBytes(48).toString("hex") +
    "\n",
  { flag: "wx", mode: 0o600 },
);
console.log("Saved the server-side settings to " + file + ".");
