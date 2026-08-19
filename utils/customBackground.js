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
export const CUSTOM_BACKGROUND_REVISION_KEY = "customBackgroundRevision";

let cachedObjectUrl = null;
let cachedRevision = null;
let cacheNeedsRefresh = false;
let refreshQueue = Promise.resolve();
let unversionedRefresh = null;
const revisionRefreshes = new Map();

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

function createRevision() {
  const nonce =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${Date.now()}-${nonce}`;
}

async function publishRevision() {
  const revision = createRevision();
  await chrome.storage.local.set({
    [CUSTOM_BACKGROUND_REVISION_KEY]: revision,
  });
  return revision;
}

async function getLegacyBackgroundUrl() {
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

function revokeAfterSwap(url) {
  // Consumers awaiting the refresh get a turn to replace their CSS/image src
  // before the object URL backing the previous image is released.
  const revoke = URL.revokeObjectURL.bind(URL);
  setTimeout(() => revoke(url), 0);
}

// Persist the uploaded file's raw bytes. `blob` is the File from the picker.
export async function saveCustomBackground(blob) {
  await idbPut(blob);
  cacheNeedsRefresh = true;
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
  return publishRevision();
}

// Forget the stored custom image entirely — used by the "remove / start over"
// affordance. Clears the IndexedDB record and drops the legacy copies so no
// backend can resurrect the deleted image. The refresh triggered by the
// revision signal safely retires any live object URL.
export async function clearCustomBackground() {
  await idbDelete();
  cacheNeedsRefresh = true;
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
  return publishRevision();
}

// Returns a URL usable directly in CSS `url(...)`, or null if none is stored.
// The returned `blob:` URL stays valid until the image is replaced or cleared.
export async function getCustomBackgroundUrl() {
  if (cachedObjectUrl && !cacheNeedsRefresh) return cachedObjectUrl;
  return refreshCustomBackgroundUrl();
}

// Refetch the shared IndexedDB value after another extension context announces
// a revision. Refreshes are serialized so rapid replacements settle in signal
// order, while duplicate listeners in one document share the same work.
export function refreshCustomBackgroundUrl(revision = null) {
  if (
    revision != null &&
    revision === cachedRevision &&
    !cacheNeedsRefresh
  ) {
    return Promise.resolve(cachedObjectUrl);
  }
  if (revision != null && revisionRefreshes.has(revision)) {
    return revisionRefreshes.get(revision);
  }
  if (revision == null && unversionedRefresh) return unversionedRefresh;

  const refresh = refreshQueue.then(async () => {
    if (
      revision != null &&
      revision === cachedRevision &&
      !cacheNeedsRefresh
    ) {
      return cachedObjectUrl;
    }

    const blob = await idbGet();
    const nextObjectUrl = blob ? URL.createObjectURL(blob) : null;
    const nextUrl = nextObjectUrl ?? (await getLegacyBackgroundUrl());
    const previousObjectUrl = cachedObjectUrl;

    cachedObjectUrl = nextObjectUrl;
    cachedRevision = revision;
    cacheNeedsRefresh = false;

    if (previousObjectUrl && previousObjectUrl !== nextObjectUrl) {
      revokeAfterSwap(previousObjectUrl);
    }
    return nextUrl;
  });

  refreshQueue = refresh.catch(() => {});
  if (revision != null) {
    revisionRefreshes.set(revision, refresh);
    refresh.then(
      () => revisionRefreshes.delete(revision),
      () => revisionRefreshes.delete(revision),
    );
  } else {
    unversionedRefresh = refresh;
    refresh.then(
      () => {
        unversionedRefresh = null;
      },
      () => {
        unversionedRefresh = null;
      },
    );
  }
  return refresh;
}
