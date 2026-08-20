import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createChromeStorage,
  extractFunction,
  extractStorageListener,
  flushAsyncWork,
} from "./runtimeHarness.mjs";

const [laneSource, meridianSource] = await Promise.all([
  readFile(new URL("../components/WorkspaceLane.js", import.meta.url), "utf8"),
  readFile(new URL("../meridian.js", import.meta.url), "utf8"),
]);

function evaluateFunction(source, signature) {
  const functionSource = extractFunction(source, signature).replace(
    /^export\s+/,
    "",
  );
  const name = signature.match(/function\s+(\w+)/)?.[1];
  return new Function(`${functionSource}; return ${name};`)();
}

const sortLaneIds = evaluateFunction(meridianSource, "function sortLaneIds(");
const mergeLaneOrder = evaluateFunction(
  meridianSource,
  "function mergeLaneOrder(",
);

test("saved lane order is restored while new lanes retain their natural order", () => {
  assert.deepEqual(
    sortLaneIds(["unsorted", "new", "emberstone", "chrome"], [
      "chrome",
      "unsorted",
      "emberstone",
    ]),
    ["chrome", "unsorted", "emberstone", "new"],
  );
});

test("reordering visible lanes preserves temporarily hidden lane positions", () => {
  assert.deepEqual(
    mergeLaneOrder(
      ["unsorted", "emberstone", "hidden-group", "chrome"],
      ["chrome", "emberstone"],
    ),
    ["unsorted", "chrome", "hidden-group", "emberstone"],
  );
});

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  add(...names) {
    names.forEach((name) => this.element.classes.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.element.classes.delete(name));
  }
}

class FakeElement {
  constructor(className = "", workspaceId = null) {
    this.children = [];
    this.parentNode = null;
    this.classes = new Set(className.split(/\s+/).filter(Boolean));
    this.classList = new FakeClassList(this);
    this.dataset = workspaceId ? { workspaceId } : {};
    this.listeners = new Map();
    this.style = {};
    this.focused = false;
  }

  set className(value) {
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type, event) {
    this.listeners.get(type)?.(event);
  }

  appendChild(child) {
    return this.insertBefore(child, null);
  }

  insertBefore(child, reference) {
    child.remove();
    const index = reference ? this.children.indexOf(reference) : -1;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    child.parentNode = this;
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  before(element) {
    this.parentNode.insertBefore(element, this);
  }

  after(element) {
    this.parentNode.insertBefore(element, this.nextElementSibling);
  }

  querySelectorAll(selector) {
    assert.equal(selector, ":scope > .workspace-lane");
    return this.children.filter((child) =>
      child.classes.has("workspace-lane"),
    );
  }

  closest(selector) {
    const className = selector.replace(/^\./, "");
    if (this.classes.has(className)) return this;
    return this.parentNode?.closest(selector) ?? null;
  }

  getBoundingClientRect() {
    return { top: 0, height: 100 };
  }

  focus() {
    this.focused = true;
  }

  get nextElementSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] ?? null;
  }
}

function createLaneReorderingHarness() {
  const supportSource = [
    "const laneDragState = { laneId: null, sourceLane: null, placeholder: null };",
    extractFunction(laneSource, "function isLaneDragActive(").replace(
      /^export\s+/,
      "",
    ),
    extractFunction(laneSource, "function finishLaneDrag(").replace(
      /^export\s+/,
      "",
    ),
    extractFunction(laneSource, "function isLaneTransfer("),
    extractFunction(laneSource, "function readLaneTransfer("),
    extractFunction(laneSource, "function laneIdsIn("),
    extractFunction(laneSource, "function moveLanePlaceholder("),
    extractFunction(laneSource, "function setupLaneReordering(").replace(
      /^export\s+/,
      "",
    ),
  ].join("\n");
  const document = { createElement: () => new FakeElement() };
  return new Function(
    "document",
    `${supportSource}; return { laneDragState, setupLaneReordering };`,
  )(document);
}

function dragEvent(target, clientY = 0) {
  return {
    target,
    clientY,
    preventDefault() {},
    stopPropagation() {},
  };
}

