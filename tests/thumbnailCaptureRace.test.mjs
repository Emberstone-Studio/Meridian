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

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Build the real capture handlers over shared, per-window generation state, with
// a controllable sleep so races between events can be interleaved deterministically.
function buildCaptureHandlers({
  meridianTabId,
  thumbnails = {},
  refreshNeeded = {},
}) {
  const captured = [];
  const sleepResolvers = [];
  const harness = new Function(
    "chrome",
    "resolveMeridianTabId",
    "isManagedMeridianTabId",
    "sleep",
    "getThumbnail",
    "thumbnailNeedsRefresh",
    "captureActiveTabWithRetry",
    "getMeridianUrl",
    "console",
    `let meridianTabId = ${JSON.stringify(meridianTabId)};
     let isRefreshing = false;
     const captureGenerations = new Map();
     const MAX_LAZY_CAPTURE_ATTEMPTS = 3;
     ${extractFunction(background, "function nextCaptureGeneration(")}
     ${extractFunction(background, "async function handleActivatedCapture(")}
     ${extractFunction(background, "async function handleUpdatedCapture(")}
     return { handleActivatedCapture, handleUpdatedCapture, captureGenerations };`,
  )(
    { tabs: { create() {}, update() {} } },
    async () => {},
    (tabId) => tabId === meridianTabId,
    () => new Promise((resolve) => sleepResolvers.push(resolve)),
    async (tabId) => thumbnails[tabId] ?? null,
    async (tabId) => Boolean(refreshNeeded[tabId]),
    async (tabId, windowId, generation, attempts) => {
      captured.push([tabId, windowId, generation, attempts]);
    },
    () => "chrome-extension://meridian/meridian.html",
    { debug() {} },
  );
  return {
    ...harness,
    captured,
    releaseAllSleeps() {
      const pending = sleepResolvers.splice(0);
      pending.forEach((resolve) => resolve());
    },
  };
}

test("tab A capture is discarded once Meridian becomes active", async () => {
  const h = buildCaptureHandlers({ meridianTabId: 99 });

  const pendingA = h.handleActivatedCapture({ tabId: 1, windowId: 10 });
  await tick();
  // Switching to Meridian in the same window must invalidate A's pending capture.
  await h.handleActivatedCapture({ tabId: 99, windowId: 10 });

  h.releaseAllSleeps();
  await pendingA;

  assert.deepEqual(h.captured, []);
});

test("tab A completes, then tab B is captured under its own id", async () => {
  const h = buildCaptureHandlers({ meridianTabId: 99 });

  const pendingA = h.handleActivatedCapture({ tabId: 1, windowId: 10 });
  await tick();
  h.releaseAllSleeps();
  await pendingA;

  const pendingB = h.handleActivatedCapture({ tabId: 2, windowId: 10 });
  await tick();
  h.releaseAllSleeps();
  await pendingB;

  assert.deepEqual(h.captured, [
    [1, 10, 1, 3],
    [2, 10, 2, 3],
  ]);
});

test("activation in another window does not cancel a valid capture", async () => {
  const h = buildCaptureHandlers({ meridianTabId: 99 });

  const pendingA = h.handleActivatedCapture({ tabId: 1, windowId: 10 });
  await tick();
  // Concurrent activity in a different window must not touch window 10's work.
  const pendingC = h.handleActivatedCapture({ tabId: 3, windowId: 20 });
  await tick();

  h.releaseAllSleeps();
  await Promise.all([pendingA, pendingC]);

  assert.deepEqual(h.captured, [
    [1, 10, 1, 3],
    [3, 20, 1, 3],
  ]);
});

test("a completed navigation is discarded when a newer tab activates", async () => {
  const h = buildCaptureHandlers({ meridianTabId: 99 });

  const pendingUpdate = h.handleUpdatedCapture(
    1,
    { status: "complete" },
    { active: true, windowId: 10 },
  );
  await tick();
  // A newer activation in the same window supersedes the completed-load capture.
  await h.handleActivatedCapture({ tabId: 99, windowId: 10 });

  h.releaseAllSleeps();
  await pendingUpdate;

  assert.deepEqual(h.captured, []);
});

test("activation keeps an existing thumbnail without another automatic capture", async () => {
  const h = buildCaptureHandlers({
    meridianTabId: 99,
    thumbnails: { 1: "existing-thumbnail" },
  });

  const pending = h.handleActivatedCapture({ tabId: 1, windowId: 10 });
  await tick();
  h.releaseAllSleeps();
  await pending;

  assert.deepEqual(h.captured, []);
});

test("activation replaces an existing thumbnail marked after a display failure", async () => {
  const h = buildCaptureHandlers({
    meridianTabId: 99,
    thumbnails: { 1: "last-known-good-thumbnail" },
    refreshNeeded: { 1: true },
  });

  const pending = h.handleActivatedCapture({ tabId: 1, windowId: 10 });
  await tick();
  h.releaseAllSleeps();
  await pending;

  assert.deepEqual(h.captured, [[1, 10, 1, 3]]);
});

test("discarded and frozen lifecycle updates neither evict nor capture thumbnails", async () => {
  const h = buildCaptureHandlers({ meridianTabId: 99 });

  await h.handleUpdatedCapture(
    1,
    { discarded: true },
    { active: true, discarded: true, windowId: 10 },
  );
  await h.handleUpdatedCapture(
    1,
    { frozen: true },
    { active: true, frozen: true, windowId: 10 },
  );

  assert.deepEqual(h.captured, []);
});

