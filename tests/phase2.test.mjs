import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "fake-indexeddb/auto";
import { access } from "../src/db.ts";
import { budget, empty, progress, parseBackup } from "../src/model.ts";
import catalog from "../src/catalog.json" with { type: "json" };

const banner = (id, pulls, income = 0) => ({
  id,
  name: id,
  pulls,
  income,
  operators: [],
  date: "",
});
test("300-pull spreadsheet example preserves fractional-pull Orundum", () => {
  const s = empty();
  s.inventory = { 4003: 141070, 7003: 2, 4002: 99, 7001: 50 };
  s.banners = [banner("first", 300)];
  const b = budget(s);
  assert.equal(b.pulls, 237);
  assert.equal(b.shortage, 63);
  assert.equal(b.missingOrundum, 37730);
  assert.equal(b.banners[0].missingOrundum, 37730);
});
test("each queue entry consumes funds once and income cannot repay earlier deficits", () => {
  const s = empty();
  s.inventory = { 4002: 23, 4003: 670, 7004: 1 };
  s.settings.usePrime = true;
  s.skins = [{ price: 20, reserve: true, owned: false }];
  s.banners = [banner("first", 11), banner("next", 2), banner("late", 2, 3)];
  const b = budget(s);
  assert.equal(b.prime, 3);
  assert.deepEqual(
    b.banners.map((x) => x.missingOrundum),
    [0, 590, 0],
  );
  assert.equal(b.missingOrundum, 590);
  assert.deepEqual(
    b.banners.map((x) => x.missing),
    [0, 1, 0],
  );
});
test("stable visual metadata maps to the original IDs", async () => {
  const angel = catalog.operators.find((o) => o.id === "char_103_angel");
  assert.equal(angel.portraitId, "char_103_angel_1");
  assert.equal(
    angel.modules.find((m) => m.id === "uniequip_002_angel").designation,
    "MAR-X",
  );
  assert.equal(catalog.items.find((i) => i.id === "30012").iconId, "MTL_SL_G2");
  const future = catalog.operators.find((o) => o.id === "char_4170_hdbell");
  assert.deepEqual(
    [future.region, future.cnName, future.appellation],
    ["CN", "行铃", "Herdbells"],
  );
  for (const id of ["char_002_amiya", "char_1023_ghost2"]) {
    assert(catalog.operators.some((o) => o.id === id));
    const png = await readFile(
      new URL("../src/art/portraits/" + id + ".png", import.meta.url),
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG");
  }
});
test("outfits merge once per full skin ID and resolve both EN and CN-only owners", () => {
  assert.equal(
    new Set(catalog.outfits.map((k) => k.id)).size,
    catalog.outfits.length,
  );
  const k = catalog.outfits.find((k) => k.id === "char_103_angel@sale#8");
  assert.equal(k.name, "Midnight Delivery");
  assert.equal(k.operatorId, "char_103_angel");
  assert.equal(k.price, null);
  assert(catalog.outfits.some((k) => k.region === "CN"));
  assert(
    catalog.outfits.every((k) =>
      catalog.operators.some((o) => o.id === k.operatorId),
    ),
  );
});
test("v1 records including unknown manual outfits and balances survive catalog additions", async () => {
  const s = empty();
  s.inventory = { 4001: 123456, unknown_item: 5 };
  s.operators.char_103_angel = progress();
  s.operators.char_103_angel.modules.uniequip_002_angel = {
    current: 1,
    target: 3,
    priority: "A",
  };
  s.banners = [banner("Original", 300)];
  s.skins = [
    {
      id: "manual",
      name: "Old entry",
      skinId: "unknown#1",
      operator: "future",
      price: 18,
      release: "unscheduled",
      owned: false,
      reserve: true,
    },
  ];
  const restored = parseBackup(
    JSON.stringify({
      format: "arknights-planner",
      version: 1,
      catalogRevision: "previous",
      data: s,
    }),
  );
  await access((d) => Object.assign(d, restored));
  const loaded = await access();
  assert.deepEqual(loaded, s);
  assert.equal(budget(loaded).reserved, 18);
});
