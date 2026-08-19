import { initTabIndex, rebuildIndex } from './utils/browserSearch.js';
import { disableRemovedLocalSearchPermissions } from "./utils/localSearch.js";
import {
  evictThumbnail,
  getThumbnail,
  markThumbnailRefreshNeeded,
  saveThumbnail,
  thumbnailNeedsRefresh,
} from "./utils/thumbnailCache.js";
import { resizeThumbnailDataUrl } from "./utils/thumbnailImage.js";

let meridianTabId = null;
const meridianTabsByWindow = new Map();
let meridianTabsHydrated = false;
let meridianTabsHydration = null;
const ensuringMeridianTabsByWindow = new Map();

function getMeridianUrl() {
  return chrome.runtime.getURL("meridian.html");
}

function isMeridianTab(tab) {
  const url = getMeridianUrl();
  return (
    tab.url === url ||
    tab.pendingUrl === url ||
    tab.url === "chrome://newtab/" ||
    tab.pendingUrl === "chrome://newtab/"
  );
}

function isManagedMeridianTabId(tabId) {
  if (tabId === meridianTabId) return true;
  return [...meridianTabsByWindow.values()].includes(tabId);
}

function persistMeridianTabs() {
  const meridianTabIds = Object.fromEntries(meridianTabsByWindow);
  meridianTabId = meridianTabsByWindow.values().next().value ?? null;
  chrome.storage.local.set({ meridianTabIds, meridianTabId });
}

function rememberMeridianTab(tab) {
  if (tab?.id == null || tab?.windowId == null) return;
  for (const [windowId, tabId] of meridianTabsByWindow) {
    if (tabId === tab.id && windowId !== tab.windowId) {
      meridianTabsByWindow.delete(windowId);
    }
  }
  meridianTabsByWindow.set(tab.windowId, tab.id);
  persistMeridianTabs();
}

async function resolveMeridianTabs() {
  if (meridianTabsHydrated) return;
  if (meridianTabsHydration) return meridianTabsHydration;

  meridianTabsHydration = (async () => {
    const stored = await chrome.storage.local.get([
      "meridianTabIds",
      "meridianTabId",
    ]);
    const storedIds = new Set(
      Object.values(stored.meridianTabIds ?? {})
        .concat(stored.meridianTabId ?? [])
        .filter((id) => Number.isInteger(id)),
    );

    for (const id of storedIds) {
      try {
        const tab = await chrome.tabs.get(id);
        if (tab?.id != null && tab?.windowId != null) {
          meridianTabsByWindow.set(tab.windowId, tab.id);
        }
      } catch (_) {
        /* tab gone */
      }
    }

    const pinnedTabs = await chrome.tabs.query({ pinned: true });
    for (const tab of pinnedTabs.filter(isMeridianTab)) {
      if (!meridianTabsByWindow.has(tab.windowId)) {
        meridianTabsByWindow.set(tab.windowId, tab.id);
      }
    }

    meridianTabsHydrated = true;
    persistMeridianTabs();
  })().finally(() => {
    meridianTabsHydration = null;
  });

  return meridianTabsHydration;
}

async function normalizeMeridianTab(tab) {
  const update = {};
  if (!tab.pinned) update.pinned = true;
  if (!isMeridianTab(tab)) update.url = getMeridianUrl();
  if (Object.keys(update).length > 0) {
    try {
      tab = await chrome.tabs.update(tab.id, update);
    } catch (_) {
      /* window or tab closed */
      return null;
    }
  }
  if (tab.index !== 0) {
    try {
      tab = await chrome.tabs.move(tab.id, { index: 0 });
    } catch (_) {
      /* window or tab closed */
      return null;
    }
  }
  rememberMeridianTab(tab);
  return tab;
}

async function ensureMeridianTabInWindow(windowId, options = null) {
  const { reuseUnpinned = false, active = true } = options ?? {};
  const mappedId = meridianTabsByWindow.get(windowId);
  if (mappedId != null) {
    try {
      const mappedTab = await chrome.tabs.get(mappedId);
      if (mappedTab.windowId === windowId) return normalizeMeridianTab(mappedTab);
    } catch (_) {
      meridianTabsByWindow.delete(windowId);
    }
  }

  let tabs;
  try {
    tabs = await chrome.tabs.query({ windowId });
  } catch (_) {
    /* window closed */
    return null;
  }
  const existing =
    tabs.find((tab) => tab.pinned && isMeridianTab(tab)) ??
    (reuseUnpinned ? tabs.find(isMeridianTab) : null);
  if (existing) return normalizeMeridianTab(existing);

  let tab;
  try {
    tab = await chrome.tabs.create({
      windowId,
      pinned: true,
      active,
      index: 0,
      url: getMeridianUrl(),
    });
  } catch (_) {
    /* window closed */
    return null;
  }
  rememberMeridianTab(tab);
  return tab;
}

