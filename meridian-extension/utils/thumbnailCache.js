import { mutateStorageValue } from "./storageMutationQueue.js";

const PREFIX = "thumb_";
const ACCESS_KEY = "thumbnailCacheAccess";
const MAX_ENTRIES = 200;
const MAX_BYTES = 50 * 1024 * 1024;

function dataUrlBytes(value) {
  return typeof value === "string" ? value.length : 0;
}

async function pruneThumbnails(incomingKey, incomingDataUrl) {
  await mutateStorageValue(ACCESS_KEY, {}, async (access) => {
    access[incomingKey] = {
      t: Date.now(),
      b: dataUrlBytes(incomingDataUrl),
    };
    const entries = Object.entries(access)
      .map(([key, metadata]) => ({
        key,
        timestamp: typeof metadata === "number" ? metadata : metadata?.t ?? 0,
        bytes: typeof metadata === "number" ? 0 : metadata?.b ?? 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    let totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
    const remove = [];
    while (
      entries.length - remove.length > MAX_ENTRIES ||
      totalBytes > MAX_BYTES
    ) {
      const entry = entries[remove.length];
      if (!entry || entry.key === incomingKey) break;
      remove.push(entry.key);
      totalBytes -= entry.bytes;
      delete access[entry.key];
    }

    if (remove.length) await chrome.storage.local.remove(remove);
    await chrome.storage.local.set({ [incomingKey]: incomingDataUrl });
    return access;
  });
}

export async function getThumbnail(tabId) {
  const key = PREFIX + tabId;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

export async function saveThumbnail(tabId, dataUrl) {
  await pruneThumbnails(PREFIX + tabId, dataUrl);
}

export async function evictThumbnail(tabId) {
  const key = PREFIX + tabId;
  await mutateStorageValue(ACCESS_KEY, {}, async (access) => {
    delete access[key];
    await chrome.storage.local.remove(key);
    return access;
  });
}

export async function getAllThumbnails() {
  const all = await chrome.storage.local.get(null);
  const thumbnails = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PREFIX)) {
      thumbnails[key.slice(PREFIX.length)] = value;
    }
  }
  return thumbnails;
}
