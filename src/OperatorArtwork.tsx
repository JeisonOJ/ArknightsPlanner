import { useState } from "react";
import { Art, OperatorIdentity, opName } from "./CatalogVisuals";
import { useArtworkKeys } from "./artworkKeys";
import { Panel } from "./ui";
import type { Operator } from "./catalog";

export function OperatorArtwork({ op }: { op: Operator }) {
  const keys = useArtworkKeys();
  const [selection, setSelection] = useState<string>();
  const variants = op.artwork
    .map(({ phase }) => ({
      key: "operatorArt:" + op.id + ":" + (phase ?? "form"),
      label:
        phase === null
          ? "Form artwork"
          : phase === 0
            ? "Base / E0"
            : "Elite " + phase,
    }))
    .filter(({ key }) => keys.has(key));
  const selected = variants.find(({ key }) => key === selection) ?? variants[0];
  return (
    <Panel title="Operator artwork">
      {selected ? (
        <>
          <div className="operator-art">
            <Art
              localKey={selected.key}
              alt={opName(op) + " · " + selected.label}
              fallback={
                <span className="muted">Illustration unavailable.</span>
              }
            />
          </div>
          <div className="buttons" role="group" aria-label="Artwork variants">
            {variants.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === selected.key}
                onClick={() => setSelection(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <OperatorIdentity op={op} />
          <p className="muted">
            Import your existing skin folder in Settings &amp; backups to add
            full operator illustrations.
          </p>
        </>
      )}
    </Panel>
  );
}
