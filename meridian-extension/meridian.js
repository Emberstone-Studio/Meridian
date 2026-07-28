import { createSearchBar } from "./components/SearchBar.js";
import {
  createWorkspaceLane,
  finishTabDrag,
  isTabDragActive,
} from "./components/WorkspaceLane.js";
import { search } from "./utils/browserSearch.js";
import {
  createSettingsPanel,
  applyTheme,
  applyAccentFromBackground,
  applyBackground,
  applyPhotoAdjustments,
  DEFAULT_BACKGROUND,
} from "./components/SettingsPanel.js";
import { getCustomBackgroundUrl } from "./utils/customBackground.js";
import { clusterTabsByDomain } from "./utils/domainCluster.js";
import { getAllThumbnails } from "./utils/thumbnailCache.js";
import {
  getEnabledLocalSearchSources,
  setLocalSearchSourceEnabled,
} from "./utils/localSearch.js";
import { normalizeHomepageUrl } from "./utils/homepageUrl.js";
import { openUrlFromMeridian } from "./utils/tabNavigation.js";
import { activateTab } from "./utils/tabActivation.js";
import { normalizeUrlInput } from "./utils/urlInput.js";
import { watchToolbarIconTheme } from "./utils/toolbarIcon.js";
import {
  getWorkspaceData,
  createWorkspace,
  assignTab,
} from "./utils/workspaceManager.js";
import {
  show as showContextMenu,
  isOpen as isContextMenuOpen,
} from "./components/ContextMenu.js";
import { createScopePopup } from "./components/BookmarksButton.js";
import { createSearchPopup } from "./components/SearchPopup.js";
import { createSearchSelection } from "./components/SearchSelection.js";

const hasNativeGroups = typeof chrome.tabGroups !== "undefined";

let lightboxApi = null;
let appearanceGeneration = 0;
// Set when a lane should open directly into inline rename on the next render
// (e.g. after "Move to new group"); matched against each lane's workspace id.
let pendingRenameLaneId = null;

async function getNewTabBehavior() {
  const { newTabBehavior } =
    await chrome.storage.sync.get("newTabBehavior");
  return newTabBehavior ?? "meridian-view";
}

async function applyStoredAppearance(backgroundOverride = null) {
  const generation = ++appearanceGeneration;
  let bg = backgroundOverride;

  // Photo transparency/blur modifiers live alongside the background; fetch them
  // here so a background change re-applies them against the new photo.
  const { theme, background, photoAdjust } = await chrome.storage.sync.get([
    "theme",
    "background",
    "photoAdjust",
  ]);
  if (generation !== appearanceGeneration) return;

  if (!bg) {
    applyTheme(theme ?? "system");
    bg = background ?? DEFAULT_BACKGROUND;
  }

  const customUrlPromise =
    bg.type === "custom" ? getCustomBackgroundUrl() : null;
  applyAccentFromBackground(bg, customUrlPromise);
  const customUrl = customUrlPromise ? await customUrlPromise : null;
  if (generation !== appearanceGeneration) return;
  applyBackground(bg, customUrl);
  applyPhotoAdjustments(bg, photoAdjust);
}

