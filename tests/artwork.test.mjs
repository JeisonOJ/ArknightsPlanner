import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ZipWriter, BlobWriter, BlobReader } from "@zip.js/zip.js";
import "fake-indexeddb/auto";
import { classifyArtwork, compareArtwork } from "../src/artworkMatch.ts";
import { artworkKeys, readArtwork, clearArtwork } from "../src/artworkDb.ts";
import { importArtwork } from "../src/artworkImport.ts";
import { access } from "../src/db.ts";
import { parseBackup } from "../src/model.ts";
const key = (path) => classifyArtwork(path).match?.key;

test("built-in art maps by phase and alternate form without absorbing outfits", () => {
  for (const [suffix, phase] of [
    ["1", 0],
    ["1+", 1],
    ["2", 2],
  ]) {
    assert.equal(
      key("skin/char_002_amiya_" + suffix + "b.png"),
      "operatorArt:char_002_amiya:" + phase,
    );
  }
  assert.equal(
    key("characters/char_1001_amiya2_2b.png"),
    "operatorArt:char_1001_amiya2:form",
  );
  assert.equal(key("skin/char_103_angel_1+b.png"), undefined);
  assert.equal(
    key("skin/char_103_angel_sale#8b.png"),
    "illustration:char_103_angel@sale#8",
  );
  assert.equal(key("portrait/char_002_amiya_1.png"), "operator:char_002_amiya");
});

test("repository paths resolve by ID and asset purpose", () => {
  assert.equal(
    key("repo/avatar/char_4170_hdbell.png"),
    "operator:char_4170_hdbell",
  );
  assert.equal(
    key("portrait/char_1001_amiya2_2.png"),
    "operator:char_1001_amiya2",
  );
  assert.equal(key("portrait/char_103_angel_1.png"), "operator:char_103_angel");
  assert.equal(key("item/MTL_SL_G2.png"), "item:30012");
  assert.equal(
    key("equip/icon/uniequip_002_angel.png"),
    "module:uniequip_002_angel",
  );
  assert.equal(
    key("characters/char_103_angel_sale#8.png"),
    "outfit:char_103_angel@sale#8",
  );
  assert.equal(
    key("skin/char_103_angel_sale#8b.png"),
    "illustration:char_103_angel@sale#8",
  );
  assert.equal(key("skin/char_103_angel_sale#8.png"), undefined);
  assert.equal(classifyArtwork("item/30012.svg").status, "unsupported");
  assert.equal(classifyArtwork("README.md").status, "ignored");
  const paths = [
    "portrait/char_103_angel_2.png",
    "avatar/char_103_angel.png",
    "portrait/char_103_angel_1.png",
  ];
  assert.equal(
    paths
      .map((path) => ({ path, rank: classifyArtwork(path).match.rank }))
      .sort(compareArtwork)[0].path,
    paths[1],
  );
});

test("ZIP and folder imports persist, keep duplicates, and clear independently of planner backups", async () => {
  const png = await readFile(
    new URL("../src/art/portraits/char_002_amiya.png", import.meta.url),
  );
  const blob = new Blob([png], { type: "image/png" });
  // Browser image decoding is covered by the real-browser smoke check.
  globalThis.createImageBitmap = async () => ({ close() {} });
  const zip = new ZipWriter(new BlobWriter());
  await zip.add("root/portrait/char_002_amiya_1.png", new BlobReader(blob));
  await zip.add("root/avatar/char_002_amiya.png", new BlobReader(blob));
  let summary;
  const report = (s) => {
    summary = s;
  };
  await importArtwork(
    [new File([await zip.close()], "sample.zip")],
    true,
    false,
    report,
  );
  const id = "operator:char_002_amiya";
  assert.deepEqual(await artworkKeys(), [id]);
  assert.equal(summary.duplicates, 1);
  assert.equal((await readArtwork(id)).path, "root/avatar/char_002_amiya.png");
  const replacement = new File([blob], "char_002_amiya_1.png");
  await importArtwork([replacement], false, false, report);
  assert.equal(summary.existing, 1);
  await importArtwork([replacement], false, true, report);
  assert.equal((await readArtwork(id)).path, replacement.name);
  await access((s) => {
    s.inventory["4001"] = 120;
  });
  await clearArtwork();
  assert.deepEqual(await artworkKeys(), []);
  const s = await access();
  assert.equal(
    parseBackup(
      JSON.stringify({ format: "arknights-planner", version: 1, data: s }),
    ).inventory["4001"],
    120,
  );
});
