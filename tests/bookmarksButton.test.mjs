import assert from "node:assert/strict";
import test from "node:test";

import {
  createScopePopup,
  flattenBookmarks,
  findBookmarksBar,
  allBookmarksRoot,
  openBookmarkFolderInGroup,
} from "../components/BookmarksButton.js";

// Chrome's getTree() shape: root (id "0") → [Bookmarks Bar (id "1"),
// Other Bookmarks (id "2"), ...]; folders have no `url`, leaves do.
function fixture() {
  return {
    id: "0",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          { id: "10", title: "GitHub", url: "https://github.com" },
          {
            id: "11",
            title: "Dev",
            children: [
              { id: "12", title: "MDN", url: "https://developer.mozilla.org" },
            ],
          },
        ],
      },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [
          { id: "20", title: "News", url: "https://news.example" },
          {
            id: "21",
            title: "Recipes",
            children: [
              { id: "22", title: "Soup", url: "https://soup.example" },
            ],
          },
        ],
      },
    ],
  };
}

function fakeElement() {
  return {
    className: "",
    id: "",
    textContent: "",
    children: [],
    attributes: new Map(),
    classList: { add() {} },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...children) {
      children.forEach((child) => this.appendChild(child));
    },
  };
}

test("findBookmarksBar resolves the bar by stable id 1", () => {
  const bar = findBookmarksBar(fixture());
  assert.equal(bar.id, "1");
});

test("findBookmarksBar falls back to a title match when id 1 is absent", () => {
  const root = {
    children: [
      { id: "99", title: "Bookmarks Toolbar", children: [] },
      { id: "2", title: "Other", children: [] },
    ],
  };
  assert.equal(findBookmarksBar(root).id, "99");
});

test("flattenBookmarks (Bookmarks Bar view) recurses folders and drops folder nodes", () => {
  const bar = findBookmarksBar(fixture());
  const urls = flattenBookmarks(bar.children).map((b) => b.url);
  assert.deepEqual(urls, [
    "https://github.com",
    "https://developer.mozilla.org",
  ]);
});

test("allBookmarksRoot preserves folder nodes for drill-in (does not flatten)", () => {
  const root = fixture();
  const bar = findBookmarksBar(root);
  const top = allBookmarksRoot(root, bar);

  // Top level = children of non-bar roots: the News leaf + the Recipes folder.
  assert.deepEqual(
    top.map((n) => n.id),
    ["20", "21"],
  );
  const recipes = top.find((n) => n.id === "21");
  assert.ok(!recipes.url, "folder node retains no url");
  assert.deepEqual(
    recipes.children.map((n) => n.url),
    ["https://soup.example"],
    "drilling into a folder exposes its children",
  );
});

test("allBookmarksRoot excludes the bookmarks bar subtree", () => {
  const root = fixture();
  const bar = findBookmarksBar(root);
  const ids = allBookmarksRoot(root, bar).map((n) => n.id);
  assert.ok(!ids.includes("10") && !ids.includes("11"));
});

test("openBookmarkFolderInGroup opens nested bookmarks in one named group", async () => {
  const folder = {
    title: "Reading",
    children: [
      { title: "One", url: "https://one.example" },
      {
        title: "Nested",
        children: [{ title: "Two", url: "https://two.example" }],
      },
    ],
  };
  const calls = [];
  let nextTabId = 40;
  const api = {
    tabs: {
      async create(options) {
        calls.push(["create", options]);
        return { id: nextTabId++ };
      },
      async group(options) {
        calls.push(["group", options]);
        return 7;
      },
      async update(tabId, options) {
        calls.push(["update", tabId, options]);
      },
    },
    tabGroups: {
      async update(groupId, options) {
        calls.push(["updateGroup", groupId, options]);
      },
    },
  };

  const groupId = await openBookmarkFolderInGroup(folder, api);

  assert.equal(groupId, 7);
  assert.deepEqual(calls, [
    ["create", { url: "https://one.example", active: false }],
    ["create", { url: "https://two.example", active: false }],
    ["group", { tabIds: [40, 41] }],
    ["updateGroup", 7, { title: "Reading" }],
    ["update", 40, { active: true }],
  ]);
});

test("openBookmarkFolderInGroup does nothing for an empty folder", async () => {
  const api = {
    tabs: {
      create() {
        assert.fail("should not create a tab");
      },
    },
  };

  assert.equal(
    await openBookmarkFolderInGroup({ title: "Empty", children: [] }, api),
    null,
  );
});

test("a disabled popup source explains access without querying it", async () => {
  let bookmarkQueries = 0;
  let historyQueries = 0;
  const announcements = [];
  const panel = {
    children: [],
    addEventListener() {},
    setAttribute() {},
    replaceChildren(...children) {
      this.children = [...children];
    },
    appendChild(node) {
      this.children.push(node);
    },
    querySelectorAll: () => [],
  };

  globalThis.document = {
    createElement: fakeElement,
  };
  globalThis.chrome = {
    bookmarks: {
      async getTree() {
        bookmarkQueries += 1;
        return [];
      },
    },
  };

  const popup = {
    el: panel,
    open() {},
    close() {},
    isOpen: () => false,
  };
  const scopes = createScopePopup(popup, {
    openItem() {},
    announce: (message) => announcements.push(message),
    isSourceEnabled: async () => false,
    historyProvider: async () => {
      historyQueries += 1;
      return [];
    },
  });

  await scopes.openScope("bookmarks");
  await scopes.openScope("history");

  assert.equal(bookmarkQueries, 0);
  assert.equal(historyQueries, 0);
  assert.match(panel.children[0].children[0].textContent, /access is off/i);
  assert.ok(
    announcements.some((message) =>
      /Bookmarks search scope selected\. Loading bookmark results/.test(
        message,
      ),
    ),
  );
  assert.match(announcements.at(-1), /History access is off/);
});

test("history scope opens with the retained search query", async () => {
  const requestedQueries = [];
  const announcements = [];
  let open = false;
  const panel = {
    children: [],
    addEventListener() {},
    setAttribute() {},
    replaceChildren(...children) {
      this.children = [...children];
    },
    appendChild(node) {
      this.children.push(node);
    },
    querySelectorAll: () => [],
  };

  globalThis.document = {
    createElement: fakeElement,
  };

  const popup = {
    el: panel,
    open() {
      open = true;
    },
    close() {
      open = false;
    },
    isOpen: () => open,
  };
  const scopes = createScopePopup(popup, {
    openItem() {},
    announce: (message) => announcements.push(message),
    isSourceEnabled: async () => true,
    historyProvider: async (query) => {
      requestedQueries.push(query);
      return [];
    },
  });

  await scopes.openScope("history", "retained query");

  assert.deepEqual(requestedQueries, ["retained query"]);
  assert.equal(open, true);
  assert.deepEqual(announcements, [
    "History search scope selected. Loading history results.",
    "No history results found.",
  ]);
});