function setupLightbox() {
  const lightbox = document.getElementById("tab-lightbox");
  const thumbEl = document.getElementById("lightbox-thumbnail");
  const placeholderEl = document.getElementById("lightbox-placeholder");
  const faviconEl = document.getElementById("lightbox-favicon");
  const titleEl = document.getElementById("lightbox-title");
  const urlEl = document.getElementById("lightbox-url");
  const LIGHTBOX_W = 400;
  const MARGIN = 8;
  let currentTab = null;
  let closeTimer = null;

  function navigate() {
    if (currentTab) activateTab(currentTab.id);
    hideLightbox();
  }

  function showLightbox({ tab, thumbnail, rect }) {
    currentTab = tab;
    clearTimeout(closeTimer);

    if (thumbnail) {
      thumbEl.src = thumbnail;
      thumbEl.classList.remove("hidden");
      placeholderEl.classList.add("hidden");
    } else {
      thumbEl.src = "";
      thumbEl.classList.add("hidden");
      placeholderEl.textContent = (tab.title || "?").charAt(0).toUpperCase();
      placeholderEl.classList.remove("hidden");
    }

    if (tab.favIconUrl) {
      faviconEl.src = tab.favIconUrl;
    }
    faviconEl.classList.toggle("hidden", !tab.favIconUrl);

    titleEl.textContent = tab.title || tab.url || "New Tab";
    urlEl.textContent = tab.url || "";

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // thumbnail height + body section (title + meta + padding)
    const approxH = Math.round((LIGHTBOX_W * 10) / 16) + 80;

    // Center both horizontally and vertically on the card
    const cardCX = rect.left + rect.width / 2;
    const cardCY = rect.top + rect.height / 2;

    let left = cardCX - LIGHTBOX_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - LIGHTBOX_W - MARGIN));

    let top = cardCY - approxH / 2;
    top = Math.max(MARGIN, Math.min(top, vh - approxH - MARGIN));

    // Transform-origin at the card's center so it appears to grow from the card
    const originX = Math.round(
      ((rect.left + rect.width / 2 - left) / LIGHTBOX_W) * 100,
    );
    const originY = Math.round(
      ((rect.top + rect.height / 2 - top) / approxH) * 100,
    );
    lightbox.style.setProperty("--lightbox-origin-x", `${originX}%`);
    lightbox.style.setProperty("--lightbox-origin-y", `${originY}%`);
    lightbox.style.setProperty("--lightbox-left", `${left}px`);
    lightbox.style.setProperty("--lightbox-top", `${top}px`);
    lightbox.classList.remove("hidden");
  }

  function hideLightbox() {
    lightbox.classList.add("hidden");
    currentTab = null;
  }

  lightbox.addEventListener("mouseleave", () => {
    closeTimer = setTimeout(hideLightbox, 150);
  });
  lightbox.addEventListener("mouseenter", () => clearTimeout(closeTimer));

  lightbox.addEventListener("click", navigate);

  document.addEventListener("tab-lightbox-show", (e) => {
    // Suppress the hover preview while a context menu is open (same intent as
    // hovering the tab's close "X").
    if (isContextMenuOpen()) return;
    showLightbox(e.detail);
  });
  document.addEventListener("dragstart", hideLightbox);

  return {
    hide: hideLightbox,
    isVisible: () => !lightbox.classList.contains("hidden"),
  };
}

async function getWindowMeridianTabId(currentTab) {
  if (!currentTab) return null;
  const stored = await chrome.storage.local.get([
    "meridianTabIds",
    "meridianTabId",
  ]);
  const candidates = [
    stored.meridianTabIds?.[String(currentTab.windowId)],
    stored.meridianTabId,
  ].filter((id) => Number.isInteger(id));

  for (const id of candidates) {
    try {
      const tab = await chrome.tabs.get(id);
      if (tab.windowId === currentTab.windowId) return id;
    } catch (_) {
      /* stale stored id */
    }
  }

  const pinnedTabs = await chrome.tabs.query({
    pinned: true,
    windowId: currentTab.windowId,
  });
  const meridianUrl = chrome.runtime.getURL("meridian.html");
  return (
    pinnedTabs.find(
      (tab) =>
        tab.url === meridianUrl ||
        tab.pendingUrl === meridianUrl ||
        tab.url === "chrome://newtab/" ||
        tab.pendingUrl === "chrome://newtab/",
    )?.id ?? null
  );
}

async function handleNewTabBehavior() {
  const [newTabBehavior, { homepageUrl }] = await Promise.all([
    getNewTabBehavior(),
    chrome.storage.sync.get("homepageUrl"),
  ]);
  if (newTabBehavior === "focus-pinned") {
    const currentTab = await chrome.tabs.getCurrent();
    const meridianTabId = await getWindowMeridianTabId(currentTab);
    if (meridianTabId && currentTab && meridianTabId !== currentTab.id) {
      await activateTab(meridianTabId);
      window.close();
    }
  } else if (newTabBehavior === "open-homepage") {
    const normalizedHomepage = normalizeHomepageUrl(homepageUrl ?? "");
    if (!normalizedHomepage) return;

    const currentTab = await chrome.tabs.getCurrent();
    const meridianTabId = await getWindowMeridianTabId(currentTab);
    if (!currentTab || currentTab.id === meridianTabId) return;
    try {
      await chrome.tabs.update(currentTab.id, { url: normalizedHomepage });
    } catch (error) {
      console.warn("Could not open the configured homepage.", error);
    }
  }
}

