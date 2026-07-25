// The single dropdown shell shared by every search-zone popup: the
// bookmarks/history scope view, the "search everything" results, and
// settings. It owns placement (anchored beneath the search pill), chrome
// (surface, radius, shadow via the .search-popup class), open/close state,
// and mutual exclusion. Callers own only the content they render into `el`.

const registry = new Set();

export function createSearchPopup({ anchor, id, ariaLabel } = {}) {
  const el = document.createElement("div");
  el.className = "search-popup hidden";
  if (id) el.id = id;
  el.setAttribute("role", "dialog");
  if (ariaLabel) el.setAttribute("aria-label", ariaLabel);
  (anchor || document.body).appendChild(el);

  const api = {
    el,
    isOpen: () => !el.classList.contains("hidden"),
    open() {
      // Only one dropdown may sit under the pill at a time.
      for (const other of registry) {
        if (other !== api && other.isOpen()) other.close();
      }
      el.classList.remove("hidden");
    },
    close() {
      el.classList.add("hidden");
    },
    setContent(...nodes) {
      el.replaceChildren(...nodes);
    },
    setLabel(label) {
      if (label) el.setAttribute("aria-label", label);
    },
  };

  registry.add(api);
  return api;
}
