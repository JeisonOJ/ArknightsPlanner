# ArknightsPlanner

ArknightsPlanner is a personal hobby project for Arknights players who want to plan upgrades, track supplies, and budget pulls and outfits in one place. I built it for my own use and share it freely with the community.

## Try It Online

[Open ArknightsPlanner](https://arknights-planner-nine.vercel.app). It is free to use and requires no account or password.

Your inventory, plans, wishlist, and imported artwork stay in IndexedDB in your browser. Each browser profile and site address has its own workspace. There is no cloud synchronization. Export a JSON backup regularly, especially before clearing site data or moving to another device.

## Features

- **Dashboard and inventory** — enter owned materials and battle records, then see total upgrade requirements and what you are short of.
- **Operators** — plan levels, promotions, shared skill ranks, and masteries. The Active goals filter shows operators with progression targets.
- **Modules** — plan stages independently of operator progression, set priorities, and review unlock levels, trust, and missions.
- **Pull Planner** — order banner goals, add estimated income, and see exact Orundum shortages. Use eligible tickets and optionally the Originite Prime (OP) left after skin reservations.
- **Skins** — search the outfit catalog, add catalog or manual wishlist entries, and reserve OP for priced outfits. Imported artwork enables previews where matching images are available.
- **EN and CN catalogs** — see entries from both clients. EN indicates presence in the EN client data, and the separate Global confirmed label covers a curated subset of official announcements. CN-only entries have no projected Global release date. Special progression costs for Raidian and modules with incomplete stage costs are unavailable.
- **Backup and restore** — export or import planner JSON under **Settings & backups**. Restore replaces the destination workspace after validation and confirmation. Keep a backup of any existing data at that destination.

## Artwork and Game Assets

The current source and hosted application ship without copyrighted Arknights artwork. The planner uses original symbols and initials until you import your own compatible images.

Go to **Settings & backups → Artwork Library** and choose **Import folder** or **Import ZIP**. Use images you have permission to use, and retain the original filenames, including characters such as `#`. The importer supports PNG, JPEG, and WebP up to 16 MiB per image and matches catalog filenames within recognized folders. A ZIP can include an enclosing directory. Keep the relevant folders and filenames intact.

| Images | Example paths and recognized folders |
| --- | --- |
| Operator and outfit thumbnails | `avatar/`, `portrait/`, `avatars/`, `portraits/`, `characters/` |
| Operator and outfit illustrations | `skin/`, `characters/` |
| Resource icons | `item/`, `items/`, `material/` |
| Module icons | `equip/icon/` (the immediate parent is `icon/`) |

The import summary shows matches, unsupported files, and failures. Imports retain existing matches unless you enable **Replace matching artwork already in the library**. Artwork stays in a separate browser-local library and is excluded from planner JSON backups. Keep your original folder or ZIP if you want to reimport the images on another device.

## Local Development

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the loopback URL printed by Vite. The build runs the TypeScript check and writes the static site to `dist/`. The project requires no environment variables. The existing Vercel project builds automatically from pushes to `main` using [the checked-in configuration](vercel.json).

The build uses the checked-in catalog snapshot. `npm run catalog` is a separate maintainer command that regenerates the snapshot from the upstream revision pinned in [the extractor](scripts/catalog.mjs).

## AI-Assisted Development

AI assisted with implementation and testing. I set the project’s direction, make the project decisions, and review changes.

## ☕ Support the Project

ArknightsPlanner is a personal hobby project, developed with the assistance of artificial intelligence and shared freely with the community.

If you find it useful and would like to support its development, you can buy me a coffee. Any contribution is greatly appreciated and entirely voluntary!

☕ [Support me on Ko-fi](https://ko-fi.com/jeisonoj)

Your support motivates me to keep learning, improving my projects, and sharing new ideas with the community.

## Disclaimer and Acknowledgments

ArknightsPlanner is an unofficial fan project. It is unaffiliated with and has no endorsement from Hypergryph, Yostar, or the creators of Arknights. Game names, artwork, and other game assets remain the property of their respective rights holders.

The catalog snapshot comes from [ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata), with a curated Global release label informed by an [official EN notice](https://www.arknights.global/news/1695). The optional artwork importer recognizes naming and folder conventions used by [ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource) and [Aceship’s Arknight-Images](https://github.com/Aceship/Arknight-Images). Those repositories are references for compatibility and do not grant permission to redistribute game artwork.

## License

ArknightsPlanner’s original source code is licensed under the [MIT License](LICENSE).

Arknights game names, trademarks, artwork, the upstream data represented in the catalog snapshot, and other third-party materials remain subject to their respective owners’ rights and terms and are outside the scope of this license. ArknightsPlanner is an unofficial fan project and has no affiliation with or endorsement from the rights holders. The build includes [license notices for bundled dependencies](https://arknights-planner-nine.vercel.app/third-party-licenses.md).
