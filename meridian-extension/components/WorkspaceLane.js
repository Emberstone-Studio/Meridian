import { createTabCard } from "./TabCard.js";
import { createNewTabCard } from "./NewTabCard.js";
import {
  renameWorkspace,
  deleteWorkspace,
  assignTab,
  unassignTab,
} from "../utils/workspaceManager.js";
import { mutateStorageValue } from "../utils/storageMutationQueue.js";

const hasNativeGroups = typeof chrome.tabGroups !== "undefined";

// Tracks which tab is being dragged and from which lane, for same-lane
// reordering. Keeping the source element lets every drop path clean up even
// when Chrome updates the tab model before the browser emits `dragend`.
const dragState = { tabId: null, laneId: null, sourceCard: null };
const laneDragState = { laneId: null, sourceLane: null, placeholder: null };
const LANE_DRAG_TYPE = "application/x-meridian-lane";

export function isTabDragActive() {
  return dragState.tabId !== null;
}

export function finishTabDrag() {
  dragState.sourceCard?.classList.remove("dragging");
  dragState.sourceCard?.classList.remove("tab-drag-source-out-of-flow");
  dragState.tabId = null;
  dragState.laneId = null;
  dragState.sourceCard = null;
}

export function isLaneDragActive() {
  return laneDragState.laneId !== null;
}

export function isWorkspaceDragActive() {
  return isTabDragActive() || isLaneDragActive();
}

export function finishLaneDrag() {
  laneDragState.sourceLane?.classList.remove("dragging");
  laneDragState.placeholder?.remove();
  laneDragState.laneId = null;
  laneDragState.sourceLane = null;
  laneDragState.placeholder = null;
}

function laneIdsIn(container) {
  return [...container.querySelectorAll(":scope > .workspace-lane")].map(
    (lane) => lane.dataset.workspaceId,
  );
}

function isLaneTransfer(event) {
  return (
    isLaneDragActive() ||
    [...(event.dataTransfer?.types ?? [])].includes(LANE_DRAG_TYPE)
  );
}

function readLaneTransfer(event) {
  try {
    return JSON.parse(event.dataTransfer?.getData(LANE_DRAG_TYPE) || "null");
  } catch {
    return null;
  }
}

function moveLanePlaceholder(container, insertRef) {
  const sourceLane = laneDragState.sourceLane;
  if (sourceLane) {
    let naturalNext = sourceLane.nextElementSibling;
    if (
      laneDragState.placeholder &&
      naturalNext === laneDragState.placeholder
    )
      naturalNext = naturalNext.nextElementSibling;
    if (insertRef === sourceLane || insertRef === naturalNext) {
      laneDragState.placeholder?.remove();
      return;
    }
  }

  if (!laneDragState.placeholder) {
    const placeholder = document.createElement("div");
    placeholder.className = "drag-placeholder lane-drag-placeholder";
    laneDragState.placeholder = placeholder;
  }
  container.insertBefore(laneDragState.placeholder, insertRef ?? null);
}

export function setupLaneReordering(container, onReorder) {
  container.addEventListener("dragover", (e) => {
    if (!isLaneTransfer(e)) return;
    e.preventDefault();
    e.stopPropagation();

    const targetLane = e.target.closest?.(".workspace-lane");
    if (!targetLane || targetLane.parentNode !== container) {
      if (e.target === container) moveLanePlaceholder(container, null);
      return;
    }
    const sourceLane = laneDragState.sourceLane;
    const lanes = [
      ...container.querySelectorAll(":scope > .workspace-lane"),
    ];
    const sourceIndex = lanes.indexOf(sourceLane);
    const targetIndex = lanes.indexOf(targetLane);
    const insertRef = sourceLane
      ? sourceIndex < targetIndex
        ? targetLane.nextElementSibling
        : targetLane
      : e.clientY >=
          targetLane.getBoundingClientRect().top +
            targetLane.getBoundingClientRect().height / 2
        ? targetLane.nextElementSibling
        : targetLane;
    moveLanePlaceholder(container, insertRef);
  });

  container.addEventListener("drop", (e) => {
    if (!isLaneTransfer(e)) return;
    e.preventDefault();
    e.stopPropagation();

    const externalPayload = isLaneDragActive() ? null : readLaneTransfer(e);
    const sourceLane =
      laneDragState.sourceLane ??
      [...container.querySelectorAll(":scope > .workspace-lane")].find(
        (lane) => lane.dataset.workspaceId === externalPayload?.laneId,
      );
    const { placeholder } = laneDragState;
    if (sourceLane && placeholder?.parentNode === container) {
      container.insertBefore(sourceLane, placeholder);
      const laneOrder = laneIdsIn(container);
      finishLaneDrag();
      onReorder(laneOrder, externalPayload);
      return;
    }
    if (externalPayload) onReorder(laneIdsIn(container), externalPayload);
    finishLaneDrag();
  });
}

