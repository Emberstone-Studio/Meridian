import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Could not find ${signature}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not find the end of ${signature}`);
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("sidebar search ignores reversed and cleared async results", async () => {
  const source = await readFile(
    new URL("../components/sidebar.js", import.meta.url),
    "utf8",
  );
  const isCurrentSearch = extractFunction(
    source,
    "function isCurrentSearch(",
  );
  const runSearch = extractFunction(source, "async function runSearch(");
  const attachListeners = extractFunction(source, "function attachListeners(");

  const pendingSearches = new Map();
  const pendingProvider = deferred();
  const writes = [];
  const listeners = {};
  const input = {
    value: "",
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };
  const container = {};
  Object.defineProperty(container, "innerHTML", {
    set(value) {
      writes.push(["html", value]);
    },
  });
  const button = {
    addEventListener() {},
    classList: { toggle() {} },
    setAttribute() {},
  };
  const clearButton = {
    addEventListener() {},
    classList: { toggle() {} },
  };

  const harness = new Function(
    "document",
    "chrome",
    "getEnabledLocalSearchSources",
    "search",
    "renderResultSection",
    "renderTabList",
    `
      const PROVIDER_URLS = { google: "https://example.test/?q=" };
      const SCOPE_PLACEHOLDERS = {
        all: "Search anything",
        bookmarks: "Search bookmarks",
        history: "Search history",
      };
      let query = "";
      let searchScope = "all";
      let isSearching = false;
      let searchGeneration = 0;
      ${isCurrentSearch}
      ${runSearch}
      ${attachListeners}
      return { attachListeners };
    `,
  )(
    {
      getElementById(id) {
        if (id === "search-input") return input;
        if (id === "search-clear-btn") return clearButton;
        if (id === "tab-list") return container;
        return button;
      },
      querySelector() {
        return null;
      },
    },
    {
      storage: {
        sync: {
          get(key) {
            if (key === "searchProvider") return pendingProvider.promise;
            return Promise.resolve({});
          },
        },
        local: { get: async () => ({}) },
      },
      tabs: { create() {} },
    },
    async () => ({ tabs: true, bookmarks: true, history: true }),
    (query) => {
      const request = deferred();
      pendingSearches.set(query, request);
      return request.promise;
    },
    (_container, label, items) => {
      if (items.length) writes.push(["section", label, items[0].title]);
    },
    () => writes.push(["tabs"]),
  );

  harness.attachListeners();

  input.value = "old";
  const oldSearch = listeners.input();
  input.value = "new";
  const newSearch = listeners.input();
  await new Promise((resolve) => setImmediate(resolve));
  pendingSearches.get("new").resolve({
    tabs: [{ title: "new result" }],
    bookmarks: [],
    history: [],
  });
  await newSearch;
  const afterNew = structuredClone(writes);

  await oldSearch;
  assert.equal(pendingSearches.has("old"), false);
  assert.deepEqual(writes, afterNew);
  assert.equal(writes.at(-1).at(-1), "new result");

  input.value = "empty";
  const emptySearch = listeners.input();
  await new Promise((resolve) => setImmediate(resolve));
  pendingSearches.get("empty").resolve({
    tabs: [],
    bookmarks: [],
    history: [],
  });
  await new Promise((resolve) => setImmediate(resolve));

  input.value = "latest";
  const latestSearch = listeners.input();
  await new Promise((resolve) => setImmediate(resolve));
  pendingSearches.get("latest").resolve({
    tabs: [{ title: "latest result" }],
    bookmarks: [],
    history: [],
  });
  await latestSearch;
  pendingProvider.resolve({ searchProvider: "google" });
  await emptySearch;
  assert.equal(writes.at(-1).at(-1), "latest result");

  input.value = "pending";
  const pendingSearch = listeners.input();
  await new Promise((resolve) => setImmediate(resolve));
  input.value = "";
  await listeners.input();
  const afterClear = structuredClone(writes);
  pendingSearches.get("pending").resolve({
    tabs: [{ title: "stale after clear" }],
    bookmarks: [],
    history: [],
  });
  await pendingSearch;
  assert.deepEqual(writes, afterClear);
  assert.deepEqual(writes.at(-1), ["tabs"]);
});

test("sidebar bookmark and history controls switch the list scope", async () => {
  const source = await readFile(
    new URL("../components/sidebar.js", import.meta.url),
    "utf8",
  );
  const isCurrentSearch = extractFunction(
    source,
    "function isCurrentSearch(",
  );
  const runSearch = extractFunction(source, "async function runSearch(");
  const attachListeners = extractFunction(source, "function attachListeners(");

  function makeButton() {
    const listeners = {};
    return {
      listeners,
      disabled: false,
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
      classList: { toggle() {} },
      setAttribute() {},
    };
  }

  const input = {
    value: "",
    placeholder: "",
    addEventListener() {},
    focus() {},
  };
  const clearButton = makeButton();
  const bookmarkButton = makeButton();
  const historyButton = makeButton();
  const genericButton = makeButton();
  const container = { innerHTML: "", appendChild() {} };
  const requestedPermissions = [];
  const searchedScopes = [];
  const renderedSections = [];
  const treeRenders = [];
  const historyLoads = [];
  let tabListRenders = 0;

  const harness = new Function(
    "document",
    "chrome",
    "getEnabledLocalSearchSources",
    "setLocalSearchSourceEnabled",
    "search",
    "renderResultSection",
    "renderBookmarkTree",
    "loadFullHistoryResults",
    "renderTabList",
    `
      const PROVIDER_URLS = { google: "https://example.test/?q=" };
      const SCOPE_PLACEHOLDERS = {
        all: "Search anything",
        bookmarks: "Search bookmarks",
        history: "Search history",
      };
      let query = "";
      let searchScope = "all";
      let isSearching = false;
      let searchGeneration = 0;
      let currentWindowId = null;
      ${isCurrentSearch}
      ${runSearch}
      ${attachListeners}
      return { attachListeners };
    `,
  )(
    {
      getElementById(id) {
        if (id === "search-input") return input;
        if (id === "search-clear-btn") return clearButton;
        if (id === "scope-bookmarks") return bookmarkButton;
        if (id === "scope-history") return historyButton;
        if (id === "tab-list") return container;
        return genericButton;
      },
      querySelector() {
        return null;
      },
    },
    {
      storage: { sync: { get: async () => ({}) } },
      tabs: { create() {} },
      bookmarks: {
        getTree: async () => [
          { children: [{ id: "1", title: "Bookmarks Bar", children: [] }] },
        ],
      },
    },
    async () => ({ tabs: true, bookmarks: true, history: true }),
    async (scope, enabled) => {
      requestedPermissions.push([scope, enabled]);
    },
    async (_query, scope) => {
      searchedScopes.push(scope);
      return {
        tabs: [],
        bookmarks:
          scope === "bookmarks" ? [{ title: "Saved page" }] : [],
        history: scope === "history" ? [{ title: "Visited page" }] : [],
      };
    },
    (_container, label) => renderedSections.push(label),
    (_container, roots) => treeRenders.push(roots[0].title),
    async (query) => {
      historyLoads.push(query);
      return [{ title: "Visited page" }];
    },
    () => {
      tabListRenders += 1;
    },
  );

  harness.attachListeners();

  await bookmarkButton.listeners.click();
  assert.equal(input.placeholder, "Search bookmarks");
  assert.deepEqual(requestedPermissions, []);
  assert.deepEqual(searchedScopes, []);
  assert.deepEqual(treeRenders, ["Bookmarks Bar"]);

  await historyButton.listeners.click();
  assert.equal(input.placeholder, "Search history");
  assert.deepEqual(requestedPermissions, []);
  assert.deepEqual(searchedScopes, []);
  assert.deepEqual(historyLoads, [""]);
  assert.deepEqual(renderedSections, ["History"]);

  await historyButton.listeners.click();
  assert.equal(input.placeholder, "Search anything");
  assert.equal(tabListRenders, 1);
});

test("sidebar history scope paginates through all available history", async () => {
  const source = await readFile(
    new URL("../components/sidebar.js", import.meta.url),
    "utf8",
  );
  const loadFullHistoryResults = extractFunction(
    source,
    "async function loadFullHistoryResults(",
  ).replace("const pageSize = 10000;", "const pageSize = 2;");

  const requests = [];
  const pages = [
    [
      { id: "a", title: "Newest", url: "https://a.test", lastVisitTime: 30 },
      { id: "b", title: "Middle", url: "https://b.test", lastVisitTime: 20 },
    ],
    [
      { id: "b", title: "Middle", url: "https://b.test", lastVisitTime: 20 },
      { id: "c", title: "Oldest", url: "https://c.test", lastVisitTime: 10 },
    ],
    [
      { id: "c", title: "Oldest", url: "https://c.test", lastVisitTime: 10 },
    ],
  ];
  const load = new Function(
    "chrome",
    `${loadFullHistoryResults}; return loadFullHistoryResults;`,
  )({
    history: {
      async search(request) {
        requests.push(request);
        return pages.shift();
      },
    },
  });

  const results = await load("");
  assert.deepEqual(
    results.map((item) => item.title),
    ["Newest", "Middle", "Oldest"],
  );
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.maxResults === 2));
  assert.equal(requests[1].endTime, 20);
  assert.equal(requests[2].endTime, 10);
});

test("sidebar bookmark tree opens the toolbar with nested folders collapsed", async () => {
  const source = await readFile(
    new URL("../components/sidebar.js", import.meta.url),
    "utf8",
  );
  const functions = [
    "function makeRowInteractive(",
    "function buildResultRow(",
    "function countBookmarks(",
    "function buildBookmarkTreeNode(",
    "function renderBookmarkTree(",
  ]
    .map((signature) => extractFunction(source, signature))
    .join("\n");

  class MockElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.listeners = {};
      this.attributes = {};
      this.styles = {};
      this._classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => this._classes.add(name)),
        contains: (name) => this._classes.has(name),
        remove: (...names) =>
          names.forEach((name) => this._classes.delete(name)),
        toggle: (name, force) => {
          const enabled =
            force === undefined ? !this._classes.has(name) : Boolean(force);
          if (enabled) this._classes.add(name);
          else this._classes.delete(name);
          return enabled;
        },
      };
      this.style = {
        setProperty: (name, value) => {
          this.styles[name] = value;
        },
      };
    }

    set className(value) {
      this._classes = new Set(value.split(/\s+/).filter(Boolean));
    }

    get className() {
      return [...this._classes].join(" ");
    }

    get childElementCount() {
      return this.children.length;
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    append(...children) {
      this.children.push(...children);
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }
  }

  const renderBookmarkTree = new Function(
    "document",
    "chrome",
    "makeFaviconImg",
    "activateTab",
    `${functions}; return renderBookmarkTree;`,
  )(
    { createElement: (tagName) => new MockElement(tagName) },
    { tabs: { create() {} } },
    () => new MockElement("img"),
    () => {},
  );

  const container = new MockElement("div");
  renderBookmarkTree(container, [
    { id: "2", title: "Other bookmarks", children: [] },
    {
      id: "1",
      title: "Bookmarks Bar",
      children: [
        { id: "a", title: "Saved", url: "https://saved.test" },
        {
          id: "folder",
          title: "Nested",
          children: [
            { id: "b", title: "Nested saved", url: "https://nested.test" },
          ],
        },
      ],
    },
  ]);

  const tree = container.children[0];
  const toolbarFolder = tree.children[0];
  const toolbarRow = toolbarFolder.children[0];
  const toolbarChildren = toolbarFolder.children[1];
  const nestedFolder = toolbarChildren.children[1];
  const nestedRow = nestedFolder.children[0];
  const otherFolder = tree.children[1];

  assert.equal(
    toolbarRow.children[2].children[0].textContent,
    "Bookmarks Bar",
  );
  assert.equal(toolbarFolder.classList.contains("collapsed"), false);
  assert.equal(nestedFolder.classList.contains("collapsed"), true);
  assert.equal(otherFolder.classList.contains("collapsed"), true);
  assert.equal(toolbarRow.attributes["aria-expanded"], "true");

  nestedRow.listeners.click();
  assert.equal(nestedFolder.classList.contains("collapsed"), false);
  assert.equal(nestedRow.attributes["aria-expanded"], "true");
});

test("background accent ignores reversed image analysis", async () => {
  const properties = new Map();
  const images = new Map();
  const pixels = new Map([
    ["photo:old", [255, 0, 0, 255]],
    ["photo:new", [255, 255, 0, 255]],
  ]);

  globalThis.document = {
    documentElement: {
      dataset: { theme: "light" },
      style: {
        setProperty(name, value) {
          properties.set(name, value);
        },
        removeProperty(name) {
          properties.delete(name);
        },
      },
    },
    createElement(tag) {
      assert.equal(tag, "canvas");
      let image;
      return {
        getContext() {
          return {
            drawImage(value) {
              image = value;
            },
            getImageData() {
              const pixel = pixels.get(image.src);
              const data = new Uint8ClampedArray(48 * 48 * 4);
              for (let i = 0; i < data.length; i += 4) data.set(pixel, i);
              return { data };
            },
          };
        },
      };
    },
  };
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
  };
  globalThis.getComputedStyle = (element) => ({
    getPropertyValue(name) {
      if (name === "--surface") {
        return element.dataset.theme === "dark" ? "#101010" : "#ffffff";
      }
      if (name === "--bg") return "#ffffff";
      return properties.get(name) ?? "";
    },
  });
  globalThis.Image = class {
    set src(value) {
      this._src = value;
      images.set(value, this);
    }

    get src() {
      return this._src;
    }
  };

  const { applyAccentFromBackground, applyTheme } = await import(
    `../components/SettingsPanel.js?case=latest-accent`
  );

  const oldAnalysis = applyAccentFromBackground({
    type: "photo",
    value: "photo:old",
  });
  await Promise.resolve();
  const newAnalysis = applyAccentFromBackground({
    type: "photo",
    value: "photo:new",
  });
  await Promise.resolve();

  images.get("photo:new").onload();
  await newAnalysis;
  images.get("photo:old").onload();
  await oldAnalysis;

  assert.equal(properties.get("--accent-hue"), "68");

  applyTheme("dark");
  assert.equal(
    properties.get("--accent-hue"),
    "68",
    "the stale analysis must not replace the cached dominant color",
  );

  const customUrl = deferred();
  const staleCustom = applyAccentFromBackground(
    { type: "custom", value: "" },
    customUrl.promise,
  );
  const currentSolid = applyAccentFromBackground({
    type: "solid",
    value: "#00ff00",
  });
  await currentSolid;
  customUrl.resolve("photo:old");
  await staleCustom;

  assert.equal(
    properties.get("--accent-hue"),
    "120",
    "a delayed custom URL must not start obsolete image analysis",
  );
  assert.equal(images.size, 2);
});
