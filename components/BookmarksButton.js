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

function faviconUrl(pageUrl) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "16");
  return url.toString();
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
export function createScopePopup(panel, { openItem, historyProvider }) {
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

  function isOpen() {
    return !panel.classList.contains("hidden");
  }

  function close() {
    panel.classList.add("hidden");
  }

  function renderEmpty(text) {
    const message = document.createElement("p");
    message.className = "bookmarks-empty";
    message.textContent = text;
    panel.appendChild(message);
  }

  // Generic result row (favicon + label). Works for bookmark leaves and history.
  function makeItemRow(item) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "bookmark-row";
    row.title = item.url;

    const favicon = document.createElement("img");
    favicon.className = "bookmark-favicon";
    favicon.alt = "";
    favicon.src = item.favicon || faviconUrl(item.url);
    favicon.addEventListener("error", () => favicon.classList.add("hidden"));

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
      title.textContent = path[path.length - 1].title || "Folder";

      subnav.append(back, title);
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
      if (!matches.length) {
        renderEmpty("No bookmarks match");
        return;
      }
      const list = document.createElement("div");
      list.className = "bookmarks-list";
      for (const b of matches.slice(0, 200)) list.appendChild(makeItemRow(b));
      panel.appendChild(list);
      return;
    }

    // Empty → browsable tabbed / folder view.
    panel.appendChild(renderHeader());
    const nodes = currentNodes();
    if (!nodes.length) {
      renderEmpty("No bookmarks");
      return;
    }

    const list = document.createElement("div");
    list.className = "bookmarks-list";
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
    if (!historyItems.length) {
      renderEmpty(query.trim() ? "No history match" : "No history");
      return;
    }
    const list = document.createElement("div");
    list.className = "bookmarks-list";
    for (const item of historyItems.slice(0, 200)) {
      list.appendChild(makeItemRow(item));
    }
    panel.appendChild(list);
  }

  function render() {
    panel.replaceChildren();
    if (scope === "history") renderHistory();
    else renderBookmarks();
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

  async function openScope(next) {
    scope = next;
    query = "";
    panel.setAttribute(
      "aria-label",
      next === "history" ? "History" : "Bookmarks",
    );

    try {
      if (next === "bookmarks") {
        if (!bmLoaded) await loadBookmarks();
      } else if (next === "history") {
        await fetchHistory("");
      }
    } catch {
      panel.replaceChildren();
      renderEmpty("Could not load");
      panel.classList.remove("hidden");
      return;
    }

    panel.classList.remove("hidden");
    render();
  }

  async function setQuery(next) {
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

  return { openScope, close, isOpen, setQuery };
}
