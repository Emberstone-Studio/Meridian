const DB_NAME = "meridian";
const DB_VERSION = 2;
const BACKGROUND_STORE = "backgrounds";
const THUMBNAIL_STORE = "thumbnails";

const displayUrls = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BACKGROUND_STORE)) {
        db.createObjectStore(BACKGROUND_STORE);
      }
      if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
        db.createObjectStore(THUMBNAIL_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(mode, operation) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(THUMBNAIL_STORE, mode);
        const store = transaction.objectStore(THUMBNAIL_STORE);
        let result;

        try {
          result = operation(store);
        } catch (error) {
          db.close();
          reject(error);
          return;
        }

        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error("Thumbnail transaction aborted"));
        };
      }),
  );
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function thumbnailDataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new TypeError("Thumbnail must be an image data URL");
  }
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Could not decode thumbnail data");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size === 0) {
    throw new Error("Decoded thumbnail is not a non-empty image");
  }
  return blob;
}

export async function saveThumbnailBlob(tabId, dataUrl, tabUrl = "") {
  const blob = await thumbnailDataUrlToBlob(dataUrl);
  const record = {
    blob,
    tabUrl,
    updatedAt: Date.now(),
  };
  await runTransaction("readwrite", (store) => {
    store.put(record, String(tabId));
  });
  return record;
}

export async function saveThumbnailBlobIfAbsent(
  tabId,
  dataUrl,
  tabUrl = "",
) {
  const key = String(tabId);
  const blob = await thumbnailDataUrlToBlob(dataUrl);
  return runTransaction("readwrite", (store) => {
    const existingRequest = store.get(key);
    return new Promise((resolve, reject) => {
      existingRequest.onsuccess = () => {
        if (existingRequest.result) {
          resolve(false);
          return;
        }
        const putRequest = store.add(
          {
            blob,
            tabUrl,
            updatedAt: Date.now(),
          },
          key,
        );
        putRequest.onsuccess = () => resolve(true);
        putRequest.onerror = () => reject(putRequest.error);
      };
      existingRequest.onerror = () => reject(existingRequest.error);
    });
  });
}

export async function getThumbnailBlob(tabId) {
  const request = await runTransaction("readonly", (store) =>
    requestResult(store.get(String(tabId))),
  );
  return (await request) ?? null;
}

export async function getAllThumbnailBlobs() {
  const pending = await runTransaction("readonly", (store) => {
    const keys = requestResult(store.getAllKeys());
    const records = requestResult(store.getAll());
    return Promise.all([keys, records]);
  });
  const [keys, records] = await pending;
  return keys.map((key, index) => ({
    tabId: String(key),
    ...records[index],
  }));
}

export async function deleteThumbnailBlobs(tabIds) {
  const ids = [...new Set(tabIds.map((id) => String(id)))];
  if (ids.length === 0) return;
  await runTransaction("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  });
  for (const id of ids) {
    const cached = displayUrls.get(id);
    if (cached) URL.revokeObjectURL(cached.url);
    displayUrls.delete(id);
  }
}

export async function getAllThumbnailDisplayUrls(tabs = null) {
  const records = await getAllThumbnailBlobs();
  const currentIds = new Set(records.map((record) => record.tabId));

  for (const [tabId, cached] of displayUrls) {
    if (currentIds.has(tabId)) continue;
    URL.revokeObjectURL(cached.url);
    displayUrls.delete(tabId);
  }

  const recordUrls = new Map();
  for (const record of records) {
    const token = [
      record.updatedAt,
      record.blob.size,
      record.blob.type,
    ].join(":");
    let cached = displayUrls.get(record.tabId);
    if (!cached || cached.token !== token) {
      if (cached) URL.revokeObjectURL(cached.url);
      cached = {
        token,
        url: URL.createObjectURL(record.blob),
      };
      displayUrls.set(record.tabId, cached);
    }
    recordUrls.set(record.tabId, cached.url);
  }

  if (!Array.isArray(tabs)) {
    return Object.fromEntries(recordUrls);
  }

  const recordsByUrl = new Map();
  for (const record of [...records].sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  )) {
    if (record.tabUrl && !recordsByUrl.has(record.tabUrl)) {
      recordsByUrl.set(record.tabUrl, record);
    }
  }

  const thumbnails = {};
  for (const tab of tabs) {
    const tabId = String(tab.id);
    const exact = records.find((record) => record.tabId === tabId);
    const tabUrl = tab.url ?? tab.pendingUrl ?? "";
    const record =
      exact && (!exact.tabUrl || exact.tabUrl === tabUrl)
        ? exact
        : recordsByUrl.get(tabUrl) ?? exact;
    if (record) thumbnails[tabId] = recordUrls.get(record.tabId);
  }
  return thumbnails;
}
