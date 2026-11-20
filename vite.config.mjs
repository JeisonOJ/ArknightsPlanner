import { defineConfig, loadEnv } from "vite";
import { renameSync } from "node:fs";
import { authenticate, configured, valid, loginPage } from "./server/auth.mjs";
export default defineConfig(({ mode, command }) => {
  if (command === "serve") {
    const env = loadEnv(mode, process.cwd(), "");
    for (const k of ["PASSWORD_VERIFIER", "SESSION_SECRET"])
      if (env[k]) process.env[k] = env[k];
  }
  return {
    server: {
      fs: {
        allow: [process.cwd()],
        deny: [
          "**/.env*",
          "**/*.{env,pem,key,crt,p12,pfx,db}",
          "**/*.env.*",
          "**/.git/**",
          "**/ArknightsArtwork/**",
          "**/backups/**",
          "**/local-data/**",
          "**/arknights-planner-*.json",
        ],
      },
    },
    plugins: [
      {
        name: "planner-auth",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (
              !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
                req.socket.remoteAddress,
              ) ||
              !/^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i.test(
                req.headers.host ?? "",
              )
            ) {
              res.writeHead(403);
              return res.end();
            }
            const path = req.url?.split("?")[0];
            if (path === "/api/login" || path === "/api/logout")
              return authenticate(req, res, path.slice(5), true).catch(next);
            if (!configured()) {
              res.writeHead(503);
              return res.end(
                "Run npm run auth:setup and restart the development server.",
              );
            }
            if (valid(req.headers.cookie, Date.now(), true)) return next();
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            });
            res.end(loginPage(req.url.includes("login=failed")));
          });
        },
        closeBundle() {
          if (command === "build")
            renameSync("dist/index.html", "server/app.html");
        },
      },
    ],
  };
});
