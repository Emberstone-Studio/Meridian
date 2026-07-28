import { search, getPreviousTab } from '../utils/browserSearch.js';
import { createFavicon } from '../utils/favicon.js';
import {
  getEnabledLocalSearchSources,
  setLocalSearchSourceEnabled,
} from '../utils/localSearch.js';
import { activateTab } from '../utils/tabActivation.js';
import { watchToolbarIconTheme } from '../utils/toolbarIcon.js';

const PROVIDER_URLS = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
};

const SCOPE_PLACEHOLDERS = {
  all: 'Search anything…',
  bookmarks: 'Search bookmarks…',
  history: 'Search history…',
};

const GROUP_COLORS = {
  grey: '#9aa0a6',
  blue: '#4285f4',
  red: '#ea4335',
  yellow: '#fbbc04',
  green: '#34a853',
  pink: '#e91e63',
  purple: '#9c27b0',
  cyan: '#00bcd4',
  orange: '#ff9800',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let query = '';
let searchScope = 'all';
let previousTab = null;
let allTabs = [];
let workspaceData = null;
let chromeGroups = [];
let isSearching = false;
let searchGeneration = 0;
let meridianTabId = null;
let currentWindowId = null;
let draggedTabId = null;
let collapsedSections = new Set();

const COLLAPSED_KEY = 'sidebarCollapsed';

const hasNativeGroups = typeof chrome.tabGroups !== 'undefined';

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadAll() {
  const [tabs, groups, wsStore, localStore, prev] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    hasNativeGroups ? chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }) : Promise.resolve([]),
    chrome.storage.local.get('workspaces'),
    chrome.storage.local.get(['meridianTabIds', 'meridianTabId']),
    getPreviousTab().catch(() => null),
  ]);

  currentWindowId = tabs[0]?.windowId ?? null;
  meridianTabId =
    localStore.meridianTabIds?.[String(currentWindowId)] ??
    tabs.find(
      (tab) =>
        tab.pinned &&
        (tab.url === chrome.runtime.getURL('meridian.html') ||
          tab.pendingUrl === chrome.runtime.getURL('meridian.html')),
    )?.id ??
    null;
  allTabs = tabs.filter((t) => t.id !== meridianTabId);
  chromeGroups = groups;
  workspaceData = wsStore.workspaces ?? null;
  previousTab = prev?.id === meridianTabId ? null : prev;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFaviconImg(url) {
  return createFavicon(url, 'tab-favicon');
}

function makeRowInteractive(row, label, activate) {
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', label);
  row.addEventListener('click', activate);
  row.addEventListener('keydown', (e) => {
    if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    activate();
  });
}

function makeSection(label, colorDot) {
  const section = document.createElement('div');
  section.className = 'tab-section';

  if (label) {
    if (collapsedSections.has(label)) section.classList.add('collapsed');

    const labelRow = document.createElement('div');
    labelRow.className = 'section-label';

    if (colorDot) {
      const dot = document.createElement('span');
      dot.className = 'group-dot';
      dot.style.setProperty('--group-color', colorDot);
      labelRow.appendChild(dot);
    }

    const text = document.createElement('span');
    text.textContent = label;
    labelRow.appendChild(text);

    const chevron = document.createElement('span');
    chevron.className = 'section-chevron';
    chevron.innerHTML = `<svg viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>`;
    labelRow.appendChild(chevron);

    labelRow.addEventListener('click', () => {
      const isNowCollapsed = section.classList.toggle('collapsed');
      if (isNowCollapsed) {
        collapsedSections.add(label);
      } else {
        collapsedSections.delete(label);
      }
      chrome.storage.local.set({ [COLLAPSED_KEY]: [...collapsedSections] });
    });

    section.appendChild(labelRow);
  }

  return section;
}

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

function attachDragEvents(row, tab) {
  row.draggable = true;

  row.addEventListener('dragstart', (e) => {
    draggedTabId = tab.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tab.id));
    requestAnimationFrame(() => row.classList.add('dragging'));
  });

  row.addEventListener('dragend', () => {
    draggedTabId = null;
    row.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  });

  row.addEventListener('dragover', (e) => {
    if (!draggedTabId || draggedTabId === tab.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });

  row.addEventListener('dragleave', (e) => {
    if (!row.contains(e.relatedTarget)) row.classList.remove('drag-over');
  });

  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    row.classList.remove('drag-over');
    const sourceId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!sourceId || sourceId === tab.id) return;
    try {
      await chrome.tabs.move(sourceId, { index: tab.index });
    } catch (_) {}
  });
}

