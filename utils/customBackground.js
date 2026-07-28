// Custom background images can be large (tens of MB). Storing them as base64
// data URLs is doubly wrong: base64 inflates the payload ~33%, and both
// localStorage (~5MB cap) and a giant inline CSS `url("data:...")` value choke
// on the result. Instead we keep the raw File/Blob in IndexedDB (which honors
// `unlimitedStorage`) and render it via a short-lived `blob:` object URL.

const DB_NAME = "meridian";
const DB_VERSION = 2;
const STORE = "backgrounds";
const THUMBNAIL_STORE = "thumbnails";
const KEY = "custom";
const LEGACY_KEY = "meridian_bg_custom";

let cachedObjectUrl = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
        db.createObjectStore(THUMBNAIL_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(blob) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(blob, KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

function idbGet() {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => {
          db.close();
          resolve(req.result ?? null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      }),
  );
}

function idbDelete() {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

// Persist the uploaded file's raw bytes. `blob` is the File from the picker.
export async function saveCustomBackground(blob) {
  await idbPut(blob);
  // Drop any pre-IndexedDB copies so backends can't diverge.
  try {
    await chrome.storage.local.remove(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

// Forget the stored custom image entirely — used by the "remove / start over"
// affordance. Clears the IndexedDB record, revokes any live object URL, and
// drops the legacy copies so no backend can resurrect the deleted image.
export async function clearCustomBackground() {
  await idbDelete();
  if (cachedObjectUrl) {
    URL.revokeObjectURL(cachedObjectUrl);
    cachedObjectUrl = null;
  }
  try {
    await chrome.storage.local.remove(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

// Returns a URL usable directly in CSS `url(...)`, or null if none is stored.
// The returned `blob:` URL stays valid for the life of the document; the
// previous one is revoked so we don't leak object URLs across replacements.
export async function getCustomBackgroundUrl() {
  const blob = await idbGet();
  if (blob) {
    if (cachedObjectUrl) URL.revokeObjectURL(cachedObjectUrl);
    cachedObjectUrl = URL.createObjectURL(blob);
    return cachedObjectUrl;
  }
  // Legacy fallback: small images uploaded before the IndexedDB move were
  // stored as data URLs. Read them so existing backgrounds still render.
  try {
    const local = await chrome.storage.local.get(LEGACY_KEY);
    if (local[LEGACY_KEY] != null) return local[LEGACY_KEY];
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}
