import { useEffect, useRef, useState } from "react";
import { catalog, type Operator } from "./catalog";
import { readArtwork } from "./artworkDb";
import { useArtworkKeys } from "./artworkKeys";

export const operatorsById = new Map(
  catalog.operators.map((op) => [op.id, op]),
);
const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
export function Art({
  localKey,
  alt = "",
  onImageLoad,
  fallback,
}: {
  localKey?: string;
  alt?: string;
  onImageLoad?: (image: HTMLImageElement) => void;
  fallback: React.ReactNode;
}) {
  const keys = useArtworkKeys();
  const container = useRef<HTMLSpanElement>(null);
  const [local, setLocal] = useState<{
    key: string;
    keys: typeof keys;
    url: string;
  }>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    if (!localKey || !keys.has(localKey) || !container.current) return;
    let active = true;
    let url: string | undefined;
    const load = () => {
      void readArtwork(localKey)
        .then((record) => {
          if (!active || !record) return;
          url = URL.createObjectURL(record.blob);
          setLocal({ key: localKey, keys, url });
        })
        .catch(() => {});
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(container.current);
    return () => {
      active = false;
      observer.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [keys, localKey]);
  const localUrl =
    local && local.key === localKey && local.keys === keys
      ? local.url
      : undefined;
  return (
    <span ref={container} className="art-content">
      {localUrl && localUrl !== failed ? (
        <img
          className="catalog-img"
          alt={alt}
          onLoad={(event) => onImageLoad?.(event.currentTarget)}
          loading="lazy"
          src={localUrl}
          onError={() => setFailed(localUrl)}
        />
      ) : (
        <>{fallback}</>
      )}
    </span>
  );
}
export function opName(op: Operator) {
  return op.region === "CN" && op.appellation ? op.appellation : op.name;
}
export function regionName(op: Operator) {
  return op.confirmedGlobal
    ? "Global confirmed"
    : op.region === "CN"
      ? "CN only"
      : "EN catalog";
}
export function opSearch(op: Operator) {
  return [op.name, op.cnName, op.appellation, op.profession, op.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
const shapes = {
  flask: "M9 3h6m-5 0v6L4 19q-1 2 1 2h14q2 0 1-2l-6-10V3 M7 15h10",
  ingot: "M3 14l5-7h10l3 7-4 4H5z M3 14h18 M8 7l2 7",
  fiber: "M3 8q5-6 9 0t9 0 M3 12q5-6 9 0t9 0 M3 16q5-6 9 0t9 0",
  sugar: "M2 10l8-4 6 4-8 4z M2 10v6l6 4 8-4v-6 M8 14v6 M13 6l4-2 5 3v6l-4 2",
  wheel: "M21 12a9 9 0 11-18 0 9 9 0 0118 0 M15 12a3 3 0 11-6 0 3 3 0 016 0",
  rock: "M3 16l3-8 8-4 6 5 1 7-9 5z M6 8l6 4 8-3 M12 12v9",
  cube: "M3 8l9-5 9 5-9 5z M3 8v9l9 5 9-5V8 M12 13v9",
  chip: "M6 6h12v12H6z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  gem: "M3 8l5-5h8l5 5-9 14z M3 8h18 M8 8l4 14 4-14",
  book: "M5 4h14v16H5z M8 4v16 M11 9h5m-5 4h4",
  ticket: "M3 5h18v5a2 2 0 000 4v5H3v-5a2 2 0 000-4z M15 7v3m0 4v3",
  record: "M3 5h18v14H3z M10 9l5 3-5 3z",
  cash: "M2 6h20v12H2z M5 9h2m10 6h2 M12 9l3 3-3 3-3-3z",
  coat: "M8 3l4 2 4-2 5 4-3 5-2-2v10H8V10l-2 2-3-5z",
};
export function Glyph({ type }: { type: keyof typeof shapes }) {
  return (
    <svg
      aria-hidden="true"
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d={shapes[type]} />
    </svg>
  );
}
function materialShape(id: string, iconId: string): keyof typeof shapes {
  if (id === "4001") return "cash";
  if (id === "4002" || id === "4003") return "gem";
  if (id.startsWith("7")) return "ticket";
  if (id.startsWith("200") || id === "EXP") return "record";
  if (id.startsWith("330")) return "book";
  if (/^(32|mod_)/.test(id) || iconId.includes("BOSS")) return "chip";
  if (/KETONE|ALCOHOL|SOLVENT|FLUID/.test(iconId)) return "flask";
  if (/IRON|MANGANESE|ALLOY/.test(iconId)) return "ingot";
  if (/STRG/.test(iconId)) return "sugar";
  if (/RUSH|FIBER/.test(iconId)) return "fiber";
  if (/_PG/.test(iconId)) return "wheel";
  if (/_G[1-4]$/.test(iconId)) return "rock";
  return "cube";
}
export function ResourceMark({ id }: { id: string }) {
  const item = itemsById.get(id);
  const type = materialShape(id, item?.iconId ?? "");
  const key = item?.iconId || id;
  const tone =
    Array.from(key).reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0) %
    360;
  return (
    <span
      className="catalog-mark"
      style={{ color: "hsl(" + tone + " 52% 76%)" }}
      aria-hidden="true"
    >
      <Art
        localKey={"item:" + id}
        fallback={<Glyph type={type} />}
      />
    </span>
  );
}
export function OperatorIdentity({ op }: { op: Operator }) {
  const name = opName(op),
    secondary = op.cnName !== name ? op.cnName : "";
  return (
    <span className="identity">
      <span className="catalog-mark portrait" aria-hidden="true">
        <Art
          localKey={"operator:" + op.id}
          fallback={<b>{name.slice(0, 2).toUpperCase()}</b>}
        />
      </span>
      <span>
        <strong>{name}</strong>
        {secondary && (
          <span className="cn-name" lang="zh">
            {secondary}
          </span>
        )}
        <small>
          {op.rarity}★ · {op.profession} · {regionName(op)}
        </small>
      </span>
    </span>
  );
}
export function OperatorPicker({
  value,
  change,
  options = catalog.operators,
  clear = false,
}: {
  value: string;
  change: (id: string) => void;
  options?: Operator[];
  clear?: boolean;
}) {
  const [open, toggle] = useState(false),
    [query, search] = useState(""),
    [limit, more] = useState(16);
  const trigger = useRef<HTMLButtonElement>(null),
    selected = operatorsById.get(value);
  const matches = open
    ? options
        .filter((op) => opSearch(op).includes(query.trim().toLowerCase()))
        .sort((a, b) => opName(a).localeCompare(opName(b)))
    : [];
  function close() {
    toggle(false);
    trigger.current?.focus();
  }
  function choose(id: string) {
    change(id);
    close();
  }
  return (
    <div
      className="op-picker"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        onClick={() => {
          toggle(!open);
          search("");
          more(16);
        }}
      >
        {selected ? (
          <OperatorIdentity op={selected} />
        ) : (
          value || "Choose operator"
        )}
      </button>
      {open && (
        <div className="picker-body">
          <input
            autoFocus
            type="search"
            aria-label="Search operators"
            placeholder="Search name, codename, class or ID…"
            value={query}
            onChange={(e) => {
              search(e.target.value);
              more(16);
            }}
          />
          {clear && value && (
            <button type="button" onClick={() => choose("")}>
              Clear selection
            </button>
          )}
          <div className="op-results">
            {matches.slice(0, limit).map((op) => (
              <button type="button" key={op.id} onClick={() => choose(op.id)}>
                <OperatorIdentity op={op} />
              </button>
            ))}
          </div>
          {!matches.length && <small>No matching operators.</small>}
          {matches.length > limit && (
            <button type="button" onClick={() => more(limit + 16)}>
              Show more operators
            </button>
          )}
        </div>
      )}
    </div>
  );
}
