import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadRefreshAllThumbnails(dependencies) {
  const background = await readFile(
    new URL("../background.js", import.meta.url),
    "utf8",
  );
  const start = background.indexOf("async function refreshAllThumbnails()");
  let depth = 0;
  let end = start;

  for (; end < background.length; end += 1) {
    if (background[end] === "{") depth += 1;
    if (background[end] === "}" && --depth === 0) {
      end += 1;
      break;
    }
  }

  return Function(
    "chrome",
    "resolveMeridianTabId",
    "isManagedMeridianTabId",
    "sleep",
    "captureTab",
    "console",
    `let meridianTabId = null;
     let isRefreshing = false;
     ${background.slice(start, end)}
     return refreshAllThumbnails;`,
  )(
    dependencies.chrome,
    async () => {},
    () => false,
    async () => {},
    dependencies.captureTab,
    dependencies.console,
  );
}

test("continues refreshing and restores active tabs when one tab fails", async () => {
  const updates = [];
  const captured = [];
  const warnings = [];
  const tabs = [
    { id: 1, windowId: 10, url: "https://one.example", active: true },
    { id: 2, windowId: 10, url: "https://two.example", active: false },
    { id: 3, windowId: 20, url: "https://three.example", active: true },
  ];
  const chrome = {
    tabs: {
      async query(query) {
        return query.active ? tabs.filter((tab) => tab.active) : tabs;
      },
      async update(tabId) {
        updates.push(tabId);
        if (tabId === 2) throw new Error("tab disappeared");
      },
    },
  };
  const refreshAllThumbnails = await loadRefreshAllThumbnails({
    chrome,
    captureTab: async (tabId) => captured.push(tabId),
    console: { warn: (...args) => warnings.push(args) },
  });

  await refreshAllThumbnails();

  assert.deepEqual(captured, [1, 3]);
  assert.deepEqual(updates, [1, 2, 3, 1, 3]);
  assert.equal(warnings.length, 1);
});

