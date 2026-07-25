const PREFIX = "thumb_";
const ACCESS_KEY = "thumbnailCacheAccess";
const MAX_ENTRIES = 200;
const MAX_BYTES = 50 * 1024 * 1024;

function dataUrlBytes(value) {
  return typeof value === "string" ? value.length * 2 : 0;
}

async function pruneThumbnails(incomingKey, incomingDataUrl) {
  const all = await chrome.storage.local.get(null);
  const access = { ...(all[ACCESS_KEY] ?? {}), [incomingKey]: Date.now() };
  const entries = Object.entries(all)
    .filter(([key]) => key.startsWith(PREFIX) && key !== incomingKey)
    .map(([key, value]) => ({ key, bytes: dataUrlBytes(value) }));

  entries.push({ key: incomingKey, bytes: dataUrlBytes(incomingDataUrl) });
  entries.sort((a, b) => (access[a.key] ?? 0) - (access[b.key] ?? 0));

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
  await chrome.storage.local.set({
    [incomingKey]: incomingDataUrl,
    [ACCESS_KEY]: access,
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
  const { [ACCESS_KEY]: storedAccess = {} } =
    await chrome.storage.local.get(ACCESS_KEY);
  const access = { ...storedAccess };
  delete access[key];
  await chrome.storage.local.remove(key);
  await chrome.storage.local.set({ [ACCESS_KEY]: access });
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
