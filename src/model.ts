export type Pair = { current: number; target: number };
export type Priority = "A" | "B" | "C" | "D";
export type Progress = {
  phase: Pair;
  level: Pair;
  rank: Pair;
  skills: Record<string, Pair>;
  modules: Record<string, Pair & { priority: Priority }>;
};
export type Banner = {
  id: string;
  name: string;
  operators: string[];
  pulls: number;
  date: string;
  income: number;
};
export type Skin = {
  id: string;
  name: string;
  operator: string;
  skinId: string;
  price: number | null;
  owned: boolean;
  reserve: boolean;
  release: string;
};
export type State = {
  inventory: Record<string, number>;
  operators: Record<string, Progress>;
  banners: Banner[];
  skins: Skin[];
  settings: { usePrime: boolean };
};
export const pair = (n = 0): Pair => ({ current: n, target: n });
export const progress = (): Progress => ({
  phase: pair(),
  level: pair(1),
  rank: pair(1),
  skills: {},
  modules: {},
});
export const empty = (): State => ({
  inventory: {},
  operators: {},
  banners: [],
  skins: [],
  settings: { usePrime: false },
});
export const whole = (x: unknown, min = 0, max = 999999999): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max;
type Dict = Record<string, unknown>;
function dict(x: unknown): x is Dict {
  return (
    !!x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    Object.keys(x).every(
      (id) =>
        ![
          "__proto__",
          "prototype",
          "constructor",
          ...Object.getOwnPropertyNames(Object.prototype),
        ].includes(id),
    )
  );
}
const str = (x: unknown): x is string =>
  typeof x === "string" && x.length <= 500;
function entries(x: unknown, check: (v: unknown) => boolean) {
  return (
    dict(x) &&
    Object.entries(x).every(
      ([k, v]) => k.length > 0 && k.length <= 300 && check(v),
    )
  );
}
function bounds(x: unknown, min: number, max: number, ordered = true) {
  return (
    dict(x) &&
    whole(x.current, min, max) &&
    whole(x.target, min, max) &&
    (!ordered || x.target >= x.current)
  );
}
function goal(x: unknown) {
  return (
    dict(x) &&
    bounds(x.phase, 0, 2) &&
    bounds(x.level, 1, 90, false) &&
    dict(x.phase) &&
    dict(x.level) &&
    (x.phase.current !== x.phase.target ||
      Number(x.level.target) >= Number(x.level.current)) &&
    bounds(x.rank, 1, 7) &&
    entries(x.skills, (v) => bounds(v, 0, 3)) &&
    entries(
      x.modules,
      (v) =>
        dict(v) &&
        bounds(v, 0, 3) &&
        ["A", "B", "C", "D"].includes(String(v.priority)),
    )
  );
}
function rows(x: unknown, check: (v: Dict) => boolean) {
  return (
    Array.isArray(x) &&
    x.every(
      (v) =>
        dict(v) &&
        str(v.id) &&
        v.id.length > 0 &&
        str(v.name) &&
        v.name.trim().length > 0 &&
        check(v),
    ) &&
    new Set(x.map((v) => v.id)).size === x.length
  );
}
export function parseBackup(raw: string): State {
  if (raw.length > 8000000) throw Error("Backup exceeds the 8 MB limit.");
  const b = JSON.parse(raw);
  if (b?.format !== "arknights-planner" || b.version !== 1)
    throw Error("Unsupported backup format or version.");
  const s = b.data;
  if (
    !dict(s) ||
    !entries(s.inventory, (v) => whole(v)) ||
    !entries(s.operators, goal) ||
    !dict(s.settings) ||
    typeof s.settings.usePrime !== "boolean" ||
    !rows(
      s.banners,
      (v) =>
        Array.isArray(v.operators) &&
        v.operators.every(str) &&
        whole(v.pulls) &&
        whole(v.income) &&
        str(v.date) &&
        (!v.date || /^\d{4}-\d\d-\d\d$/.test(v.date)),
    ) ||
    !rows(
      s.skins,
      (v) =>
        str(v.operator) &&
        str(v.skinId) &&
        str(v.release) &&
        (v.price === null || whole(v.price)) &&
        typeof v.owned === "boolean" &&
        typeof v.reserve === "boolean",
    )
  )
    throw Error("Backup contains invalid or incomplete planner records.");
  return s as State;
}
export function budget(s: State) {
  const inv = s.inventory;
  const selected = s.skins.filter((k) => !k.owned && k.reserve);
  const reserved = selected.reduce((n, k) => n + (k.price ?? 0), 0);
  const prime = Math.max(0, (inv["4002"] || 0) - reserved);
  const tickets = (inv["7003"] || 0) + 10 * (inv["7004"] || 0);
  const shards = (inv["4003"] || 0) + (s.settings.usePrime ? prime * 180 : 0);
  const pulls = tickets + Math.floor(shards / 600);
  // Allocate in Orundum equivalents so a partial pull survives queue boundaries.
  let remaining = tickets * 600 + shards;
  const banners = s.banners.map((b) => {
    remaining += b.income * 600;
    const required = b.pulls * 600;
    const missingOrundum = Math.max(0, required - remaining);
    remaining = Math.max(0, remaining - required);
    return {
      id: b.id,
      missing: Math.ceil(missingOrundum / 600),
      missingOrundum,
    };
  });
  return {
    missingOrundum: banners.reduce((sum, b) => sum + b.missingOrundum, 0),
    reserved,
    prime,
    pulls,
    banners,
    unknown: selected.filter((k) => k.price === null).length,
    target: s.banners.reduce((n, b) => n + b.pulls, 0),
    shortage: banners.reduce((sum, b) => sum + b.missing, 0),
  };
}
