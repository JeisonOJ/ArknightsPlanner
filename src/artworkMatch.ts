import { catalog } from "./catalog.ts";

export type ArtworkKind =
  | "operator"
  | "operatorArt"
  | "item"
  | "module"
  | "outfit"
  | "illustration";
type Match = { key: string; kind: ArtworkKind; rank: number };
const aliases = new Map<string, Match[]>();
function alias(
  kind: ArtworkKind,
  id: string,
  rank: number,
  folders: string[],
  names: (string | null)[],
) {
  for (const name of new Set(names.filter(Boolean))) {
    for (const folder of folders) {
      const path = folder + "/" + name!.toLowerCase();
      const matches = aliases.get(path) ?? [];
      matches.push({ kind, key: kind + ":" + id, rank });
      aliases.set(path, matches);
    }
  }
}
for (const op of catalog.operators) {
  for (const art of op.artwork) {
    alias(
      "operatorArt",
      op.id + ":" + (art.phase ?? "form"),
      20,
      ["skin", "characters", ""],
      [art.portraitId + "b", art.illustrationId],
    );
  }
  alias("operator", op.id, 30, ["avatar", "avatars"], [op.id]);
  alias(
    "operator",
    op.id,
    20,
    ["portrait", "portraits", "characters", ""],
    [op.portraitId, op.id + "_1"],
  );
  alias(
    "operator",
    op.id,
    10,
    ["avatar", "avatars", "portrait", "portraits", "characters", ""],
    [op.id + "_2"],
  );
  alias("operator", op.id, 15, [""], [op.id]);
}
for (const item of catalog.items)
  alias(
    "item",
    item.id,
    20,
    ["item", "items", "material", ""],
    [item.iconId, item.id],
  );
for (const op of catalog.operators)
  for (const module of op.modules)
    alias("module", module.id, 20, ["icon", ""], [module.id, module.iconId]);
for (const outfit of catalog.outfits) {
  const name = outfit.portraitId;
  alias("outfit", outfit.id, 30, ["avatar", "avatars"], [name, outfit.id]);
  alias(
    "outfit",
    outfit.id,
    20,
    ["portrait", "portraits", "characters", ""],
    [name, outfit.id],
  );
  alias(
    "outfit",
    outfit.id,
    10,
    ["avatar", "avatars", "portrait", "portraits"],
    [name && "sp_" + name],
  );
  alias(
    "illustration",
    outfit.id,
    20,
    ["skin", "characters", ""],
    [outfit.illustrationId, name && name + "b"],
  );
  alias(
    "illustration",
    outfit.id,
    10,
    ["skin", "characters", ""],
    [name && name + "_spb", name && name + "+b"],
  );
}
const knownFolders = new Set([
  "avatar",
  "avatars",
  "portrait",
  "portraits",
  "characters",
  "item",
  "items",
  "material",
  "skin",
  "icon",
]);
const unsupportedImages = /\.(gif|svg|bmp|tiff?|ico|dds|avif|heic|ktx2)$/i;
export function classifyArtwork(path: string) {
  const parts = path.replaceAll("\\", "/").toLowerCase().split("/");
  const filename = parts.pop() ?? "";
  const extension = filename.match(/\.(png|jpe?g|webp)$/)?.[1];
  if (!extension)
    return {
      status: unsupportedImages.test(filename) ? "unsupported" : "ignored",
    } as const;
  const folder = parts.at(-1) ?? "";
  const context = knownFolders.has(folder) ? folder : "";
  const entries =
    aliases.get(context + "/" + filename.slice(0, -extension.length - 1)) ?? [];
  const keys = new Set(entries.map((entry) => entry.key));
  if (keys.size !== 1) return { status: "unmatched" } as const;
  return {
    status: "matched",
    match: entries.reduce((first, next) =>
      next.rank > first.rank ? next : first,
    ),
    mime:
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg",
  } as const;
}
export function compareArtwork(
  a: { path: string; rank: number },
  b: { path: string; rank: number },
) {
  return b.rank - a.rank || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
