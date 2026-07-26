import { createFavicon } from "../utils/favicon.js";
import { createSearchSelection } from "./SearchSelection.js";

export function flattenBookmarks(nodes) {
  return nodes.flatMap((node) => [
    ...(node.url ? [node] : []),
    ...flattenBookmarks(node.children || []),
  ]);
}

export function findBookmarksBar(root) {
  return (
    root.children?.find((node) => node.id === "1") ||
    root.children?.find((node) =>
      /bookmarks (bar|toolbar)/i.test(node.title || ""),
    )
  );
}

// The top level of the All Bookmarks view: the direct children of every
// non-bookmarks-bar root (e.g. Other Bookmarks, Mobile Bookmarks), merged so
// the user sees their folders and loose bookmarks without an extra wrapper.
export function allBookmarksRoot(root, bar) {
  return (root.children || [])
    .filter((node) => node !== bar)
    .flatMap((node) => node.children || []);
}

export async function openBookmarkFolderInGroup(folder, api = chrome) {
  const bookmarks = flattenBookmarks(folder.children || []);
  if (!bookmarks.length) return null;

  const createdTabs = await Promise.all(
    bookmarks.map(({ url }) => api.tabs.create({ url, active: false })),
  );
  const tabIds = createdTabs
    .map((tab) => tab.id)
    .filter((id) => Number.isInteger(id));

  if (tabIds.length !== bookmarks.length) {
    throw new Error("Chrome did not return an ID for every opened bookmark");
  }

  const groupId = await api.tabs.group({ tabIds });
  await api.tabGroups.update(groupId, {
    title: folder.title || "Untitled folder",
  });
  await api.tabs.update(tabIds[0], { active: true });
  return groupId;
}

function folderIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("bookmark-folder-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  );
  svg.appendChild(path);
  return svg;
}

