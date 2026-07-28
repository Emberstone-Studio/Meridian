import assert from "node:assert/strict";
import test from "node:test";

const storage = {
  tabSearchIndex: {
    7: {
      tabId: 7,
      title: "Project Dashboard",
      url: "https://tabs.example/dashboard",
      domain: "tabs.example",
      metaDescription: "Quarterly roadmap",
      headings: "Roadmap Overview",
      workspaceName: "Work",
      lastActive: 111,
    },
    99: {
      tabId: 99,
      title: "Closed Tab",
      url: "https://gone.example/old",
      domain: "gone.example",
      metaDescription: "Should disappear",
      headings: "Stale",
      workspaceName: "Work",
      lastActive: 222,
    },
  },
};

// Only tab 7 still exists; tab 99 was closed while the worker was cold.
const currentTabs = [
  {
    id: 7,
    title: "Project Dashboard",
    url: "https://tabs.example/dashboard",
    status: "loading",
  },
];

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test${path}`,
  },
  storage: {
    local: {
      async get(key) {
        return { [key]: structuredClone(storage[key]) };
      },
      async set(update) {
        Object.assign(storage, structuredClone(update));
      },
    },
  },
  tabs: {
    async query() {
      return structuredClone(currentTabs);
    },
  },
  scripting: {
    async executeScript() {
      return [{ result: { metaDescription: "", headings: "" } }];
    },
  },
};

const { rebuildIndex } = await import("../utils/browserSearch.js");

test("rebuildIndex removes stale closed tabs but preserves live metadata", async () => {
  await rebuildIndex();

  // Stale entry for the closed tab is gone.
  assert.equal(storage.tabSearchIndex["99"], undefined);

  // The still-open tab is retained with its existing metadata and lastActive.
  const kept = storage.tabSearchIndex["7"];
  assert.ok(kept, "expected the live tab to remain indexed");
  assert.equal(kept.tabId, 7);
  assert.equal(kept.metaDescription, "Quarterly roadmap");
  assert.equal(kept.headings, "Roadmap Overview");
  assert.equal(kept.lastActive, 111);
  assert.equal(kept.url, "https://tabs.example/dashboard");

  // Only the live tab survives the rebuild.
  assert.deepEqual(Object.keys(storage.tabSearchIndex), ["7"]);
});
