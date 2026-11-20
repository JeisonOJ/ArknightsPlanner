# Arknights Planner

A private React and TypeScript resource planner for Global inventory and EN/CN goals. Each browser profile has its own IndexedDB. Only authentication reaches the server. Two operator identities use designated Japanese fan-kit stickers. Resource lists use original symbols. See [art sources and conditions](src/art/SOURCES.md).

## Run locally on Windows

Use Node.js 24 and PowerShell in the project directory.

```powershell
Set-Location C:\Dev\Codex\ArknightsPlanner
npm.cmd ci
Read-Host -MaskInput 'Shared password from your password manager' | npm.cmd run auth:setup
npm.cmd run dev
```

In PowerShell 7, use a strong randomly generated password of at least 20 characters. The masked prompt passes it to setup, which writes the salted scrypt verifier and an independent signing secret to the ignored `.env.local`. For an existing setup, start at `npm.cmd run dev`. Open the loopback address printed by Vite and enter the shared password. Use the same address, port and browser profile to access that inventory. Stop Vite with Ctrl+C.

## Verify and refresh

```powershell
npm.cmd test
npm.cmd run build
```

Build type-checks the frontend and packages assets in `dist/assets`. It moves the entry HTML to `server/app.html` for authenticated delivery. Use the development command for local use. Serving the dist folder alone cannot provide login.

The normal build uses the included catalog. `npm.cmd run catalog` explicitly regenerates it from the pin in [the extractor](scripts/catalog.mjs). To update, review a new commit, change the pin, regenerate, inspect the diff and run the tests. The script fetches only selected JSON, checks regional constants and writes the snapshot after successful processing.

