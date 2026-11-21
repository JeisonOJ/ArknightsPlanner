import { useState } from "react";
import { catalog, type Outfit } from "./catalog";
import {
  operatorsById,
  opName,
  opSearch,
  Glyph,
  Art,
} from "./CatalogVisuals";
import { Panel, usePlanner } from "./ui";
import type { Skin } from "./model";
import { useArtworkKeys } from "./artworkKeys";
import { OutfitPreview } from "./OutfitPreview";

function OutfitRow({
  outfit,
  wished,
  add,
}: {
  outfit: Outfit;
  wished: boolean;
  add: () => void;
}) {
  const [expanded, toggle] = useState(false);
  const op = operatorsById.get(outfit.operatorId);
  const keys = useArtworkKeys();
  const thumbnailKey = "outfit:" + outfit.id;
  const illustrationKey = "illustration:" + outfit.id;
  const fullSize = keys.has(illustrationKey);
  const canPreview = fullSize || keys.has(thumbnailKey);
  return (
    <article className="outfit-row">
      <span className="catalog-mark outfit-mark">
        <Art
          localKey={thumbnailKey}
          fallback={<Glyph type="coat" />}
        />
      </span>
      <div className="outfit-caption">
        <strong>{outfit.name}</strong>
        <small>
          {op ? opName(op) : outfit.operatorId} ·{" "}
          {outfit.region === "CN" ? "CN only" : "EN catalog"}
        </small>
        {outfit.cnName && outfit.cnName !== outfit.name && (
          <small lang="zh">{outfit.cnName}</small>
        )}
      </div>
      <div className="outfit-actions">
        {canPreview && (
          <button
            aria-haspopup="dialog"
            onClick={(event) => {
              event.currentTarget.focus();
              toggle(true);
            }}
          >
            Preview
          </button>
        )}
        <button disabled={wished} onClick={add}>
          {wished ? "In wishlist" : "Add to wishlist"}
        </button>
      </div>
      {expanded && canPreview && (
        <OutfitPreview
          name={outfit.name}
          operator={op ? opName(op) : outfit.operatorId}
          localKey={fullSize ? illustrationKey : thumbnailKey}
          onClose={() => toggle(false)}
        />
      )}
    </article>
  );
}
export function OutfitCatalog() {
  const { s, update } = usePlanner();
  const [query, search] = useState(""),
    [region, filter] = useState("All regions"),
    [limit, more] = useState(8);
  const matches = catalog.outfits.filter((outfit) => {
    const op = operatorsById.get(outfit.operatorId);
    return (
      (region === "All regions" || outfit.region === region) &&
      [outfit.name, outfit.cnName, outfit.id, op && opSearch(op)]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  function add(outfit: Outfit) {
    const row: Skin = {
      id: crypto.randomUUID(),
      operator: outfit.operatorId,
      skinId: outfit.id,
      name: outfit.name,
      price: outfit.price,
      release: "",
      reserve: true,
      owned: false,
    };
    update((d) => {
      if (!d.skins.some((k) => k.skinId === outfit.id)) d.skins.push(row);
    });
  }
  return (
    <Panel
      title="Outfit catalog"
      action={<span className="tag">{matches.length} outfits</span>}
    >
      <div className="filters">
        <input
          type="search"
          aria-label="Search outfits"
          placeholder="Search outfit, operator or catalog ID…"
          value={query}
          onChange={(e) => {
            search(e.target.value);
            more(8);
          }}
        />
        <select
          aria-label="Outfit region"
          value={region}
          onChange={(e) => {
            filter(e.target.value);
            more(8);
          }}
        >
          <option>All regions</option>
          <option value="CN">CN only</option>
          <option value="EN">EN catalog</option>
        </select>
      </div>
      {matches.slice(0, limit).map((outfit) => (
        <OutfitRow
          key={outfit.id}
          outfit={outfit}
          wished={s.skins.some((k) => k.skinId === outfit.id)}
          add={() => add(outfit)}
        />
      ))}
      {!matches.length && (
        <p>
          No matching outfits. You can still add a manual entry to the wishlist.
        </p>
      )}
      {matches.length > limit && (
        <button onClick={() => more(limit + 12)}>Show more outfits</button>
      )}
    </Panel>
  );
}
