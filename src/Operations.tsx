import { useState } from "react";
import { OperatorArtwork } from "./OperatorArtwork";
import {
  OperatorIdentity,
  Art,
  Glyph,
  OperatorPicker,
  ResourceMark,
  opSearch,
  opName,
} from "./CatalogVisuals";
import { catalog, type Operator, type Module } from "./catalog.ts";
import { progress, pair, type Progress, type Priority } from "./model.ts";
import { meetsModuleLevel, moduleCost } from "./calc.ts";
import { usePlanner, Panel, NumberBox, Materials, fmt } from "./ui.tsx";
export function Inventory() {
  const { s, update, result } = usePlanner(),
    [query, q] = useState(""),
    [category, c] = useState("All categories");
  const rows = catalog.items.filter(
    (x) =>
      (category === "All categories" || x.category === category) &&
      (x.name + " " + x.id).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="strip">
        <span>Available battle record EXP</span>
        <strong>{fmt(result.exp)}</strong>
      </div>
      <Panel title="Resource inventory">
        <div className="filters">
          <input
            aria-label="Search inventory"
            placeholder="Search resources or IDs…"
            value={query}
            onChange={(e) => q(e.target.value)}
          />
          <select
            aria-label="Resource category"
            value={category}
            onChange={(e) => c(e.target.value)}
          >
            {[
              "All categories",
              ...new Set(catalog.items.map((x) => x.category)),
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Owned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className="resource-id">
                      <ResourceMark id={x.id} />
                      <span>
                        {x.name}
                        {x.exp > 0 && <small>{fmt(x.exp)} EXP each</small>}
                      </span>
                    </span>
                  </td>
                  <td>{x.category}</td>
                  <td>
                    <NumberBox
                      label={x.name + " quantity"}
                      value={s.inventory[x.id] || 0}
                      onChange={(n) =>
                        update((d) => {
                          d.inventory[x.id] = n;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p>No matching resources.</p>}
        </div>
      </Panel>
    </>
  );
}
function useRecord(op: Operator) {
  const { s, update } = usePlanner();
  return {
    p: s.operators[op.baseId] ?? progress(),
    edit: (fn: (p: Progress) => void) =>
      update((s) => {
        fn((s.operators[op.baseId] ??= progress()));
      }),
  };
}
function Steps({
  label,
  current,
  target,
  max,
  change,
  min = 0,
}: {
  label: string;
  current: number;
  target: number;
  max: number;
  min?: number;
  change: (key: "current" | "target", n: number) => void;
}) {
  return (
    <div className="step">
      <span>{label}</span>
      {(["current", "target"] as const).map((k) => (
        <NumberBox
          key={k}
          label={label + " " + k}
          value={k === "current" ? current : target}
          min={k === "current" ? min : current}
          max={max}
          onChange={(n) => change(k, n)}
        />
      ))}
    </div>
  );
}
function ModuleRow({ op, m }: { op: Operator; m: Module }) {
  const { p, edit } = useRecord(op),
    v = p.modules[m.id] ?? { ...pair(), priority: "B" as Priority };
  return (
    <details className="module">
      <summary>
        <span className="module-identity">
          <OperatorIdentity op={op} />
          <span className="catalog-mark" aria-hidden="true">
            <Art localKey={"module:" + m.id} fallback={<Glyph type="chip" />} />
          </span>
          <span>
            <b>
              {m.designation} · {m.name}
            </b>
            <small>
              {m.region === "CN" ? "CN only" : "EN catalog"} · Stage {v.current}{" "}
              / {v.target} · Priority {v.priority}
            </small>
          </span>
        </span>
      </summary>
      <p>
        Unlock at E{m.phase} Lv. {m.level}. {m.missions.length} mission(s).
        Trust by stage:{" "}
        {m.trust.map((t) => t + "%").join(" / ") || "unspecified"}.
      </p>
      {v.target > v.current && !meetsModuleLevel(m, p) && (
        <p className="gold">
          Unlock requirement unmet. This module requires E{m.phase} Lv. {m.level}.
        </p>
      )}
      <div className="step caps">
        <span>Stage</span>
        <span>Current</span>
        <span>Target</span>
      </div>
      <Steps
        label="Module stage"
        {...v}
        max={m.costs.length}
        change={(k, n) =>
          edit((p) => {
            const v = (p.modules[m.id] ??= { ...pair(), priority: "B" });
            v[k] = n;
            v.target = Math.max(v.current, v.target);
          })
        }
      />
      <div className="filters">
        <label>
          Priority{" "}
          <select
            value={v.priority}
            onChange={(e) => {
              const priority = e.target.value as Priority;
              edit((p) => {
                (p.modules[m.id] ??= { ...pair(), priority: "B" }).priority =
                  priority;
              });
            }}
          >
            {["A", "B", "C", "D"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {v.target > v.current && (
          <button
            onClick={() =>
              edit((p) => {
                p.modules[m.id].current = p.modules[m.id].target;
              })
            }
          >
            Complete stage goal
          </button>
        )}
      </div>
      <Materials costs={moduleCost(m.costs, v)} />
    </details>
  );
}
export function Modules() {
  const { s } = usePlanner(),
    [q, set] = useState(""),
    [priority, filter] = useState("All priorities"),
    [only, toggle] = useState(false),
    [limit, more] = useState(30);
  const rows = catalog.operators
    .flatMap((op) => op.modules.map((m) => ({ op, m })))
    .filter(({ op, m }) => {
      const v = s.operators[op.baseId]?.modules[m.id];
      return (
        [opSearch(op), m.designation, m.name, m.id]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (priority === "All priorities" || (v?.priority ?? "B") === priority) &&
        (!only || (v && v.target > v.current))
      );
    });
  return (
    <Panel title="Module directory">
      <div className="filters">
        <input
          placeholder="Search operator or module…"
          aria-label="Search modules"
          value={q}
          onChange={(e) => set(e.target.value)}
        />
        <select
          aria-label="Filter priority"
          value={priority}
          onChange={(e) => filter(e.target.value)}
        >
          {["All priorities", "A", "B", "C", "D"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={only}
            onChange={(e) => toggle(e.target.checked)}
          />{" "}
          Planned only
        </label>
      </div>
      {rows.slice(0, limit).map(({ op, m }) => (
        <ModuleRow key={op.id + m.id} op={op} m={m} />
      ))}
      {!rows.length && <p>No matching modules.</p>}
      {rows.length > limit && (
        <button onClick={() => more(limit + 30)}>Show more modules</button>
      )}
    </Panel>
  );
}
export function Operators() {
  const { result } = usePlanner(),
    [region, filter] = useState("All regions"),
    [id, pick] = useState(""),
    [planned, onlyPlanned] = useState(false);
  const matches = catalog.operators.filter(
    (op) =>
      (!planned || result.activeOperatorIds.has(op.baseId)) &&
      (region === "All regions" || op.region === region),
  );
  const op = matches.find((o) => o.id === id) ?? matches[0];
  return (
    <>
      <Panel title="Operator catalog">
        <div className="filters">
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => filter(e.target.value)}
          >
            {["All regions", "EN", "CN"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={planned}
              onChange={(e) => onlyPlanned(e.target.checked)}
            />{" "}
            Active goals
          </label>
          <OperatorPicker
            options={matches}
            value={op?.id ?? ""}
            change={pick}
          />
        </div>
        {!op && <p>No matching operators.</p>}
      </Panel>
      {op && (
        <div className="operator-workspace">
          <OperatorArtwork key={op.id} op={op} />
          <div>
            <OperatorEditor op={op} key={op.id} />
            <Panel title="Operator requirements">
              <Materials costs={result.perBase[op.baseId] ?? {}} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
function OperatorEditor({ op }: { op: Operator }) {
  const { p, edit } = useRecord(op);
  if (!op.standardProgression)
    return (
      <Panel title={op.name}>
        <p>Special progression costs are unavailable for this operator.</p>
      </Panel>
    );
  return (
    <Panel
      title={opName(op)}
      action={
        <span className="tag">
          {op.confirmedGlobal
            ? "Global confirmed"
            : op.region === "EN"
              ? "EN catalog"
              : "CN only"}{" "}
          · {op.rarity}★
        </span>
      }
    >
      <OperatorIdentity op={op} />
      <div className="step caps">
        <span>Progression</span>
        <span>Current</span>
        <span>Target</span>
      </div>
      <Steps
        label="Elite phase"
        {...p.phase}
        max={op.phases.length - 1}
        change={(k, n) =>
          edit((d) => {
            d.phase[k] = n;
            d.phase.target = Math.max(d.phase.current, d.phase.target);
            for (const key of ["current", "target"] as const)
              d.level[key] = Math.min(
                d.level[key],
                op.phases[d.phase[key]].maxLevel,
              );
            if (d.phase.current === d.phase.target)
              d.level.target = Math.max(d.level.current, d.level.target);
          })
        }
      />
      <div className="step">
        <span>Operator level</span>
        {(["current", "target"] as const).map((k) => (
          <NumberBox
            key={k}
            label={k + " level"}
            value={p.level[k]}
            min={
              k === "target" && p.phase.target === p.phase.current
                ? p.level.current
                : 1
            }
            max={op.phases[p.phase[k]]?.maxLevel ?? 1}
            onChange={(n) =>
              edit((d) => {
                d.level[k] = n;
                if (d.phase.current === d.phase.target)
                  d.level.target = Math.max(d.level.target, d.level.current);
              })
            }
          />
        ))}
      </div>
      <Steps
        label="Shared skill rank"
        {...p.rank}
        min={1}
        max={op.ranks.length + 1}
        change={(k, n) =>
          edit((d) => {
            d.rank[k] = n;
            d.rank.target = Math.max(d.rank.current, d.rank.target);
          })
        }
      />
      {op.skills
        .filter((x) => x.mastery.length)
        .map((x) => (
          <Steps
            key={x.id}
            label={x.name + " mastery"}
            {...(p.skills[x.id] ?? pair())}
            max={x.mastery.length}
            change={(k, n) =>
              edit((d) => {
                const v = (d.skills[x.id] ??= pair());
                v[k] = n;
                v.target = Math.max(v.target, v.current);
              })
            }
          />
        ))}
      <p className="muted">
        Requirements include shared prerequisites once. EXP is a value
        equivalent from the start of the entered level.
      </p>
      {op.modules.map((m) => (
        <ModuleRow op={op} m={m} key={m.id} />
      ))}
    </Panel>
  );
}
