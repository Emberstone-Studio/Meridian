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

const background = await readFile(
  new URL("../background.js", import.meta.url),
  "utf8",
);

test("a removed Meridian tab is restored in the same window", async () => {
  const scheduled = [];
  const evicted = [];
  const meridianTabsByWindow = new Map();
  let persisted = 0;
  const handleTabRemoved = new Function(
    "chrome",
    "evictThumbnail",
    "resolveMeridianTabs",
    "isManagedMeridianTabId",
    "meridianTabsByWindow",
    "persistMeridianTabs",
    "setTimeout",
    "ensureMeridianTab",
    "console",
    `${extractFunction(background, "async function handleTabRemoved(")}
     return handleTabRemoved;`,
  )(
    {
      storage: {
        local: {
          get: async () => ({
            meridianTabIds: { 7: 42 },
            meridianTabId: 42,
          }),
        },
      },
    },
    (tabId) => evicted.push(tabId),
    async () => {},
    () => false,
    meridianTabsByWindow,
    () => {
      persisted += 1;
    },
    (callback, delay) => scheduled.push({ callback, delay }),
    () => {},
    { debug() {}, warn() {} },
  );

  await handleTabRemoved(42, { windowId: 7, isWindowClosing: false });

  assert.deepEqual(evicted, [42]);
  assert.equal(meridianTabsByWindow.has(7), false);
  assert.equal(persisted, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 150);
});

test("thumbnail eviction failure does not block removed Meridian restoration", async () => {
  const scheduled = [];
  const warnings = [];
  const meridianTabsByWindow = new Map([[7, 42]]);
  const handleTabRemoved = new Function(
    "chrome",
    "evictThumbnail",
    "resolveMeridianTabs",
    "isManagedMeridianTabId",
    "meridianTabsByWindow",
    "persistMeridianTabs",
    "setTimeout",
    "ensureMeridianTab",
    "console",
    `${extractFunction(background, "async function handleTabRemoved(")}
     return handleTabRemoved;`,
  )(
    {
      storage: {
        local: {
          get: async () => ({ meridianTabIds: { 7: 42 } }),
        },
      },
    },
    async () => {
      throw new Error("storage unavailable");
    },
    async () => {},
    (tabId) => [...meridianTabsByWindow.values()].includes(tabId),
    meridianTabsByWindow,
    () => {},
    (callback, delay) => scheduled.push({ callback, delay }),
    () => {},
    { debug() {}, warn: (...args) => warnings.push(args) },
  );

  await handleTabRemoved(42, { windowId: 7, isWindowClosing: false });

  assert.equal(scheduled[0].delay, 150);
  assert.match(warnings[0].join(" "), /storage unavailable/);
});

test("closing a window does not recreate its Meridian tab", async () => {
  const scheduled = [];
  const evicted = [];
  const meridianTabsByWindow = new Map([[7, 42]]);
  const handleTabRemoved = new Function(
    "chrome",
    "evictThumbnail",
    "resolveMeridianTabs",
    "isManagedMeridianTabId",
    "meridianTabsByWindow",
    "persistMeridianTabs",
    "setTimeout",
    "console",
    `${extractFunction(background, "async function handleTabRemoved(")}
     return handleTabRemoved;`,
  )(
    {
      storage: {
        local: {
          get: async () => ({ meridianTabIds: { 7: 42 } }),
        },
      },
    },
    async (tabId) => evicted.push(tabId),
    async () => {},
    (tabId) => [...meridianTabsByWindow.values()].includes(tabId),
    meridianTabsByWindow,
    () => {},
    (...args) => scheduled.push(args),
    { debug() {}, warn() {} },
  );

  await handleTabRemoved(42, { windowId: 7, isWindowClosing: true });

  assert.deepEqual(scheduled, []);
  assert.deepEqual(evicted, []);
  assert.equal(meridianTabsByWindow.has(7), false);
});

