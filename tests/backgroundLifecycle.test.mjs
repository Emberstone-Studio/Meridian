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

test("navigation from a managed Meridian tab opens separately and restores it", async () => {
  const created = [];
  const updated = [];
  const moved = [];
  const remembered = [];
  const meridianUrl = "chrome-extension://meridian/meridian.html";
  const protectMeridianTab = new Function(
    "chrome",
    "isMeridianTab",
    "getMeridianUrl",
    "rememberMeridianTab",
    "console",
    `${extractFunction(background, "async function protectMeridianTab(")}
     return protectMeridianTab;`,
  )(
    {
      tabs: {
        async create(options) {
          created.push(options);
        },
        async update(tabId, options) {
          updated.push([tabId, options]);
          return { id: tabId, windowId: 7, index: 2, pinned: true, url: meridianUrl };
        },
        async move(tabId, options) {
          moved.push([tabId, options]);
        },
      },
    },
    (tab) => tab.url === meridianUrl || tab.url === "chrome://newtab/",
    () => meridianUrl,
    (tab) => remembered.push(tab),
    { warn() {} },
  );

  await protectMeridianTab(
    42,
    { url: "https://example.com/path" },
    { id: 42, windowId: 7, index: 0, active: true },
  );

  assert.deepEqual(created, [
    {
      windowId: 7,
      index: 1,
      url: "https://example.com/path",
      active: true,
    },
  ]);
  assert.deepEqual(updated, [
    [42, { pinned: true, url: meridianUrl }],
  ]);
  assert.deepEqual(moved, [[42, { index: 0 }]]);
  assert.equal(remembered.length, 1);
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
