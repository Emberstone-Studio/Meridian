const PROVIDERS = [
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
const BOOKMARK_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`;
const HISTORY_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>`;
const SCOPE_GLYPHS = {
  all: MAGNIFIER_ICON,
  bookmarks: BOOKMARK_ICON,
  history: HISTORY_ICON,
};

const SCOPE_PLACEHOLDERS = {
  all: "Search everything…",
  bookmarks: "Search bookmarks…",
  history: "Search history…",
};

const SCOPE_LABELS = {
  all: "Search everything",
  bookmarks: "Search bookmarks",
  history: "Search history",
};

export function createSearchBar(container) {
  let currentProvider = PROVIDERS[0];
  let scope = "all";

  const wrapper = document.createElement("div");
  wrapper.className = "search-container";
  wrapper.dataset.scope = scope;

  // Left: scope glyph — a signifier of the active mode, NOT an engine picker.
  // Engine selection lives on the web-search row (see meridian.js).
  const logoBtn = document.createElement("button");
  logoBtn.className = "search-logo-btn search-logo-btn--glyph";
  logoBtn.type = "button";
  logoBtn.tabIndex = -1;
  logoBtn.setAttribute("aria-label", SCOPE_LABELS.all);

  const glyph = document.createElement("span");
  glyph.className = "search-logo-glyph";
  glyph.innerHTML = SCOPE_GLYPHS.all;
  logoBtn.appendChild(glyph);

  // Center: search input
  const input = document.createElement("input");
  input.className = "search-input";
  input.type = "text";
  input.placeholder = SCOPE_PLACEHOLDERS.all;
  input.setAttribute("aria-label", SCOPE_LABELS.all);
  input.autofocus = true;

  // Clear button (shown when input has text)
  const clearBtn = document.createElement("button");
  clearBtn.className = "search-clear-btn hidden";
  clearBtn.setAttribute("aria-label", "Clear search");
  clearBtn.textContent = "\xd7";

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
    api.onBrowserQuery?.(input.value.trim() || null, scope);
  }

  function applyScope(next) {
    scope = next;
    wrapper.dataset.scope = scope;
    // Left glyph stays the search magnifier across all scopes; only the
    // placeholder signals the active mode.
    input.placeholder = SCOPE_PLACEHOLDERS[scope] ?? SCOPE_PLACEHOLDERS.all;
    const label = SCOPE_LABELS[scope] ?? SCOPE_LABELS.all;
    input.setAttribute("aria-label", label);
    logoBtn.setAttribute("aria-label", label);

    // Query text clears on scope switch (carrying a query across scopes misleads).
    input.value = "";
    updateClearBtn();

    api.onScopeChange?.(scope);
    notifyQuery();
  }

  function setScope(requested) {
    applyScope(scope === requested ? "all" : requested);
    input.focus();
  }

  function doSearch() {
    const q = input.value.trim();
    if (!q) return;
    if (scope !== "all") {
      api.onScopedSubmit?.();
      return;
    }
    chrome.tabs.create({ url: currentProvider.url + encodeURIComponent(q) });
    input.value = "";
    updateClearBtn();
  }

  // Left glyph is a signifier; clicking it just returns focus to the field.
  logoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    input.focus();
  });

  input.addEventListener("input", () => {
    updateClearBtn();
    notifyQuery();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      doSearch();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      api.onArrowDown?.();
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
    onScopedSubmit: null,
    onScopeChange: null,
    onProviderChange: null,
    setScope,
    getScope: () => scope,
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

  return api;
}