// ---------------------------------------------------------------------------
// Tab row builder
// ---------------------------------------------------------------------------

function buildTabRow(tab) {
  const row = document.createElement('div');
  row.className = 'tab-row';
  row.title = tab.title || tab.url || '';

  row.appendChild(makeFaviconImg(tab.url));

  const body = document.createElement('div');
  body.className = 'tab-body';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || tab.url || 'Untitled';
  body.appendChild(title);
  row.appendChild(body);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close-btn';
  closeBtn.setAttribute('aria-label', 'Close tab');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.remove(tab.id);
  });
  row.appendChild(closeBtn);

  makeRowInteractive(
    row,
    `Switch to tab: ${tab.title || tab.url || 'Untitled'}`,
    () => activateTab(tab.id),
  );

  attachDragEvents(row, tab);
  return row;
}

// ---------------------------------------------------------------------------
// Render — default tab list
// ---------------------------------------------------------------------------

function renderTabList() {
  const container = document.getElementById('tab-list');
  container.innerHTML = '';

  // Previous tab shortcut
  if (previousTab) {
    const section = makeSection(null);
    section.classList.add('prev-section');

    const row = document.createElement('div');
    row.className = 'tab-row';

    const label = document.createElement('span');
    label.className = 'prev-label';
    label.textContent = '↩';
    row.appendChild(label);

    row.appendChild(makeFaviconImg(previousTab.url));

    const body = document.createElement('div');
    body.className = 'tab-body';
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = previousTab.title || previousTab.url || 'Previous tab';
    body.appendChild(title);
    row.appendChild(body);

    makeRowInteractive(
      row,
      `Switch to previous tab: ${previousTab.title || previousTab.url || 'Untitled'}`,
      () => activateTab(previousTab.id),
    );
    section.appendChild(row);
    container.appendChild(section);
  }

  // Separate Chrome-grouped tabs from ungrouped
  const groupedMap = new Map();
  const ungrouped = [];

  for (const tab of allTabs) {
    if (hasNativeGroups && tab.groupId != null && tab.groupId !== -1) {
      if (!groupedMap.has(tab.groupId)) groupedMap.set(tab.groupId, []);
      groupedMap.get(tab.groupId).push(tab);
    } else {
      ungrouped.push(tab);
    }
  }

  if (workspaceData?.workspaces?.length > 0 && workspaceData?.assignments) {
    const { workspaces, assignments } = workspaceData;

    // Unsorted first
    const unsortedTabs = ungrouped.filter(
      (t) => (assignments[String(t.id)] ?? 'unsorted') === 'unsorted',
    );
    if (unsortedTabs.length > 0) {
      const section = makeSection('Unsorted');
      for (const tab of unsortedTabs) section.appendChild(buildTabRow(tab));
      container.appendChild(section);
    }

    // Chrome tab groups
    for (const [groupId, tabs] of groupedMap) {
      const group = chromeGroups.find((g) => g.id === groupId);
      const label =
        group?.title?.trim() ||
        (group?.color
          ? group.color.charAt(0).toUpperCase() + group.color.slice(1)
          : 'Group');
      const colorHex = GROUP_COLORS[group?.color] ?? '#9aa0a6';

      const section = makeSection(label, colorHex);
      for (const tab of tabs) section.appendChild(buildTabRow(tab));
      container.appendChild(section);
    }

    // Named Meridian workspaces
    for (const ws of workspaces) {
      if (ws.id === 'unsorted') continue;
      const wsTabs = ungrouped.filter((t) => assignments[String(t.id)] === ws.id);
      if (wsTabs.length === 0) continue;

      const section = makeSection(ws.name);
      for (const tab of wsTabs) section.appendChild(buildTabRow(tab));
      container.appendChild(section);
    }
  } else {
    // No workspace data — Chrome groups then flat ungrouped list
    for (const [groupId, tabs] of groupedMap) {
      const group = chromeGroups.find((g) => g.id === groupId);
      const label =
        group?.title?.trim() ||
        (group?.color
          ? group.color.charAt(0).toUpperCase() + group.color.slice(1)
          : 'Group');
      const colorHex = GROUP_COLORS[group?.color] ?? '#9aa0a6';

      const section = makeSection(label, colorHex);
      for (const tab of tabs) section.appendChild(buildTabRow(tab));
      container.appendChild(section);
    }

    const section = makeSection('Open Tabs');
    for (const tab of ungrouped) section.appendChild(buildTabRow(tab));
    container.appendChild(section);
  }
}

