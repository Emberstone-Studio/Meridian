import assert from "node:assert/strict";
import test from "node:test";

const storage = {};
const listeners = {};
const tab = {
  id: 42,
  title: "Example",
  url: "https://example.com/page",
  status: "complete",
};
let executedScript;

function event(name) {
  return {
    addListener(listener) {
      listeners[name] = listener;
    },
  };
}

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test${path}`,
  },
  storage: {
    onChanged: event("storageChanged"),
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
    onCreated: event("created"),
    onUpdated: event("updated"),
    onActivated: event("activated"),
    onRemoved: event("removed"),
  },
  scripting: {
    async executeScript(injection) {
      executedScript = injection;
      return [
        {
          result: {
            metaDescription: "Launch checklist",
            headings: "Release readiness",
          },
        },
      ];
    },
  },
};

const { initTabIndex } = await import("../utils/browserSearch.js");

test("completed tabs are indexed with page metadata", async () => {
  initTabIndex();
  await listeners.updated(tab.id, { status: "complete" }, tab);

  assert.deepEqual(executedScript.target, { tabId: tab.id });
  assert.match(executedScript.func.toString(), /meta\[name="description"\]/);
  assert.match(executedScript.func.toString(), /h1,h2/);
  assert.equal(
    storage.tabSearchIndex[tab.id].metaDescription,
    "Launch checklist",
  );
  assert.equal(storage.tabSearchIndex[tab.id].headings, "Release readiness");
});

test("workspace assignment and rename refresh indexed workspace names", async () => {
  storage.workspaces = {
    workspaces: [{ id: "work", name: "Renamed workspace" }],
    assignments: { [tab.id]: "work" },
  };

  await listeners.storageChanged(
    { workspaces: { newValue: structuredClone(storage.workspaces) } },
    "local",
  );

  assert.equal(
    storage.tabSearchIndex[tab.id].workspaceName,
    "Renamed workspace",
  );
});