let searchBarApi = null;
let browserSearchActive = false;
let browserSearchSequence = 0;
let resultsPopup = null; // shared shell for the "search everything" results
let resultsSelection = null;
let settingsPopup = null; // shared shell for the settings dropdown

function setupKeyboardNav() {
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    const isEditing =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      document.activeElement?.contentEditable === "true";

    if (e.key === "/" && !isEditing) {
      e.preventDefault();
      searchBarApi?.focus();
      return;
    }

    if (e.key === "Escape") {
      if (lightboxApi?.isVisible()) {
        lightboxApi.hide();
        return;
      }
      if (settingsPopup?.isOpen()) {
        closeSettings();
        return;
      }
      if (browserSearchActive) {
        clearBrowserSearch();
        searchBarApi?.clearSearch?.();
        return;
      }
      if (document.activeElement?.tagName === "INPUT") {
        document.activeElement.blur();
        focusFirstCard();
      }
      return;
    }

    if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
      if (isEditing) return;
      e.preventDefault();
      navigateCards(e.key);
    }
  });
}

function navigateCards(key) {
  const cards = [...document.querySelectorAll(".tab-card")];
  if (!cards.length) return;
  const focused = document.activeElement;
  if (!cards.includes(focused)) {
    cards[0].focus();
    return;
  }

  const grid = focused.closest(".tab-grid");
  const lane = focused.closest(".workspace-lane");
  const gridCards = [...grid.querySelectorAll(".tab-card")];
  const gridIdx = gridCards.indexOf(focused);

  let next = null;
  if (key === "ArrowRight") next = gridCards[gridIdx + 1] ?? null;
  if (key === "ArrowLeft") next = gridIdx > 0 ? gridCards[gridIdx - 1] : null;

  if (key === "ArrowDown" || key === "ArrowUp") {
    const lanes = [...document.querySelectorAll(".workspace-lane")];
    const laneIdx = lanes.indexOf(lane);
    const targetLane =
      key === "ArrowDown" ? lanes[laneIdx + 1] : lanes[laneIdx - 1];
    if (targetLane) next = targetLane.querySelector(".tab-card");
  }

  next?.focus();
}

function focusFirstCard() {
  document.querySelector(".tab-card")?.focus();
}

async function handleTabClosed(tabId) {
  await chrome.tabs.remove(tabId);
}

function openSettings() {
  settingsPopup?.open();
}

function closeSettings() {
  settingsPopup?.close();
}

function openSettingsFromSearch() {
  if (searchBarApi.getScope() !== "all") searchBarApi.setScope("all");

  // Resetting a retained scoped query starts an asynchronous Anything search.
  // Invalidate it before Settings opens so its eventual result popup cannot
  // reclaim the shared popup slot and close Settings.
  clearBrowserSearch();
  openSettings();
}

async function openBookmark(url) {
  await openUrlFromMeridian(url);
}

function colorLabel(color) {
  return color ? color.charAt(0).toUpperCase() + color.slice(1) : "Group";
}

let renderTimer = null;
let renderRunning = false;
let renderDeferredByDrag = false;

function scheduleRender() {
  // Replacing the lane DOM during a native drag removes the source element,
  // which prevents `dragend` from firing and leaves Meridian stuck in its drag
  // state. Hold browser/storage-driven renders until the gesture is finished.
  if (isTabDragActive()) {
    renderDeferredByDrag = true;
    return;
  }

  clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    if (isTabDragActive()) {
      renderDeferredByDrag = true;
      return;
    }
    if (renderRunning) {
      scheduleRender();
      return;
    }
    renderRunning = true;
    try {
      await render();
    } finally {
      renderRunning = false;
    }
  }, 50);
}

