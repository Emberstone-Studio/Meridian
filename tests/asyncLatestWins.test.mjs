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
  const button = { addEventListener() {} };

  const harness = new Function(
    "document",
    "chrome",
    "getEnabledLocalSearchSources",
    "search",
    "renderResultSection",
    "renderTabList",
    `
      const PROVIDER_URLS = { google: "https://example.test/?q=" };
      let query = "";
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
  assert.equal(properties.get("--on-bg"), "rgba(0, 0, 0, 0.9)");

  applyTheme("dark");
  assert.equal(
    properties.get("--on-bg"),
    "rgba(0, 0, 0, 0.9)",
    "the stale analysis must not replace the cached luminance",
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
