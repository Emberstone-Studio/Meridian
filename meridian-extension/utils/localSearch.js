export const DEFAULT_LOCAL_SEARCH = {
  tabs: true,
  bookmarks: false,
  history: false,
};

const OPTIONAL_SOURCE_PERMISSIONS = {
  bookmarks: "bookmarks",
  history: "history",
};

async function hasPermission(permission) {
  try {
    return await chrome.permissions.contains({ permissions: [permission] });
  } catch {
    return false;
  }
}

export async function getEnabledLocalSearchSources(savedSources) {
  const stored =
    savedSources ??
    (await chrome.storage.sync.get("localSearch")).localSearch ??
    {};
  const enabled = {
    tabs: stored.tabs ?? DEFAULT_LOCAL_SEARCH.tabs,
    bookmarks: false,
    history: false,
  };

  await Promise.all(
    Object.entries(OPTIONAL_SOURCE_PERMISSIONS).map(
      async ([source, permission]) => {
        if (stored[source] !== true) return;
        enabled[source] = await hasPermission(permission);
      },
    ),
  );

  return enabled;
}

export async function setLocalSearchSourceEnabled(source, requested) {
  const permission = OPTIONAL_SOURCE_PERMISSIONS[source];
  let enabled = !!requested;
  let denied = false;

  if (permission && requested) {
    try {
      enabled = await chrome.permissions.request({
        permissions: [permission],
      });
    } catch {
      enabled = false;
    }
    denied = !enabled;
  } else if (permission) {
    try {
      await chrome.permissions.remove({ permissions: [permission] });
    } catch {
      // The preference still disables all queries if Chrome keeps the grant.
    }
  }

  const { localSearch = {} } =
    await chrome.storage.sync.get("localSearch");
  await chrome.storage.sync.set({
    localSearch: { ...localSearch, [source]: enabled },
  });

  return { enabled, denied };
}

export async function disableRemovedLocalSearchPermissions(removed) {
  const revokedSources = Object.entries(OPTIONAL_SOURCE_PERMISSIONS)
    .filter(([, permission]) => removed.permissions?.includes(permission))
    .map(([source]) => source);
  if (!revokedSources.length) return [];

  const { localSearch = {} } =
    await chrome.storage.sync.get("localSearch");
  const next = { ...localSearch };
  for (const source of revokedSources) next[source] = false;
  await chrome.storage.sync.set({ localSearch: next });
  return revokedSources;
}