function flushDeferredDragRender() {
  if (!renderDeferredByDrag) return;
  renderDeferredByDrag = false;
  scheduleRender();
}

function sortByTabOrder(tabs, order) {
  if (!order?.length) return tabs;
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...tabs].sort(
    (a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity),
  );
}

async function render() {
  const container = document.getElementById("workspace-container");
  container.innerHTML = "";

  const { groupByDomain } = await chrome.storage.sync.get("groupByDomain");

  const chromeGroupsPromise = hasNativeGroups
    ? chrome.tabGroups.query({})
    : Promise.resolve([]);

  const [allTabs, chromeGroups, thumbnails, currentTab, wsData, localStore] =
    await Promise.all([
      chrome.tabs.query({}),
      chromeGroupsPromise,
      getAllThumbnails(),
      chrome.tabs.getCurrent(),
      getWorkspaceData(),
      chrome.storage.local.get(["collapsedLanes", "tabOrder"]),
    ]);
  const collapsedLanes = localStore.collapsedLanes ?? {};
  const tabOrder = localStore.tabOrder ?? {};

  const meridianUrl = chrome.runtime.getURL("meridian.html");
  const visibleTabs = allTabs.filter(
    (t) =>
      t.id !== currentTab?.id &&
      t.url !== meridianUrl &&
      t.pendingUrl !== meridianUrl &&
      t.url !== "chrome://newtab/" &&
      t.pendingUrl !== "chrome://newtab/",
  );

  const groupMap = new Map(chromeGroups.map((g) => [g.id, g]));
  const chromeGroupedMap = new Map();
  const ungroupedTabs = [];

  for (const tab of visibleTabs) {
    if (hasNativeGroups && tab.groupId !== -1) {
      if (!chromeGroupedMap.has(tab.groupId))
        chromeGroupedMap.set(tab.groupId, []);
      chromeGroupedMap.get(tab.groupId).push(tab);
    } else {
      ungroupedTabs.push(tab);
    }
  }

  // Distribute ungrouped tabs into Meridian workspaces
  const customWorkspaces = wsData.workspaces.filter((w) => w.id !== "unsorted");
  const wsTabMap = new Map(customWorkspaces.map((w) => [w.id, []]));
  const trulyUnsorted = [];

  for (const tab of ungroupedTabs) {
    const wsId = wsData.assignments[String(tab.id)];
    if (wsId && wsTabMap.has(wsId)) {
      wsTabMap.get(wsId).push(tab);
    } else {
      trulyUnsorted.push(tab);
    }
  }

  // 1. Unsorted / domain clusters first
  if (groupByDomain) {
    const clusters = clusterTabsByDomain(trulyUnsorted);
    for (const [name, clusterTabs] of clusters) {
      const workspace = { id: `dc_${name}`, name };
      const sorted = sortByTabOrder(clusterTabs, tabOrder[workspace.id]);
      const lane = createWorkspaceLane(
        workspace,
        sorted,
        thumbnails,
        handleTabClosed,
        { collapsed: collapsedLanes[workspace.id] ?? false },
      );
      lane.addEventListener("workspace-reassigned", scheduleRender);
      container.appendChild(lane);
    }
  } else if (trulyUnsorted.length > 0) {
    const workspace = { id: "unsorted", name: "Unsorted" };
    const sorted = sortByTabOrder(trulyUnsorted, tabOrder["unsorted"]);
    const lane = createWorkspaceLane(
      workspace,
      sorted,
      thumbnails,
      handleTabClosed,
      { collapsed: collapsedLanes[workspace.id] ?? false },
    );
    lane.addEventListener("workspace-reassigned", scheduleRender);
    container.appendChild(lane);
  }

  // 2. Meridian workspace lanes (always shown, even if empty)
  for (const ws of customWorkspaces) {
    const wsTabs = sortByTabOrder(wsTabMap.get(ws.id) ?? [], tabOrder[ws.id]);
    const autoRename = pendingRenameLaneId === ws.id;
    if (autoRename) pendingRenameLaneId = null;
    const lane = createWorkspaceLane(
      { id: ws.id, name: ws.name },
      wsTabs,
      thumbnails,
      handleTabClosed,
      {
        meridianWorkspace: ws,
        collapsed: collapsedLanes[ws.id] ?? false,
        autoRename,
      },
    );
    lane.addEventListener("workspace-reassigned", scheduleRender);
    container.appendChild(lane);
  }

  // 3. Chrome tab group lanes
  for (const [groupId, tabs] of chromeGroupedMap) {
    const group = groupMap.get(groupId);
    const name = group?.title?.trim() || colorLabel(group?.color);
    const workspace = { id: `cg_${groupId}`, name };
    const autoRename = pendingRenameLaneId === workspace.id;
    if (autoRename) pendingRenameLaneId = null;
    const lane = createWorkspaceLane(
      workspace,
      tabs,
      thumbnails,
      handleTabClosed,
      {
        chromeGroup: group,
        collapsed: collapsedLanes[workspace.id] ?? false,
        autoRename,
      },
    );
    lane.addEventListener("workspace-reassigned", scheduleRender);
    container.appendChild(lane);
  }
}