async function ensureMeridianTab(windowId = null, options = null) {
  const { reuseUnpinned = false, active = true } = options ?? {};
  await resolveMeridianTabs();

  if (windowId == null) {
    const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
    return Promise.all(
      windows.map((window) =>
        ensureMeridianTab(window.id, { reuseUnpinned: true }),
      ),
    );
  }

  const pending = ensuringMeridianTabsByWindow.get(windowId);
  if (pending) return pending;

  const ensure = ensureMeridianTabInWindow(windowId, {
    reuseUnpinned,
    active,
  }).finally(() => {
    if (ensuringMeridianTabsByWindow.get(windowId) === ensure) {
      ensuringMeridianTabsByWindow.delete(windowId);
    }
  });
  ensuringMeridianTabsByWindow.set(windowId, ensure);
  return ensure;
}

async function resolveMeridianTabId() {
  await resolveMeridianTabs();
  if (meridianTabId === null) {
    const tabs = await chrome.tabs.query({ pinned: true });
    const tab = tabs.find(isMeridianTab);
    if (tab) rememberMeridianTab(tab);
  }
}

async function focusMeridianTab(windowId) {
  const tab = await ensureMeridianTab(windowId);
  if (!tab) return null;
  try {
    await chrome.tabs.update(tab.id, { active: true });
  } catch (_) {
    /* window or tab closed */
    return null;
  }
  return tab;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureTab(tabId, windowId) {
  try {
    // Immediately before capturing, confirm the intended tab is still the active
    // tab in the target window. A delayed capture could otherwise persist a
    // different tab's screenshot (e.g. Meridian) under this tab's id.
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (!activeTab || activeTab.id !== tabId) {
      return;
    }
    // captureVisibleTab only supports "jpeg" | "png" (NOT webp). Resize the
    // full-window capture before storage so cards do not retain screen-sized data.
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 72,
    });
    const thumbnail = await resizeThumbnailDataUrl(dataUrl);
    const [stillActiveTab] = await chrome.tabs.query({ active: true, windowId });
    if (!stillActiveTab || stillActiveTab.id !== tabId) {
      return false;
    }
    await saveThumbnail(
      tabId,
      thumbnail,
      stillActiveTab.url ?? stillActiveTab.pendingUrl ?? "",
    );
    console.log("[Meridian] Saved thumbnail for tab", tabId);
    return true;
  } catch (err) {
    console.warn(
      "[Meridian] captureVisibleTab failed for tab",
      tabId,
      ":",
      err.message,
    );
    return false;
  }
}

chrome.runtime.onInstalled.addListener(() => ensureMeridianTab().catch(() => {}));

chrome.runtime.onStartup.addListener(() => ensureMeridianTab().catch(() => {}));

chrome.windows.onCreated.addListener((window) => {
  if (window.type && window.type !== "normal") return;
  setTimeout(
    () =>
      ensureMeridianTab(window.id, { reuseUnpinned: true }).catch(() => {}),
    100,
  );
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  await resolveMeridianTabs();
  if (!meridianTabsByWindow.delete(windowId)) return;
  persistMeridianTabs();
});

chrome.permissions.onRemoved.addListener((removed) => {
  disableRemovedLocalSearchPermissions(removed);
});

async function handleTabRemoved(tabId, removeInfo) {
  removeInfo ??= {};
  console.debug("[Meridian] Thumbnail lifecycle", {
    event: "tab-removed",
    tabId,
  });
  if (!removeInfo.isWindowClosing) {
    try {
      await evictThumbnail(tabId);
    } catch (error) {
      console.warn(
        "[Meridian] Failed to evict removed tab thumbnail:",
        error.message,
      );
    }
  }

  const stored = await chrome.storage.local.get([
    "meridianTabIds",
    "meridianTabId",
  ]);
  const storedEntry = Object.entries(stored.meridianTabIds ?? {}).find(
    ([, id]) => id === tabId,
  );
  const wasStoredMeridian =
    Boolean(storedEntry) || stored.meridianTabId === tabId;
  await resolveMeridianTabs();
  let windowId =
    removeInfo.windowId ??
    (storedEntry ? Number.parseInt(storedEntry[0], 10) : undefined);
  if (!wasStoredMeridian && !isManagedMeridianTabId(tabId)) return;
  if (windowId == null) {
    windowId = [...meridianTabsByWindow].find(([, id]) => id === tabId)?.[0];
  }
  if (windowId != null) meridianTabsByWindow.delete(windowId);
  persistMeridianTabs();
  if (removeInfo.isWindowClosing || windowId == null) return;
  setTimeout(() => ensureMeridianTab(windowId).catch(() => {}), 150);
}

