import { defineConfig } from "vite";

export default defineConfig({
  build: {
    license: { fileName: "third-party-licenses.md" },
  },
  server: {
    fs: {
      deny: [
        "**/.env*",
        "**/*.{env,pem,key,crt,p12,pfx,db,zip,bak,backup}",
        "**/*.env.*",
        "**/*.backup.*",
        "**/.git/**",
        "**/ArknightsArtwork/**",
        "**/backups/**",
        "**/local-data/**",
        "**/arknights-planner-*.json",
      ],
    },
  },
});