function clearBrowserSearch() {
  browserSearchActive = false;
  browserSearchSequence += 1;

  resultsSelection?.reset();
  resultsPopup?.close();
  resultsPopup?.el.replaceChildren();
}

function buildResultRow(item) {
  const row = document.createElement("div");
  row.className = "result-row";
  row.tabIndex = 0;

  const favicon = document.createElement("img");
  favicon.className = "result-favicon";
  favicon.width = 16;
  favicon.height = 16;
  favicon.src = item.favicon || "";
  favicon.onerror = () => {
    let letter = "?";
    try { letter = new URL(item.url).hostname.replace(/^www\./, "").charAt(0).toUpperCase() || "?"; } catch (_) {}
    const ph = document.createElement("span");
    ph.className = "favicon-placeholder";
    ph.textContent = letter;
    favicon.replaceWith(ph);
  };

  const body = document.createElement("div");
  body.className = "result-body";

  const title = document.createElement("div");
  title.className = "result-title";
  title.textContent = item.title || item.url;

  const meta = document.createElement("div");
  meta.className = "result-meta";
  meta.textContent = item.url;

  body.appendChild(title);
  body.appendChild(meta);

  const context = document.createElement("div");
  context.className = "result-context";
  context.textContent = item.context || "";

  row.appendChild(favicon);
  row.appendChild(body);
  row.appendChild(context);

  row.addEventListener("click", () => {
    if (item.tabId != null) {
      activateTab(item.tabId);
    } else {
      openUrlFromMeridian(item.url);
    }
  });

  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter") row.click();
  });

  return row;
}

function renderSearchResults(results, query, scope = "all") {
  if (!resultsPopup) return;
  const container = resultsPopup.el;
  resultsSelection?.reset();
  container.innerHTML = "";

  const sections = [
    { label: "Open Tabs", items: results.tabs },
    { label: "Bookmarks", items: results.bookmarks },
    { label: "History", items: results.history },
  ];

  for (const { label, items } of sections) {
    if (!items.length) continue;
    const section = document.createElement("div");
    section.className = "search-results-section";

    const heading = document.createElement("div");
    heading.className = "search-results-label";
    heading.id = `search-results-${label.toLowerCase().replaceAll(" ", "-")}-label`;
    heading.textContent = label;
    section.setAttribute("role", "group");
    section.setAttribute("aria-labelledby", heading.id);
    section.appendChild(heading);

    for (const item of items.slice(0, 10)) {
      section.appendChild(buildResultRow(item));
    }
    container.appendChild(section);
  }

  if (scope !== "all") {
    if (
      !results.tabs.length &&
      !results.bookmarks.length &&
      !results.history.length
    ) {
      const empty = document.createElement("div");
      empty.className = "search-results-empty";
      empty.textContent =
        scope === "bookmarks" ? "No bookmarks found" : "No history found";
      container.appendChild(empty);
    }
    resultsPopup.open();
    const count = resultsSelection?.sync?.() ?? 0;
    searchBarApi?.announce?.(
      count
        ? `${count} result${count === 1 ? "" : "s"} available.`
        : "No results found.",
    );
    return;
  }

  // Web is a peer result section. With no local matches, it becomes the only
  // fallback section instead of showing an empty-state message.
  if (query) {
    container.appendChild(buildWebSearchSection(query));
  }

  // Show the dropdown only when it actually has something to show.
  if (container.childElementCount > 0) {
    resultsPopup.open();
    const count = resultsSelection?.sync?.() ?? 0;
    searchBarApi?.announce?.(
      `${count} result${count === 1 ? "" : "s"} available.`,
    );
  } else {
    resultsPopup.close();
    searchBarApi?.announce?.("No results found.");
  }
}

