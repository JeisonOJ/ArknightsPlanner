import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import config from "../vercel.json" with { type: "json" };

test("the production build serves a public static entry without bundled artwork", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "arknights-public-build-"));
  t.after(() => rm(output, { recursive: true }));
  const root = fileURLToPath(new URL("..", import.meta.url));
  const vite = join(root, "node_modules", "vite", "bin", "vite.js");
  await promisify(execFile)(
    process.execPath,
    [vite, "build", "--outDir", output],
    { cwd: root, timeout: 30_000 },
  );

  const html = await readFile(join(output, "index.html"), "utf8");
  assert.match(html, /<div id="root">/);
  assert.match(html, /src="\/assets\/[^"]+\.js"/);
  assert.doesNotMatch(html, /type="password"|\/api\/login/);
  assert.equal(config.functions, undefined);
  assert.equal(config.rewrites, undefined);

  const assets = await readdir(join(output, "assets"));
  assert(assets.every((path) => /\.(js|css)$/.test(path)));
});
