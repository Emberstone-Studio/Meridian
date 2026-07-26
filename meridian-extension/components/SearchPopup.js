// The single dropdown shell shared by every search-zone popup: the
// bookmarks/history scope view, the "search everything" results, and
// settings. It owns placement (anchored beneath the search pill), chrome
// (surface, radius, shadow via the .search-popup class), open/close state,
// and mutual exclusion. Callers own only the content they render into `el`.

const registry = new Set();

export function createSearchPopup({
  anchor,
  id,
  ariaLabel,
  role = "dialog",
  onOpenChange,
} = {}) {
  const openChangeListeners = new Set();
  const el = document.createElement("div");
  el.className = "search-popup hidden";
  if (id) el.id = id;
  el.setAttribute("role", role);
  if (ariaLabel) el.setAttribute("aria-label", ariaLabel);
  (anchor || document.body).appendChild(el);

  const api = {
    el,
    isOpen: () => !el.classList.contains("hidden"),
    addOpenChangeListener(listener) {
      openChangeListeners.add(listener);
      return () => openChangeListeners.delete(listener);
    },
    open() {
      if (api.isOpen()) {
        for (const listener of openChangeListeners) listener(true);
        return;
      }
      // Only one dropdown may sit under the pill at a time.
      for (const other of registry) {
        if (other !== api && other.isOpen()) other.close();
      }
      el.classList.remove("hidden");
      onOpenChange?.(true);
      for (const listener of openChangeListeners) listener(true);
    },
    close() {
      if (!api.isOpen()) return;
      el.classList.add("hidden");
      onOpenChange?.(false);
      for (const listener of openChangeListeners) listener(false);
    },
  };

  registry.add(api);
  return api;
}