function buildWebSearchSection(query) {
  // The provider is chosen in Settings; this section just launches it.
  const provider =
    searchBarApi?.getProvider?.() ?? searchBarApi?.getProviders?.()?.[0];
  const directUrl = normalizeUrlInput(query);
  const targetUrl =
    directUrl ?? (provider?.url ? provider.url + encodeURIComponent(query) : "");

  const section = document.createElement("div");
  section.className = "search-results-section search-web-section";

  const heading = document.createElement("div");
  heading.className = "search-results-label";
  heading.id = "search-results-web-label";
  heading.textContent = "Web";
  section.setAttribute("role", "group");
  section.setAttribute("aria-labelledby", heading.id);
  section.appendChild(heading);

  const go = document.createElement("button");
  go.className = "search-web-go result-row";
  go.type = "button";

  const fav = document.createElement("img");
  fav.className = "result-favicon";
  fav.alt = "";
  fav.src = provider?.favicon ?? "";
  fav.onerror = () => {
    fav.classList.add("load-failed");
  };

  const body = document.createElement("span");
  body.className = "result-body";

  const title = document.createElement("span");
  title.className = "result-title";
  title.textContent = directUrl
    ? `Go to ${query}`
    : `Search ${provider?.name ?? "the web"} for "${query}"`;

  const meta = document.createElement("span");
  meta.className = "result-meta";
  meta.textContent = directUrl ? "Open URL" : "Web search";

  body.append(title, meta);
  go.append(fav, body);
  go.addEventListener("click", () => {
    if (!targetUrl) return;
    openUrlFromMeridian(targetUrl);
    // Launching the search is "done" — reset the field (and close this
    // dropdown) so returning to the tab starts fresh, not on the stale query.
    searchBarApi?.clearSearch?.();
  });

  section.appendChild(go);
  return section;
}

async function handleBrowserQuery(query, scope = "all") {
  browserSearchActive = true;
  const searchSequence = ++browserSearchSequence;
  if (!resultsPopup?.isOpen()) {
    searchBarApi?.announce?.("Loading search results.");
  }

  // Results live in the popup only; leave the board unfiltered in every
  // scope so search-everything behaves like the bookmarks/history popup.

  const enabledSources = await getEnabledLocalSearchSources();
  if (!browserSearchActive || searchSequence !== browserSearchSequence) return;
  const r = await search(query, scope, enabledSources);
  if (!browserSearchActive || searchSequence !== browserSearchSequence) return;

  renderSearchResults(r, query ?? "", scope);
}