// ---------------------------------------------------------------------------
// Render — search results
// ---------------------------------------------------------------------------

function buildResultRow(item) {
  const row = document.createElement('div');
  row.className = 'tab-row';

  row.appendChild(makeFaviconImg(item.url));

  const body = document.createElement('div');
  body.className = 'tab-body';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = item.title || item.url || '';
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'tab-meta';
  if (item.context) {
    meta.textContent = item.context;
  } else {
    try {
      meta.textContent = new URL(item.url).hostname;
    } catch {
      meta.textContent = item.url || '';
    }
  }
  body.appendChild(meta);

  row.appendChild(body);

  makeRowInteractive(
    row,
    `Open ${item.title || item.url || 'result'}`,
    async () => {
      if (item.tabId != null) {
        await activateTab(item.tabId);
      } else {
        await chrome.tabs.create({ url: item.url });
      }
    },
  );

  return row;
}

function renderResultSection(
  container,
  label,
  items,
  limit = 10,
  respectSavedCollapse = true,
) {
  if (!items.length) return;
  const section = makeSection(label);
  if (!respectSavedCollapse) section.classList.remove('collapsed');
  for (const item of items.slice(0, limit)) {
    section.appendChild(buildResultRow(item));
  }
  container.appendChild(section);
}

function countBookmarks(node) {
  if (node.url) return 1;
  return (node.children || []).reduce(
    (total, child) => total + countBookmarks(child),
    0,
  );
}

function buildBookmarkTreeNode(node, depth = 0, defaultExpanded = false) {
  if (node.url) {
    const row = buildResultRow(node);
    row.classList.add('bookmark-tree-item');
    row.style.setProperty('--bookmark-depth', depth);
    return row;
  }

  const folder = document.createElement('div');
  folder.className = `bookmark-tree-folder${defaultExpanded ? '' : ' collapsed'}`;

  const row = document.createElement('div');
  row.className = 'tab-row bookmark-folder-row';
  row.style.setProperty('--bookmark-depth', depth);

  const chevron = document.createElement('span');
  chevron.className = 'bookmark-tree-chevron';
  chevron.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 1l4 4-4 4"/></svg>`;
  row.appendChild(chevron);

  const folderIcon = document.createElement('span');
  folderIcon.className = 'bookmark-tree-folder-icon';
  folderIcon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
  row.appendChild(folderIcon);

  const body = document.createElement('div');
  body.className = 'tab-body';
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = node.title || 'Bookmarks';
  body.appendChild(title);
  row.appendChild(body);

  const count = document.createElement('span');
  count.className = 'bookmark-tree-count';
  count.textContent = String(countBookmarks(node));
  row.appendChild(count);

  const children = document.createElement('div');
  children.className = 'bookmark-tree-children';
  for (const child of node.children || []) {
    children.appendChild(buildBookmarkTreeNode(child, depth + 1));
  }

  const updateFolderState = (expanded) => {
    folder.classList.toggle('collapsed', !expanded);
    row.setAttribute('aria-expanded', String(expanded));
    row.setAttribute(
      'aria-label',
      `${expanded ? 'Collapse' : 'Expand'} bookmark folder: ${node.title || 'Bookmarks'}`,
    );
  };

  makeRowInteractive(
    row,
    `${defaultExpanded ? 'Collapse' : 'Expand'} bookmark folder: ${node.title || 'Bookmarks'}`,
    () => updateFolderState(folder.classList.contains('collapsed')),
  );
  row.setAttribute('aria-expanded', String(defaultExpanded));

  folder.append(row, children);
  return folder;
}