test("concurrent ensure requests create one Meridian tab per window", async () => {
  const calls = { create: [], query: 0 };
  const meridianTabsByWindow = new Map();
  const ensuringMeridianTabsByWindow = new Map();
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  const ensureMeridianTab = new Function(
    "chrome",
    "resolveMeridianTabs",
    "meridianTabsByWindow",
    "ensuringMeridianTabsByWindow",
    "isMeridianTab",
    "normalizeMeridianTab",
    "rememberMeridianTab",
    "getMeridianUrl",
    `${extractFunction(background, "async function ensureMeridianTabInWindow(")}
     ${extractFunction(background, "async function ensureMeridianTab(")}
     return ensureMeridianTab;`,
  )(
    {
      tabs: {
        async get(tabId) {
          return { id: tabId, windowId: 7, pinned: true, url: meridianUrl };
        },
        async query() {
          calls.query += 1;
          return [];
        },
        async create(options) {
          calls.create.push(options);
          return { id: 84, windowId: 7, index: 0, ...options };
        },
      },
      windows: { async getAll() { return []; } },
    },
    async () => {},
    meridianTabsByWindow,
    ensuringMeridianTabsByWindow,
    (tab) => tab.url === meridianUrl,
    async (tab) => tab,
    (tab) => meridianTabsByWindow.set(tab.windowId, tab.id),
    () => meridianUrl,
  );

  const results = await Promise.all(
    Array.from({ length: 13 }, () => ensureMeridianTab(7, { active: false })),
  );

  assert.equal(calls.query, 1);
  assert.equal(calls.create.length, 1);
  assert.equal(calls.create[0].active, false);
  assert.deepEqual(results.map((tab) => tab.id), Array(13).fill(84));
  assert.equal(ensuringMeridianTabsByWindow.size, 0);
});

test("normalizing a tab tolerates it disappearing during update", async () => {
  const moved = [];
  const remembered = [];
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  const normalizeMeridianTab = new Function(
    "chrome",
    "isMeridianTab",
    "getMeridianUrl",
    "rememberMeridianTab",
    `${extractFunction(background, "async function normalizeMeridianTab(")}
     return normalizeMeridianTab;`,
  )(
    {
      tabs: {
        async update() {
          throw new Error("No tab with id: 42");
        },
        async move(...args) {
          moved.push(args);
        },
      },
    },
    (tab) => tab.url === meridianUrl,
    () => meridianUrl,
    (tab) => remembered.push(tab),
  );
  const tab = {
    id: 42,
    windowId: 7,
    index: 3,
    pinned: false,
    url: meridianUrl,
  };

  const result = await normalizeMeridianTab(tab);

  assert.equal(result, null);
  assert.deepEqual(moved, []);
  assert.deepEqual(remembered, []);
});

test("normalizing a tab does not remember it when it disappears during move", async () => {
  const remembered = [];
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  const normalizeMeridianTab = new Function(
    "chrome",
    "isMeridianTab",
    "getMeridianUrl",
    "rememberMeridianTab",
    `${extractFunction(background, "async function normalizeMeridianTab(")}
     return normalizeMeridianTab;`,
  )(
    {
      tabs: {
        async move() {
          throw new Error("No tab with id: 42");
        },
      },
    },
    (tab) => tab.url === meridianUrl,
    () => meridianUrl,
    (tab) => remembered.push(tab),
  );
  const tab = {
    id: 42,
    windowId: 7,
    index: 3,
    pinned: true,
    url: meridianUrl,
  };

  const result = await normalizeMeridianTab(tab);

  assert.equal(result, null);
  assert.deepEqual(remembered, []);
});

test("ensuring a tab tolerates its window disappearing", async (t) => {
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  function buildEnsure(tabs) {
    return new Function(
      "chrome",
      "meridianTabsByWindow",
      "isMeridianTab",
      "normalizeMeridianTab",
      "rememberMeridianTab",
      "getMeridianUrl",
      `${extractFunction(background, "async function ensureMeridianTabInWindow(")}
       return ensureMeridianTabInWindow;`,
    )(
      { tabs },
      new Map(),
      (tab) => tab.url === meridianUrl,
      async (tab) => tab,
      () => {},
      () => meridianUrl,
    );
  }

  await t.test("during tab lookup", async () => {
    const ensureMeridianTabInWindow = buildEnsure({
      async query() {
        throw new Error("No window with id: 7");
      },
    });

    assert.equal(await ensureMeridianTabInWindow(7), null);
  });

  await t.test("during tab creation", async () => {
    const ensureMeridianTabInWindow = buildEnsure({
      async query() {
        return [];
      },
      async create() {
        throw new Error("No window with id: 7");
      },
    });

    assert.equal(await ensureMeridianTabInWindow(7), null);
  });
});

test("focusing a Meridian tab tolerates a closed tab or window", async (t) => {
  function buildFocus(ensureMeridianTab, update) {
    return new Function(
      "chrome",
      "ensureMeridianTab",
      `${extractFunction(background, "async function focusMeridianTab(")}
       return focusMeridianTab;`,
    )({ tabs: { update } }, ensureMeridianTab);
  }

  await t.test("while ensuring the tab", async () => {
    const focusMeridianTab = buildFocus(async () => null, async () => {
      throw new Error("update should not be called");
    });

    assert.equal(await focusMeridianTab(7), null);
  });

  await t.test("while activating the tab", async () => {
    const focusMeridianTab = buildFocus(
      async () => ({ id: 42 }),
      async () => {
        throw new Error("No tab with id: 42");
      },
    );

    assert.equal(await focusMeridianTab(7), null);
  });
});