// Scope popup driven by the search bar's Bookmarks / History scopes. It attaches
// directly below the search field. Bookmarks: browsable tabbed / folder view
// when empty, flat filtered results when typing. History: recent list when
// empty, filtered when typing (via the injected historyProvider).
export function createScopePopup(
  popup,
  {
    openItem,
    historyProvider,
    isSourceEnabled = async () => false,
    announce,
    onActiveDescendantChange,
  },
) {
  const panel = popup.el; // the shared search-popup shell element
  const selection = createSearchSelection(popup, {
    rowSelector: ".bookmark-row",
    idPrefix: "bookmark-result",
    onActiveDescendantChange,
  });
  let scope = null; // "bookmarks" | "history"
  let query = "";

  // Bookmarks state
  let bmLoaded = false;
  let bookmarksBar = [];
  let allRoot = [];
  let allFlat = [];
  let view = "bar"; // "bar" | "all"
  let path = []; // folders drilled into within the "all" view

  // History state
  let historyItems = [];
  let histSeq = 0;
  let scopeSeq = 0;

  function isOpen() {
    return popup.isOpen();
  }

  function close() {
    scopeSeq += 1;
    selection.reset();
    popup.close();
  }

  function makeResultsList() {
    const list = document.createElement("div");
    list.className = "bookmarks-list";
    list.id = "bookmarks-results-listbox";
    list.setAttribute("role", "listbox");
    list.setAttribute(
      "aria-label",
      `${scope === "history" ? "History" : "Bookmark"} results`,
    );
    return list;
  }

  function renderEmpty(list, text) {
    const message = document.createElement("p");
    message.className = "bookmarks-empty";
    message.textContent = text;
    list.appendChild(message);
  }

  // Generic result row (favicon + label). Works for bookmark leaves and history.
  function makeItemRow(item) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "bookmark-row";
    row.title = item.url;

    const favicon = createFavicon(item.url, "bookmark-favicon");

    const label = document.createElement("span");
    label.textContent = item.title || item.url;
    row.append(favicon, label);
    row.addEventListener("click", () => openItem(item.url));
    return row;
  }

  function makeFolderRow(folder) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "bookmark-row bookmark-folder";

    const label = document.createElement("span");
    label.textContent = folder.title || "Untitled folder";

    const chevron = document.createElement("span");
    chevron.className = "bookmark-folder-chevron";
    chevron.textContent = "›"; // ›
    chevron.setAttribute("aria-hidden", "true");

    row.append(folderIcon(), label, chevron);
    row.addEventListener("click", () => {
      path.push(folder);
      render();
    });
    return row;
  }

  function makeTab(label, targetView) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "bookmarks-tab" + (view === targetView ? " active" : "");
    tab.textContent = label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(view === targetView));
    tab.addEventListener("click", () => {
      // Re-selecting the active All Bookmarks tab pops back to its root.
      if (view === targetView && !path.length) return;
      view = targetView;
      path = [];
      render();
    });
    return tab;
  }

  function renderHeader() {
    const header = document.createElement("div");
    header.className = "bookmarks-panel-header";

    const tabs = document.createElement("div");
    tabs.className = "bookmarks-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.append(makeTab("Bookmarks Bar", "bar"), makeTab("All Bookmarks", "all"));
    header.appendChild(tabs);

    if (view === "all" && path.length) {
      const subnav = document.createElement("div");
      subnav.className = "bookmarks-subnav";
      const folder = path[path.length - 1];

      const back = document.createElement("button");
      back.type = "button";
      back.className = "bookmarks-back";
      back.textContent = "‹ Back"; // ‹ Back
      back.addEventListener("click", () => {
        path.pop();
        render();
      });

      const title = document.createElement("strong");
      title.className = "bookmarks-subnav-title";
      title.textContent = folder.title || "Folder";

      const bookmarkCount = flattenBookmarks(folder.children || []).length;
      const openAll = document.createElement("button");
      openAll.type = "button";
      openAll.className = "bookmarks-open-group";
      openAll.textContent = "Open all in group";
      openAll.disabled = bookmarkCount === 0;
      openAll.title = bookmarkCount
        ? `Open ${bookmarkCount} bookmark${bookmarkCount === 1 ? "" : "s"} in a new group`
        : "This folder has no bookmarks";
      openAll.addEventListener("click", async () => {
        openAll.disabled = true;
        openAll.setAttribute("aria-busy", "true");
        try {
          await openBookmarkFolderInGroup(folder);
          close();
        } catch (error) {
          console.error("Could not open bookmark folder in a group", error);
          openAll.textContent = "Could not open";
        } finally {
          openAll.removeAttribute("aria-busy");
        }
      });

      subnav.append(back, title, openAll);
      header.appendChild(subnav);
    }
    return header;
  }

  function currentNodes() {
    if (view === "bar") return bookmarksBar;
    if (path.length) return path[path.length - 1].children || [];
    return allRoot;
  }

  function renderBookmarks() {
    const q = query.trim().toLowerCase();

    // Typed → flat, filtered search across every bookmark.
    if (q) {
      const matches = allFlat.filter(
        (b) =>
          (b.title || "").toLowerCase().includes(q) ||
          (b.url || "").toLowerCase().includes(q),
      );
      const list = makeResultsList();
      if (!matches.length) {
        renderEmpty(list, "No bookmarks match");
        panel.appendChild(list);
        return;
      }
      for (const b of matches.slice(0, 200)) list.appendChild(makeItemRow(b));
      panel.appendChild(list);
      return;
    }

    // Empty → browsable tabbed / folder view.
    panel.appendChild(renderHeader());
    const nodes = currentNodes();
    const list = makeResultsList();
    if (!nodes.length) {
      renderEmpty(list, "No bookmarks");
      panel.appendChild(list);
      return;
    }

    // Folders first, then bookmarks — matches how bookmark managers group them.
    for (const node of nodes) {
      if (!node.url) list.appendChild(makeFolderRow(node));
    }
    for (const node of nodes) {
      if (node.url) list.appendChild(makeItemRow(node));
    }
    panel.appendChild(list);
  }

  function renderHistory() {
    const list = makeResultsList();
    if (!historyItems.length) {
      renderEmpty(
        list,
        query.trim() ? "No history match" : "No history",
      );
      panel.appendChild(list);
      return;
    }
    for (const item of historyItems.slice(0, 200)) {
      list.appendChild(makeItemRow(item));
    }
    panel.appendChild(list);
  }

  function render() {
    selection.reset();
    panel.replaceChildren();
    if (scope === "history") renderHistory();
    else renderBookmarks();
    const count = selection.sync();
    if (count) {
      announce?.(
        `${count} ${scope === "history" ? "history" : "bookmark"} result${count === 1 ? "" : "s"} available.`,
      );
    } else {
      announce?.(
        query.trim()
          ? `No ${scope === "history" ? "history" : "bookmark"} results found.`
          : `No ${scope === "history" ? "history entries" : "bookmarks"} available.`,
      );
    }
  }

  async function loadBookmarks() {
    const [root] = await chrome.bookmarks.getTree();
    const bar = findBookmarksBar(root);
    bookmarksBar = flattenBookmarks(bar?.children || []);
    allRoot = allBookmarksRoot(root, bar);
    allFlat = flattenBookmarks(root.children || []);
    bmLoaded = true;
  }

  async function fetchHistory(q) {
    const seq = ++histSeq;
    const items = await historyProvider(q);
    if (seq !== histSeq) return false; // a newer request superseded this one
    historyItems = items || [];
    return true;
  }

  async function openScope(next, initialQuery = "") {
    const seq = ++scopeSeq;
    selection.reset();
    scope = next;
    query = initialQuery || "";
    panel.setAttribute(
      "aria-label",
      next === "history" ? "History" : "Bookmarks",
    );
    announce?.(
      `${next === "history" ? "History" : "Bookmarks"} search scope selected. Loading ${next === "history" ? "history" : "bookmark"} results.`,
    );

    try {
      if (!(await isSourceEnabled(next))) {
        if (seq !== scopeSeq) return;
        panel.replaceChildren();
        const list = makeResultsList();
        renderEmpty(
          list,
          `${next === "history" ? "History" : "Bookmark"} access is off. Enable it in Settings to search this source.`,
        );
        panel.appendChild(list);
        selection.sync();
        popup.open();
        announce?.(
          `${next === "history" ? "History" : "Bookmark"} access is off. Enable it in Settings to search this source.`,
        );
        return;
      }
      if (next === "bookmarks") {
        if (!bmLoaded) await loadBookmarks();
      } else if (next === "history") {
        // The field can keep changing while permission/data loading is in
        // flight. Fetch until the results match the latest retained query.
        let requestedQuery;
        do {
          requestedQuery = query;
          await fetchHistory(requestedQuery);
          if (seq !== scopeSeq) return;
        } while (requestedQuery !== query);
      }
    } catch {
      if (seq !== scopeSeq) return;
      panel.replaceChildren();
      const list = makeResultsList();
      renderEmpty(list, "Could not load");
      panel.appendChild(list);
      selection.sync();
      popup.open();
      announce?.(
        `Could not load ${next === "history" ? "history" : "bookmark"} results.`,
      );
      return;
    }

    if (seq !== scopeSeq) return;
    render();
    popup.open();
  }

  async function setQuery(next) {
    selection.reset();
    query = next || "";
    if (!isOpen()) return;
    if (scope === "history") {
      const fresh = await fetchHistory(query);
      if (fresh) render();
    } else {
      render();
    }
  }

  panel.addEventListener("click", (event) => event.stopPropagation());
  panel.appendChild(makeResultsList());

  return {
    openScope,
    close,
    isOpen,
    setQuery,
    moveSelection: selection.move,
    activateSelection: selection.activate,
    resetSelection: selection.reset,
  };
}
