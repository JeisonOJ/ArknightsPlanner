import { useState } from "react";

import { budget, type Banner, type Skin } from "./model.ts";
import { Panel, usePlanner, NumberBox, fmt } from "./ui.tsx";
import {
  OperatorPicker,
  OperatorIdentity,
  operatorsById,
} from "./CatalogVisuals";
import { OutfitCatalog } from "./Outfits";
function Wallet() {
  const { s, update } = usePlanner();
  return (
    <div className="wallet">
      {[
        ["4003", "Orundum"],
        ["4002", "Originite Prime"],
        ["7003", "Single permits"],
        ["7004", "Ten-roll permits"],
      ].map(([id, label]) => (
        <label key={id}>
          {label}
          <NumberBox
            label={label}
            value={s.inventory[id] || 0}
            onChange={(n) =>
              update((d) => {
                d.inventory[id] = n;
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
function Controls({
  index,
  length,
  move,
  remove,
}: {
  index: number;
  length: number;
  move: (n: number) => void;
  remove: () => void;
}) {
  return (
    <div className="buttons">
      <button disabled={!index} onClick={() => move(-1)}>
        Move up
      </button>
      <button disabled={index === length - 1} onClick={() => move(1)}>
        Move down
      </button>
      <button
        onClick={() => {
          if (confirm("Remove this plan?")) remove();
        }}
      >
        Remove
      </button>
    </div>
  );
}
function reorder<T extends { id: string }>(rows: T[], id: string, by: number) {
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0 && i + by >= 0 && i + by < rows.length)
    rows.splice(i + by, 0, ...rows.splice(i, 1));
}
export function Pulls() {
  const { s, update } = usePlanner(),
    b = budget(s),
    [name, set] = useState("");
  const edit = (id: string, f: (v: Banner) => void) =>
    update((d) => {
      const row = d.banners.find((x) => x.id === id);
      if (row) f(row);
    });
  return (
    <>
      <Panel
        title="Pull balance"
        action={<strong className="gold">{fmt(b.pulls)} pulls</strong>}
      >
        <Wallet />
        <label className="check">
          <input
            type="checkbox"
            checked={s.settings.usePrime}
            onChange={(e) => {
              const value = e.target.checked;
              update((d) => {
                d.settings.usePrime = value;
              });
            }}
          />{" "}
          Convert unreserved OP for pull estimates ({fmt(b.prime)} OP available)
        </label>
        <p className="muted">
          600 Orundum per pull · 180 Orundum per OP. Only standard headhunting
          permits count.
        </p>
      </Panel>
      <Panel
        title="Banner queue"
        action={
          <span className="tag">
            {fmt(b.shortage)} pulls short · {fmt(b.missingOrundum)} Orundum
            needed
          </span>
        }
      >
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              const row = {
                id: crypto.randomUUID(),
                name: name.trim(),
                operators: [],
                pulls: 0,
                income: 0,
                date: "",
              };
              update((d) => {
                d.banners.push(row);
              });
              set("");
            }
          }}
        >
          <input
            aria-label="Banner name"
            placeholder="Banner name"
            maxLength={200}
            required
            value={name}
            onChange={(e) => set(e.target.value)}
          />
          <button className="primary">Add banner</button>
        </form>
        {s.banners.length > 0 && (
          <p className="muted">
            Balances fund banners in queue order. Estimated income starts at its
            banner and counts as whole pulls.
          </p>
        )}
        {!s.banners.length && (
          <p className="muted">
            Add a banner to allocate pulls in queue order.
          </p>
        )}
        {s.banners.map((row, i) => (
          <article key={row.id} className="plan">
            <div className="line">
              <h3>{row.name}</h3>
              <span className="tag">
                {fmt(b.banners[i].missing)} pulls short ·{" "}
                {fmt(b.banners[i].missingOrundum)} Orundum needed
              </span>
            </div>
            <div className="wallet">
              <label>
                Target pulls
                <NumberBox
                  label="Target pulls"
                  value={row.pulls}
                  onChange={(n) =>
                    edit(row.id, (r) => {
                      r.pulls = n;
                    })
                  }
                />
              </label>
              <label>
                Additional income (pulls)
                <NumberBox
                  label="Additional income in pulls before this banner"
                  value={row.income}
                  onChange={(n) =>
                    edit(row.id, (r) => {
                      r.income = n;
                    })
                  }
                />
              </label>
              <label>
                Expected date
                <input
                  aria-label="Expected banner date"
                  type="date"
                  value={row.date}
                  onChange={(e) => {
                    const value = e.target.value;
                    edit(row.id, (r) => {
                      r.date = value;
                    });
                  }}
                />
              </label>
              <div>
                Add target operator
                <OperatorPicker
                  value=""
                  change={(id) =>
                    edit(row.id, (r) => {
                      if (id && !r.operators.includes(id)) r.operators.push(id);
                    })
                  }
                />
              </div>
            </div>
            <div className="buttons">
              {row.operators.map((id) => (
                <button
                  title="Remove target"
                  key={id}
                  onClick={() =>
                    edit(row.id, (r) => {
                      r.operators = r.operators.filter((v) => v !== id);
                    })
                  }
                >
                  {operatorsById.has(id) ? (
                    <OperatorIdentity op={operatorsById.get(id)!} />
                  ) : (
                    id
                  )}{" "}
                  ×
                </button>
              ))}
            </div>
            <Controls
              index={i}
              length={s.banners.length}
              move={(n) => update((d) => reorder(d.banners, row.id, n))}
              remove={() =>
                update((d) => {
                  d.banners = d.banners.filter((r) => r.id !== row.id);
                })
              }
            />
          </article>
        ))}
      </Panel>
    </>
  );
}
export function Skins() {
  const { s, update } = usePlanner(),
    b = budget(s),
    [name, set] = useState("");
  const edit = (id: string, f: (v: Skin) => void) =>
    update((d) => {
      const row = d.skins.find((x) => x.id === id);
      if (row) f(row);
    });
  let remaining = s.inventory["4002"] || 0;
  return (
    <>
      <div className="strip">
        <span>Selected skin reservations</span>
        <strong>{fmt(b.reserved)} OP</strong>
        <span>
          {b.unknown} unpriced · {fmt(b.prime)} OP left for pulls
        </span>
      </div>
      <OutfitCatalog />
      <Panel title="Outfit wishlist">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              const row = {
                id: crypto.randomUUID(),
                name: name.trim(),
                operator: "",
                skinId: "",
                price: null,
                owned: false,
                reserve: true,
                release: "",
              };
              update((d) => {
                d.skins.push(row);
              });
              set("");
            }
          }}
        >
          <input
            aria-label="Outfit name"
            placeholder="Outfit name"
            maxLength={200}
            required
            value={name}
            onChange={(e) => set(e.target.value)}
          />
          <button className="primary">Add outfit</button>
        </form>
        {!s.skins.length && (
          <p className="muted">Add an outfit and enter its price when known.</p>
        )}
        {s.skins.map((row, i) => {
          const fits = row.price !== null && remaining >= row.price;
          if (row.reserve && !row.owned) remaining -= row.price ?? 0;
          return (
            <article className="plan" key={row.id}>
              <div className="line">
                <h3>{row.name}</h3>
                <span className="tag">
                  {row.owned
                    ? "Owned"
                    : row.price === null
                      ? "Price unknown"
                      : fits
                        ? "Affordable in order"
                        : "Insufficient OP"}
                </span>
              </div>
              <div className="wallet">
                <div>
                  Operator
                  <OperatorPicker
                    clear
                    value={row.operator}
                    change={(id) =>
                      edit(row.id, (r) => {
                        r.operator = id;
                      })
                    }
                  />
                </div>
                <label>
                  Price in OP
                  <input
                    type="number"
                    min="0"
                    aria-label="Price in OP"
                    placeholder="Unknown"
                    value={row.price ?? ""}
                    onChange={(e) => {
                      const t = e.target.value,
                        n = e.target.valueAsNumber;
                      if (
                        t === "" ||
                        (Number.isSafeInteger(n) && n >= 0 && n <= 999999999)
                      )
                        edit(row.id, (r) => {
                          r.price = t === "" ? null : n;
                        });
                    }}
                  />
                </label>
                <label>
                  Catalog skin ID
                  <input
                    defaultValue={row.skinId}
                    key={row.id + row.skinId}
                    maxLength={300}
                    onBlur={(e) => {
                      const value = e.target.value;
                      edit(row.id, (r) => {
                        r.skinId = value;
                      });
                    }}
                  />
                </label>
                <label>
                  Expected release
                  <input
                    defaultValue={row.release}
                    key={row.id + row.release}
                    maxLength={300}
                    placeholder="Unknown"
                    onBlur={(e) => {
                      const value = e.target.value;
                      edit(row.id, (r) => {
                        r.release = value;
                      });
                    }}
                  />
                </label>
              </div>
              <div className="filters">
                <label>
                  <input
                    type="checkbox"
                    checked={row.reserve}
                    onChange={(e) => {
                      const value = e.target.checked;
                      edit(row.id, (r) => {
                        r.reserve = value;
                      });
                    }}
                  />{" "}
                  Reserve OP
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={row.owned}
                    onChange={(e) => {
                      const value = e.target.checked;
                      edit(row.id, (r) => {
                        r.owned = value;
                      });
                    }}
                  />{" "}
                  Owned
                </label>
              </div>
              <Controls
                index={i}
                length={s.skins.length}
                move={(n) => update((d) => reorder(d.skins, row.id, n))}
                remove={() =>
                  update((d) => {
                    d.skins = d.skins.filter((r) => r.id !== row.id);
                  })
                }
              />
            </article>
          );
        })}
      </Panel>
    </>
  );
}