test("lane drag moves the whole lane at the placeholder without invoking tab drag data", () => {
  const { laneDragState, setupLaneReordering } =
    createLaneReorderingHarness();
  const container = new FakeElement();
  const lanes = ["one", "two", "three"].map(
    (id) => new FakeElement("workspace-lane", id),
  );
  lanes.forEach((lane) => container.appendChild(lane));
  const committed = [];
  setupLaneReordering(container, (order) => committed.push(order));

  laneDragState.laneId = "one";
  laneDragState.sourceLane = lanes[0];
  container.dispatch("dragover", dragEvent(lanes[2], 0));
  container.dispatch("drop", dragEvent(lanes[2], 0));

  assert.deepEqual(committed, [["two", "three", "one"]]);
  assert.deepEqual(
    container.querySelectorAll(":scope > .workspace-lane").map(
      (lane) => lane.dataset.workspaceId,
    ),
    ["two", "three", "one"],
  );
  assert.equal(laneDragState.laneId, null);
});

test("the last lane can start a drag before any placeholder exists", () => {
  const { laneDragState, setupLaneReordering } =
    createLaneReorderingHarness();
  const container = new FakeElement();
  const lanes = ["one", "two", "three"].map(
    (id) => new FakeElement("workspace-lane", id),
  );
  lanes.forEach((lane) => container.appendChild(lane));
  const committed = [];
  setupLaneReordering(container, (order) => committed.push(order));

  laneDragState.laneId = "three";
  laneDragState.sourceLane = lanes[2];
  container.dispatch("dragover", dragEvent(lanes[0], 50));
  container.dispatch("drop", dragEvent(lanes[0], 50));

  assert.deepEqual(committed, [["three", "one", "two"]]);
});

test("the group name is the draggable lane target without a separate handle", () => {
  assert.match(
    laneSource,
    /title\.className = "lane-title";[\s\S]*?title\.draggable = true;[\s\S]*?title\.addEventListener\("dragstart"/,
  );
  assert.doesNotMatch(laneSource, /lane-drag-handle/);
});

test("lane order storage changes schedule renders in every open window", async () => {
  const { chrome } = createChromeStorage();
  const renderCounts = [0, 0];
  const listenerSource = extractStorageListener(meridianSource);

  for (let index = 0; index < renderCounts.length; index += 1) {
    new Function(
      "chrome",
      "renderCounts",
      "index",
      `
        const CUSTOM_BACKGROUND_REVISION_KEY = "customBackgroundRevision";
        const DEFAULT_BACKGROUND = {};
        const refreshCustomBackgroundUrl = async () => null;
        const applyStoredAppearance = () => {};
        const applyPhotoAdjustments = () => {};
        const clearBrowserSearch = () => {};
        const searchBarApi = { getScope: () => "all", setScope: () => {} };
        const syncScopeButtons = () => {};
        const scheduleRender = () => { renderCounts[index] += 1; };
        chrome.storage.onChanged.addListener(${listenerSource});
      `,
    )(chrome, renderCounts, index);
  }

  await chrome.storage.local.set({ laneOrder: ["three", "one", "two"] });
  await flushAsyncWork();

  assert.deepEqual(renderCounts, [1, 1]);
});

test("tab drop listeners explicitly ignore lane transfers", () => {
  const listenersStart = laneSource.indexOf(
    'lane.addEventListener("dragover"',
  );
  const listenersEnd = laneSource.indexOf("return lane;", listenersStart);
  const laneDropListeners = laneSource.slice(listenersStart, listenersEnd);
  assert.match(
    laneDropListeners,
    /addEventListener\("dragover"[\s\S]*?if \(isLaneTransfer\(e\)\) return/,
  );
  assert.match(
    laneDropListeners,
    /addEventListener\("drop"[\s\S]*?if \(isLaneTransfer\(e\)\) return/,
  );
});

test("same-lane tab gaps use the whole grid as a coordinate hit area", () => {
  assert.doesNotMatch(laneSource, /card\.addEventListener\("dragover"/);
  assert.match(
    laneSource,
    /grid\.addEventListener\("dragover"[\s\S]*?e\.clientX, e\.clientY/,
  );
  assert.match(laneSource, /function insertionRefAtPoint\(clientX, clientY\)/);
  assert.match(laneSource, /distanceToRow/);
  assert.match(laneSource, /rect\.left \+ rect\.width \/ 2/);
  assert.match(laneSource, /card\.offsetLeft - grid\.offsetLeft/);
});
