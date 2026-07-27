import assert from "node:assert/strict";
import test from "node:test";

import { activateTab } from "../utils/tabActivation.js";

test("activating a tab also focuses the window that contains it", async () => {
  const calls = [];
  globalThis.chrome = {
    tabs: {
      async update(tabId, update) {
        calls.push(["tab", tabId, update]);
        return { id: tabId, windowId: 22 };
      },
    },
    windows: {
      async update(windowId, update) {
        calls.push(["window", windowId, update]);
      },
    },
  };

  const tab = await activateTab(7);

  assert.deepEqual(calls, [
    ["tab", 7, { active: true }],
    ["window", 22, { focused: true }],
  ]);
  assert.deepEqual(tab, { id: 7, windowId: 22 });
});

test("activation can update a tab without allowing inactive overrides", async () => {
  let received;
  globalThis.chrome = {
    tabs: {
      async update(tabId, update) {
        received = [tabId, update];
        return { id: tabId, windowId: 3 };
      },
    },
    windows: {
      async update() {},
    },
  };

  await activateTab(9, { url: "https://example.test", active: false });

  assert.deepEqual(received, [
    9,
    { url: "https://example.test", active: true },
  ]);
});
