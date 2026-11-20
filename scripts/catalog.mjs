// Run explicitly to refresh the checked-in planner data. Normal builds work offline.
import { mkdir, rename, writeFile } from "node:fs/promises";

const revision = "e0cd8f274ffbcf57ed0b0684cb681620478ffe0e";
const repository = "ArknightsAssets/ArknightsGamedata";
const officialNotice = "https://www.arknights.global/news/1695";
const confirmedNames = new Set([
  "Exusiai the New Covenant",
  "Lemuen",
  "Texas the Omertosa",
  "Specter the Unchained",
  "Nearl the Radiant Knight",
]);
const professions = {
  PIONEER: "Vanguard",
  WARRIOR: "Guard",
  TANK: "Defender",
  SNIPER: "Sniper",
  CASTER: "Caster",
  MEDIC: "Medic",
  SUPPORT: "Supporter",
  SPECIAL: "Specialist",
};

async function table(region, file) {
  const path = `${region}/gamedata/excel/${file}.json`;
  const response = await fetch(
    `https://raw.githubusercontent.com/${repository}/${revision}/${path}`,
  );
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
// Some empty source arrays are serialized as empty objects.
function list(rows) {
  if (rows == null || Object.keys(rows).length === 0) return [];
  if (!Array.isArray(rows)) throw new Error("Unexpected non-list source value");
  return rows;
}
function costs(rows) {
  return list(rows).map(({ id, count }) => {
    if (!id || !Number.isSafeInteger(count) || count <= 0)
      throw new Error("Unexpected cost row");
    return { id, count };
  });
}
function phase(value) {
  if (!/^PHASE_[012]$/.test(value))
    throw new Error("Unexpected phase: " + value);
  return Number(value.slice(-1));
}
function steps(rows, key) {
  return list(rows).map((row) => ({
    phase: phase(row.unlockCond.phase),
    level: row.unlockCond.level,
    cost: costs(row[key]),
  }));
}
async function regionData(region) {
  const [chars, patch, skills, equip, favor, items, constants, skins] =
    await Promise.all(
      [
        "character_table",
        "char_patch_table",
        "skill_table",
        "uniequip_table",
        "favor_table",
        "item_table",
        "gamedata_const",
        "skin_table",
      ].map((name) => table(region, name)),
    );
  const baseIds = new Map(
    Object.entries(patch.infos).flatMap(([base, info]) =>
      info.tmplIds.map((id) => [id, base]),
    ),
  );
  const trust = new Map(
    favor.favorFrames.map((frame) => [
      frame.data.favorPoint,
      frame.data.percent,
    ]),
  );
  const modules = new Map();
  for (const m of Object.values(equip.equipDict)) {
    if (m.type === "INITIAL" || !m.itemCost) continue;
    const owner = m.tmplId || m.charId;
    const stages = Object.keys(m.itemCost).sort(
      (a, b) => Number(a) - Number(b),
    );
    if (
      !stages.length ||
      stages.some(
        (stage, index) =>
          Number(stage) !== index + 1 || !Array.isArray(m.itemCost[stage]),
      )
    ) {
      console.warn(
        "Skipping module without complete cost arrays:",
        region,
        m.uniEquipId,
      );
      continue;
    }
    const entry = {
      id: m.uniEquipId,
      name: m.uniEquipName,
      designation: [m.typeName1, m.typeName2].filter(Boolean).join("-") || null,
      iconId: m.uniEquipIcon || null,
      region: region.toUpperCase(),
      phase: phase(m.unlockEvolvePhase),
      level: m.unlockLevel,
      trust: stages.map((stage) => {
        const value = trust.get(m.unlockFavors[stage]);
        if (value === undefined)
          throw new Error("Unknown trust threshold for " + m.uniEquipId);
        return value;
      }),
      costs: stages.map((stage) => costs(m.itemCost[stage])),
      missions: list(m.missionList),
    };
    if (!modules.has(owner)) modules.set(owner, []);
    modules.get(owner).push(entry);
  }
  const operators = Object.entries({ ...chars, ...patch.patchChars })
    .filter(
      ([id, ch]) =>
        id.startsWith("char_") &&
        !ch.isNotObtainable &&
        Object.hasOwn(professions, ch.profession),
    )
    .map(([id, ch]) => ({
      id,
      baseId: baseIds.get(id) ?? id,
      name: ch.name,
      cnName: region === "cn" ? ch.name : "",
      appellation: ch.appellation?.trim() || null,
      artwork: operatorArtwork(skins, id, baseIds.get(id)),
      portraitId:
        skins.charSkins[
          skins.buildinEvolveMap[id]?.[0] ??
            skins.buildinPatchMap[baseIds.get(id)]?.[id]
        ]?.portraitId || null,
      profession: professions[ch.profession],
      region: region.toUpperCase(),
      confirmedGlobal: region === "en" && confirmedNames.has(ch.name),
      // Raidian advances through Integrated Strategies rewards. Its empty upgrade
      // cost arrays cannot be priced using normal six-star promotion constants.
      standardProgression: id !== "char_4195_radian",
      rarity: Number(ch.rarity.slice(-1)),
      phases: ch.phases.map((p) => ({
        maxLevel: p.maxLevel,
        cost: costs(p.evolveCost),
      })),
      ranks: steps(ch.allSkillLvlup, "lvlUpCost"),
      skills: list(ch.skills)
        .filter((s) => s.skillId)
        .map((s) => ({
          id: s.skillId,
          name: skills[s.skillId]?.levels?.[0]?.name ?? s.skillId,
          mastery: steps(s.levelUpCostCond, "levelUpCost"),
        })),
      modules: modules.get(id) ?? [],
    }));
  const operatorIds = new Set(operators.map((op) => op.id));
  const outfits = Object.values(skins.charSkins)
    .filter(
      (s) => s.displaySkin?.skinName && operatorIds.has(s.tmplId || s.charId),
    )
    .map((s) => ({
      id: s.skinId,
      operatorId: s.tmplId || s.charId,
      name: s.displaySkin.skinName,
      cnName: region === "cn" ? s.displaySkin.skinName : "",
      region: region.toUpperCase(),
      portraitId: s.portraitId || null,
      illustrationId: s.illustId || null,
      price: null,
    }));
  return { operators, items, constants, outfits };
}
function mergeOperators(en, cn) {
  const combined = new Map(cn.map((op) => [op.id, op]));
  for (const op of en) {
    const other = combined.get(op.id);
    const modules = new Map((other?.modules ?? []).map((m) => [m.id, m]));
    for (const mod of op.modules) modules.set(mod.id, mod);
    combined.set(op.id, {
      ...op,
      cnName: other?.name ?? "",
      modules: [...modules.values()],
    });
  }
  return [...combined.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
}
function operatorArtwork(skins, id, baseId) {
  const builtIn = Object.entries(skins.buildinEvolveMap[id] ?? {});
  const formSkin = skins.buildinPatchMap[baseId]?.[id];
  if (!builtIn.length && formSkin) builtIn.push(["form", formSkin]);
  const portraits = new Set();
  return builtIn.flatMap(([phase, skinId]) => {
    const skin = skins.charSkins[skinId];
    if (!skin?.portraitId || portraits.has(skin.portraitId)) return [];
    portraits.add(skin.portraitId);
    return [
      {
        phase: phase === "form" ? null : Number(phase),
        portraitId: skin.portraitId,
        illustrationId: skin.illustId || null,
      },
    ];
  });
}
const en = await regionData("en");
const cn = await regionData("cn");
const operators = mergeOperators(en.operators, cn.operators);
const outfitsById = new Map(cn.outfits.map((s) => [s.id, s]));
for (const outfit of en.outfits) {
  const other = outfitsById.get(outfit.id);
  if (other && other.operatorId !== outfit.operatorId) {
    throw new Error("Regional outfit ownership differs: " + outfit.id);
  }
  outfitsById.set(outfit.id, { ...outfit, cnName: other?.name ?? "" });
}
const currencies = new Set(["4001", "4002", "4003", "7001", "7003", "7004"]);
const needed = new Set([
  ...currencies,
  ...Object.keys(en.items.expItems),
  ...Object.keys(cn.items.expItems),
]);
for (const op of operators) {
  const costs = [
    ...op.phases,
    ...op.ranks,
    ...op.skills.flatMap((s) => s.mastery),
  ].flatMap((step) => step.cost);
  for (const row of [...costs, ...op.modules.flatMap((m) => m.costs.flat())])
    needed.add(row.id);
}
function category(id, exp) {
  if (exp) return "Battle records";
  if (currencies.has(id)) return "Currency & permits";
  if (/^330[123]$/.test(id)) return "Skill summaries";
  if (id.startsWith("mod_")) return "Module materials";
  return "Upgrade materials";
}
const items = [...needed].sort().map((id) => {
  const source = en.items.items[id] ?? cn.items.items[id];
  const exp = (en.items.expItems[id] ?? cn.items.expItems[id])?.gainExp ?? 0;
  return {
    id,
    name: source?.name ?? id,
    category: category(id, exp),
    exp,
    iconId: source?.iconId || null,
  };
});
for (const key of [
  "characterExpMap",
  "characterUpgradeCostMap",
  "evolveGoldCost",
]) {
  if (JSON.stringify(en.constants[key]) !== JSON.stringify(cn.constants[key]))
    throw new Error("Regional constants differ: " + key);
}
const catalog = {
  version: 3,
  revision,
  repository,
  globalNotice: officialNotice,
  operators,
  items,
  outfits: [...outfitsById.values()].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  ),
  exp: en.constants.characterExpMap,
  levelLmd: en.constants.characterUpgradeCostMap,
  promotionLmd: en.constants.evolveGoldCost,
};
const target = new URL("../src/catalog.json", import.meta.url);
await mkdir(new URL(".", target), { recursive: true });
const temporary = new URL("catalog.pending.json", target);
await writeFile(temporary, JSON.stringify(catalog) + "\n");
await rename(temporary, target);
console.log(
  `Prepared ${operators.length} operator forms, ${operators.flatMap((op) => op.modules).length} modules, ${items.length} items at ${revision}`,
);
