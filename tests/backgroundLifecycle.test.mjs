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

test("a cold worker restores the removed Meridian tab from its stored id", async () => {
  const removedKeys = [];
  const scheduled = [];
  const evicted = [];
  const handleTabRemoved = new Function(
    "chrome",
    "evictThumbnail",
    "setTimeout",
    "ensureMeridianTab",
    `let meridianTabId = null;
     ${extractFunction(background, "async function handleTabRemoved(")}
     return handleTabRemoved;`,
  )(
    {
      storage: {
        local: {
          get: async () => ({ meridianTabId: 42 }),
          remove: async (key) => removedKeys.push(key),
        },
      },
    },
    (tabId) => evicted.push(tabId),
    (callback, delay) => scheduled.push({ callback, delay }),
    () => {},
  );

  await handleTabRemoved(42);

  assert.deepEqual(evicted, [42]);
  assert.deepEqual(removedKeys, ["meridianTabId"]);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 500);
});

test("refresh-driven activation does not change previous-tab tracking", async () => {
  const writes = [];
  const trackPreviousTabActivation = new Function(
    "chrome",
    "resolveMeridianTabId",
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
  );

  await trackPreviousTabActivation.run({ tabId: 8, windowId: 1 });
  assert.deepEqual(writes, []);

  trackPreviousTabActivation.finishRefresh();
  await trackPreviousTabActivation.run({ tabId: 9, windowId: 1 });
  assert.deepEqual(writes, [{ previousTabId: 7 }]);
});
