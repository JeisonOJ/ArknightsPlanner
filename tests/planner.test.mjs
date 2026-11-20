import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/catalog.json" with { type: "json" };
import { calculate, meetsModuleLevel, moduleCost } from "../src/calc.ts";
import { budget, empty, pair, parseBackup, progress } from "../src/model.ts";
import "fake-indexeddb/auto";
import { access } from "../src/db.ts";
const angel = catalog.operators.find((o) => o.id === "char_103_angel");
function fixture() {
  const s = empty();
  const p = (s.operators[angel.id] = progress());
  return { s, p, run: () => calculate(catalog, s) };
}
test("catalog merges EN and CN by stable ID and keeps class templates and future modules", () => {
  assert.equal(
    new Set(catalog.operators.map((o) => o.id)).size,
    catalog.operators.length,
  );
  assert.equal(angel.cnName, "能天使");
  assert.equal(angel.name, "Exusiai");
  assert.equal(
    catalog.operators.find((o) => o.id === "char_4170_hdbell").region,
    "CN",
  );
  assert(
    catalog.operators.some(
      (o) => o.region === "EN" && o.modules.some((m) => m.region === "CN"),
    ),
  );
  assert.equal(
    catalog.operators.filter((o) => o.baseId === "char_002_amiya").length,
    3,
  );
});
test("two level transitions and EXP records", () => {
  const { s, p, run } = fixture();
  p.level.target = 3;
  s.inventory["2002"] = 2;
  const r = run();
  assert.equal(r.total.EXP, 217);
  assert.equal(r.levelLmd, 66);
  assert.equal(r.exp, 800);
});
test("Exusiai E1 delta charges the promotion once", () => {
  const { p, run } = fixture();
  p.level.current = 50;
  p.phase.target = 1;
  assert.deepEqual(run().total, { 3241: 5, 30012: 12, 30052: 4, 4001: 30000 });
});
test("Exusiai S1 M1 charges verified material rows from E2 rank seven", () => {
  const { p, run } = fixture();
  p.phase = pair(2);
  p.rank = pair(7);
  p.skills[angel.skills[0].id] = { current: 0, target: 1 };
  assert.deepEqual(run().total, { 3303: 6, 30064: 3, 30043: 4 });
});
test("explicit masteries share E2 and skill ranks, and module costs are added once", () => {
  const { p, run } = fixture();
  p.phase = pair(1);
  p.level = pair(80);
  for (const skill of angel.skills.slice(0, 2))
    p.skills[skill.id] = { current: 0, target: 1 };
  const operatorOnly = run();
  assert.equal(operatorOnly.promotionLmd, 180000);
  assert.equal(operatorOnly.moduleCount, 0);
  p.modules.uniequip_002_angel = { current: 0, target: 1, priority: "A" };
  const r = run();
  assert.equal(r.promotionLmd, 180000);
  assert.equal(r.total["4001"], r.levelLmd + 180000 + 80000);
  assert.deepEqual(r.perBase, operatorOnly.perBase);
  assert.equal(r.total.EXP, operatorOnly.total.EXP);
  assert.equal(r.total["3303"], operatorOnly.total["3303"]);
  assert.equal(r.active, 1);
  assert.equal(r.moduleCount, 1);
});
test("Qiubai module-only plan keeps its priority, costs and unlock warning without activating progression", () => {
  const state = empty();
  const qiubai = catalog.operators.find((op) => op.id === "char_4082_qiubai");
  const thumpy = catalog.operators.find((op) => op.id === "char_4235_thumpy");
  const mod = qiubai.modules.find((m) => m.id === "uniequip_002_qiubai");
  const plan = (state.operators[qiubai.id] = progress());
  plan.modules[mod.id] = { current: 0, target: 1, priority: "D" };
  state.inventory["4001"] = 50;
  const original = structuredClone(state);
  const moduleOnly = calculate(catalog, state);
  const moduleMaterials = { mod_unlock_token: 4, 30135: 2, 4001: 80000 };
  assert.deepEqual(moduleOnly.total, moduleMaterials);
  assert.deepEqual(moduleOnly.missing, Object.entries(moduleMaterials));
  assert.equal(moduleOnly.active, 0);
  assert.equal(moduleOnly.moduleCount, 1);
  assert.equal(moduleOnly.levelLmd, 0);
  assert.equal(moduleOnly.promotionLmd, 0);
  assert.equal(meetsModuleLevel(mod, plan), false);
  assert.equal(meetsModuleLevel(mod, { ...plan, phase: pair(2), level: pair(59) }), false);
  assert.equal(meetsModuleLevel(mod, { ...plan, phase: pair(2), level: pair(60) }), true);
  assert.deepEqual(state, original);

  state.operators[thumpy.id] = { ...progress(), level: { current: 1, target: 2 } };
  const restored = parseBackup(JSON.stringify({ format: "arknights-planner", version: 1, data: state }));
  const combined = calculate(catalog, restored);
  assert.deepEqual(restored, state);
  assert.deepEqual([...combined.activeOperatorIds], [thumpy.id]);
  assert.equal(combined.active, 1);
  assert.deepEqual(combined.perBase, { [thumpy.id]: { EXP: 100, 4001: 30 } });
  assert.deepEqual(combined.total, { ...moduleMaterials, EXP: 100, 4001: 80030 });
  assert.equal(combined.total["4001"] - combined.owned["4001"], 79980);
});
test("unlocked module charges only its next stage", () => {
  const { p, run } = fixture(),
    m = angel.modules.find((m) => m.id === "uniequip_002_angel");
  p.modules[m.id] = { current: 1, target: 2, priority: "C" };
  assert.deepEqual(run().total, moduleCost(m.costs, { current: 1, target: 2 }));
  assert.equal(run().total["4001"], 100000);
});
test("multiple operators share inventory without spending it", () => {
  const { s, p, run } = fixture();
  p.level.target = 2;
  s.operators.char_002_amiya = structuredClone(p);
  s.inventory["4001"] = 40;
  const r = run();
  assert.equal(r.total["4001"] - r.owned["4001"], 20);
  assert.equal(s.inventory["4001"], 40);
});
test("skin reservations protect OP and permits apply once", () => {
  const s = empty();
  Object.assign(s.inventory, {
    4002: 22,
    4003: 480,
    7004: 1,
    7003: 1,
    7001: 300,
  });
  s.settings.usePrime = true;
  s.skins = [
    { price: 18, reserve: true, owned: false },
    { price: null, reserve: true, owned: false },
  ];
  s.banners = [
    { id: "first", pulls: 14, income: 0 },
    { id: "later", pulls: 1, income: 3 },
  ];
  const r = budget(s);
  assert.equal(r.pulls, 13);
  assert.equal(r.unknown, 1);
  assert.equal(r.shortage, 1);
  assert.deepEqual(
    r.banners.map((x) => x.missing),
    [1, 0],
  );
});
test("backup round trip preserves unknown IDs and rejects invalid records", () => {
  const s = empty();
  s.inventory.unknown = 22;
  s.operators.future = progress();
  const raw = JSON.stringify({
    format: "arknights-planner",
    version: 1,
    data: s,
  });
  assert.deepEqual(parseBackup(raw), s);
  for (const invalid of [
    "{",
    raw.replace('"version":1', '"version":2'),
    raw.replace("22", "-1"),
    raw.replace('"unknown"', '"__proto__"'),
  ])
    assert.throws(() => parseBackup(invalid));
});
test("IndexedDB serializes concurrent edits and rolls back failed replacement", async () => {
  await Promise.all([
    access((s) => {
      s.inventory["4001"] = 5;
    }),
    access((s) => {
      s.inventory["4002"] = 8;
    }),
  ]);
  const before = await access();
  assert.deepEqual(before.inventory, { 4001: 5, 4002: 8 });
  await assert.rejects(
    access((s) => {
      s.inventory = {};
      throw Error("aborted restore");
    }),
  );
  assert.deepEqual(await access(), before);
});
