import { useEffect, useSyncExternalStore } from "react";
import { artworkKeys } from "./artworkDb";
let keys = new Set<IDBValidKey>();
let refreshNumber = 0;
const listeners = new Set<() => void>();
export async function refreshArtwork() {
  const request = ++refreshNumber;
  const current = new Set(await artworkKeys());
  if (request !== refreshNumber) return;
  keys = current;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  return keys;
}
let started = false;
export function useArtworkKeys() {
  const current = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    if (!started) {
      started = true;
      void refreshArtwork().catch(() => {
        started = false;
      });
    }
  }, []);
  return current;
}
