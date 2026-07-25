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

export function createBookmarksButton(button, panel, openBookmark) {
  let view = "bar"; // "bar" | "all"
  let bookmarksBar = [];
  let allRoot = [];
  let path = []; // stack of folder nodes drilled into within the "all" view

  function close() {
    panel.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
  }

  function renderMessage(text) {
    panel.replaceChildren();
    const message = document.createElement("p");
    message.className = "bookmarks-empty";
    message.textContent = text;
    panel.appendChild(message);
  }

  function makeBookmarkRow(bookmark) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "bookmark-row";
    row.title = bookmark.url;

    const favicon = document.createElement("img");
    favicon.className = "bookmark-favicon";
    favicon.alt = "";
    favicon.src = faviconUrl(bookmark.url);
    favicon.addEventListener("error", () => favicon.classList.add("hidden"));

    const label = document.createElement("span");
    label.textContent = bookmark.title || bookmark.url;
    row.append(favicon, label);
    row.addEventListener("click", () => {
      close();
      openBookmark(bookmark.url);
    });
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

  function render() {
    panel.replaceChildren();
    panel.appendChild(renderHeader());

    const nodes = currentNodes();
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.className = "bookmarks-empty";
      empty.textContent = "No bookmarks";
      panel.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "bookmarks-list";
    // Folders first, then bookmarks — matches how bookmark managers group them.
    for (const node of nodes) {
      if (!node.url) list.appendChild(makeFolderRow(node));
    }
    for (const node of nodes) {
      if (node.url) list.appendChild(makeBookmarkRow(node));
    }
    panel.appendChild(list);
  }

  async function open() {
    try {
      const [root] = await chrome.bookmarks.getTree();
      const bar = findBookmarksBar(root);
      bookmarksBar = flattenBookmarks(bar?.children || []);
      allRoot = allBookmarksRoot(root, bar);
      view = "bar";
      path = [];
      render();
    } catch {
      renderMessage("Could not load bookmarks");
    }
    panel.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
  }

  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!panel.classList.contains("hidden")) {
      close();
      return;
    }
    await open();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", close);

  return {
    close,
    isOpen: () => !panel.classList.contains("hidden"),
  };
}
