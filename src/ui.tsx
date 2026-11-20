import { createContext, useContext, useState, type ReactNode } from "react";
import { ResourceMark } from "./CatalogVisuals";
import { catalog } from "./catalog.ts";
import type { State } from "./model.ts";
import type { Costs, calculate } from "./calc.ts";
export const sections = [
  "Dashboard",
  "Inventory",
  "Operators",
  "Modules",
  "Pull Planner",
  "Skins",
  "Settings and Backups",
] as const;
export type Page = (typeof sections)[number];
export const iconPaths = [
  "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  "M3 8l9-5 9 5v10l-9 4-9-4z M3 8l9 5 9-5 M12 13v9 M7 6l9 5",
  "M12 12a4 4 0 100-8 4 4 0 000 8z M4 21v-2a8 6 0 0116 0v2",
  "M6 6h12v12H6z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  "M3 6h18v5a2 2 0 000 4v3H3v-3a2 2 0 000-4z M15 7v2m0 2v2m0 2v2",
  "M8 3l4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4z",
  "M4 5h16M4 12h16M4 19h16M8 2v6m8 1v6m-6 1v6",
];
export function Icon({ i, size = 20 }: { i: number; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={iconPaths[i]} />
    </svg>
  );
}
export const fmt = (n: number) => n.toLocaleString();
export const itemName = (id: string) =>
  id === "EXP"
    ? "EXP equivalent"
    : (catalog.items.find((i) => i.id === id)?.name ?? id);
export const Ctx = createContext<null | {
  s: State;
  update: (fn: (s: State) => void) => Promise<void>;
  result: ReturnType<typeof calculate>;
  go: (p: Page) => void;
}>(null);
export function usePlanner() {
  const ctx = useContext(Ctx);
  if (!ctx) throw Error("Planner unavailable");
  return ctx;
}
export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function NumberBox({
  label,
  value,
  onChange,
  max = 999999999,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  min?: number;
}) {
  const [draft, set] = useState<string | null>(null);
  return (
    <input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step="1"
      value={draft ?? value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value;
        set(t);
        const n = e.target.valueAsNumber;
        if (Number.isSafeInteger(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => set(null)}
    />
  );
}

export function Materials({ costs }: { costs: Costs }) {
  const { result } = usePlanner();
  return Object.keys(costs).length ? (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Required</th>
            <th>Owned</th>
            <th>Missing</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(costs).map(([id, n]) => (
            <tr key={id}>
              <td>
                <span className="resource-id">
                  <ResourceMark id={id} />
                  {itemName(id)}
                </span>
              </td>
              <td>{fmt(n)}</td>
              <td>{fmt(result.owned[id] || 0)}</td>
              <td className={n > (result.owned[id] || 0) ? "gold" : ""}>
                {fmt(Math.max(0, n - (result.owned[id] || 0)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="muted">No resources required.</p>
  );
}