test("concurrent navigation updates hand off management without rewriting the destination", async () => {
  const updated = [];
  const ensured = [];
  const meridianTabsByWindow = new Map([[7, 42]]);
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  const currentTab = {
    id: 42,
    windowId: 7,
    index: 0,
    active: true,
    pinned: true,
    url: "https://example.com/path",
  };
  const protectMeridianTab = new Function(
    "chrome",
    "isMeridianTab",
    "normalizeMeridianTab",
    "replacingMeridianTabs",
    "meridianTabId",
    "meridianTabsByWindow",
    "persistMeridianTabs",
    "ensureMeridianTab",
    `${extractFunction(background, "async function protectMeridianTab(")}
     return protectMeridianTab;`,
  )(
    {
      tabs: {
        async update(tabId, options) {
          updated.push([tabId, options]);
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
      },
    },
    (tab) => tab.url === meridianUrl || tab.url === "chrome://newtab/",
    async () => {},
    new Set(),
    null,
    meridianTabsByWindow,
    () => {},
    async (windowId, options) => ensured.push([windowId, options]),
  );

  await Promise.all([
    protectMeridianTab(42, { url: currentTab.url }, currentTab),
    protectMeridianTab(42, { url: currentTab.url }, currentTab),
  ]);

  assert.deepEqual(updated, [[42, { pinned: false }]]);
  assert.deepEqual(ensured, [[7, { active: false }]]);
  assert.equal(meridianTabsByWindow.has(7), false);
  assert.equal(currentTab.url, "https://example.com/path");
});

test("stale old-tab and replacement-tab updates cannot create more Meridian tabs", async () => {
  const updated = [];
  const ensured = [];
  const meridianTabsByWindow = new Map([[7, 42]]);
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  const protectMeridianTab = new Function(
    "chrome",
    "isMeridianTab",
    "normalizeMeridianTab",
    "replacingMeridianTabs",
    "meridianTabId",
    "meridianTabsByWindow",
    "persistMeridianTabs",
    "ensureMeridianTab",
    `${extractFunction(background, "async function protectMeridianTab(")}
     return protectMeridianTab;`,
  )(
    {
      tabs: {
        async update(tabId, options) {
          updated.push([tabId, options]);
        },
      },
    },
    (tab) => tab.url === meridianUrl || tab.url === "chrome://newtab/",
    async () => {},
    new Set(),
    null,
    meridianTabsByWindow,
    () => {},
    async (windowId, options) => {
      ensured.push([windowId, options]);
      meridianTabsByWindow.set(windowId, 84);
    },
  );

  const destinationTab = {
    id: 42,
    windowId: 7,
    pinned: true,
    url: "https://example.com/path",
  };
  await protectMeridianTab(42, { url: destinationTab.url }, destinationTab);
  await protectMeridianTab(42, { url: destinationTab.url }, destinationTab);
  await protectMeridianTab(
    84,
    { url: meridianUrl },
    { id: 84, windowId: 7, pinned: true, url: meridianUrl },
  );

  assert.deepEqual(updated, [[42, { pinned: false }]]);
  assert.deepEqual(ensured, [[7, { active: false }]]);
  assert.equal(meridianTabsByWindow.get(7), 84);
});

test("refresh-driven activation does not change previous-tab tracking", async () => {
  const writes = [];
  const trackPreviousTabActivation = new Function(
    "chrome",
    "resolveMeridianTabId",
    "isManagedMeridianTabId",
    `let meridianTabId = null;
     let isRefreshing = true;
     let _previousTabId = 7;
     ${extractFunction(background, "async function trackPreviousTabActivation(")}
     return {
       run: trackPreviousTabActivation,
       finishRefresh: () => { isRefreshing = false; },
     };`,
  )(
    {
      storage: {
        local: {
          set: async (update) => writes.push(update),
        },
      },
    },
    async () => {},
    (tabId) => tabId === null,
  );

  await trackPreviousTabActivation.run({ tabId: 8, windowId: 1 });
  assert.deepEqual(writes, []);

  trackPreviousTabActivation.finishRefresh();
  await trackPreviousTabActivation.run({ tabId: 9, windowId: 1 });
  assert.deepEqual(writes, [{ previousTabId: 7 }]);
});
