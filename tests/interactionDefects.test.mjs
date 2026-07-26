import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSearchBar } from "../components/SearchBar.js";
import { createSearchPopup } from "../components/SearchPopup.js";
import { normalizeHomepageUrl } from "../utils/homepageUrl.js";
import { normalizeUrlInput } from "../utils/urlInput.js";

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

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.classList = new FakeClassList(this);
    this.dataset = {};
    this.style = {};
    this.value = "";
  }

  set className(value) {
    this.classList.values = new Set(value.split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this.classList.values].join(" ");
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  get childElementCount() {
    return this.children.length;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    event.target ??= this;
    event.stopPropagation ??= () => {};
    event.preventDefault ??= () => {};
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
  }

  closest() {
    return null;
  }

  focus() {}

  blur() {}
}

test("search popups expose their requested semantic role", () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    body: new FakeElement("body"),
  };
  const anchor = new FakeElement("div");

  const results = createSearchPopup({
    anchor,
    id: "results",
    ariaLabel: "Search results",
    role: "listbox",
  });
  const settings = createSearchPopup({
    anchor,
    id: "settings",
    ariaLabel: "Settings",
  });

  assert.equal(results.el.getAttribute("role"), "listbox");
  assert.equal(results.el.getAttribute("aria-label"), "Search results");
  assert.equal(settings.el.getAttribute("role"), "dialog");
});

test("Enter web search clears the field and notifies the public query handler", () => {
  const opened = [];
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    tabs: {
      create: (options) => opened.push(options),
    },
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const input = container.children[0].children[1];
  const notifications = [];
  searchBar.onBrowserQuery = (...args) => notifications.push(args);

  input.value = "fresh results";
  input.dispatch("input");
  input.dispatch("keydown", { key: "Enter" });

  assert.deepEqual(opened, [
    { url: "https://www.google.com/search?q=fresh%20results" },
  ]);
  assert.equal(input.value, "");
  assert.deepEqual(notifications.at(-1), [null, "all"]);
});

test("web search submit delegates navigation to the Meridian tab policy", () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    tabs: {
      create: () => assert.fail("the fallback navigator should not run"),
    },
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const input = container.children[0].children[1];
  const navigated = [];
  searchBar.onNavigate = (url) => navigated.push(url);

  input.value = "reuse this tab";
  input.dispatch("keydown", { key: "Enter" });

  assert.deepEqual(navigated, [
    "https://www.google.com/search?q=reuse%20this%20tab",
  ]);
});

test("Enter treats a domain-like value as a URL instead of a search", () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    tabs: {
      create: () => assert.fail("the fallback navigator should not run"),
    },
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const input = container.children[0].children[1];
  const navigated = [];
  searchBar.onNavigate = (url) => navigated.push(url);

  input.value = "example.com/docs";
  input.dispatch("keydown", { key: "Enter" });

  assert.deepEqual(navigated, ["https://example.com/docs"]);
});

test("magnifier submits the active scope and scope toggles preserve the query", () => {
  const opened = [];
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    tabs: {
      create: (options) => opened.push(options),
    },
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const wrapper = container.children[0];
  const magnifier = wrapper.children[0];
  const input = wrapper.children[1];
  let scopedSubmits = 0;
  searchBar.onScopedSubmit = () => {
    scopedSubmits += 1;
  };

  input.value = "same query";
  input.dispatch("input");
  searchBar.setScope("bookmarks");
  input.dispatch("keydown", { key: "Enter" });
  magnifier.dispatch("click");

  assert.equal(scopedSubmits, 2);
  assert.equal(searchBar.getScope(), "bookmarks");
  assert.equal(searchBar.getQuery(), "same query");
  assert.equal(opened.length, 0);

  searchBar.setScope("history");
  assert.equal(searchBar.getScope(), "history");
  assert.equal(searchBar.getQuery(), "same query");

  searchBar.setScope("history");
  assert.equal(searchBar.getScope(), "all");
  assert.equal(searchBar.getQuery(), "same query");
});

test("search input routes both arrows and activates a selection before submit", () => {
  const navigated = [];
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    tabs: {
      create: () => assert.fail("the fallback navigator should not run"),
    },
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const wrapper = container.children[0];
  const magnifier = wrapper.children[0];
  const input = wrapper.children[1];
  const moves = [];
  let resets = 0;
  let activate = true;

  searchBar.onNavigate = (url) => navigated.push(url);
  searchBar.onSelectionMove = (delta) => moves.push(delta);
  searchBar.onSelectionActivate = () => activate;
  searchBar.onSelectionReset = () => {
    resets += 1;
  };

  input.value = "selected query";
  input.dispatch("input");
  input.dispatch("keydown", { key: "ArrowDown" });
  input.dispatch("keydown", { key: "ArrowUp" });
  input.dispatch("keydown", { key: "Enter" });
  magnifier.dispatch("click");

  assert.deepEqual(moves, [1, -1]);
  assert.equal(resets, 1);
  assert.deepEqual(navigated, []);

  activate = false;
  input.dispatch("keydown", { key: "Enter" });
  assert.deepEqual(navigated, [
    "https://www.google.com/search?q=selected%20query",
  ]);
});