async function moveTabToWindow(tabId, windowId) {
  if (windowId == null) return chrome.tabs.get(tabId);
  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId === windowId) return tab;
  return chrome.tabs.move(tabId, { windowId, index: -1 });
}

async function groupTabInWindow(tabId, chromeGroup, destinationWindowId) {
  const targetWindowId = destinationWindowId ?? chromeGroup.windowId;
  await moveTabToWindow(tabId, targetWindowId);

  if (chromeGroup.windowId === targetWindowId) {
    await chrome.tabs.group({ tabIds: [tabId], groupId: chromeGroup.id });
    return;
  }

  const groups = await chrome.tabGroups.query({ windowId: targetWindowId });
  const matchingGroup = groups.find(
    (group) =>
      (group.title ?? "").trim() === (chromeGroup.title ?? "").trim() &&
      group.color === chromeGroup.color,
  );
  if (matchingGroup) {
    await chrome.tabs.group({ tabIds: [tabId], groupId: matchingGroup.id });
    return;
  }

  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  await chrome.tabGroups.update(groupId, {
    title: chromeGroup.title ?? "",
    color: chromeGroup.color,
  });
}

// refTabId: the tab that should follow the dragged tab in the new order (null = insert at end)
async function reorderInChromeGroup(draggedTabId, refTabId, groupId) {
  const groupTabs = await chrome.tabs.query({ groupId });
  groupTabs.sort((a, b) => a.index - b.index);
  const newOrder = groupTabs.filter((t) => t.id !== draggedTabId);
  const insertIdx =
    refTabId != null
      ? newOrder.findIndex((t) => t.id === refTabId)
      : newOrder.length;
  newOrder.splice(
    insertIdx === -1 ? newOrder.length : insertIdx,
    0,
    groupTabs.find((t) => t.id === draggedTabId),
  );
  const newRelIdx = newOrder.findIndex((t) => t.id === draggedTabId);
  await chrome.tabs.move(draggedTabId, {
    index: groupTabs[0].index + newRelIdx,
  });
}

async function reorderInStorage(
  draggedTabId,
  refTabId,
  workspaceId,
  currentTabIds,
) {
  const newOrder = currentTabIds.filter((id) => id !== draggedTabId);
  const insertIdx =
    refTabId != null ? newOrder.indexOf(refTabId) : newOrder.length;
  newOrder.splice(
    insertIdx === -1 ? newOrder.length : insertIdx,
    0,
    draggedTabId,
  );
  await mutateStorageValue("tabOrder", {}, (tabOrder) => {
    tabOrder[workspaceId] = newOrder;
  });

  // Meridian-only lanes are not native Chrome groups, but their visible order
  // should still match the browser tab strip. Browser order is per-window, so
  // only move the dragged tab relative to lane peers in its existing window.
  try {
    const draggedTab = await chrome.tabs.get(draggedTabId);
    const windowTabs = await chrome.tabs.query({ windowId: draggedTab.windowId });
    const movableIds = new Set(
      windowTabs
        .filter((tab) => tab.pinned === draggedTab.pinned)
        .map((tab) => tab.id),
    );
    const windowOrder = newOrder.filter((id) => movableIds.has(id));
    const position = windowOrder.indexOf(draggedTabId);
    const previousId = position > 0 ? windowOrder[position - 1] : null;
    const nextId =
      position >= 0 && position < windowOrder.length - 1
        ? windowOrder[position + 1]
        : null;

    if (nextId != null) {
      const nextTab = windowTabs.find((tab) => tab.id === nextId);
      if (nextTab) {
        const targetIndex =
          draggedTab.index < nextTab.index ? nextTab.index - 1 : nextTab.index;
        await chrome.tabs.move(draggedTabId, { index: targetIndex });
      }
    } else if (previousId != null) {
      const previousTab = windowTabs.find((tab) => tab.id === previousId);
      if (previousTab) {
        const targetIndex =
          previousTab.index + (draggedTab.index > previousTab.index ? 1 : 0);
        await chrome.tabs.move(draggedTabId, { index: targetIndex });
      }
    }
  } catch (error) {
    console.warn(
      "[Meridian] Could not mirror lane order to the browser tab bar:",
      error,
    );
  }
}

