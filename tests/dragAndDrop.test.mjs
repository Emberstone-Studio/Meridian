import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Could not find ${signature}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not find the end of ${signature}`);
}

const [laneSource, meridianSource, meridianCss, meridianHtml] =
  await Promise.all([
    readFile(
      new URL("../components/WorkspaceLane.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../meridian.js", import.meta.url), "utf8"),
    readFile(new URL("../meridian.css", import.meta.url), "utf8"),
    readFile(new URL("../meridian.html", import.meta.url), "utf8"),
  ]);

test("same-group gap follows grid-wide pointer coordinates without a chase timer", () => {
  const movePlaceholder = extractFunction(
    laneSource,
    "function movePlaceholder(",
  );
  const changeGridLayout = extractFunction(
    laneSource,
    "function changeGridLayout(",
  );

  assert.match(laneSource, /dropPlaceholder\.className = "drag-placeholder"/);
  assert.match(movePlaceholder, /changeGridLayout/);
  assert.match(movePlaceholder, /insertRef \?\? endRef \?\? null/);
  assert.doesNotMatch(movePlaceholder, /setTimeout|pendingInsertRef/);
  assert.match(laneSource, /function insertionRefAtPoint\(clientX, clientY\)/);
  const insertionRefAtPoint = extractFunction(
    laneSource,
    "function insertionRefAtPoint(",
  );
  assert.match(insertionRefAtPoint, /card\.offsetLeft - grid\.offsetLeft/);
  assert.match(insertionRefAtPoint, /card\.offsetTop - grid\.offsetTop/);
  assert.doesNotMatch(
    insertionRefAtPoint,
    /card\.getBoundingClientRect\(\)/,
  );
  assert.match(
    laneSource,
    /grid\.addEventListener\("dragover"[\s\S]*?insertionRefAtPoint\(e\.clientX, e\.clientY\)/,
  );
  assert.match(changeGridLayout, /shiftAnimations\.get\(item\)\?\.cancel\(\)/);
  assert.match(changeGridLayout, /item\.animate/);
  assert.doesNotMatch(
    changeGridLayout,
    /offsetHeight|style\.transition|transitionend/,
  );
});

test("browser-driven renders are deferred while a tab or lane drag is active", () => {
  const scheduleRender = extractFunction(
    meridianSource,
    "function scheduleRender(",
  );

  assert.match(scheduleRender, /isWorkspaceDragActive\(\)/);
  assert.match(scheduleRender, /renderDeferredByDrag = true/);
  assert.match(
    meridianSource,
    /function flushDeferredDragRender\(\)[\s\S]*?scheduleRender\(\)/,
  );
});

test("both windows rerender when a tab crosses the window boundary", () => {
  assert.match(
    meridianSource,
    /chrome\.tabs\.onDetached\.addListener\(scheduleRender\)/,
  );
  assert.match(
    meridianSource,
    /chrome\.tabs\.onAttached\.addListener\(scheduleRender\)/,
  );
});

test("the top ungroup target mirrors the bottom new-group drop zone", () => {
  assert.match(
    meridianCss,
    /\.workspace-lane--empty-unsorted\s*{[^}]*display:\s*none/,
  );
  assert.match(
    meridianHtml,
    /id="ungroup-drop-zone"[\s\S]*?class="tab-drop-zone hidden"[\s\S]*?Drop a tab here to remove from all groups/,
  );
  assert.match(
    meridianHtml,
    /id="new-group-drop-zone"[\s\S]*?class="tab-drop-zone hidden"/,
  );
  assert.equal(
    (meridianHtml.match(/class="tab-drop-zone-label"/g) ?? []).length,
    2,
  );
  assert.match(
    meridianCss,
    /\.tab-drop-zone-label\s*{[^}]*color:\s*#fff[^}]*mix-blend-mode:\s*difference/,
  );
  assert.match(
    meridianCss,
    /#ungroup-drop-zone\s*{[^}]*margin:\s*0 24px 32px/,
  );
  assert.doesNotMatch(
    meridianCss,
    /#ungroup-drop-zone\s*{[^}]*position:\s*absolute/,
  );
  assert.match(
    meridianSource,
    /if \(isTabDragActive\(\)\) showTabDropZones\(false, true\)/,
  );
  assert.match(
    meridianSource,
    /requestAnimationFrame\(\(\) => \{[\s\S]*?ungroupDropZone\.classList\.remove\("hidden"\)/,
  );
  assert.match(
    meridianSource,
    /data-workspace-id="unsorted"[\s\S]*?!lane\.classList\.contains\("workspace-lane--empty-unsorted"\)[\s\S]*?ungroupDropZone\.classList\.add\("hidden"\)/,
  );
  assert.match(
    meridianSource,
    /ungroupDropZone\.addEventListener\("drop"[\s\S]*?chrome\.tabs\.ungroup[\s\S]*?unassignTab/,
  );
});

test("cross-window tab drops move before joining a matching destination group", async () => {
  const calls = [];
  const tab = { id: 7, windowId: 1 };
  const chrome = {
    tabs: {
      async get() {
        calls.push("get");
        return { ...tab };
      },
      async move(_tabId, moveInfo) {
        calls.push(["move", moveInfo]);
        tab.windowId = moveInfo.windowId;
        return { ...tab };
      },
      async group(groupInfo) {
        calls.push(["group", groupInfo]);
      },
    },
    tabGroups: {
      async query(queryInfo) {
        calls.push(["query-groups", queryInfo]);
        return [{ id: 22, title: "Work", color: "blue" }];
      },
      async update() {
        assert.fail("a matching group should be reused");
      },
    },
  };
  const source = [
    extractFunction(laneSource, "async function moveTabToWindow("),
    extractFunction(laneSource, "async function groupTabInWindow("),
  ].join("\n");
  const groupTabInWindow = new Function(
    "chrome",
    `${source}; return groupTabInWindow;`,
  )(chrome);

  await groupTabInWindow(
    7,
    { id: 11, windowId: 1, title: "Work", color: "blue" },
    2,
  );

  assert.deepEqual(calls, [
    "get",
    ["move", { windowId: 2, index: -1 }],
    ["query-groups", { windowId: 2 }],
    ["group", { tabIds: [7], groupId: 22 }],
  ]);
});

test("cross-window group drops move every tab and recreate the native group", async () => {
  const tabs = new Map([
    [7, { id: 7, windowId: 1, groupId: -1 }],
    [8, { id: 8, windowId: 1, groupId: -1 }],
  ]);
  const moves = [];
  const grouped = [];
  const updates = [];
  const chrome = {
    tabs: {
      async get(tabId) {
        return { ...tabs.get(tabId) };
      },
      async move(tabId, moveInfo) {
        moves.push([tabId, moveInfo]);
        tabs.get(tabId).windowId = moveInfo.windowId;
      },
      async group(groupInfo) {
        grouped.push(groupInfo);
        return 33;
      },
    },
    tabGroups: {
      async query() {
        return [];
      },
      async update(groupId, updateInfo) {
        updates.push([groupId, updateInfo]);
      },
    },
  };
  const moveLaneToCurrentWindow = new Function(
    "chrome",
    "hasNativeGroups",
    "currentMeridianWindowId",
    `${extractFunction(
      meridianSource,
      "async function moveLaneToCurrentWindow(",
    )}; return moveLaneToCurrentWindow;`,
  )(chrome, true, 2);

  const movedLaneId = await moveLaneToCurrentWindow({
    tabIds: [7, 8],
    laneId: "cg_11",
    chromeGroup: { title: "Work", color: "blue" },
  });

  assert.deepEqual(moves, [
    [7, { windowId: 2, index: -1 }],
    [8, { windowId: 2, index: -1 }],
  ]);
  assert.deepEqual(grouped, [{ tabIds: [7, 8] }]);
  assert.deepEqual(updates, [
    [33, { title: "Work", color: "blue" }],
  ]);
  assert.equal(movedLaneId, "cg_33");
});

test("cross-window native group moves replace the old lane id in saved order", async () => {
  let savedOrder = [];
  const persistLaneOrder = async (order) => {
    savedOrder = [...order];
  };
  const moveLaneToCurrentWindow = async () => "cg_33";
  const mutateStorageValue = async (_key, _fallback, mutate) => {
    savedOrder = mutate(savedOrder);
  };
  const handleLaneReorder = new Function(
    "persistLaneOrder",
    "moveLaneToCurrentWindow",
    "mutateStorageValue",
    `${extractFunction(
      meridianSource,
      "async function handleLaneReorder(",
    )}; return handleLaneReorder;`,
  )(persistLaneOrder, moveLaneToCurrentWindow, mutateStorageValue);

  await handleLaneReorder(["unsorted", "cg_11"], { laneId: "cg_11" });

  assert.deepEqual(savedOrder, ["unsorted", "cg_33"]);
});
