import { queueStorageMutation } from "./storageMutationQueue.js";
import {
  deleteThumbnailBlobs,
  getAllThumbnailBlobs,
  getAllThumbnailDisplayUrls,
  getThumbnailBlob,
  saveThumbnailBlob,
  saveThumbnailBlobIfAbsent,
} from "./thumbnailBlobStore.js";

const PREFIX = "thumb_";
const ACCESS_KEY = "thumbnailCacheAccess";
const REVISION_KEY = "thumbnailCacheRevision";
const REFRESH_KEY = "thumbnailRefreshNeeded";
const MAX_ENTRIES = 200;
const MAX_BYTES = 50 * 1024 * 1024;
const DEBUG_THUMBNAILS = false;
const hasIndexedDb = typeof indexedDB !== "undefined";

let migrationPromise = null;

function dataUrlBytes(value) {
  return typeof value === "string"
    ? new TextEncoder().encode(value).byteLength
    : 0;
}

async function pruneLegacyThumbnails(incomingKey, incomingDataUrl) {
  await queueStorageMutation(ACCESS_KEY, async () => {
    const [stored, tabs] = await Promise.all([
      chrome.storage.local.get(null),
      chrome.tabs.query({}),
    ]);
    const previousAccess = stored[ACCESS_KEY] ?? {};
    const thumbnails = new Map(
      Object.entries(stored).filter(([key, value]) =>
        key.startsWith(PREFIX) && typeof value === "string"
      ),
    );
    thumbnails.set(incomingKey, incomingDataUrl);

    const access = {};
    for (const [key, value] of thumbnails) {
      const metadata = previousAccess[key];
      access[key] = {
        t: typeof metadata === "number" ? metadata : metadata?.t ?? 0,
        b: dataUrlBytes(value),
      };
    }
    access[incomingKey] = {
      t: Date.now(),
      b: dataUrlBytes(incomingDataUrl),
    };

    const liveKeys = new Set(tabs.map((tab) => PREFIX + tab.id));
    liveKeys.add(incomingKey);
    const entries = [...thumbnails]
      .map(([key]) => ({
        key,
        timestamp: access[key].t,
        bytes: access[key].b,
        live: liveKeys.has(key),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    let totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
    const storedBytesBefore = totalBytes;
    const remove = [];
    for (const entry of entries) {
      if (
        entries.length - remove.length <= MAX_ENTRIES &&
        totalBytes <= MAX_BYTES
      ) {
        break;
      }
      if (entry.live) continue;
      remove.push(entry.key);
      totalBytes -= entry.bytes;
    }
    const retainedAccess = { ...access };
    for (const key of remove) delete retainedAccess[key];

    if (DEBUG_THUMBNAILS) {
      console.debug("[Meridian] Thumbnail cache decision", {
        liveTabCount: tabs.length,
        thumbnailCount: thumbnails.size,
        metadataCountBefore: Object.keys(previousAccess).length,
        storedBytesBefore,
        removedCount: remove.length,
        storedBytesAfter: totalBytes,
        liveSoftCap:
          entries.length - remove.length > MAX_ENTRIES ||
          totalBytes > MAX_BYTES,
      });
    }

    // This one atomic storage write must succeed before any old data is removed.
    // A quota/write failure therefore leaves the previous cache untouched. Keep
    // metadata for planned removals until the corresponding values are gone.
    await chrome.storage.local.set({
      [incomingKey]: incomingDataUrl,
      [ACCESS_KEY]: access,
    });
    if (remove.length) {
      try {
        await chrome.storage.local.remove(remove);
      } catch (error) {
        console.warn(
          "[Meridian] Failed to remove pruned thumbnail orphans:",
          error.message,
        );
        return;
      }
      try {
        await chrome.storage.local.set({ [ACCESS_KEY]: retainedAccess });
      } catch (error) {
        // Stale metadata is safe and is reconciled from real thumb_* values on
        // the next save. The newly stored and all live thumbnails remain valid.
        console.warn(
          "[Meridian] Failed to finalize thumbnail cache metadata:",
          error.message,
        );
      }
    }
  });
}

export async function getThumbnail(tabId) {
  if (hasIndexedDb) {
    await ensureLegacyMigration();
    const exact = await getThumbnailBlob(tabId);
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (_) {
      return exact;
    }
    const tabUrl = tab.url ?? tab.pendingUrl ?? "";
    if (!tabUrl || (exact && (!exact.tabUrl || exact.tabUrl === tabUrl))) {
      return exact;
    }

    const records = await getAllThumbnailBlobs();
    return (
      records
        .filter((record) => record.tabUrl === tabUrl)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ??
      exact
    );
  }
  const key = PREFIX + tabId;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

async function ensureLegacyMigration() {
  if (!hasIndexedDb) return;
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const stored = await chrome.storage.local.get(null);
      const legacyEntries = Object.entries(stored).filter(
        ([key, value]) =>
          key.startsWith(PREFIX) && typeof value === "string",
      );
      if (legacyEntries.length === 0) return;

      const tabs = await chrome.tabs.query({});
      const urls = new Map(
        tabs.map((tab) => [String(tab.id), tab.url ?? tab.pendingUrl ?? ""]),
      );
      const migratedKeys = [];
      for (const [key, dataUrl] of legacyEntries) {
        const tabId = key.slice(PREFIX.length);
        try {
          await saveThumbnailBlobIfAbsent(
            tabId,
            dataUrl,
            urls.get(tabId) ?? "",
          );
          migratedKeys.push(key);
        } catch (error) {
          console.warn(
            "[Meridian] Failed to migrate a legacy thumbnail:",
            error.message,
          );
        }
      }
      if (migratedKeys.length) await chrome.storage.local.remove(migratedKeys);
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}

function accessFromBlobRecords(records) {
  return Object.fromEntries(
    records.map((record) => [
      PREFIX + record.tabId,
      {
        t: record.updatedAt ?? 0,
        b: record.blob?.size ?? 0,
      },
    ]),
  );
}

async function pruneBlobThumbnails(incomingTabId, dataUrl, tabUrl) {
  await queueStorageMutation(ACCESS_KEY, async () => {
    await ensureLegacyMigration();
    await saveThumbnailBlob(incomingTabId, dataUrl, tabUrl);

    const [records, tabs, cacheState] = await Promise.all([
      getAllThumbnailBlobs(),
      chrome.tabs.query({}),
      chrome.storage.local.get([REFRESH_KEY, REVISION_KEY]),
    ]);
    const liveIds = new Set(tabs.map((tab) => String(tab.id)));
    const liveUrls = new Set(
      tabs.map((tab) => tab.url ?? tab.pendingUrl ?? "").filter(Boolean),
    );
    liveIds.add(String(incomingTabId));
    const entries = records
      .map((record) => ({
        ...record,
        bytes: record.blob?.size ?? 0,
        live:
          liveIds.has(record.tabId) ||
          (record.tabUrl && liveUrls.has(record.tabUrl)),
      }))
      .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));

    let totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
    const remove = [];
    for (const entry of entries) {
      if (
        entries.length - remove.length <= MAX_ENTRIES &&
        totalBytes <= MAX_BYTES
      ) {
        break;
      }
      if (entry.live) continue;
      remove.push(entry.tabId);
      totalBytes -= entry.bytes;
    }
    if (remove.length) await deleteThumbnailBlobs(remove);

    const retained = remove.length
      ? records.filter((record) => !remove.includes(record.tabId))
      : records;
    const refreshNeeded = { ...(cacheState[REFRESH_KEY] ?? {}) };
    delete refreshNeeded[String(incomingTabId)];
    await chrome.storage.local.set({
      [ACCESS_KEY]: accessFromBlobRecords(retained),
      [REFRESH_KEY]: refreshNeeded,
      [REVISION_KEY]: (cacheState[REVISION_KEY] ?? 0) + 1,
    });

    if (DEBUG_THUMBNAILS) {
      console.debug("[Meridian] Thumbnail blob cache decision", {
        liveTabCount: tabs.length,
        thumbnailCount: records.length,
        removedCount: remove.length,
        storedBytesAfter: totalBytes,
        liveSoftCap:
          entries.length - remove.length > MAX_ENTRIES ||
          totalBytes > MAX_BYTES,
      });
    }
  });
}

export async function saveThumbnail(tabId, dataUrl, tabUrl = "") {
  if (hasIndexedDb) {
    await pruneBlobThumbnails(tabId, dataUrl, tabUrl);
    return;
  }
  await pruneLegacyThumbnails(PREFIX + tabId, dataUrl);
}

export async function evictThumbnail(tabId) {
  if (hasIndexedDb) {
    return queueStorageMutation(ACCESS_KEY, async () => {
      await ensureLegacyMigration();
      await deleteThumbnailBlobs([tabId]);
      const [records, cacheState] = await Promise.all([
        getAllThumbnailBlobs(),
        chrome.storage.local.get([REFRESH_KEY, REVISION_KEY]),
      ]);
      const refreshNeeded = { ...(cacheState[REFRESH_KEY] ?? {}) };
      delete refreshNeeded[String(tabId)];
      await chrome.storage.local.set({
        [ACCESS_KEY]: accessFromBlobRecords(records),
        [REFRESH_KEY]: refreshNeeded,
        [REVISION_KEY]: (cacheState[REVISION_KEY] ?? 0) + 1,
      });
      return true;
    });
  }
  return removeThumbnailIfMatches(tabId);
}

export async function removeThumbnailIfMatches(tabId, expectedDataUrl) {
  if (hasIndexedDb) {
    // Render failures no longer call this path. Keep the API for explicit
    // maintenance callers, but never infer corruption from an <img> error.
    if (expectedDataUrl !== undefined) return false;
    return evictThumbnail(tabId);
  }
  const key = PREFIX + tabId;
  return queueStorageMutation(ACCESS_KEY, async () => {
    const stored = await chrome.storage.local.get([key, ACCESS_KEY]);
    if (
      expectedDataUrl !== undefined &&
      stored[key] !== expectedDataUrl
    ) {
      return false;
    }
    const access = stored[ACCESS_KEY] ?? {};
    delete access[key];
    await chrome.storage.local.remove(key);
    await chrome.storage.local.set({ [ACCESS_KEY]: access });
    return true;
  });
}

export async function getAllThumbnails() {
  if (hasIndexedDb) {
    await ensureLegacyMigration();
    const tabs = await chrome.tabs.query({});
    return getAllThumbnailDisplayUrls(tabs);
  }
  const all = await chrome.storage.local.get(null);
  const thumbnails = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PREFIX)) {
      thumbnails[key.slice(PREFIX.length)] = value;
    }
  }
  return thumbnails;
}

export async function markThumbnailRefreshNeeded(tabId) {
  return queueStorageMutation(REFRESH_KEY, async () => {
    const stored = await chrome.storage.local.get(REFRESH_KEY);
    const refreshNeeded = { ...(stored[REFRESH_KEY] ?? {}) };
    refreshNeeded[String(tabId)] = true;
    await chrome.storage.local.set({ [REFRESH_KEY]: refreshNeeded });
  });
}

export async function thumbnailNeedsRefresh(tabId) {
  const stored = await chrome.storage.local.get(REFRESH_KEY);
  return Boolean(stored[REFRESH_KEY]?.[String(tabId)]);
}
