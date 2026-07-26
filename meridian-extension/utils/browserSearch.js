/**
 * browserSearch.js — Shared search engine for Meridian
 *
 * Exports two groups:
 *   A) Index management  — initTabIndex(), rebuildIndex()  (called from background.js)
 *   B) Search functions  — search(query), getPreviousTab() (called from popup.js / meridian.js)
 */

import { mutateStorageValue } from "./storageMutationQueue.js";
import { faviconUrl } from "./favicon.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the root domain from a URL string.
 * Returns "" for non-http(s) URLs or on parse failure.
 */
function extractDomain(url) {
  if (!url) return "";
  try {
    const { hostname } = new URL(url);
    // Strip leading "www."
    return hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

/**
 * Fuzzy score — returns a value 0–1.
 *
 * Rules (case-insensitive):
 *   1. Exact substring match                         → 1.0
 *   2. All query chars appear in order (subsequence) → 0.3–0.7, scaled by compactness
 *   3. No match                                      → 0
 *
 * "Compactness" = how short the matched span is relative to the text length.
 * A perfectly compact match (every char adjacent) scores 0.7;
 * a very spread-out match floors at 0.3.
 */
function fuzzyScore(query, text) {
  if (!query || !text) return 0;

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // 1. Exact substring
  if (t.includes(q)) return 1.0;

  // 2. Subsequence match
  let qi = 0;
  let firstMatch = -1;
  let lastMatch = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstMatch === -1) firstMatch = ti;
      lastMatch = ti;
      qi++;
    }
  }

  if (qi < q.length) return 0; // not all chars found

  const span = lastMatch - firstMatch + 1;
  // Compactness ratio: ideal span == q.length, worst == t.length
  const compactness = q.length / span;
  // Map compactness [0,1] → score [0.3, 0.7]
  return 0.3 + compactness * 0.4;
}

// ---------------------------------------------------------------------------
// A) Index management
// ---------------------------------------------------------------------------

const INDEX_KEY = "tabSearchIndex";
const WORKSPACE_KEY = "workspaces";

function workspaceNameFromData(tabId, data) {
  const wsId = data?.assignments?.[String(tabId)];
  if (!wsId) return "";

  const workspace = data.workspaces?.find((item) => item.id === wsId);
  return workspace?.name ?? "";
}

/**
 * Resolve the workspace name for a given tabId using the stored workspace data.
 * Returns "" if the tab has no assignment or if workspace data is unavailable.
 */
async function resolveWorkspaceName(tabId) {
  try {
    const result = await chrome.storage.local.get(WORKSPACE_KEY);
    const data = result[WORKSPACE_KEY];
    return workspaceNameFromData(tabId, data);
  } catch (_) {
    return "";
  }
}

/**
 * Read the current index from storage.
 */
async function readIndex() {
  const result = await chrome.storage.local.get(INDEX_KEY);
  return result[INDEX_KEY] ?? {};
}

/**
 * Build a TabEntry from a Chrome Tab object.
 * metaDescription and headings start empty; they are filled asynchronously
 * by the content-script injection.
 */
async function buildEntry(tab, existingEntry) {
  const domain = extractDomain(tab.url);
  const workspaceName = await resolveWorkspaceName(tab.id);

  return {
    tabId: tab.id,
    title: tab.title ?? existingEntry?.title ?? "",
    url: tab.url ?? existingEntry?.url ?? "",
    domain,
    metaDescription: existingEntry?.metaDescription ?? "",
    headings: existingEntry?.headings ?? "",
    workspaceName,
    lastActive: existingEntry?.lastActive ?? Date.now(),
  };
}

/**
 * Inject a one-shot content script to extract meta description and headings.
 * Updates the index entry in storage on success.
 * Silently ignores privileged URLs and injection errors.
 */
async function injectMetaExtractor(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        metaDescription:
          document.querySelector('meta[name="description"]')?.content ?? "",
        headings: [...document.querySelectorAll("h1,h2")]
          .map((el) => el.textContent.trim())
          .join(" "),
      }),
    });

    const payload = results?.[0]?.result;
    if (!payload) return;

    await mutateStorageValue(INDEX_KEY, {}, (index) => {
      if (!index[tabId]) return;
      index[tabId].metaDescription = payload.metaDescription;
      index[tabId].headings = payload.headings;
    });
  } catch (_) {
    // Privileged URLs (chrome://, chrome-extension://, about:, etc.) throw here.
    // Intentionally swallowed — leave metaDescription/headings as "".
  }
}

