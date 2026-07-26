import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSearchBar } from "../components/SearchBar.js";
import { normalizeHomepageUrl } from "../utils/homepageUrl.js";

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

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
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
  magnifier.dispatch("click");

  assert.equal(scopedSubmits, 1);
  assert.equal(searchBar.getScope(), "bookmarks");
  assert.equal(searchBar.getQuery(), "same query");
  assert.equal(opened.length, 0);

  searchBar.setScope("bookmarks");
  assert.equal(searchBar.getScope(), "all");
  assert.equal(searchBar.getQuery(), "same query");
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
