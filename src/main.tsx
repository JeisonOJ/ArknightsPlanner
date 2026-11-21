import { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { catalog } from "./catalog.ts";
import { access } from "./db.ts";
import { OperatorIdentity, operatorsById } from "./CatalogVisuals";
import { budget, parseBackup, type State } from "./model.ts";
import { calculate } from "./calc.ts";
import {
  Ctx,
  Panel,
  sections,
  Icon,
  usePlanner,
  fmt,
  Materials,
  type Page,
} from "./ui.tsx";
import { Inventory, Operators, Modules } from "./Operations.tsx";
import { Pulls, Skins } from "./Budget.tsx";
import { ArtworkLibrary } from "./ArtworkLibrary";
import "./style.css";
const descriptions = [
  "Your resources and active plans at a glance.",
  "Manage the resources available for your plans.",
  "Set current progression and plan your next upgrade.",
  "Prioritize unlocks and module stages.",
  "Allocate your saved pulls across upcoming banners.",
  "Reserve Originite Prime for your preferred outfits.",
  "Manage local data, backups, and artwork.",
];
function Terrain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const w = (c.width = 800),
      h = (c.height = 240);
    for (let k = 0; k < 55; k++) {
      g.beginPath();
      const r = 12 + k * 7;
      for (let j = 0; j <= 400; j++) {
        const a = (j / 400) * Math.PI * 2,
          b =
            r *
            (1 +
              0.14 * Math.sin(a * 3 + r * 0.003) +
              0.09 * Math.cos(5 * a + r * 0.004) +
              0.04 * Math.sin(9 * a));
        const x = w * 0.62 + Math.cos(a) * b * 1.45 + Math.sin(k * 0.06) * 36,
          y = h * 0.65 + Math.sin(a) * b * 0.67;
        if (j) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.strokeStyle = k % 6 === 0 ? "#ccbc72" : "#74919a";
      g.globalAlpha = k % 6 === 0 ? 0.72 : 0.52;
      g.stroke();
    }
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="terrain" />;
}
function Dashboard() {
  const { s, result: r, go } = usePlanner(),
    b = budget(s),
    owned = s.inventory;
  const cards = [
    ["LMD", fmt(owned["4001"] || 0), "Available currency", 1],
    ["Battle record EXP", fmt(r.exp), "EXP equivalent", 3],
    ["Pull equivalents", fmt(b.pulls), "Available now", 4],
    ["Reserved OP", fmt(b.reserved), "Selected outfits", 5],
  ] as const;
  let op = owned["4002"] || 0,
    affordable = 0;
  for (const skin of s.skins.filter(
    (x) => x.reserve && !x.owned && x.price !== null,
  )) {
    op -= skin.price!;
    if (op >= 0) affordable++;
  }
  return (
    <>
      <div className="hero">
        <Terrain />
        <div>
          <div className="eyebrow">
            <span className="signal" /> PROGRESSION
          </div>
          <h2>Upgrade readiness</h2>
          <p>
            {r.active} active operator goals <span> / </span> {r.moduleCount}{" "}
            planned modules
          </p>
          <button className="primary" onClick={() => go("Operators")}>
            Plan an upgrade
          </button>
        </div>
      </div>
      <div className="metrics">
        {cards.map(([name, value, hint, icon]) => (
          <button
            className="metric"
            key={name}
            onClick={() =>
              go(
                icon === 4
                  ? "Pull Planner"
                  : icon === 5
                    ? "Skins"
                    : "Inventory",
              )
            }
          >
            <span className="metric-name">
              <Icon i={icon} />
              {name}
            </span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      <div className="columns">
        <Panel
          title="Upgrade requirements"
          action={<button onClick={() => go("Inventory")}>Inventory</button>}
        >
          {r.active || r.moduleCount ? (
            <>
              <p className="muted">
                {r.missing.length} resource types short · {fmt(r.levelLmd)}{" "}
                leveling LMD · {fmt(r.promotionLmd)} promotion LMD
              </p>
              <div className="goal-summary">
                {Object.entries(r.perBase)
                  .filter(
                    ([id, costs]) =>
                      operatorsById.has(id) && Object.keys(costs).length > 0,
                  )
                  .slice(0, 5)
                  .map(([id]) => (
                    <OperatorIdentity key={id} op={operatorsById.get(id)!} />
                  ))}
              </div>
              <Materials costs={r.total} />
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <Icon i={1} size={28} />
              </div>
              <h3>No active upgrade goals</h3>
              <p>
                Choose an operator and set a target to see material
                requirements.
              </p>
              <button onClick={() => go("Operators")}>Browse operators</button>
            </div>
          )}
        </Panel>
        <Panel title="Pull allocation">
          <div className="balance">
            <div>
              <strong>{fmt(b.pulls)}</strong>{" "}
              <span>/ {fmt(b.target)} target</span>
            </div>
            <progress value={Math.min(b.pulls, b.target)} max={b.target || 1} />
            <small>
              {fmt(b.shortage)} pulls short · {fmt(b.missingOrundum)} additional
              Orundum after planned income
            </small>
          </div>
          <button onClick={() => go("Pull Planner")}>Open pull planner</button>
          <div className="sub">
            <b>Skin wishlist</b>
            <p>
              {affordable} selected outfits affordable · {b.unknown} unpriced
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Settings() {
  const { s, update } = usePlanner(),
    [msg, set] = useState("");
  async function restore(file: File) {
    try {
      if (file.size > 8000000) throw Error("File exceeds 8 MB.");
      const next = parseBackup(await file.text());
      validateCatalog(next);
      if (
        !confirm(
          "Replace all local data with " +
            Object.keys(next.operators).length +
            " operator records, " +
            Object.keys(next.inventory).length +
            " balances, " +
            next.banners.length +
            " banners and " +
            next.skins.length +
            " outfits?",
        )
      )
        return;
      await update((d) => Object.assign(d, next));
      set("Backup restored.");
    } catch (e) {
      set(String(e));
    }
  }
  return (
    <>
      <Panel title="Local backups">
        <p>
          This browser profile stores your inventory and plans. Export a copy
          before clearing site data or changing devices.
        </p>
        <div className="filters">
          <button
            className="primary"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        format: "arknights-planner",
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        catalogRevision: catalog.revision,
                        data: s,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download =
                "arknights-planner-" +
                new Date().toISOString().slice(0, 10) +
                ".json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export JSON
          </button>
          <label className="file">
            Import backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) restore(f);
              }}
            />
          </label>
        </div>
        <p role="status">{msg}</p>
      </Panel>
      <ArtworkLibrary />
      <Panel title="Game catalog">
        <p>
          {catalog.operators.length} operator forms · {catalog.items.length}{" "}
          resources · {catalog.outfits.length} outfits · Version{" "}
          {catalog.version}
        </p>
        <a
          href={
            "https://github.com/" +
            catalog.repository +
            "/commit/" +
            catalog.revision
          }
        >
          ArknightsAssets · {catalog.revision.slice(0, 12)}
        </a>
        <p className="muted">
          EN and CN indicate catalog presence. Confirmed Global releases have a
          separate label. Three modules with incomplete costs are omitted.
        </p>
      </Panel>
    </>
  );
}
function validateCatalog(s: State) {
  for (const [id, p] of Object.entries(s.operators)) {
    const op = catalog.operators.find((o) => o.id === id);
    if (!op) continue;
    for (const k of ["current", "target"] as const)
      if (
        !op.phases[p.phase[k]] ||
        p.level[k] > op.phases[p.phase[k]].maxLevel ||
        p.rank[k] > op.ranks.length + 1
      )
        throw Error("Progression exceeds catalog limits for " + op.name);
  }
}
function App() {
  const [s, set] = useState<State | null>(null),
    [error, fail] = useState(""),
    [page, open] = useState<Page>(
      () =>
        sections.find(
          (p) => p === decodeURIComponent(location.hash.slice(1)),
        ) ?? "Dashboard",
    ),
    [menu, toggle] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      access()
        .then((d) => {
          if (alive) set(d);
        })
        .catch((e) => fail(String(e)));
    load();
    window.addEventListener("focus", load);
    const nav = () =>
      open(
        sections.find(
          (p) => p === decodeURIComponent(location.hash.slice(1)),
        ) ?? "Dashboard",
      );
    window.addEventListener("hashchange", nav);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("hashchange", nav);
    };
  }, []);
  const result = useMemo(() => (s ? calculate(catalog, s) : null), [s]);
  async function update(fn: (s: State) => void) {
    try {
      set(await access(fn));
      fail("");
    } catch (e) {
      fail("Could not save local data: " + String(e));
      throw e;
    }
  }
  function go(p: Page) {
    location.hash = encodeURIComponent(p);
    open(p);
    toggle(false);
    window.scrollTo(0, 0);
  }
  const idx = sections.indexOf(page);
  return (
    <div className="app">
      <aside className={menu ? "visible" : ""}>
        <div className="brand">
          <span className="mark">Λ</span>
          <div>
            Arknights<small>PLANNER</small>
          </div>
        </div>
        <nav>
          {sections.map((p, i) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p)}
            >
              <Icon i={i} />
              {p === "Settings and Backups" ? "Settings & backups" : p}
            </button>
          ))}
        </nav>
        <div className="local">
          <i /> Browser-local workspace
        </div>
      </aside>
      <main>
        <div className="top">
          <button className="menu" onClick={() => toggle(!menu)}>
            Menu
          </button>
          <span>Workspace</span>
          <b>/</b>
          {page}
          <span className="region">
            EN <b>/</b> CN
          </span>
        </div>
        <div className="content">
          <div className="heading">
            <div>
              <h1>{page}</h1>
              <p>{descriptions[idx]}</p>
            </div>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {s && result ? (
            <Ctx.Provider value={{ s, update, result, go }}>
              {
                [
                  <Dashboard />,
                  <Inventory />,
                  <Operators />,
                  <Modules />,
                  <Pulls />,
                  <Skins />,
                  <Settings />,
                ][idx]
              }
            </Ctx.Provider>
          ) : (
            <p>Opening local inventory…</p>
          )}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
