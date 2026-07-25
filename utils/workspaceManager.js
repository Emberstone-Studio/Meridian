import { mutateStorageValue } from "./storageMutationQueue.js";

const STORAGE_KEY = "workspaces";
const SCHEMA_VERSION = 2;

const DEFAULT_DATA = {
  version: SCHEMA_VERSION,
  workspaces: [{ id: "unsorted", name: "Unsorted" }],
  assignments: {},
};

function normalizeWorkspaceData(data) {
  if (!data || data.version !== SCHEMA_VERSION) {
    return structuredClone(DEFAULT_DATA);
  }
  if (!data.workspaces.find((w) => w.id === "unsorted")) {
    data.workspaces.unshift({ id: "unsorted", name: "Unsorted" });
  }
  return data;
}

function mutateWorkspaceData(mutate) {
  return mutateStorageValue(STORAGE_KEY, DEFAULT_DATA, (data) => {
    data = normalizeWorkspaceData(data);
    mutate(data);
    return data;
  });
}

export async function getWorkspaceData() {
  // Pure read: normalize in memory only. Writing here would fire
  // storage.onChanged("workspaces") on every render() call, which the
  // meridian.js listener turns back into scheduleRender() — a self-sustaining
  // render/write loop. Schema migration is persisted lazily by the first
  // actual mutation via mutateWorkspaceData().
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeWorkspaceData(result[STORAGE_KEY]);
}

export async function assignTab(tabId, workspaceId) {
  await mutateWorkspaceData((data) => {
    data.assignments[String(tabId)] = workspaceId;
  });
}

export async function unassignTab(tabId) {
  await mutateWorkspaceData((data) => {
    delete data.assignments[String(tabId)];
  });
}

export async function createWorkspace(name) {
  const workspace = { id: crypto.randomUUID(), name };
  await mutateWorkspaceData((data) => {
    data.workspaces.push(workspace);
  });
  return workspace;
}

export async function renameWorkspace(workspaceId, newName) {
  await mutateWorkspaceData((data) => {
    const ws = data.workspaces.find((w) => w.id === workspaceId);
    if (ws) ws.name = newName;
  });
}

export async function deleteWorkspace(workspaceId) {
  if (workspaceId === "unsorted") return;
  await mutateWorkspaceData((data) => {
    data.workspaces = data.workspaces.filter((w) => w.id !== workspaceId);
    for (const [tabId, wsId] of Object.entries(data.assignments)) {
      if (wsId === workspaceId) data.assignments[tabId] = "unsorted";
    }
  });
}

export async function getTabWorkspace(tabId) {
  const data = await getWorkspaceData();
  return data.assignments[String(tabId)] ?? "unsorted";
}

export async function initFromTabs(tabs, clusterFn) {
  await mutateWorkspaceData((data) => {
    if (data.workspaces.length > 1) return;

    const clusters = clusterFn(tabs);
    for (const [name, clusterTabs] of clusters) {
      if (name === "Unsorted") continue;
      const ws = { id: crypto.randomUUID(), name };
      data.workspaces.push(ws);
      for (const tab of clusterTabs) {
        data.assignments[String(tab.id)] = ws.id;
      }
    }
  });
}
