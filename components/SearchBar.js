import { normalizeUrlInput } from "../utils/urlInput.js";

export const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com/search?q=",
    favicon: "https://www.google.com/favicon.ico",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    url: "https://duckduckgo.com/?q=",
    favicon: "https://duckduckgo.com/favicon.ico",
  },
  {
    id: "bing",
    name: "Bing",
    url: "https://www.bing.com/search?q=",
    favicon: "https://www.bing.com/favicon.ico",
  },
  {
    id: "brave",
    name: "Brave",
    url: "https://search.brave.com/search?q=",
    favicon: "https://brave.com/favicon.ico",
  },
];

const MAGNIFIER_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

const SCOPE_PLACEHOLDERS = {
  all: "Search anything…",
  bookmarks: "Search bookmarks…",
  history: "Search history…",
};

const SCOPE_LABELS = {
  all: "Search anything",
  bookmarks: "Search bookmarks",
  history: "Search history",
};

const SCOPE_CONTROLS = {
  all: "browser-search-results",
  bookmarks: "bookmarks-results-listbox",
  history: "bookmarks-results-listbox",
};

export function createSearchBar(container) {
  let currentProvider = PROVIDERS[0];
  let scope = "all";

  const wrapper = document.createElement("div");
  wrapper.className = "search-container";
  wrapper.dataset.scope = scope;

  // Left: search submit button. Engine selection lives on the web-search row
  // (see meridian.js).
  const logoBtn = document.createElement("button");
  logoBtn.className = "search-logo-btn search-logo-btn--glyph";
  logoBtn.type = "button";
  logoBtn.setAttribute("aria-label", "Submit search");

  const glyph = document.createElement("span");
  glyph.className = "search-logo-glyph";
  glyph.innerHTML = MAGNIFIER_ICON;
  logoBtn.appendChild(glyph);

  // Center: search input
  const input = document.createElement("input");
  input.className = "search-input";
  input.type = "text";
  input.placeholder = SCOPE_PLACEHOLDERS.all;
  input.setAttribute("aria-label", SCOPE_LABELS.all);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", SCOPE_CONTROLS.all);
  input.autofocus = true;

  // Clear button (shown when input has text)
  const clearBtn = document.createElement("button");
  clearBtn.className = "search-clear-btn hidden";
  clearBtn.setAttribute("aria-label", "Clear search");
  clearBtn.textContent = "\xd7";

  const status = document.createElement("div");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");

  function updateClearBtn() {
    if (input.value.length > 0) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  function updateProvider(provider) {
    currentProvider = provider;
    chrome.storage.sync.set({ searchProvider: provider.id });
    api.onProviderChange?.(provider);
  }

  function notifyQuery() {
    api.onSelectionReset?.();
    api.onBrowserQuery?.(input.value.trim() || null, scope);
  }

  function applyScope(next) {
    scope = next;
    wrapper.dataset.scope = scope;
    // The magnifier stays the submit control across all scopes; only the
    // placeholder signals the active mode.
    input.placeholder = SCOPE_PLACEHOLDERS[scope] ?? SCOPE_PLACEHOLDERS.all;
    const label = SCOPE_LABELS[scope] ?? SCOPE_LABELS.all;
    input.setAttribute("aria-label", label);
    api.setComboboxPopup({
      expanded: false,
      controlsId: SCOPE_CONTROLS[scope] ?? SCOPE_CONTROLS.all,
    });
    api.announce(
      scope === "all"
        ? "All search sources selected."
        : `${scope === "bookmarks" ? "Bookmarks" : "History"} search scope selected.`,
    );

    // Keep the current query while switching between all, bookmarks, and
    // history so users can compare the same search across scopes.
    updateClearBtn();

    api.onScopeChange?.(scope);
    notifyQuery();
  }

  function setScope(requested) {
    applyScope(scope === requested ? "all" : requested);
    input.focus();
  }

  function doSearch() {
    if (api.onSelectionActivate?.()) return;
    const q = input.value.trim();
    if (!q) return;
    if (scope !== "all") {
      api.onScopedSubmit?.();
      return;
    }
    const url =
      normalizeUrlInput(q) ??
      currentProvider.url + encodeURIComponent(q);
    if (api.onNavigate) api.onNavigate(url);
    else chrome.tabs.create({ url });
    api.clearSearch();
  }

  // Clicking the magnifier submits exactly like pressing Enter in the field.
  logoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    doSearch();
  });

  input.addEventListener("input", () => {
    updateClearBtn();
    notifyQuery();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      doSearch();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (api.onSelectionMove) {
        api.onSelectionMove(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "ArrowDown") {
        api.onArrowDown?.();
      }
    }
    if (e.key === "Escape") {
      if (scope !== "all") {
        applyScope("all");
      } else {
        input.value = "";
        updateClearBtn();
        notifyQuery();
        input.blur();
      }
    }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    updateClearBtn();
    notifyQuery();
    input.focus();
  });

  // In a scoped mode (bookmarks/history), a click anywhere outside the pill or
  // its popup exits the scope: deselect back to "all" (which closes the popup
  // via onScopeChange) and drop focus. pointerdown so it beats focus changes.
  document.addEventListener("pointerdown", (e) => {
    if (scope === "all") return;
    const insidePill = wrapper.contains(e.target);
    const insidePopup = !!e.target.closest?.("#bookmarks-panel");
    if (insidePill || insidePopup) return;
    applyScope("all");
    input.blur();
  });

  wrapper.appendChild(logoBtn);
  wrapper.appendChild(input);
  wrapper.appendChild(clearBtn);
  wrapper.appendChild(status);

  container.appendChild(wrapper);

  chrome.storage.sync.get("searchProvider").then(({ searchProvider }) => {
    const saved =
      PROVIDERS.find((p) => p.id === searchProvider) ?? PROVIDERS[0];
    updateProvider(saved);
  });

  const api = {
    focus: () => input.focus(),
    onBrowserQuery: null,
    onArrowDown: null,
    onSelectionMove: null,
    onSelectionActivate: null,
    onSelectionReset: null,
    onScopedSubmit: null,
    onNavigate: null,
    onScopeChange: null,
    onProviderChange: null,
    setComboboxPopup: ({ expanded, controlsId } = {}) => {
      if (controlsId) input.setAttribute("aria-controls", controlsId);
      input.setAttribute("aria-expanded", String(Boolean(expanded)));
      if (!expanded) input.removeAttribute("aria-activedescendant");
    },
    bindPopup: (popup, controlsId) =>
      popup.addOpenChangeListener((expanded) => {
        api.setComboboxPopup({
          expanded,
          ...(expanded ? { controlsId } : {}),
        });
      }),
    setActiveDescendant: (id) => {
      if (id) input.setAttribute("aria-activedescendant", id);
      else input.removeAttribute("aria-activedescendant");
    },
    announce: (message) => {
      const next = String(message || "").trim();
      if (next && status.textContent !== next) status.textContent = next;
    },
    setScope,
    getScope: () => scope,
    getQuery: () => input.value.trim(),
    getProvider: () => currentProvider,
    getProviders: () => PROVIDERS.slice(),
    setProvider: (id) => {
      const p = PROVIDERS.find((x) => x.id === id);
      if (p) updateProvider(p);
    },
    clearSearch: () => {
      input.value = "";
      updateClearBtn();
      notifyQuery();
    },
  };

  // Keep the active provider in sync when it's changed elsewhere (Settings).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.searchProvider) return;
    const p = PROVIDERS.find((x) => x.id === changes.searchProvider.newValue);
    if (p && p.id !== currentProvider.id) {
      currentProvider = p;
      api.onProviderChange?.(p);
    }
  });

  return api;
}