test("search input maintains combobox popup state and polite announcements", () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const wrapper = container.children[0];
  const input = wrapper.children[1];
  const status = wrapper.children[3];

  assert.equal(input.getAttribute("role"), "combobox");
  assert.equal(input.getAttribute("aria-autocomplete"), "list");
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(input.getAttribute("aria-controls"), "browser-search-results");
  assert.equal(status.getAttribute("aria-live"), "polite");

  let popupListener;
  searchBar.bindPopup(
    {
      addOpenChangeListener(listener) {
        popupListener = listener;
      },
    },
    "browser-search-results",
  );
  popupListener(true);
  searchBar.setActiveDescendant("browser-search-result-7");
  assert.equal(input.getAttribute("aria-expanded"), "true");
  assert.equal(
    input.getAttribute("aria-activedescendant"),
    "browser-search-result-7",
  );

  popupListener(false);
  assert.equal(input.getAttribute("aria-expanded"), "false");
  assert.equal(input.getAttribute("aria-activedescendant"), null);

  searchBar.setScope("history");
  assert.equal(input.getAttribute("aria-controls"), "bookmarks-results-listbox");
  assert.equal(status.textContent, "History search scope selected.");
});

test("switching between open bookmark and history scopes keeps combobox state synchronized", () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
  };
  globalThis.chrome = {
    storage: {
      sync: {
        set() {},
        get: async () => ({}),
      },
      onChanged: {
        addListener() {},
      },
    },
  };

  const container = new FakeElement("div");
  const searchBar = createSearchBar(container);
  const input = container.children[0].children[1];
  const scopePopup = createSearchPopup({
    anchor: container,
    id: "bookmarks-panel",
    ariaLabel: "Bookmarks",
  });
  const list = new FakeElement("div");
  list.id = "bookmarks-results-listbox";
  list.setAttribute("role", "listbox");
  scopePopup.el.appendChild(list);

  searchBar.bindPopup(scopePopup, "bookmarks-results-listbox");
  searchBar.onScopeChange = (scope) => {
    if (scope === "bookmarks" || scope === "history") scopePopup.open();
    else scopePopup.close();
  };

  function assertOpenScope(scope) {
    assert.equal(searchBar.getScope(), scope);
    assert.equal(scopePopup.el.classList.contains("hidden"), false);
    assert.equal(scopePopup.el.contains(list), true);
    assert.equal(input.getAttribute("aria-expanded"), "true");
    assert.equal(
      input.getAttribute("aria-controls"),
      "bookmarks-results-listbox",
    );
    assert.equal(input.getAttribute("aria-activedescendant"), null);
  }

  searchBar.setScope("bookmarks");
  assertOpenScope("bookmarks");
  searchBar.setActiveDescendant("bookmark-result-0");

  searchBar.setScope("history");
  assertOpenScope("history");
  searchBar.setActiveDescendant("bookmark-result-1");

  searchBar.setScope("bookmarks");
  assertOpenScope("bookmarks");
});

test("homepage URLs must be absolute HTTP(S) URLs and are normalized", () => {
  assert.equal(normalizeHomepageUrl(""), "");
  assert.equal(normalizeHomepageUrl("  https://Example.COM/path?q=hello world  "),
    "https://example.com/path?q=hello%20world");
  assert.equal(normalizeHomepageUrl("http://example.com:80"), "http://example.com/");

  for (const value of [
    "example.com",
    "/relative/path",
    "javascript:alert(1)",
    "ftp://example.com",
    "https://",
  ]) {
    assert.equal(normalizeHomepageUrl(value), null, value);
  }
});