/**
 * initTabIndex — wire up Chrome tab event listeners for index maintenance.
 * Call once from background.js at startup.
 */
export function initTabIndex() {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local" || !changes[WORKSPACE_KEY]) return;
    const workspaceData = changes[WORKSPACE_KEY].newValue;
    try {
      await mutateStorageValue(INDEX_KEY, {}, (index) => {
        for (const entry of Object.values(index)) {
          entry.workspaceName = workspaceNameFromData(
            entry.tabId,
            workspaceData,
          );
        }
      });
    } catch (_) {}
  });

  // New tab created
  chrome.tabs.onCreated.addListener(async (tab) => {
    try {
      await mutateStorageValue(INDEX_KEY, {}, async (index) => {
        index[tab.id] = await buildEntry(tab, index[tab.id]);
      });
    } catch (_) {}
  });

  // Tab updated (title change or navigation complete)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" && !changeInfo.title) return;

    try {
      await mutateStorageValue(INDEX_KEY, {}, async (index) => {
        index[tabId] = await buildEntry(tab, index[tabId]);
      });
    } catch (_) {
      return;
    }

    if (changeInfo.status === "complete") {
      await injectMetaExtractor(tabId);
    }
  });

  // Tab activated — update lastActive timestamp
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      await mutateStorageValue(INDEX_KEY, {}, (index) => {
        if (index[activeInfo.tabId]) {
          index[activeInfo.tabId].lastActive = Date.now();
        }
      });
    } catch (_) {}
  });

  // Tab removed — delete from index
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      await mutateStorageValue(INDEX_KEY, {}, (index) => {
        delete index[tabId];
      });
    } catch (_) {}
  });
}

/**
 * rebuildIndex — query all current tabs and rebuild the index from scratch.
 * Call once at service-worker startup to handle tabs open before the extension loaded.
 */
export async function rebuildIndex() {
  const tabs = await chrome.tabs.query({});
  // Seed from the existing index so entries written by the event listeners
  // (registered synchronously before this runs) — plus already-extracted
  // metadata and lastActive values — are preserved rather than overwritten.
  await mutateStorageValue(INDEX_KEY, {}, async (index) => {
    const rebuiltEntries = await Promise.all(
      tabs.map(async (tab) => [tab.id, await buildEntry(tab, index[tab.id])]),
    );
    for (const [tabId, entry] of rebuiltEntries) {
      index[tabId] = entry;
    }
  });

  for (const tab of tabs) {
    if (tab.status === "complete") {
      injectMetaExtractor(tab.id);
    }
  }
}

// ---------------------------------------------------------------------------
// B) Search functions
// ---------------------------------------------------------------------------

/**
 * Compute a weighted fuzzy score for a tab entry against a query string.
 * Weights: title ×3, workspaceName ×2, domain ×1.5, url ×1, metadata ×0.5
 */
function scoreTabEntry(query, entry) {
  const titleScore = fuzzyScore(query, entry.title) * 3;
  const wsScore = fuzzyScore(query, entry.workspaceName) * 2;
  const domainScore = fuzzyScore(query, entry.domain) * 1.5;
  const urlScore = fuzzyScore(query, entry.url) * 1;
  const metadataScore =
    Math.max(
      fuzzyScore(query, entry.metaDescription),
      fuzzyScore(query, entry.headings),
    ) * 0.5;
  const maxPossible = 3 + 2 + 1.5 + 1 + 0.5; // 8.0
  const raw =
    titleScore + wsScore + domainScore + urlScore + metadataScore;
  return raw / maxPossible; // normalise to 0–1
}

/**
 * Format a timestamp (ms since epoch) as a human-readable date string.
 */
function formatDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (_) {
    return "";
  }
}

/**
 * search(query) — run a cross-source search across tabs, bookmarks, and history.
 *
 * @param {string} query
 * @param {string} scope
 * @param {{ tabs?: boolean, bookmarks?: boolean, history?: boolean }} sources
 * @returns {Promise<{ tabs: ResultItem[], bookmarks: ResultItem[], history: ResultItem[] }>}
 */