chrome.tabs.onRemoved.addListener(handleTabRemoved);

chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  await resolveMeridianTabs();
  if (meridianTabsByWindow.get(detachInfo.oldWindowId) !== tabId) return;
  meridianTabsByWindow.delete(detachInfo.oldWindowId);
  persistMeridianTabs();
  setTimeout(
    () => ensureMeridianTab(detachInfo.oldWindowId).catch(() => {}),
    150,
  );
});

chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  await resolveMeridianTabs();
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    return;
  }
  if (!isMeridianTab(tab)) return;
  const existingId = meridianTabsByWindow.get(attachInfo.newWindowId);
  if (existingId != null && existingId !== tabId) {
    try {
      await chrome.tabs.remove(tabId);
    } catch (_) {
      /* tab moved or closed again */
    }
    return;
  }
  await normalizeMeridianTab(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "focus-meridian") return;
  const window = await chrome.windows.getLastFocused();
  if (window?.id != null) await focusMeridianTab(window.id);
});

let isRefreshing = false;

// Debounce/generation state scoped per window: windowId -> latest generation.
// Each activation or completed navigation in a window bumps that window's
// generation, so a pending capture is only kept if nothing newer happened in
// the SAME window. Activity in another window can no longer cancel valid work.
const captureGenerations = new Map();
const MAX_LAZY_CAPTURE_ATTEMPTS = 3;
const LAZY_CAPTURE_BACKOFF_MS = 750;

function nextCaptureGeneration(windowId) {
  const generation = (captureGenerations.get(windowId) || 0) + 1;
  captureGenerations.set(windowId, generation);
  return generation;
}

async function captureActiveTabWithRetry(
  tabId,
  windowId,
  generation,
  attempts,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (captureGenerations.get(windowId) !== generation) return false;
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (!activeTab || activeTab.id !== tabId) return false;
    if (await captureTab(tabId, windowId)) return true;
    if (attempt + 1 < attempts) {
      await sleep(LAZY_CAPTURE_BACKOFF_MS * 2 ** attempt);
    }
  }
  return false;
}

async function handleActivatedCapture(activeInfo) {
  if (isRefreshing) return;
  await resolveMeridianTabId();
  // Bump the generation for EVERY activation, including Meridian's, so becoming
  // active on Meridian invalidates a pending capture for the previous tab.
  const generation = nextCaptureGeneration(activeInfo.windowId);
  if (isManagedMeridianTabId(activeInfo.tabId)) return;
  await sleep(600);
  if (captureGenerations.get(activeInfo.windowId) !== generation) return;
  let thumbnail;
  try {
    thumbnail = await getThumbnail(activeInfo.tabId);
  } catch (error) {
    console.warn(
      "[Meridian] Failed to inspect active tab thumbnail:",
      error.message,
    );
    return;
  }
  const needsRefresh = await thumbnailNeedsRefresh(activeInfo.tabId);
  if (thumbnail && !needsRefresh) return;
  console.debug("[Meridian] Thumbnail lifecycle", {
    event: "active-tab-missing-thumbnail",
    tabId: activeInfo.tabId,
    windowId: activeInfo.windowId,
  });
  await captureActiveTabWithRetry(
    activeInfo.tabId,
    activeInfo.windowId,
    generation,
    MAX_LAZY_CAPTURE_ATTEMPTS,
  );
}

chrome.tabs.onActivated.addListener(handleActivatedCapture);

const replacingMeridianTabs = new Set();

async function protectMeridianTab(tabId, changeInfo, tab) {
  const navigatedUrl = changeInfo.url;
  if (!navigatedUrl || isMeridianTab({ url: navigatedUrl })) {
    if (changeInfo.pinned === false) await normalizeMeridianTab(tab);
    return;
  }

  if (replacingMeridianTabs.has(tabId)) return;
  replacingMeridianTabs.add(tabId);

  try {
    const windowId = tab.windowId;
    if (windowId == null) return;

    let wasManaged = meridianTabId === tabId;
    for (const [mappedWindowId, mappedTabId] of meridianTabsByWindow) {
      if (mappedTabId !== tabId) continue;
      meridianTabsByWindow.delete(mappedWindowId);
      wasManaged = true;
    }
    if (!wasManaged) return;
    persistMeridianTabs();

    try {
      if (tab.pinned) await chrome.tabs.update(tabId, { pinned: false });
    } catch (_) {
      /* the replacement is still needed if the destination tab closed */
    }
    await ensureMeridianTab(windowId, { active: false });
  } finally {
    replacingMeridianTabs.delete(tabId);
  }
}