function renderBookmarkTree(container, roots) {
  const tree = document.createElement('div');
  tree.className = 'bookmark-tree';

  const orderedRoots = [...roots].sort((a, b) => {
    if (a.id === '1') return -1;
    if (b.id === '1') return 1;
    return 0;
  });
  for (const root of orderedRoots) {
    tree.appendChild(buildBookmarkTreeNode(root, 0, root.id === '1'));
  }

  if (tree.childElementCount) {
    container.appendChild(tree);
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No bookmarks';
    container.appendChild(empty);
  }
}

async function loadFullHistoryResults(q) {
  const pageSize = 10000;
  const itemsById = new Map();
  let endTime = Date.now() + 1;

  while (endTime >= 0) {
    let page;
    try {
      page = await chrome.history.search({
        text: q,
        startTime: 0,
        endTime,
        maxResults: pageSize,
      });
    } catch {
      break;
    }

    for (const item of page) {
      if (!item.url) continue;
      itemsById.set(item.id ?? item.url, item);
    }

    if (page.length < pageSize) break;
    const oldest = Math.min(
      ...page.map((item) => item.lastVisitTime ?? endTime),
    );
    if (!Number.isFinite(oldest)) break;
    endTime = oldest < endTime ? oldest : endTime - 1;
  }

  return [...itemsById.values()]
    .sort((a, b) => (b.lastVisitTime ?? 0) - (a.lastVisitTime ?? 0))
    .map((item) => ({
      title: item.title ?? '',
      url: item.url,
      context: item.lastVisitTime
        ? new Date(item.lastVisitTime).toLocaleString()
        : '',
    }));
}

function isCurrentSearch(q, generation, scope = searchScope) {
  return (
    generation === searchGeneration &&
    query === q &&
    searchScope === scope
  );
}

async function runSearch(q, generation) {
  const scope = searchScope;
  const container = document.getElementById('tab-list');
  const enabledSources = await getEnabledLocalSearchSources();
  if (!isCurrentSearch(q, generation, scope)) return;

  if (scope === 'bookmarks' && enabledSources.bookmarks && !q) {
    let roots = [];
    try {
      const [root] = await chrome.bookmarks.getTree();
      roots = root?.children || [];
    } catch {}
    if (!isCurrentSearch(q, generation, scope)) return;
    container.innerHTML = '';
    renderBookmarkTree(container, roots);
    return;
  }

  let results;
  if (scope === 'history' && enabledSources.history) {
    results = {
      tabs: [],
      bookmarks: [],
      history: await loadFullHistoryResults(q),
    };
  } else {
    results = await search(q, scope, enabledSources);
  }
  if (!isCurrentSearch(q, generation, scope)) return;
  container.innerHTML = '';

  const total =
    results.tabs.length + results.bookmarks.length + results.history.length;

  if (total === 0) {
    if (scope !== 'all') {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const label = scope === 'bookmarks' ? 'bookmarks' : 'history';
      empty.textContent = enabledSources[scope]
        ? `No ${label}${q ? ' match' : ''}`
        : `${label[0].toUpperCase()}${label.slice(1)} access is off`;
      container.appendChild(empty);
      return;
    }

    const { searchProvider } = await chrome.storage.sync.get('searchProvider');
    if (!isCurrentSearch(q, generation, scope)) return;

    const baseUrl = PROVIDER_URLS[searchProvider] ?? PROVIDER_URLS.google;

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.appendChild(document.createTextNode('No results — '));
    const btn = document.createElement('button');
    btn.className = 'search-web-btn';
    btn.textContent = 'search the web';
    btn.addEventListener('click', () =>
      chrome.tabs.create({ url: baseUrl + encodeURIComponent(q) }),
    );
    empty.appendChild(btn);
    container.appendChild(empty);
    return;
  }

  if (scope === 'all') {
    renderResultSection(container, 'Open Tabs', results.tabs);
    renderResultSection(container, 'Bookmarks', results.bookmarks);
    renderResultSection(container, 'History', results.history);
  } else if (scope === 'bookmarks') {
    renderResultSection(
      container,
      'Bookmarks',
      results.bookmarks,
      Infinity,
      false,
    );
  } else {
    renderResultSection(
      container,
      'History',
      results.history,
      Infinity,
      false,
    );
  }
}

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

function refreshIfIdle() {
  if (isSearching) return;
  loadAll().then(renderTabList);
}

