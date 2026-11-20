import type { ArtworkKind } from "./artworkMatch.ts";

export type ArtworkRecord = {
  key: string;
  kind: ArtworkKind;
  blob: Blob;
  path: string;
};
let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("arknights-planner-artwork", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("images", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = undefined;
      reject(request.error);
    };
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, done: (value: T) => void) => void,
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("images", mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(tx.error ?? Error("Artwork storage transaction was aborted."));
    operation(tx.objectStore("images"), (value) => {
      result = value;
    });
  });
}
export const artworkKeys = () =>
  transaction<IDBValidKey[]>("readonly", (store, done) => {
    const request = store.getAllKeys();
    request.onsuccess = () => done(request.result);
  });
export const readArtwork = (key: string) =>
  transaction<ArtworkRecord | undefined>("readonly", (store, done) => {
    const request = store.get(key);
    request.onsuccess = () => done(request.result);
  });
export const clearArtwork = () =>
  transaction<void>("readwrite", (store) => {
    store.clear();
  });
export const saveArtwork = (record: ArtworkRecord, replace: boolean) =>
  transaction<boolean>("readwrite", (store, done) => {
    const request = store.getKey(record.key);
    request.onsuccess = () => {
      if (request.result !== undefined && !replace) return done(false);
      store.put(record);
      done(true);
    };
  });
