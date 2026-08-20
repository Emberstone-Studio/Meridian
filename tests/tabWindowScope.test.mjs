import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createChromeStorage,
  extractFunction,
  extractStorageListener,
} from "./runtimeHarness.mjs";

const meridianSource = await readFile(
  new URL("../meridian.js", import.meta.url),
  "utf8",
);

function createTabWindow(chrome) {
  const queryArguments = [];
  const createdLanes = [];
  const container = {
    clears: 0,
    children: [],
    set innerHTML(value) {
      assert.equal(value, "");
      this.clears += 1;
      this.children = [];
    },
    appendChild(child) {
      this.children = this.children.filter((existing) => existing !== child);
      this.children.push(child);
    },
    querySelector(selector) {
      assert.equal(selector, ".workspace-lane--empty-unsorted");
      return this.children.find((child) =>
        child.classes?.has("workspace-lane--empty-unsorted"),
      );
    },
    querySelectorAll(selector) {
      assert.equal(selector, ":scope > .workspace-lane");
      return [];
    },
  };
  const timers = [];
  const setTimeout = (callback) => {
    timers.push(callback);
    return timers.length;
  };
  const clearTimeout = () => {};

  chrome.tabs = {
    async query(options) {
      queryArguments.push(options);
      return [];
    },
    async getCurrent() {
      return null;
    },
  };
  chrome.runtime = {
    getURL(path) {
      return `chrome-extension://meridian/${path}`;
    },
  };

  const build = new Function(
    "chrome",
    "document",
    "createdLanes",
    "setTimeout",
    "clearTimeout",
    `
      const hasNativeGroups = false;
      let pendingRenameLaneId = null;
      let renderTimer = null;
      let renderRunning = false;
      let renderDeferredByDrag = false;
      const isTabDragActive = () => false;
      const isWorkspaceDragActive = () => false;
      const getAllThumbnails = async () => ({});
      const getWorkspaceData = async () => ({ workspaces: [], assignments: {} });
      const clusterTabsByDomain = () => new Map();
      const createWorkspaceLane = (workspace, tabs) => {
        const classes = new Set();
        const lane = {
          workspace,
          tabs,
          classes,
          classList: { add: (...names) => names.forEach((name) => classes.add(name)) },
          addEventListener() {},
        };
        createdLanes.push(lane);
        return lane;
      };
      const handleTabClosed = () => {};
      const clearBrowserSearch = () => {};
      const syncScopeButtons = () => {};
      const applyStoredAppearance = () => {};
      const applyPhotoAdjustments = () => {};
      const refreshCustomBackgroundUrl = async () => null;
      const searchBarApi = null;
      const DEFAULT_BACKGROUND = { type: "theme", value: "topo" };
      const CUSTOM_BACKGROUND_REVISION_KEY = "customBackgroundRevision";

      ${extractFunction(meridianSource, "function scheduleRender()")}
      ${extractFunction(meridianSource, "function sortByTabOrder(")}
      ${extractFunction(meridianSource, "function sortLaneIds(")}
      ${extractFunction(meridianSource, "function applyLaneOrder(")}
      ${extractFunction(meridianSource, "async function render()")}
      chrome.storage.onChanged.addListener(${extractStorageListener(meridianSource)});
      return { render };
    `,
  );

  const api = build(
    chrome,
    {
      getElementById(id) {
        assert.equal(id, "workspace-container");
        return container;
      },
    },
    createdLanes,
    setTimeout,
    clearTimeout,
  );

  return {
    ...api,
    container,
    createdLanes,
    queryArguments,
    async runScheduledRender() {
      const callback = timers.shift();
      assert.ok(callback, "a rerender should be scheduled");
      await callback();
    },
  };
}

test("all-windows changes alter the tab query and rerender the workspace", async () => {
  const { chrome } = createChromeStorage({
    sync: { showTabsFromAllWindows: true },
    local: { collapsedLanes: {}, tabOrder: {} },
  });
  const tabWindow = createTabWindow(chrome);

  await tabWindow.render();
  assert.deepEqual(tabWindow.queryArguments, [{}]);
  assert.equal(tabWindow.container.clears, 1);
  assert.equal(tabWindow.createdLanes.at(-1).workspace.id, "unsorted");
  assert.deepEqual(tabWindow.createdLanes.at(-1).tabs, []);
  assert.equal(
    tabWindow.createdLanes.at(-1).classes.has(
      "workspace-lane--empty-unsorted",
    ),
    true,
  );

  await chrome.storage.sync.set({ showTabsFromAllWindows: false });
  await tabWindow.runScheduledRender();
  assert.deepEqual(tabWindow.queryArguments.at(-1), { currentWindow: true });
  assert.equal(tabWindow.container.clears, 2);

  await chrome.storage.sync.set({ showTabsFromAllWindows: true });
  await tabWindow.runScheduledRender();
  assert.deepEqual(tabWindow.queryArguments.at(-1), {});
  assert.equal(tabWindow.container.clears, 3);
});
