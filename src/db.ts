import { empty, type State } from "./model.ts";
let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("arknights-planner", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("planner");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function access(edit?: (draft: State) => void): Promise<State> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("planner", edit ? "readwrite" : "readonly");
    const store = tx.objectStore("planner");
    const r = store.get("v1");
    let state: State;
    r.onsuccess = () => {
      try {
        state = r.result ?? empty();
        if (edit) {
          edit(state);
          store.put(state, "v1");
        }
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => resolve(state);
    tx.onabort = () =>
      reject(tx.error ?? Error("Storage transaction aborted."));
    tx.onerror = () => reject(tx.error);
  });
}