chrome.tabs.onCreated.addListener(refreshIfIdle);
chrome.tabs.onRemoved.addListener(refreshIfIdle);
chrome.tabs.onMoved.addListener(refreshIfIdle);
chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.title || changeInfo.status === 'complete' || changeInfo.favIconUrl)
    refreshIfIdle();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.workspaces || changes.previousTabId))
    refreshIfIdle();
  if (area === 'sync' && changes.localSearch && isSearching) {
    const generation = ++searchGeneration;
    runSearch(query, generation);
  }
});

if (hasNativeGroups) {
  chrome.tabGroups.onCreated?.addListener(refreshIfIdle);
  chrome.tabGroups.onUpdated?.addListener(refreshIfIdle);
  chrome.tabGroups.onRemoved?.addListener(refreshIfIdle);
}

// ---------------------------------------------------------------------------
// Input listeners
// ---------------------------------------------------------------------------

function attachListeners() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const scopeButtons = {
    bookmarks: document.getElementById('scope-bookmarks'),
    history: document.getElementById('scope-history'),
  };

  function updateClearButton() {
    clearBtn.classList.toggle('hidden', input.value.length === 0);
  }

  function updateScopeControls() {
    input.placeholder = SCOPE_PLACEHOLDERS[searchScope];
    for (const [scope, button] of Object.entries(scopeButtons)) {
      const active = searchScope === scope;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  async function renderCurrentMode() {
    const generation = ++searchGeneration;
    if (query || searchScope !== 'all') {
      isSearching = true;
      await runSearch(query, generation);
    } else {
      isSearching = false;
      renderTabList();
    }
  }

  async function setScope(nextScope) {
    searchScope = nextScope;
    updateScopeControls();
    await renderCurrentMode();
  }

  async function clearSearch() {
    input.value = '';
    query = '';
    updateClearButton();
    await renderCurrentMode();
    input.focus();
  }

  input.addEventListener('input', async () => {
    updateClearButton();
    query = input.value.trim();
    await renderCurrentMode();
  });

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && query) {
      e.preventDefault();
      if (searchScope !== 'all') {
        document.querySelector('#tab-list .tab-row')?.click();
        return;
      }
      const { searchProvider } = await chrome.storage.sync.get('searchProvider');
      const baseUrl = PROVIDER_URLS[searchProvider] ?? PROVIDER_URLS.google;
      chrome.tabs.create({ url: baseUrl + encodeURIComponent(query) });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      document.querySelector('#tab-list .tab-row')?.focus();
      return;
    }
    if (e.key === 'Escape' && searchScope !== 'all') {
      e.preventDefault();
      await setScope('all');
      input.focus();
      return;
    }
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      await clearSearch();
    }
  });

  clearBtn.addEventListener('click', clearSearch);

  for (const [scope, button] of Object.entries(scopeButtons)) {
    button.addEventListener('click', async () => {
      const nextScope = searchScope === scope ? 'all' : scope;
      if (nextScope !== 'all') {
        button.disabled = true;
        try {
          await setLocalSearchSourceEnabled(scope, true);
        } finally {
          button.disabled = false;
        }
      }
      await setScope(nextScope);
      input.focus();
    });
  }

  document.getElementById('new-tab-btn').addEventListener('click', () => {
    chrome.tabs.create({});
  });

  document.getElementById('meridian-btn').addEventListener('click', async () => {
    if (currentWindowId == null) {
      const window = await chrome.windows.getCurrent();
      currentWindowId = window.id;
    }
    await chrome.runtime.sendMessage({
      type: 'FOCUS_MERIDIAN',
      windowId: currentWindowId,
    });
  });

  updateScopeControls();
}

// ---------------------------------------------------------------------------
// Toolbar icon — swap to white fill in dark mode
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Narrow mode (icon-only when panel is very narrow)
// ---------------------------------------------------------------------------

function setupResizeObserver() {
  const ro = new ResizeObserver(([entry]) => {
    document.body.classList.toggle('narrow', entry.contentRect.width < 64);
  });
  ro.observe(document.body);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  watchToolbarIconTheme();

  const { [COLLAPSED_KEY]: saved } = await chrome.storage.local.get(COLLAPSED_KEY);
  if (Array.isArray(saved)) collapsedSections = new Set(saved);

  await loadAll();
  renderTabList();
  attachListeners();
  setupResizeObserver();

  document.getElementById('search-input').focus();
}

document.addEventListener('DOMContentLoaded', init);