- [Primary source](https://github.com/ArknightsAssets/ArknightsGamedata/tree/e0cd8f274ffbcf57ed0b0684cb681620478ffe0e). Both regional directories use `gamedata/excel/`. Character, patch, skill, module, favor, item and constant tables supply the factual fields.
- EN indicates client presence. CN-only entries have no assumed EN date. The separate confirmed Global label is curated from an [official EN notice](https://www.arknights.global/news/1695) and covers only the named subset.
- Raidian uses special progression. Three modules lack stage-cost arrays and are omitted. Unknown IDs in saved records survive a catalog change and remain in backups.

## Using the planner

1. Enter Global resource quantities in Inventory. Every planner section reads these balances.
2. Select an operator and enter current and target progression. Calculations begin at the start of the entered level. Mastery targets include their shared skill and promotion prerequisites once. Module plans budget module stages independently and show the unlock level, trust, and mission requirements. Alternate class forms share their base progression.
3. Use Modules to search, set a priority, or mark a stage complete. Operator and module views edit the same record. Resource tables show the comparison for the selected scope. Dashboard totals combine all operator requirements before subtracting inventory.
4. Search Skins by outfit, operator, codename or ID and filter by regional catalog presence. Add a match directly to the wishlist or enter a manual outfit. Set its OP price when known. Owned outfits release reservations. Unknown prices reserve zero until priced.
5. Add banner goals in preferred funding order. Each banner can add a manual income estimate in whole pull equivalents, available starting at its queue position. Dates are informational. Standard tickets, Orundum and optionally the remaining OP fund goals once in that order. Restricted pool tickets and recruitment permits contribute zero.
6. Export a JSON file from Settings & backups. Import validates the format, version, records and known operator limits before asking to replace the workspace atomically. A different browser or phone can restore the file manually.

## Import local artwork

1. From [ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource), save the folders `avatar/`, `portrait/`, `item/`, and `skin/` for the categories you want. For modules, use [Aceship’s equip/icon directory](https://github.com/Aceship/Arknight-Images/tree/main/equip/icon). Aceship's `avatars/`, `portraits/`, `items/`, and `characters/` are also supported. Keep the original filenames, including `#`.
2. Put the folders under one local directory. Open **Settings & backups → Artwork Library → Import folder** and choose that directory. Alternatively, ZIP the folders with their paths intact and choose **Import ZIP**. A repository ZIP with an enclosing directory also works, but a ZIP containing only the selected folders is smaller. PNG, JPEG, and WebP images up to 16 MiB per file are supported.
3. Review the summary for matches, skipped formats, and unmatched files. The importer matches exact catalog identifiers and uses the folder to distinguish a portrait from a full illustration. It prefers avatars, then base portraits, then verified alternate variants. Catalog entries and image packs can be from different revisions, so coverage can vary.
4. To update existing matches, enable **Replace matching artwork already in the library** before importing. Otherwise the import adds missing entries and keeps existing images. To empty the library, choose **Remove imported artwork** and confirm.

Artwork is stored as Blobs in a separate IndexedDB database in the current browser profile and origin. The planner reads visible images through temporary object URLs. The library has no server endpoint or synchronization. JSON backups contain planner records, so keep the original ZIP or folders to restore artwork on another browser. The resource mirrors contain copyrighted artwork. Use files you are permitted to use.

For full illustrations on Operators, reimport your existing `skin/` folder or ZIP. The importer uses the catalog's built-in evolution mapping and keeps each available phase under a separate key. Leave replacement off to fill missing images while retaining your current library. Outfit Preview opens a modal with fit, zoom and drag controls.

## Structure

| Path | Purpose |
|---|---|
| `src/catalog.json`, `src/catalog.ts` | Versioned, immutable game data and field types |
| `src/model.ts`, `src/calc.ts` | User records, backup checks, budgets and upgrade calculations |
| `src/db.ts` | Version 1 IndexedDB database and atomic read/modify/write transactions |
| `src/main.tsx`, `src/Operations.tsx`, `src/Budget.tsx`, `src/ui.tsx` | Navigation and planner screens |
| `api/`, `server/auth.mjs` | Production HTML gate, login, logout and session verification |
| `tests/` | Calculation, authentication and persistence checks |

## Publish from GitHub to Vercel

1. Create an empty private GitHub repository under the personal account linked to your Vercel Hobby team. The local preparation commit uses a project-only email. Before pushing, set this repository's author to your GitHub username and the exact GitHub-provided no-reply address from **GitHub → Settings → Emails**, so Vercel can associate the commit with its owner.

   ```powershell
   git config --local user.name '<github-username>'
   git config --local user.email '<github-provided-noreply-address>'
   git commit --amend --reset-author --no-edit
   git remote add origin '<repository-url>'
   git push -u origin main
   ```

   Amending the local commit changes its hash and preserves the verified file content. [Vercel Git author requirements](https://vercel.com/docs/deployments/troubleshoot-project-collaboration)
2. Generate independent production settings from PowerShell 7. Use a different strong password from your local one.

   ```powershell
   Read-Host -MaskInput 'Production shared password' | npm.cmd run auth:setup -- --production
   ```

3. In Vercel, import the GitHub repository. Select the root of the repository and Node 24. The repository config sets the Vite preset, `npm ci`, `npm run build`, and `dist`. Add the two values from the ignored `.env.vercel.local` to the **Production** environment in the Vercel project. Keep both server-side.

| Variable | Value |
|---|---|
| `PASSWORD_VERIFIER` | 32 hexadecimal salt characters, a colon, and the 128-character hexadecimal scrypt result generated by setup |
| `SESSION_SECRET` | Independent random signing key generated by setup |

4. Before sharing the production URL, open **Firewall → Configure → Custom Rules**. Add a fixed-window **Rate Limit** rule for **POST /api/login**. Count by IP, allow 8 requests in 10 minutes, and return HTTP 429. Apply the rule and verify it on the production origin. The application also limits attempts within each running function instance. [Vercel rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
5. On the final HTTPS URL, verify that a signed-out visitor sees sign-in, a valid password opens the app, logout restores sign-in, and reloading preserves a sample inventory entry. Confirm a signed-out request to `/api/app` shows sign-in and `/index.html` has no public application entry. Use a private browser window or test profile for the check.

The production cookie is signed, host-only, HttpOnly, Secure and SameSite=Strict, with a 12-hour lifetime. Logout clears it from the browser. If a session is compromised, rotating the signing secret invalidates issued cookies. The application HTML is private and uncached. JavaScript, CSS and catalog data are public build assets. Git and Vercel exclusions cover `ArknightsArtwork/`, local backup exports, and environment files.

### Transfer planner data to the production URL

Each person should export JSON from **Settings & backups** on their current browser origin, sign in at the final HTTPS URL, and import their JSON there. Import replaces the planner data at the destination, so export a copy there first if it has entries. Check inventory and a saved goal before relying on the new origin. Then reimport the original local artwork folders or ZIP from **Artwork Library** on that origin. JSON backups contain planner data. Artwork stays in the separate browser-local library.
