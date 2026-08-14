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

export function isTabDragActive() {
  return dragState.tabId !== null;
}

export function finishTabDrag() {
  dragState.sourceCard?.classList.remove("dragging");
  dragState.tabId = null;
  dragState.laneId = null;
  dragState.sourceCard = null;
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
  title.setAttribute("aria-label", `Rename: ${workspace.name}`);

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
  let lastInsertRef = undefined;

  function commitReorder(draggedTabId) {
    // Read where the placeholder sits to determine the new position
    let ref = dropPlaceholder?.nextElementSibling;
    while (ref && !ref.dataset?.tabId) ref = ref.nextElementSibling;
    const refTabId = ref ? parseInt(ref.dataset.tabId, 10) : null;
    if (chromeGroup)
      return reorderInChromeGroup(draggedTabId, refTabId, chromeGroup.id);
    return reorderInStorage(draggedTabId, refTabId, workspace.id, tabIds);
  }

  function movePlaceholder(insertRef) {
    if (insertRef === dropPlaceholder) return;

    // Hide placeholder when it would land on the card's current position
    const draggedEl = dragState.tabId
      ? grid.querySelector(`[data-tab-id="${dragState.tabId}"]`)
      : null;
    if (draggedEl) {
      let naturalNext = draggedEl.nextElementSibling;
      if (naturalNext === dropPlaceholder)
        naturalNext = naturalNext.nextElementSibling;
      if (insertRef === draggedEl || insertRef === naturalNext) {
        removePlaceholder();
        return;
      }
    }

    if (!dropPlaceholder) {
      dropPlaceholder = document.createElement("div");
      dropPlaceholder.className = "drag-placeholder";
      // Must preventDefault in dragover so the lane's drop event fires over the placeholder
      dropPlaceholder.addEventListener("dragover", (e) => e.preventDefault());
    }
    // Already in the right spot
    if (
      dropPlaceholder.parentNode === grid &&
      dropPlaceholder.nextElementSibling === insertRef
    )
      return;
    if (insertRef === lastInsertRef && dropPlaceholder.parentNode === grid)
      return;
    lastInsertRef = insertRef;
    grid.insertBefore(dropPlaceholder, insertRef ?? null);
  }

  function removePlaceholder() {
    if (!dropPlaceholder?.parentNode) return;
    dropPlaceholder.remove();
    lastInsertRef = undefined;
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
      });

      card.addEventListener("dragend", () => {
        removePlaceholder();
        finishTabDrag();
      });

      card.addEventListener("dragover", (e) => {
        if (dragState.laneId !== workspace.id || dragState.tabId === tab.id)
          return;
        e.preventDefault();
        e.stopPropagation();
        const rect = card.getBoundingClientRect();
        let ref =
          e.clientX >= rect.left + rect.width / 2
            ? card.nextElementSibling
            : card;
        if (ref === dropPlaceholder) ref = dropPlaceholder.nextElementSibling;
        movePlaceholder(ref);
      });

      grid.appendChild(card);
    }
  }
  for (const el of createNewTabCard(chromeGroup?.id ?? null)) {
    grid.appendChild(el);
  }

  lane.appendChild(body);

  lane.addEventListener("close-tab", (e) => onTabClosed(e.detail.tabId));

  lane.addEventListener("dragover", (e) => {
    if (dragState.laneId === workspace.id) return;
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
    e.preventDefault();
    lane.classList.remove("drag-over");

    // Same-lane reorder: use placeholder position instead of cursor position
    if (
      dragState.laneId === workspace.id &&
      dropPlaceholder?.parentNode === grid
    ) {
      const draggedTabId = dragState.tabId;
      const reorderPromise = commitReorder(draggedTabId); // reads nextElementSibling synchronously
      removePlaceholder();
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
      await chrome.tabs.group({ tabIds: [tabId], groupId: chromeGroup.id });
      await unassignTab(tabId);
      // Remove any about:blank placeholder tab now that a real tab has been added
      const groupTabs = await chrome.tabs.query({ groupId: chromeGroup.id });
      const placeholder = groupTabs.find(
        (t) => t.url === "about:blank" && t.id !== tabId,
      );
      if (placeholder) await chrome.tabs.remove(placeholder.id).catch(() => {});
    } else if (meridianWorkspace) {
      if (hasNativeGroups) await chrome.tabs.ungroup([tabId]).catch(() => {});
      await assignTab(tabId, meridianWorkspace.id);
    } else {
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
  titleEl.contentEditable = "true";
  titleEl.focus();
  document.execCommand("selectAll", false, null);

  function finish(cancelled = false) {
    titleEl.removeEventListener("blur", onBlur);
    titleEl.removeEventListener("keydown", onKeydown);
    titleEl.contentEditable = "false";
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