export async function search(
  query,
  scope = "all",
  sources = { tabs: true, bookmarks: false, history: false },
) {
  const trimmed = query?.trim() ?? "";
  if (!trimmed && scope === "all") {
    return { tabs: [], bookmarks: [], history: [] };
  }

  const [tabs, bookmarks, history] = await Promise.all([
    scope === "all" && sources.tabs ? searchTabs(trimmed) : [],
    (scope === "all" || scope === "bookmarks") && sources.bookmarks
      ? searchBookmarks(trimmed)
      : [],
    (scope === "all" || scope === "history") && sources.history
      ? searchHistory(trimmed)
      : [],
  ]);

  return { tabs, bookmarks, history };
}

/**
 * Search open tabs using the local index.
 */
async function searchTabs(query) {
  const index = await readIndex();
  const entries = Object.values(index);

  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreTabEntry(query, entry),
    }))
    .filter(({ score }) => score > 0.1)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.entry.lastActive ?? 0) - (a.entry.lastActive ?? 0);
    })
    .slice(0, 20);

  return scored.map(({ entry, score }) => ({
    tabId: entry.tabId,
    title: entry.title,
    url: entry.url,
    favicon: faviconUrl(entry.url),
    domain: entry.domain,
    context: entry.workspaceName,
    score,
  }));
}

/**
 * Search bookmarks using the Chrome Bookmarks API.
 */
async function searchBookmarks(query) {
  let nodes;
  try {
    if (query) {
      nodes = await chrome.bookmarks.search({ query });
    } else {
      const roots = await chrome.bookmarks.getTree();
      nodes = [];
      const visit = (node) => {
        if (node.url) nodes.push(node);
        node.children?.forEach(visit);
      };
      roots.forEach(visit);
    }
  } catch (_) {
    return [];
  }

  // Filter to items that have a URL (not folders)
  const bookmarkNodes = nodes.filter((n) => n.url);

  // Fetch parent folder names in parallel
  const results = await Promise.all(
    bookmarkNodes.map(async (node) => {
      let context = "";
      if (node.parentId) {
        try {
          const parents = await chrome.bookmarks.get(node.parentId);
          context = parents?.[0]?.title ?? "";
        } catch (_) {
          // ignore
        }
      }

      const domain = extractDomain(node.url);
      const titleScore = query ? fuzzyScore(query, node.title ?? "") : 1;
      const urlScore = query ? fuzzyScore(query, node.url ?? "") : 1;
      const score = Math.max(titleScore, urlScore);

      return {
        tabId: null,
        title: node.title ?? "",
        url: node.url ?? "",
        favicon: faviconUrl(node.url),
        domain,
        context,
        score,
      };
    }),
  );

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * Search browser history using the Chrome History API.
 */
async function searchHistory(query) {
  let items;
  try {
    items = await chrome.history.search({ text: query, maxResults: 20 });
  } catch (_) {
    return [];
  }

  return items
    .sort((a, b) => (b.lastVisitTime ?? 0) - (a.lastVisitTime ?? 0))
    .map((item) => {
      const domain = extractDomain(item.url);
      const titleScore = query ? fuzzyScore(query, item.title ?? "") : 1;
      const urlScore = query ? fuzzyScore(query, item.url ?? "") : 1;
      const score = Math.max(titleScore, urlScore);

      return {
        tabId: null,
        title: item.title ?? "",
        url: item.url ?? "",
        favicon: faviconUrl(item.url),
        domain,
        context: formatDate(item.lastVisitTime),
        score,
      };
    })
    .filter((r) => r.score > 0);
}

/**
 * getPreviousTab — return the Chrome Tab object for the most-recently-active
 * non-Meridian tab, or null if unavailable.
 *
 * Reads `previousTabId` from chrome.storage.local (written by background.js).
 */
export async function getPreviousTab() {
  try {
    const { previousTabId } = await chrome.storage.local.get("previousTabId");
    if (previousTabId == null) return null;

    const tab = await chrome.tabs.get(previousTabId);
    return tab ?? null;
  } catch (_) {
    return null;
  }
}