const GROUP_COLORS = {
  grey: "#9aa0a6",
  blue: "#4285f4",
  red: "#ea4335",
  yellow: "#fbbc04",
  green: "#34a853",
  pink: "#ff63b8",
  purple: "#a142f4",
  cyan: "#24c1e0",
  orange: "#ff6d00",
};

const CHEVRON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

export function createWorkspaceLane(
  workspace,
  tabs,
  thumbnails,
  onTabClosed,
  {
    chromeGroup,
    meridianWorkspace,
    destinationWindowId,
    collapsed: initialCollapsed = false,
    autoRename = false,
  } = {},
) {
  const lane = document.createElement("div");
  lane.className = "workspace-lane";
  lane.dataset.workspaceId = workspace.id;

  let collapsed = initialCollapsed;

  // ---- Header ----
  const header = document.createElement("div");
  header.className = "lane-header";

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "lane-collapse-btn";
  collapseBtn.innerHTML = CHEVRON;
  collapseBtn.setAttribute("aria-label", "Collapse lane");

  // Every lane gets a dot — it caps the lane spine. Only real Chrome groups
  // get the click-to-recolor affordance; every other lane renders a static
  // marker in the lane's --group-color, which defaults to brand mint.
  const groupColor = chromeGroup?.color
    ? (GROUP_COLORS[chromeGroup.color] ?? "#9aa0a6")
    : null;
  if (groupColor) lane.style.setProperty("--group-color", groupColor);

  const recolorable = !!groupColor && hasNativeGroups;
  const dot = document.createElement(recolorable ? "button" : "i");
  dot.className = "lane-group-dot";
  if (recolorable) {
    dot.setAttribute("aria-label", "Change group color");
    dot.title = "Change color";
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      openColorPicker(dot, chromeGroup);
    });
  } else {
    dot.setAttribute("aria-hidden", "true");
  }
  header.appendChild(collapseBtn);
  header.appendChild(dot);

  const title = document.createElement("button");
  title.className = "lane-title";
  title.textContent = workspace.name;
  title.draggable = true;
  title.title = "Drag to reorder group";
  title.setAttribute("aria-label", `Rename: ${workspace.name}`);

  title.addEventListener("dragstart", (e) => {
    const payload = {
      laneId: workspace.id,
      name: workspace.name,
      tabIds: tabs.map((tab) => tab.id),
      sourceWindowIds: [...new Set(tabs.map((tab) => tab.windowId))],
      chromeGroup: chromeGroup
        ? {
            id: chromeGroup.id,
            title: chromeGroup.title ?? "",
            color: chromeGroup.color,
          }
        : null,
      meridianWorkspaceId: meridianWorkspace?.id ?? null,
    };
    laneDragState.laneId = workspace.id;
    laneDragState.sourceLane = lane;
    lane.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(LANE_DRAG_TYPE, JSON.stringify(payload));
  });
  title.addEventListener("dragend", finishLaneDrag);

  // Renaming persists to the right place depending on the lane's kind. Only
  // real user groups are renamable (not Unsorted or auto domain clusters).
  let onCommitRename = null;
  if (chromeGroup && hasNativeGroups) {
    onCommitRename = (name) =>
      chrome.tabGroups.update(chromeGroup.id, { title: name });
  } else if (meridianWorkspace) {
    onCommitRename = (name) => renameWorkspace(workspace.id, name);
  }

  if (onCommitRename) {
    title.classList.add("lane-title--editable");
    title.addEventListener("click", () => startRename(title, onCommitRename));
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && title.contentEditable !== "true")
        startRename(title, onCommitRename);
    });
    // "Move to new group" asks the new lane to open straight into rename.
    if (autoRename)
      requestAnimationFrame(() => startRename(title, onCommitRename));
  } else {
    title.setAttribute("aria-label", `Workspace: ${workspace.name}`);
  }

  const count = document.createElement("span");
  count.className = "lane-tab-count";
  count.textContent = `${tabs.length}`;

  header.appendChild(title);
  header.appendChild(count);

  // Delete button for user-created Meridian workspaces only
  if (meridianWorkspace) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "lane-delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", `Delete group ${workspace.name}`);
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (
        !confirm(
          `Delete group "${workspace.name}"? Tabs will move to Unsorted.`,
        )
      )
        return;
      await deleteWorkspace(workspace.id);
      lane.dispatchEvent(
        new CustomEvent("workspace-reassigned", { bubbles: true }),
      );
    });
    header.appendChild(deleteBtn);
  }

  lane.appendChild(header);

  // ---- Collapse logic ----
  const grid = document.createElement("div");
  grid.className = "tab-grid";

  // The spine is drawn by .lane-body::before, so collapsing has to hide the
  // wrapper — hiding only the grid would leave a stub of spine behind.
  const body = document.createElement("div");
  body.className = "lane-body";
  body.appendChild(grid);

  // Apply initial collapsed state
  body.classList.toggle("hidden", collapsed);
  collapseBtn.classList.toggle("lane-collapse-btn--collapsed", collapsed);
  collapseBtn.setAttribute(
    "aria-label",
    collapsed ? "Expand lane" : "Collapse lane",
  );

  collapseBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    body.classList.toggle("hidden", collapsed);
    collapseBtn.classList.toggle("lane-collapse-btn--collapsed", collapsed);
    collapseBtn.setAttribute(
      "aria-label",
      collapsed ? "Expand lane" : "Collapse lane",
    );
    mutateStorageValue("collapsedLanes", {}, (collapsedLanes) => {
      if (collapsed) {
        collapsedLanes[workspace.id] = true;
      } else {
        delete collapsedLanes[workspace.id];
      }
    });
  });

  // ---- Tab cards ----
  let dropPlaceholder = null;
  let sourceLiftFrame = null;
  const shiftAnimations = new WeakMap();

  function liveItems() {
    return [...grid.children].filter(
      (item) =>
        item !== dropPlaceholder && !item.classList.contains("dragging"),
    );
  }

  function changeGridLayout(mutate, animate = true) {
    const items = liveItems();
    const first = new Map(
      items.map((item) => [item, item.getBoundingClientRect()]),
    );
    for (const item of items) shiftAnimations.get(item)?.cancel();

    mutate();

    if (
      !animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    for (const item of items) {
      if (typeof item.animate !== "function") continue;
      const before = first.get(item);
      const after = item.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
      const animation = item.animate(
        [
          { transform: `translate(${x}px, ${y}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 140,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        },
      );
      shiftAnimations.set(item, animation);
      animation.addEventListener(
        "finish",
        () => {
          if (shiftAnimations.get(item) === animation)
            shiftAnimations.delete(item);
        },
        { once: true },
      );
    }
  }

  function commitReorder(draggedTabId) {
    let ref = dropPlaceholder?.nextElementSibling;
    while (ref && !ref.dataset?.tabId) ref = ref.nextElementSibling;
    const refTabId = ref ? parseInt(ref.dataset.tabId, 10) : null;
    if (chromeGroup)
      return reorderInChromeGroup(draggedTabId, refTabId, chromeGroup.id);
    return reorderInStorage(draggedTabId, refTabId, workspace.id, tabIds);
  }

  function movePlaceholder(insertRef) {
    if (!dropPlaceholder?.parentNode) return;
    const sourceCard = dragState.sourceCard;
    const endRef = [...grid.children].find(
      (item) =>
        item !== sourceCard &&
        item !== dropPlaceholder &&
        !item.dataset?.tabId,
    );
    const targetRef = insertRef ?? endRef ?? null;
    if (dropPlaceholder.nextElementSibling === targetRef) return;
    changeGridLayout(() => grid.insertBefore(dropPlaceholder, targetRef));
  }

  function insertionRefAtPoint(clientX, clientY) {
    const cards = [
      ...grid.querySelectorAll(":scope > .tab-card[data-tab-id]"),
    ].filter((card) => card !== dragState.sourceCard);
    if (!cards.length) return null;

    const gridRect = grid.getBoundingClientRect();
    const pointerX = clientX - gridRect.left + grid.scrollLeft;
    const pointerY = clientY - gridRect.top + grid.scrollTop;
    const rows = [];
    for (const card of cards) {
      // Use layout coordinates, not getBoundingClientRect(): the latter includes
      // the in-flight FLIP transform and makes the hit target move underneath
      // a stationary pointer while cards animate.
      const rect = {
        top: card.offsetTop - grid.offsetTop,
        bottom: card.offsetTop - grid.offsetTop + card.offsetHeight,
        left: card.offsetLeft - grid.offsetLeft,
        width: card.offsetWidth,
      };
      let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 4);
      if (!row) {
        row = { top: rect.top, bottom: rect.bottom, cards: [] };
        rows.push(row);
      }
      row.bottom = Math.max(row.bottom, rect.bottom);
      row.cards.push({ card, rect });
    }

    const distanceToRow = (row) =>
      pointerY < row.top
        ? row.top - pointerY
        : pointerY > row.bottom
          ? pointerY - row.bottom
          : 0;
    const row = rows.reduce((nearest, candidate) =>
      distanceToRow(candidate) < distanceToRow(nearest) ? candidate : nearest,
    );
    const before = row.cards.find(
      ({ rect }) => pointerX < rect.left + rect.width / 2,
    );
    if (before) return before.card;

    const lastCard = row.cards.at(-1).card;
    return cards[cards.indexOf(lastCard) + 1] ?? null;
  }

  function removePlaceholder(animate = true) {
    cancelAnimationFrame(sourceLiftFrame);
    sourceLiftFrame = null;
    if (!dropPlaceholder?.parentNode) return;
    changeGridLayout(() => dropPlaceholder.remove(), animate);
  }

  function settleDropAtPlaceholder() {
    if (!dropPlaceholder?.parentNode) return;
    const sourceCard = dragState.sourceCard;
    if (sourceCard) grid.insertBefore(sourceCard, dropPlaceholder);
    removePlaceholder(false);
  }

  const tabIds = tabs.map((t) => t.id);

  for (const tab of tabs) {
    const isPlaceholder =
      chromeGroup &&
      (tab.url === "about:blank" ||
        tab.pendingUrl === "about:blank" ||
        (!tab.url && !tab.pendingUrl));
    if (isPlaceholder) {
      const [, activeEl] = createNewTabCard(chromeGroup.id, tab.id);
      activeEl.classList.remove("hidden");
      grid.appendChild(activeEl); // idle "+" intentionally omitted — no duplicate
    } else {
      const thumb = thumbnails[tab.id] ?? null;
      const card = createTabCard(tab, thumb);

      card.addEventListener("dragstart", () => {
        dragState.tabId = tab.id;
        dragState.laneId = workspace.id;
        dragState.sourceCard = card;
        sourceLiftFrame = requestAnimationFrame(() => {
          sourceLiftFrame = null;
          if (dragState.sourceCard !== card) return;
          card.classList.add("tab-drag-source-out-of-flow");
          dropPlaceholder = document.createElement("div");
          dropPlaceholder.className = "drag-placeholder";
          dropPlaceholder.addEventListener("dragover", (e) =>
            e.preventDefault(),
          );
          grid.insertBefore(dropPlaceholder, card.nextElementSibling);
        });
      });

      card.addEventListener("dragend", () => {
        removePlaceholder(false);
        finishTabDrag();
      });

      grid.appendChild(card);
    }
  }
  for (const el of createNewTabCard(chromeGroup?.id ?? null)) {
    grid.appendChild(el);
  }

  lane.appendChild(body);

  grid.addEventListener("dragover", (e) => {
    if (dragState.laneId !== workspace.id || isLaneTransfer(e)) return;
    e.preventDefault();
    e.stopPropagation();
    movePlaceholder(insertionRefAtPoint(e.clientX, e.clientY));
  });

  lane.addEventListener("close-tab", (e) => onTabClosed(e.detail.tabId));

  lane.addEventListener("dragover", (e) => {
    if (isLaneTransfer(e)) return;
    if (dragState.laneId === workspace.id) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    lane.classList.add("drag-over");
  });
  lane.addEventListener("dragleave", (e) => {
    if (!lane.contains(e.relatedTarget)) {
      lane.classList.remove("drag-over");
      removePlaceholder();
    }
  });
  lane.addEventListener("drop", async (e) => {
    if (isLaneTransfer(e)) return;
    e.preventDefault();
    lane.classList.remove("drag-over");

    // Same-lane reorder: use placeholder position instead of cursor position
    if (
      dragState.laneId === workspace.id &&
      dropPlaceholder?.parentNode === grid
    ) {
      const draggedTabId = dragState.tabId;
      const reorderPromise = commitReorder(draggedTabId);
      settleDropAtPlaceholder();
      finishTabDrag();
      await reorderPromise;
      lane.dispatchEvent(
        new CustomEvent("workspace-reassigned", { bubbles: true }),
      );
      return;
    }

    removePlaceholder();
    const tabId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    finishTabDrag();
    if (!tabId) return;

    if (chromeGroup) {
      await groupTabInWindow(tabId, chromeGroup, destinationWindowId);
      await unassignTab(tabId);
      // Remove any about:blank placeholder tab now that a real tab has been added
      const groupTabs = await chrome.tabs.query({ groupId: chromeGroup.id });
      const placeholder = groupTabs.find(
        (t) => t.url === "about:blank" && t.id !== tabId,
      );
      if (placeholder) await chrome.tabs.remove(placeholder.id).catch(() => {});
    } else if (meridianWorkspace) {
      await moveTabToWindow(tabId, destinationWindowId);
      if (hasNativeGroups) await chrome.tabs.ungroup([tabId]).catch(() => {});
      await assignTab(tabId, meridianWorkspace.id);
    } else {
      await moveTabToWindow(tabId, destinationWindowId);
      if (hasNativeGroups) await chrome.tabs.ungroup([tabId]).catch(() => {});
      await unassignTab(tabId);
    }

    lane.dispatchEvent(
      new CustomEvent("workspace-reassigned", { bubbles: true }),
    );
  });

  return lane;
}

function startRename(titleEl, onCommit) {
  if (titleEl.contentEditable === "true") return;
  const original = titleEl.textContent;
  const wasDraggable = titleEl.draggable;
  titleEl.draggable = false;
  titleEl.contentEditable = "true";
  titleEl.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(titleEl);
  selection.removeAllRanges();
  selection.addRange(range);

  function finish(cancelled = false) {
    titleEl.removeEventListener("blur", onBlur);
    titleEl.removeEventListener("keydown", onKeydown);
    titleEl.contentEditable = "false";
    titleEl.draggable = wasDraggable;
    const newName = cancelled
      ? original
      : titleEl.textContent.trim() || original;
    titleEl.textContent = newName;
    if (!cancelled && newName !== original) onCommit?.(newName);
  }

  function onBlur() {
    finish();
  }

  function onKeydown(e) {
    if (e.key !== "Enter" && e.key !== "Escape") return;
    e.preventDefault();
    finish(e.key === "Escape");
    titleEl.blur();
  }

  titleEl.addEventListener("blur", onBlur);
  titleEl.addEventListener("keydown", onKeydown);
}

// ---- Group color picker (a small palette popover off the color dot) ----
let activeColorPopover = null;

function closeColorPicker() {
  if (activeColorPopover) {
    activeColorPopover.remove();
    activeColorPopover = null;
  }
  document.removeEventListener("mousedown", onColorPickerOutside);
  document.removeEventListener("keydown", onColorPickerKey);
}

function onColorPickerOutside(e) {
  if (activeColorPopover && !activeColorPopover.contains(e.target))
    closeColorPicker();
}

function onColorPickerKey(e) {
  if (e.key === "Escape") closeColorPicker();
}

function openColorPicker(anchor, chromeGroup) {
  // Toggle off if the same picker is already open.
  const wasOpen = !!activeColorPopover;
  closeColorPicker();
  if (wasOpen) return;

  const pop = document.createElement("div");
  pop.className = "lane-color-popover";
  pop.setAttribute("role", "menu");

  for (const [name, hex] of Object.entries(GROUP_COLORS)) {
    const sw = document.createElement("button");
    sw.className =
      "lane-color-swatch" + (name === chromeGroup.color ? " selected" : "");
    sw.style.setProperty("--group-color", hex);
    sw.title = name.charAt(0).toUpperCase() + name.slice(1);
    sw.setAttribute("aria-label", sw.title);
    sw.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.tabGroups.update(chromeGroup.id, { color: name });
      closeColorPicker();
    });
    pop.appendChild(sw);
  }

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.setProperty("--context-menu-left", `${r.left}px`);
  pop.style.setProperty("--context-menu-top", `${r.bottom + 6}px`);
  // Nudge back on-screen if clipped at the right edge.
  requestAnimationFrame(() => {
    const pr = pop.getBoundingClientRect();
    if (pr.right > window.innerWidth) {
      pop.style.setProperty(
        "--context-menu-left",
        `${window.innerWidth - pr.width - 8}px`,
      );
    }
  });

  activeColorPopover = pop;
  // Defer so the click that opened it doesn't immediately close it.
  setTimeout(() => {
    document.addEventListener("mousedown", onColorPickerOutside);
    document.addEventListener("keydown", onColorPickerKey);
  }, 0);
}
