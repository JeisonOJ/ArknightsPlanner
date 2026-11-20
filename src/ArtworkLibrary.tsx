import { useEffect, useState } from "react";
import { clearArtwork } from "./artworkDb";
import { importArtwork, type ImportSummary } from "./artworkImport";
import { Panel } from "./ui";

import { useArtworkKeys, refreshArtwork } from "./artworkKeys";
export function ArtworkLibrary() {
  const keys = useArtworkKeys();
  const [replace, setReplace] = useState(false),
    [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary>(),
    [status, setStatus] = useState("");
  const [usage, setUsage] = useState("");
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage, quota }) => {
        const mib = (n: number) =>
          Math.round(n / 1048576).toLocaleString() + " MiB";
        if (usage !== undefined && quota !== undefined)
          setUsage(
            mib(usage) +
              " used of approximately " +
              mib(quota) +
              " for this site",
          );
      })
      .catch(() => {});
  }, [keys]);
  async function start(list: FileList | null, zip: boolean) {
    const files = Array.from(list ?? []);
    if (!files.length || busy) return;
    setBusy(true);
    setSummary(undefined);
    setStatus("Scanning filenames…");
    try {
      await importArtwork(files, zip, replace, setSummary);
      setStatus("Import finished.");
    } catch (error) {
      setStatus(
        "Import stopped. Images already saved remain available. " +
          String(error),
      );
    } finally {
      await refreshArtwork().catch(() =>
        setStatus("Could not read artwork storage."),
      );
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !confirm(
        "Remove imported artwork from this browser? This action affects only the artwork library.",
      )
    )
      return;
    setBusy(true);
    try {
      await clearArtwork();
      await refreshArtwork();
      setSummary(undefined);
      setStatus("Imported artwork removed.");
    } catch (error) {
      setStatus("Could not remove artwork. " + String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Artwork Library">
      <p>
        {keys.size.toLocaleString()} imported images{usage && " · " + usage}
      </p>
      <p className="muted">
        Import assets from your device. Images are stored in this browser and
        excluded from planner backups.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={replace}
          disabled={busy}
          onChange={(e) => setReplace(e.target.checked)}
        />{" "}
        Replace matching artwork already in the library
      </label>
      <div className="filters">
        <label className="file">
          Import folder
          <input
            aria-label="Import artwork folder"
            type="file"
            {...{ webkitdirectory: "" }}
            multiple
            disabled={busy}
            onChange={(e) => {
              void start(e.currentTarget.files, false);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <label className="file">
          Import ZIP
          <input
            aria-label="Import artwork ZIP"
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(e) => {
              void start(e.currentTarget.files, true);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button disabled={busy || keys.size === 0} onClick={remove}>
          Remove imported artwork
        </button>
      </div>
      {busy && (
        <progress
          aria-label="Artwork import progress"
          max={summary?.total || 1}
          value={summary?.processed}
        />
      )}
      {summary && (
        <>
          <p>
            {summary.images} image files · {summary.matched.operator} operators
            · {summary.matched.operatorArt} operator illustrations ·{" "}
            {summary.matched.item} materials · {summary.matched.module} modules
            · {summary.matched.outfit} outfit thumbnails ·{" "}
            {summary.matched.illustration} outfit illustrations
          </p>
          <p>
            {summary.processed} / {summary.total} matches processed ·{" "}
            {summary.saved} saved · {summary.existing} kept from library ·{" "}
            {summary.duplicates} alternate files · {summary.unmatched} unmatched
            · {summary.unsupported} unsupported · {summary.failed} unreadable or
            oversized
          </p>
          {summary.examples.length > 0 && (
            <details>
              <summary>Example files that could not be imported</summary>
              <ul>
                {summary.examples.map((path, i) => (
                  <li key={i}>{path}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {status && <p role="status">{status}</p>}
    </Panel>
  );
}