async function handleUpdatedCapture(tabId, changeInfo, tab) {
  if (isRefreshing) return;
  await resolveMeridianTabId();
  if (isManagedMeridianTabId(tabId)) {
    await protectMeridianTab(tabId, changeInfo, tab);
    return;
  }
  if (changeInfo.status !== "complete" || !tab.active) return;
  const generation = nextCaptureGeneration(tab.windowId);
  await sleep(400);
  if (captureGenerations.get(tab.windowId) !== generation) return;
  let thumbnail;
  try {
    thumbnail = await getThumbnail(tabId);
  } catch (error) {
    console.warn(
      "[Meridian] Failed to inspect loaded tab thumbnail:",
      error.message,
    );
    return;
  }
  console.debug("[Meridian] Thumbnail lifecycle", {
    event: "active-tab-load-complete",
    tabId,
    windowId: tab.windowId,
    hadThumbnail: Boolean(thumbnail),
    discarded: Boolean(tab.discarded),
    frozen: Boolean(tab.frozen),
  });
  await captureActiveTabWithRetry(
    tabId,
    tab.windowId,
    generation,
    thumbnail ? 1 : MAX_LAZY_CAPTURE_ATTEMPTS,
  );
}

chrome.tabs.onUpdated.addListener(handleUpdatedCapture);

chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
  if (moveInfo.toIndex === 0) return;
  await resolveMeridianTabId();
  if (!isManagedMeridianTabId(tabId)) return;
  try {
    await chrome.tabs.move(tabId, { index: 0 });
  } catch (_) {
    /* tab or window closed */
  }
});

async function refreshAllThumbnails() {
  await resolveMeridianTabId();
  const allTabs = await chrome.tabs.query({});
  const capturable = allTabs.filter(
    (t) =>
      !isManagedMeridianTabId(t.id) &&
      t.url &&
      !t.url.startsWith("chrome://") &&
      !t.url.startsWith("chrome-extension://") &&
      !t.url.startsWith("about:"),
  );

  const activeTabs = await chrome.tabs.query({ active: true });
  const originalActive = new Map(activeTabs.map((t) => [t.windowId, t.id]));

  isRefreshing = true;
  try {
    for (const tab of capturable) {
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await sleep(800);
        await captureTab(tab.id, tab.windowId);
      } catch (err) {
        console.warn(
          "[Meridian] Failed to refresh thumbnail for tab",
          tab.id,
          ":",
          err.message,
        );
      }
    }
  } finally {
    for (const [, tabId] of originalActive) {
      try {
        await chrome.tabs.update(tabId, { active: true });
      } catch (_) {
        /* tab gone */
      }
    }
    isRefreshing = false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FOCUS_MERIDIAN") {
    const windowId = msg.windowId ?? sender.tab?.windowId;
    if (windowId == null) {
      sendResponse({ focused: false });
      return;
    }
    focusMeridianTab(windowId).then(
      (tab) => sendResponse({ focused: true, tabId: tab.id }),
      (err) => {
        console.warn("[Meridian] Could not focus Meridian:", err.message);
        sendResponse({ focused: false });
      },
    );
    return true;
  }
  if (msg.type === "GET_TABS") {
    chrome.tabs.query({}).then((tabs) => sendResponse(tabs));
    return true;
  }
  if (msg.type === "CLOSE_TAB") {
    chrome.tabs.remove(msg.tabId);
  }
  if (msg.type === "REFRESH_THUMBNAILS") {
    refreshAllThumbnails().then(
      () => sendResponse({ done: true }),
      (err) => {
        console.warn("[Meridian] Failed to refresh thumbnails:", err.message);
        sendResponse({ done: false });
      },
    );
    return true;
  }
  if (msg.type === "MARK_THUMBNAIL_REFRESH_NEEDED") {
    markThumbnailRefreshNeeded(msg.tabId).then(
      () => sendResponse({ marked: true }),
      (err) => {
        console.warn(
          "[Meridian] Failed to mark thumbnail for refresh:",
          err.message,
        );
        sendResponse({ marked: false });
      },
    );
    return true;
  }
});

// Open side panel when toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Tab search index
rebuildIndex();
initTabIndex();

// Track previous tab for popup's "switch to previous tab" feature
let _previousTabId = null;
async function trackPreviousTabActivation(activeInfo) {
  if (isRefreshing) return;
  await resolveMeridianTabId();
  if (isManagedMeridianTabId(activeInfo.tabId)) return; // never track Meridian as current or previous
  if (_previousTabId !== null && _previousTabId !== activeInfo.tabId) {
    chrome.storage.local.set({ previousTabId: _previousTabId });
  }
  _previousTabId = activeInfo.tabId;
}

chrome.tabs.onActivated.addListener(trackPreviousTabActivation);