test("settings feedback and guarded homepage navigation use the shared validator", async () => {
  const [settings, meridian] = await Promise.all([
    readFile(new URL("../components/SettingsPanel.js", import.meta.url), "utf8"),
    readFile(new URL("../meridian.js", import.meta.url), "utf8"),
  ]);

  assert.match(settings, /normalizeHomepageUrl\(homepageInput\.value\)/);
  assert.match(settings, /setCustomValidity\(message\)/);
  assert.match(settings, /aria-invalid/);
  assert.match(settings, /complete http:\/\/ or https:\/\//);
  assert.match(meridian, /normalizeHomepageUrl\(homepageUrl \?\? ""\)/);
  assert.match(meridian, /try \{[\s\S]*chrome\.tabs\.update[\s\S]*\} catch \(error\)/);
});

test("sidebar tab and result rows expose keyboard activation and visible focus", async () => {
  const paths = [
    "../components/sidebar.js",
    "../meridian-extension/components/sidebar.js",
  ];
  const cssPaths = [
    "../components/sidebar.css",
    "../meridian-extension/components/sidebar.css",
  ];

  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /row\.tabIndex = 0/);
    assert.match(source, /row\.setAttribute\('role', 'button'\)/);
    assert.match(source, /row\.setAttribute\('aria-label', label\)/);
    assert.match(source, /e\.key !== 'Enter' && e\.key !== ' '/);
    assert.ok(
      (source.match(/makeRowInteractive\(/g) ?? []).length >= 4,
      `${path} applies keyboard behavior to tab, previous-tab, and result rows`,
    );
  }

  for (const path of cssPaths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /\.tab-row:focus-visible\s*\{/);
    assert.match(source, /\.tab-row:focus-within \.tab-close-btn/);
  }
});

test("web search renders as a labeled result section without a local-empty message", async () => {
  for (const path of ["../meridian.js", "../meridian-extension/meridian.js"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /buildWebSearchSection\(query\)/);
    assert.match(
      source,
      /section\.className = "search-results-section search-web-section"/,
    );
    assert.match(source, /heading\.textContent = "Web"/);
    assert.doesNotMatch(
      source,
      /No matches in your tabs, bookmarks, or history/,
    );
  }
});

test("an empty local result set renders only the Web section", async () => {
  const source = await readFile(
    new URL("../meridian.js", import.meta.url),
    "utf8",
  );
  const container = new FakeElement("div");
  let opens = 0;
  const renderSearchResults = new Function(
    "document",
    "resultsPopup",
    "resultsSelection",
    "searchBarApi",
    "buildResultRow",
    "buildWebSearchSection",
    `${extractFunction(source, "function renderSearchResults(")}
     return renderSearchResults;`,
  )(
    {
      getElementById: () => container,
      createElement: (tagName) => new FakeElement(tagName),
    },
    {
      el: container,
      open: () => {
        opens += 1;
      },
      close() {},
    },
    { reset() {}, sync: () => 1 },
    { announce: (message) => announcements.push(message) },
    () => new FakeElement("button"),
    () => {
      const section = new FakeElement("div");
      section.className = "search-results-section search-web-section";
      return section;
    },
  );
  const announcements = [];

  renderSearchResults(
    { tabs: [], bookmarks: [], history: [] },
    "no local result",
  );

  assert.equal(container.childElementCount, 1);
  assert.ok(container.children[0].classList.contains("search-web-section"));
  assert.equal(opens, 1);
  assert.equal(announcements.at(-1), "1 result available.");
});

test("the Web section launches the selected provider and clears the query", async () => {
  const source = await readFile(
    new URL("../meridian.js", import.meta.url),
    "utf8",
  );
  const navigated = [];
  let clears = 0;
  const buildWebSearchSection = new Function(
    "document",
    "searchBarApi",
    "openUrlFromMeridian",
    "normalizeUrlInput",
    `${extractFunction(source, "function buildWebSearchSection(")}
     return buildWebSearchSection;`,
  )(
    { createElement: (tagName) => new FakeElement(tagName) },
    {
      getProvider: () => ({
        name: "Example Search",
        url: "https://search.example/?q=",
        favicon: "icon.svg",
      }),
      clearSearch: () => {
        clears += 1;
      },
    },
    (url) => navigated.push(url),
    normalizeUrlInput,
  );

  const section = buildWebSearchSection("release ready");
  assert.equal(section.children[0].textContent, "Web");
  section.children[1].dispatch("click");

  assert.deepEqual(navigated, [
    "https://search.example/?q=release%20ready",
  ]);
  assert.equal(clears, 1);

  const directSection = buildWebSearchSection("example.com/docs");
  assert.equal(directSection.children[1].children[1].children[0].textContent, "Go to example.com/docs");
  assert.equal(directSection.children[1].children[1].children[1].textContent, "Open URL");
  directSection.children[1].dispatch("click");

  assert.deepEqual(navigated, [
    "https://search.example/?q=release%20ready",
    "https://example.com/docs",
  ]);
  assert.equal(clears, 2);
});