async function init() {
  watchToolbarIconTheme();
  await applyStoredAppearance();
  await handleNewTabBehavior();

  lightboxApi = setupLightbox();

  searchBarApi = createSearchBar(document.getElementById("search-bar"));
  searchBarApi.onNavigate = openUrlFromMeridian;

  // Move the scope/settings icon cluster into the search pill itself.
  const searchContainer = document.querySelector("#search-bar .search-container");
  const topActions = document.getElementById("top-actions");
  if (searchContainer && topActions) searchContainer.appendChild(topActions);

  // All three search-zone dropdowns share one shell, anchored beneath the pill.
  const searchBarEl = document.getElementById("search-bar");

  // Scope popup (Bookmarks / History), shown while a scope is active.
  const scopeShell = createSearchPopup({
    anchor: searchBarEl,
    id: "bookmarks-panel",
    ariaLabel: "Bookmarks",
  });
  const scopePopup = createScopePopup(scopeShell, {
    openItem: openBookmark,
    announce: (message) => searchBarApi.announce(message),
    onActiveDescendantChange: (id) =>
      searchBarApi.setActiveDescendant(id),
    isSourceEnabled: async (source) =>
      (await getEnabledLocalSearchSources())[source],
    historyProvider: async (q) => {
      const enabledSources = await getEnabledLocalSearchSources();
      return search(q, "history", enabledSources).then((r) => r.history);
    },
  });

  // "Search everything" results dropdown.
  resultsPopup = createSearchPopup({
    anchor: searchBarEl,
    id: "browser-search-results",
    ariaLabel: "Search results",
    role: "listbox",
  });
  resultsSelection = createSearchSelection(resultsPopup, {
    idPrefix: "browser-search-result",
    onActiveDescendantChange: (id) =>
      searchBarApi.setActiveDescendant(id),
  });
  searchBarApi.bindPopup(scopeShell, "bookmarks-results-listbox");
  searchBarApi.bindPopup(resultsPopup, "browser-search-results");

  const isPopupScope = (scope) => scope === "bookmarks" || scope === "history";

  searchBarApi.onBrowserQuery = (query, scope) => {
    if (isPopupScope(scope)) {
      scopePopup.setQuery(query || "");
      return;
    }
    if (!query && scope === "all") {
      clearBrowserSearch();
    } else {
      handleBrowserQuery(query, scope);
    }
  };

  searchBarApi.onSelectionMove = (delta) => {
    if (isPopupScope(searchBarApi.getScope())) {
      return scopePopup.moveSelection(delta);
    }
    return resultsSelection.move(delta);
  };
  searchBarApi.onSelectionActivate = () => {
    if (isPopupScope(searchBarApi.getScope())) {
      return scopePopup.activateSelection();
    }
    return resultsSelection.activate();
  };
  searchBarApi.onSelectionReset = () => {
    scopePopup.resetSelection();
    resultsSelection.reset();
  };
  searchBarApi.onScopedSubmit = () => {
    if (isPopupScope(searchBarApi.getScope())) {
      document
        .querySelector("#bookmarks-panel .bookmark-row:not(.bookmark-folder)")
        ?.click();
      return;
    }
    document.querySelector("#browser-search-results .result-row")?.click();
  };

  const settingsBtn = document.getElementById("settings-btn");
  // Settings dropdown — same shell as the other search-zone popups. The gear
  // lights up in the accent while open, exactly like the scope chips.
  settingsPopup = createSearchPopup({
    anchor: searchBarEl,
    id: "settings-panel",
    ariaLabel: "Settings",
    onOpenChange: (open) => settingsBtn.classList.toggle("active", open),
  });
  createSettingsPanel(settingsPopup.el);

  // The scope chips and the gear are one mutually-exclusive group: opening the
  // gear drops any active scope, so the two are never lit at once.
  settingsBtn.addEventListener("click", () => {
    if (settingsPopup.isOpen()) {
      closeSettings();
    } else {
      openSettingsFromSearch();
    }
  });

  const scopeButtons = {
    bookmarks: document.getElementById("scope-bookmarks"),
    history: document.getElementById("scope-history"),
  };
  for (const [scopeName, btn] of Object.entries(scopeButtons)) {
    btn?.addEventListener("click", async () => {
      if (searchBarApi.getScope() === scopeName) {
        searchBarApi.setScope(scopeName);
        return;
      }
      btn.disabled = true;
      try {
        await setLocalSearchSourceEnabled(scopeName, true);
      } finally {
        btn.disabled = false;
      }
      searchBarApi.setScope(scopeName);
    });
  }
  searchBarApi.onScopeChange = (activeScope) => {
    for (const [scopeName, btn] of Object.entries(scopeButtons)) {
      const active = scopeName === activeScope;
      btn?.classList.toggle("active", active);
      btn?.setAttribute("aria-pressed", String(active));
    }
    if (isPopupScope(activeScope)) {
      clearBrowserSearch();
      // A scope wins the group — make sure the gear is closed.
      closeSettings();
      scopePopup.openScope(activeScope, searchBarApi.getQuery());
    } else {
      scopePopup.close();
    }
  };
  // A press outside the settings dropdown (and not on its trigger) closes it.
  // Uses pointerdown, not click: selecting a card re-renders its grid, which
  // detaches the clicked node before a bubbled click would reach here — making
  // contains() falsely read "outside" and close the panel. pointerdown fires
  // while the target is still in the DOM, so the check stays correct.
  document.addEventListener("pointerdown", (e) => {
    if (!settingsPopup.isOpen()) return;
    if (settingsPopup.el.contains(e.target) || settingsBtn.contains(e.target)) {
      return;
    }
    closeSettings();
  });

  setupKeyboardNav();

  document.addEventListener("tab-context-menu", (e) => {
    // Opening the menu dismisses any hover preview and blocks a new one.
    lightboxApi?.hide();
    showContextMenu(e.detail.tab, e.detail.x, e.detail.y);
  });

  // A context-menu "Move to new group" creates the lane, then asks us to drop
  // the user straight into renaming it. Remember the target across the render.
  document.addEventListener("focus-lane-rename", (e) => {
    pendingRenameLaneId = e.detail.laneId;
    scheduleRender();
  });

  const dropZone = document.getElementById("new-group-drop-zone");
  document.addEventListener("dragstart", () =>
    dropZone.classList.remove("hidden"),
  );
  document.addEventListener("dragend", () => {
    finishTabDrag();
    dropZone.classList.add("hidden");
    dropZone.classList.remove("drag-over");
    flushDeferredDragRender();
  });
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", (e) => {
    if (!dropZone.contains(e.relatedTarget))
      dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const tabId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    finishTabDrag();
    dropZone.classList.add("hidden");
    flushDeferredDragRender();
    if (!tabId) return;
    const name = prompt("New group name:");
    if (!name?.trim()) return;
    if (hasNativeGroups) {
      const groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, { title: name.trim() });
    } else {
      const ws = await createWorkspace(name.trim());
      await assignTab(tabId, ws.id);
    }
    scheduleRender();
  });

  await render();

  chrome.tabs.onCreated.addListener(scheduleRender);
  chrome.tabs.onRemoved.addListener(scheduleRender);
  chrome.tabs.onUpdated.addListener((id, info) => {
    if (info.title || info.favIconUrl || info.groupId !== undefined)
      scheduleRender();
  });

  chrome.tabs.onMoved.addListener(scheduleRender);

  if (hasNativeGroups) {
    chrome.tabGroups.onCreated.addListener(scheduleRender);
    chrome.tabGroups.onRemoved.addListener(scheduleRender);
    chrome.tabGroups.onUpdated.addListener(scheduleRender);
  }

  window.addEventListener("settings-changed", scheduleRender);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleRender();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.background) {
      applyStoredAppearance(changes.background.newValue ?? DEFAULT_BACKGROUND);
    }
    // A photo modifier change (e.g. from another tab) only re-interpolates the
    // CSS vars against the current background — it never re-samples the photo.
    if (area === "sync" && changes.photoAdjust && !changes.background) {
      chrome.storage.sync.get("background").then(({ background }) => {
        applyPhotoAdjustments(
          background ?? DEFAULT_BACKGROUND,
          changes.photoAdjust.newValue,
        );
      });
    }
    if (area === "sync" && changes.localSearch) {
      clearBrowserSearch();
      if (searchBarApi?.getScope() !== "all") searchBarApi.setScope("all");
    }
    if (area !== "local") return;
    const keys = Object.keys(changes);
    if (
      keys.some(
        (k) =>
          k.startsWith("thumb_") ||
          k === "thumbnailCacheRevision" ||
          k === "workspaces" ||
          k === "tabOrder",
      )
    ) {
      scheduleRender();
    }
  });

}

init();