test("completed active navigation refreshes once when a valid thumbnail exists", async () => {
  const h = buildCaptureHandlers({
    meridianTabId: 99,
    thumbnails: { 1: "previous-valid-thumbnail" },
  });

  const pending = h.handleUpdatedCapture(
    1,
    { status: "complete" },
    { active: true, discarded: false, frozen: false, windowId: 10 },
  );
  await tick();
  h.releaseAllSleeps();
  await pending;

  assert.deepEqual(h.captured, [[1, 10, 1, 1]]);
});

// Verify the final guard inside captureTab: it re-checks the active tab in the
// target window immediately before capturing and only persists on a match.
function buildCaptureTab() {
  const events = { queried: [], captured: [], saved: [] };
  const state = { activeTab: undefined, dataUrl: "data:image/jpeg;base64,zzz" };
  const captureTab = new Function(
    "chrome",
    "saveThumbnail",
    "resizeThumbnailDataUrl",
    "console",
    `${extractFunction(background, "async function captureTab(")}
     return captureTab;`,
  )(
    {
      tabs: {
        async query(query) {
          events.queried.push(query);
          return state.activeTab === undefined ? [] : [state.activeTab];
        },
        async captureVisibleTab(windowId, options) {
          events.captured.push([windowId, options]);
          return state.dataUrl;
        },
      },
    },
    async (tabId, dataUrl) => {
      events.saved.push([tabId, dataUrl]);
    },
    async (dataUrl) => `resized:${dataUrl}`,
    { log() {}, warn() {} },
  );
  return { captureTab, events, state };
}

test("captureTab persists only when the intended tab is still active", async () => {
  const { captureTab, events, state } = buildCaptureTab();
  state.activeTab = { id: 1, windowId: 10 };

  await captureTab(1, 10);

  assert.deepEqual(events.queried, [
    { active: true, windowId: 10 },
    { active: true, windowId: 10 },
  ]);
  assert.equal(events.captured.length, 1);
  assert.deepEqual(events.saved, [[1, "resized:data:image/jpeg;base64,zzz"]]);
});

test("captureTab skips a mismatched active tab (e.g. Meridian took over)", async () => {
  const { captureTab, events, state } = buildCaptureTab();
  state.activeTab = { id: 99, windowId: 10 };

  await captureTab(1, 10);

  assert.equal(events.captured.length, 0);
  assert.deepEqual(events.saved, []);
});

test("captureTab preserves the prior thumbnail if focus changes during processing", async () => {
  let queryCount = 0;
  const saved = [];

  // Change the active tab from the resize step, between capture and persistence.
  const guardedCapture = new Function(
    "chrome",
    "saveThumbnail",
    "resizeThumbnailDataUrl",
    "console",
    `${extractFunction(background, "async function captureTab(")}
     return captureTab;`,
  )(
    {
      tabs: {
        async query() {
          queryCount += 1;
          return [{ id: queryCount === 1 ? 1 : 2 }];
        },
        async captureVisibleTab() {
          return "captured";
        },
      },
    },
    async (...args) => saved.push(args),
    async (dataUrl) => `resized:${dataUrl}`,
    { log() {}, warn() {} },
  );

  assert.equal(await guardedCapture(1, 10), false);
  assert.deepEqual(saved, []);
});

function buildRetryHarness(results) {
  const captures = [];
  const sleeps = [];
  const tabQueries = [];
  const captureActiveTabWithRetry = new Function(
    "chrome",
    "captureTab",
    "sleep",
    `const captureGenerations = new Map([[10, 1]]);
     const LAZY_CAPTURE_BACKOFF_MS = 750;
     ${extractFunction(background, "async function captureActiveTabWithRetry(")}
     return captureActiveTabWithRetry;`,
  )(
    {
      tabs: {
        async query(query) {
          tabQueries.push(query);
          return [{ id: 1, windowId: 10, active: true }];
        },
      },
    },
    async (...args) => {
      captures.push(args);
      return results.shift() ?? false;
    },
    async (delay) => sleeps.push(delay),
  );
  return { captureActiveTabWithRetry, captures, sleeps, tabQueries };
}

test("missing-thumbnail recovery uses bounded exponential retries", async () => {
  const h = buildRetryHarness([false, false, true]);

  assert.equal(await h.captureActiveTabWithRetry(1, 10, 1, 3), true);

  assert.equal(h.captures.length, 3);
  assert.deepEqual(h.sleeps, [750, 1500]);
  assert.deepEqual(h.tabQueries, [
    { active: true, windowId: 10 },
    { active: true, windowId: 10 },
    { active: true, windowId: 10 },
  ]);
});

test("missing-thumbnail recovery stops after its retry limit without changing focus", async () => {
  const h = buildRetryHarness([false, false, false, true]);

  assert.equal(await h.captureActiveTabWithRetry(1, 10, 1, 3), false);

  assert.equal(h.captures.length, 3);
  assert.deepEqual(h.sleeps, [750, 1500]);
});

test("captureTab skips when the target window has no active tab", async () => {
  const { captureTab, events, state } = buildCaptureTab();
  state.activeTab = undefined;

  await captureTab(1, 10);

  assert.equal(events.captured.length, 0);
  assert.deepEqual(events.saved, []);
});
