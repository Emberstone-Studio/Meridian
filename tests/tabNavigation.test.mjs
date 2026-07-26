import assert from "node:assert/strict";
import test from "node:test";

import { openUrlFromMeridian } from "../utils/tabNavigation.js";

test("links launched from a pinned Meridian tab open in a new tab", async () => {
  const calls = [];
  const tabs = {
    getCurrent: async () => ({ id: 14, pinned: true }),
    create: async (options) => calls.push(["create", options]),
    update: async (...args) => calls.push(["update", ...args]),
  };

  await openUrlFromMeridian("https://example.com/pinned", tabs);

  assert.deepEqual(calls, [
    ["create", { url: "https://example.com/pinned" }],
  ]);
});

test("links launched from an unpinned Meridian tab replace that tab", async () => {
  const calls = [];
  const tabs = {
    getCurrent: async () => ({ id: 27, pinned: false }),
    create: async (options) => calls.push(["create", options]),
    update: async (...args) => calls.push(["update", ...args]),
  };

  await openUrlFromMeridian("https://example.com/new-tab", tabs);

  assert.deepEqual(calls, [
    ["update", 27, { url: "https://example.com/new-tab" }],
  ]);
});

test("link launches fall back to a new tab without a current tab context", async () => {
  const calls = [];
  const tabs = {
    getCurrent: async () => null,
    create: async (options) => calls.push(["create", options]),
    update: async (...args) => calls.push(["update", ...args]),
  };

  await openUrlFromMeridian("chrome://settings", tabs);

  assert.deepEqual(calls, [["create", { url: "chrome://settings" }]]);
});
