import {
  saveCustomBackground,
  getCustomBackgroundUrl,
} from "../utils/customBackground.js";
import {
  DEFAULT_LOCAL_SEARCH,
  getEnabledLocalSearchSources,
  setLocalSearchSourceEnabled,
} from "../utils/localSearch.js";
import { normalizeHomepageUrl } from "../utils/homepageUrl.js";
import { PROVIDERS } from "./SearchBar.js";

const NEW_TAB_OPTIONS = [
  { id: "meridian-view", label: "Open a new Meridian tab" },
  { id: "focus-pinned", label: "Return to the pinned Meridian tab" },
  { id: "open-homepage", label: "Open a specific page" },
];

// Tiny diagrams (one per option). Each has a DISTINCT hero silhouette so the
// options read apart at a glance — a plus, a return arrow, a globe — rather
// than three near-identical browser windows. The frame is thin and muted
// (`currentColor`, pinned to gray by CSS: just context); the hero is solid
// `--accent` (that shape IS the behavior). Two-tone, no opacity.
const NEW_TAB_DIAGRAMS = {
  // A gray (inactive) tab, then a new blue tab to its right; hero "+" reinforces
  // "new." Every tab is a solid 14x5 fill so they read as identical in size.
  "meridian-view": `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="68" height="38" rx="6" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 17H74" stroke="currentColor" stroke-width="1.5"/>
    <rect x="11" y="9.5" width="14" height="5" rx="2" fill="currentColor"/>
    <rect x="28" y="9.5" width="14" height="5" rx="2" fill="var(--accent)"/>
    <path d="M40 24V38M33 31H47" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  // The blue (pinned) tab is on the LEFT; hero is a centered left arrow, drawn
  // at the same size and stroke as the "+" and globe. Same solid 14x5 tabs.
  "focus-pinned": `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="68" height="38" rx="6" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 17H74" stroke="currentColor" stroke-width="1.5"/>
    <rect x="11" y="9.5" width="14" height="5" rx="2" fill="var(--accent)"/>
    <rect x="28" y="9.5" width="14" height="5" rx="2" fill="currentColor"/>
    <path d="M48 31H32M39 24L32 31L39 38" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  // Globe hero, plus the same [gray][blue] tab strip as the "new" diagram.
  "open-homepage": `<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="68" height="38" rx="6" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 17H74" stroke="currentColor" stroke-width="1.5"/>
    <rect x="11" y="9.5" width="14" height="5" rx="2" fill="currentColor"/>
    <rect x="28" y="9.5" width="14" height="5" rx="2" fill="var(--accent)"/>
    <circle cx="40" cy="31" r="8" stroke="var(--accent)" stroke-width="2"/>
    <path d="M32 31H48M40 23V39" stroke="var(--accent)" stroke-width="1.5"/>
    <path d="M40 23C44.4 26 44.4 36 40 39C35.6 36 35.6 26 40 23Z" stroke="var(--accent)" stroke-width="1.5"/>
  </svg>`,
};

// Theme icons (sun / moon / auto). Line style, `currentColor` so they recolor
// with the button text — muted normally, accent when the theme is selected.
const THEME_ICONS = {
  // Sun.
  light: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5"/>
    <path d="M12 1.5v2.5M12 20v2.5M3.9 3.9l1.8 1.8M18.3 18.3l1.8 1.8M1.5 12h2.5M20 12h2.5M3.9 20.1l1.8-1.8M18.3 5.7l1.8-1.8"/>
  </svg>`,
  // Crescent moon.
  dark: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 12.8A8.5 8.5 0 1 1 11.2 4 6.6 6.6 0 0 0 20 12.8z"/>
  </svg>`,
  // Auto/contrast: a circle with one half filled (follows the system).
  system: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>
  </svg>`,
};

const SOLID_COLORS = [
  { id: "s1", value: "#000000", label: "Black" },
  { id: "s2", value: "#1e2028", label: "Ink" },
  { id: "s3", value: "#0d1b2a", label: "Midnight" },
  { id: "s4", value: "#0f2218", label: "Forest" },
  { id: "s5", value: "#1a0a2e", label: "Plum" },
];

const GRADIENT_PRESETS = [
  {
    id: "g1",
    value: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)",
    label: "Midnight",
  },
  {
    id: "g2",
    value: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
    label: "Ocean",
  },
  { id: "g3", value: "linear-gradient(135deg,#667eea,#764ba2)", label: "Dusk" },
  {
    id: "g4",
    value: "linear-gradient(135deg,#11998e,#38ef7d)",
    label: "Emerald",
  },
  {
    id: "g5",
    value: "linear-gradient(135deg,#f7971e,#ffd200)",
    label: "Amber",
  },
  {
    id: "g6",
    value: "linear-gradient(135deg,#f093fb,#f5576c)",
    label: "Bloom",
  },
];

// Default background when the user hasn't chosen one (matches the "Ocean"
// gradient preset so its swatch shows selected).
export const DEFAULT_BACKGROUND = {
  type: "gradient",
  value: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
};

function generateSeeds(count = 12, exclude = new Set()) {
  const seeds = new Set();
  while (seeds.size < count) {
    const s = String(Math.floor(Math.random() * 9000) + 1000);
    if (!exclude.has(s)) seeds.add(s);
  }
  return [...seeds];
}

export function createSettingsPanel(container) {
  let newTabBehavior = "meridian-view";
  let groupByDomain = false;
  let homepageUrl = "";
  let currentTheme = "system";
  let currentBg = DEFAULT_BACKGROUND;
  let customBgUrl = null;
  let photoSeeds = generateSeeds();

  const panel = document.createElement("div");

  // Settings are grouped into labeled sections; each control group is
  // appended to one of these rather than straight onto the panel.
  function makeSection(titleText) {
    const section = document.createElement("div");
    section.className = "settings-section";
    const heading = document.createElement("h3");
    heading.className = "settings-section-title";
    heading.textContent = titleText;
    section.appendChild(heading);
    return section;
  }

  const appearanceSection = makeSection("Appearance");
  const searchSection = makeSection("Search");
  const tabsSection = makeSection("Tabs");

  // --- New tab behavior ---
  const newTabGroup = document.createElement("div");
  newTabGroup.className = "settings-group";

  const newTabLabel = document.createElement("span");
  newTabLabel.className = "settings-label";
  newTabLabel.textContent = "New Tab Behavior";
  newTabGroup.appendChild(newTabLabel);

  // Card grid (radiogroup): each option shows a diagram of what happens,
  // replacing the native <select>. Full radio semantics + arrow-key nav.
  const newTabRow = document.createElement("div");
  newTabRow.className = "settings-behavior-grid";
  newTabRow.setAttribute("role", "radiogroup");
  newTabRow.setAttribute("aria-label", "New Tab Behavior");
  newTabGroup.appendChild(newTabRow);

  function renderNewTabCards() {
    newTabRow.innerHTML = "";
    NEW_TAB_OPTIONS.forEach((o, i) => {
      const selected = o.id === newTabBehavior;
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "settings-behavior-card" + (selected ? " selected" : "");
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", selected ? "true" : "false");
      card.tabIndex = selected ? 0 : -1;

      const fig = document.createElement("span");
      fig.className = "settings-behavior-diagram";
      fig.setAttribute("aria-hidden", "true");
      fig.innerHTML = NEW_TAB_DIAGRAMS[o.id] ?? "";
      card.appendChild(fig);

      const cap = document.createElement("span");
      cap.className = "settings-behavior-caption";
      cap.textContent = o.label;
      card.appendChild(cap);

      card.addEventListener("click", () => selectNewTab(o.id));
      card.addEventListener("keydown", (e) => {
        let ni = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown")
          ni = (i + 1) % NEW_TAB_OPTIONS.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
          ni = (i - 1 + NEW_TAB_OPTIONS.length) % NEW_TAB_OPTIONS.length;
        if (ni >= 0) {
          e.preventDefault();
          selectNewTab(NEW_TAB_OPTIONS[ni].id, true);
        }
      });

      newTabRow.appendChild(card);
    });
  }

  function selectNewTab(id, focus) {
    newTabBehavior = id;
    chrome.storage.sync.set({ newTabBehavior: id });
    syncNewTab();
    if (focus) {
      const el = newTabRow.querySelector(".settings-behavior-card.selected");
      if (el) el.focus();
    }
  }

  // Only the "open a specific page" option needs a URL field; it appears
  // beneath the grid when that option is selected.
  const homepageField = document.createElement("div");
  homepageField.className = "settings-homepage-field";

  const homepageInput = document.createElement("input");
  homepageInput.type = "url";
  homepageInput.className = "settings-homepage-input";
  homepageInput.placeholder = "https://example.com";
  homepageInput.setAttribute(
    "aria-describedby",
    "settings-homepage-feedback",
  );

  const homepageFeedback = document.createElement("p");
  homepageFeedback.id = "settings-homepage-feedback";
  homepageFeedback.className = "settings-homepage-feedback";
  homepageFeedback.setAttribute("role", "alert");

  function setHomepageError(message) {
    homepageInput.setCustomValidity(message);
    homepageInput.setAttribute("aria-invalid", String(!!message));
    homepageFeedback.textContent = message;
  }

  homepageInput.addEventListener("change", () => {
    const normalized = normalizeHomepageUrl(homepageInput.value);
    if (normalized == null) {
      setHomepageError("Enter a complete http:// or https:// URL.");
      return;
    }

    setHomepageError("");
    homepageUrl = normalized;
    homepageInput.value = normalized;
    chrome.storage.sync.set({ homepageUrl });
  });
  homepageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") homepageInput.blur();
  });
  homepageField.append(homepageInput, homepageFeedback);
  newTabGroup.appendChild(homepageField);

  function syncNewTab() {
    renderNewTabCards();
    homepageInput.value = homepageUrl;
    homepageField.classList.toggle(
      "hidden",
      newTabBehavior !== "open-homepage",
    );
  }

  tabsSection.appendChild(newTabGroup);

  // --- Group by domain ---
  const domainGroup = document.createElement("div");
  domainGroup.className = "settings-group";

  const domainLabel = document.createElement("span");
  domainLabel.className = "settings-label";
  domainLabel.textContent = "Tab Organization";
  domainGroup.appendChild(domainLabel);

  const toggleRow = document.createElement("label");
  toggleRow.className = "settings-toggle-row";

  const toggleCheckbox = document.createElement("input");
  toggleCheckbox.type = "checkbox";
  toggleCheckbox.className = "settings-toggle";
  toggleCheckbox.setAttribute("aria-label", "Group unsorted tabs by domain");

  const toggleLabel = document.createElement("span");
  toggleLabel.textContent = "Group unsorted tabs by domain";

  toggleCheckbox.addEventListener("change", () => {
    groupByDomain = toggleCheckbox.checked;
    chrome.storage.sync.set({ groupByDomain });
    window.dispatchEvent(new CustomEvent("settings-changed"));
  });

  toggleRow.appendChild(toggleCheckbox);
  toggleRow.appendChild(toggleLabel);
  domainGroup.appendChild(toggleRow);
  tabsSection.appendChild(domainGroup);

  // --- Local Search ---
  const localSearchGroup = document.createElement("div");
  localSearchGroup.className = "settings-group";

  const localSearchLabel = document.createElement("span");
  localSearchLabel.className = "settings-label";
  localSearchLabel.textContent = "Local Search";
  localSearchGroup.appendChild(localSearchLabel);

  let localSearch = { ...DEFAULT_LOCAL_SEARCH };

  const localSearchSources = [
    { key: "tabs", label: "Open Tabs" },
    { key: "bookmarks", label: "Bookmarks", optional: true },
    { key: "history", label: "History", optional: true },
  ];

  const localSearchCheckboxes = {};
  const permissionStatus = document.createElement("p");
  permissionStatus.className = "settings-permission-status";
  permissionStatus.setAttribute("aria-live", "polite");

  for (const source of localSearchSources) {
    const row = document.createElement("label");
    row.className = "settings-toggle-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "settings-toggle";
    checkbox.setAttribute("aria-label", source.label);
    checkbox.checked = localSearch[source.key];

    const label = document.createElement("span");
    label.textContent = source.label;

    checkbox.addEventListener("change", async () => {
      const requested = checkbox.checked;
      checkbox.disabled = true;
      try {
        const result = await setLocalSearchSourceEnabled(
          source.key,
          requested,
        );
        localSearch[source.key] = result.enabled;
        checkbox.checked = result.enabled;
        if (source.optional) {
          permissionStatus.textContent = result.denied
            ? `${source.label} permission was not granted. This source remains off.`
            : `${source.label} access ${result.enabled ? "enabled" : "disabled"}.`;
        }
        window.dispatchEvent(new CustomEvent("settings-changed"));
      } catch {
        checkbox.checked = localSearch[source.key];
        permissionStatus.textContent =
          `Could not update ${source.label.toLowerCase()} access.`;
      } finally {
        checkbox.disabled = false;
      }
    });

    row.appendChild(checkbox);
    row.appendChild(label);
    localSearchGroup.appendChild(row);
    localSearchCheckboxes[source.key] = checkbox;
  }
  localSearchGroup.appendChild(permissionStatus);

  async function syncLocalSearchCheckboxes(savedSources) {
    const enabled = await getEnabledLocalSearchSources(savedSources);
    localSearch = { ...localSearch, ...enabled };
    for (const [key, checkbox] of Object.entries(localSearchCheckboxes)) {
      checkbox.checked = enabled[key];
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.localSearch) return;
    syncLocalSearchCheckboxes(changes.localSearch.newValue);
  });

  // (Appended below, after Search Engine, so the engine picker sits on top.)

  // --- Search Engine ---
  let searchProvider = PROVIDERS[0].id;

  const searchEngineGroup = document.createElement("div");
  searchEngineGroup.className = "settings-group";

  const searchEngineLabel = document.createElement("span");
  searchEngineLabel.className = "settings-label";
  searchEngineLabel.textContent = "Search Engine";
  searchEngineGroup.appendChild(searchEngineLabel);

  // Provider card grid (radiogroup): each card shows the provider's favicon +
  // name — the native <select> couldn't render provider marks.
  const searchEngineRow = document.createElement("div");
  searchEngineRow.className = "settings-provider-grid";
  searchEngineRow.setAttribute("role", "radiogroup");
  searchEngineRow.setAttribute("aria-label", "Search Engine");
  searchEngineGroup.appendChild(searchEngineRow);

  function renderProviderCards() {
    searchEngineRow.innerHTML = "";
    PROVIDERS.forEach((p, i) => {
      const selected = p.id === searchProvider;
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "settings-provider-card" + (selected ? " selected" : "");
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", selected ? "true" : "false");
      card.tabIndex = selected ? 0 : -1;

      const icon = document.createElement("img");
      icon.className = "settings-provider-icon";
      icon.src = p.favicon;
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      icon.loading = "lazy";
      // If a favicon fails to load, hide the broken-image glyph gracefully.
      icon.addEventListener("error", () => {
        icon.classList.add("load-failed");
      });
      card.appendChild(icon);

      const cap = document.createElement("span");
      cap.className = "settings-provider-name";
      cap.textContent = p.name;
      card.appendChild(cap);

      card.addEventListener("click", () => selectProvider(p.id));
      card.addEventListener("keydown", (e) => {
        let ni = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown")
          ni = (i + 1) % PROVIDERS.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
          ni = (i - 1 + PROVIDERS.length) % PROVIDERS.length;
        if (ni >= 0) {
          e.preventDefault();
          selectProvider(PROVIDERS[ni].id, true);
        }
      });

      searchEngineRow.appendChild(card);
    });
  }

  function selectProvider(id, focus) {
    searchProvider = id;
    chrome.storage.sync.set({ searchProvider: id });
    renderProviderCards();
    if (focus) {
      const el = searchEngineRow.querySelector(
        ".settings-provider-card.selected"
      );
      if (el) el.focus();
    }
  }

  // Search Engine on top, then Local Search beneath it.
  searchSection.append(searchEngineGroup, localSearchGroup);

  // --- Theme ---
  const themeGroup = document.createElement("div");
  themeGroup.className = "settings-group";

  const themeLabel = document.createElement("span");
  themeLabel.className = "settings-label";
  themeLabel.textContent = "Theme";
  themeGroup.appendChild(themeLabel);

  const themeRow = document.createElement("div");
  themeRow.className = "settings-theme-row";

  const THEMES = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System" },
  ];

  function renderThemeButtons() {
    themeRow
      .querySelectorAll(".settings-theme-btn")
      .forEach((el) => el.remove());
    for (const t of THEMES) {
      const btn = document.createElement("button");
      btn.className =
        "settings-theme-btn" + (t.id === currentTheme ? " selected" : "");

      const icon = document.createElement("span");
      icon.className = "settings-theme-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = THEME_ICONS[t.id] ?? "";
      btn.appendChild(icon);

      const label = document.createElement("span");
      label.textContent = t.label;
      btn.appendChild(label);

      btn.addEventListener("click", () => {
        currentTheme = t.id;
        chrome.storage.sync.set({ theme: t.id });
        applyTheme(t.id);
        renderThemeButtons();
      });
      themeRow.appendChild(btn);
    }
  }

  themeGroup.appendChild(themeRow);
  appearanceSection.appendChild(themeGroup);

  // --- Background ---
  const bgGroup = document.createElement("div");
  bgGroup.className = "settings-group";

  const bgLabel = document.createElement("span");
  bgLabel.className = "settings-label";
  bgLabel.textContent = "Background";
  bgGroup.appendChild(bgLabel);

  function isSelected(type, value) {
    return currentBg.type === type && currentBg.value === value;
  }

  function selectBg(type, value) {
    currentBg = { type, value };
    chrome.storage.sync.set({ background: currentBg });
    applyBackground(currentBg, customBgUrl);
    applyAccentFromBackground(currentBg, customBgUrl);
    renderBgSection();
  }

  function makeSwatch(opts) {
    const btn = document.createElement("button");
    btn.className =
      "settings-bg-swatch" +
      (opts.isNone ? " settings-bg-swatch--none" : "") +
      (opts.selected ? " selected" : "");
    if (opts.background) {
      btn.style.setProperty("--swatch-background", opts.background);
    }
    if (opts.label) btn.setAttribute("aria-label", opts.label);
    if (opts.label) btn.title = opts.label;
    if (opts.text) btn.textContent = opts.text;
    if (opts.imgSrc) {
      const img = document.createElement("img");
      img.src = opts.imgSrc;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => {
        btn.classList.add("load-failed");
      };
      btn.appendChild(img);
    }
    btn.addEventListener("click", opts.onClick);
    return btn;
  }

  function renderBgSection() {
    bgGroup
      .querySelectorAll(
        ".settings-bg-sublabel-row, .settings-bg-combined-grid, .settings-bg-photo-grid, .settings-bg-upload-btn, .settings-bg-file-input",
      )
      .forEach((el) => el.remove());

    // ── Row label: Colors & Gradients ──
    const colorGradRow = document.createElement("div");
    colorGradRow.className = "settings-bg-sublabel-row";
    const colorGradLabel = document.createElement("span");
    colorGradLabel.className = "settings-bg-sublabel";
    colorGradLabel.textContent = "Colors & Gradients";
    colorGradRow.appendChild(colorGradLabel);
    bgGroup.appendChild(colorGradRow);

    // ── Combined 6-column grid: [None, 5 solids] + [6 gradients] ──
    const combinedGrid = document.createElement("div");
    combinedGrid.className = "settings-bg-combined-grid";

    // None
    combinedGrid.appendChild(
      makeSwatch({
        isNone: true,
        selected: currentBg.type === "none",
        label: "No background",
        onClick: () => selectBg("none", ""),
      }),
    );

    // Solid colors
    for (const c of SOLID_COLORS) {
      combinedGrid.appendChild(
        makeSwatch({
          selected: isSelected("solid", c.value),
          background: c.value,
          label: c.label,
          onClick: () => selectBg("solid", c.value),
        }),
      );
    }

    // Gradients
    for (const g of GRADIENT_PRESETS) {
      combinedGrid.appendChild(
        makeSwatch({
          selected: isSelected("gradient", g.value),
          background: g.value,
          label: g.label,
          onClick: () => selectBg("gradient", g.value),
        }),
      );
    }

    bgGroup.appendChild(combinedGrid);

    // ── Row label: Photos + Refresh ──
    const photoRow = document.createElement("div");
    photoRow.className = "settings-bg-sublabel-row";

    const photoLabel = document.createElement("span");
    photoLabel.className = "settings-bg-sublabel";
    photoLabel.textContent = "Photos";

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "settings-bg-refresh";
    refreshBtn.textContent = "↻ Refresh";
    refreshBtn.addEventListener("click", () => {
      photoSeeds = generateSeeds(12, new Set(photoSeeds));
      renderBgSection();
    });

    photoRow.appendChild(photoLabel);
    photoRow.appendChild(refreshBtn);
    bgGroup.appendChild(photoRow);

    // ── Photo grid: 12 photos (2 rows × 6) ──
    const photoGrid = document.createElement("div");
    photoGrid.className = "settings-bg-photo-grid";

    for (const seed of photoSeeds) {
      const fullUrl = `https://picsum.photos/seed/${seed}/1920/1080`;
      const thumbUrl = `https://picsum.photos/seed/${seed}/200/125`;
      photoGrid.appendChild(
        makeSwatch({
          selected: isSelected("photo", fullUrl),
          label: `Photo ${seed}`,
          imgSrc: thumbUrl,
          onClick: () => selectBg("photo", fullUrl),
        }),
      );
    }

    bgGroup.appendChild(photoGrid);

    // ── Custom image drop zone ──
    const uploadBtn = document.createElement("button");
    uploadBtn.className =
      "settings-bg-upload-btn" +
      (currentBg.type === "custom" ? " selected" : "");
    uploadBtn.textContent =
      currentBg.type === "custom"
        ? "✓ Custom image active — drop or click to replace"
        : "Drop an image here or click to upload";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "settings-bg-file-input";
    async function processCustomImage(file) {
      if (!file) return;
      uploadBtn.classList.remove("drag-over", "upload-error");
      if (!file.type.startsWith("image/")) {
        uploadBtn.classList.add("upload-error");
        uploadBtn.textContent = "Please choose an image file";
        return;
      }
      uploadBtn.disabled = true;
      uploadBtn.textContent = "Processing…";
      try {
        await saveCustomBackground(file);
        customBgUrl = await getCustomBackgroundUrl();
        selectBg("custom", "");
      } catch {
        uploadBtn.classList.add("upload-error");
        uploadBtn.textContent = "Could not save image — try another file";
      } finally {
        uploadBtn.disabled = false;
        fileInput.value = "";
      }
    }

    fileInput.addEventListener("change", () =>
      processCustomImage(fileInput.files?.[0]),
    );
    uploadBtn.addEventListener("click", () => fileInput.click());

    let dragDepth = 0;
    uploadBtn.addEventListener("dragenter", (event) => {
      event.preventDefault();
      if (uploadBtn.disabled) return;
      dragDepth += 1;
      uploadBtn.classList.add("drag-over");
    });
    uploadBtn.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (uploadBtn.disabled) return;
      event.dataTransfer.dropEffect = "copy";
      uploadBtn.classList.add("drag-over");
    });
    uploadBtn.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) uploadBtn.classList.remove("drag-over");
    });
    uploadBtn.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      uploadBtn.classList.remove("drag-over");
      if (uploadBtn.disabled) return;
      processCustomImage(event.dataTransfer.files?.[0]);
    });

    bgGroup.appendChild(fileInput);
    bgGroup.appendChild(uploadBtn);
  }

  appearanceSection.appendChild(bgGroup);

  // --- Refresh thumbnails (a group under Tabs, at the bottom of the panel) ---
  const refreshGroup = document.createElement("div");
  refreshGroup.className = "settings-group";

  const refreshLabel = document.createElement("span");
  refreshLabel.className = "settings-label";
  refreshLabel.textContent = "Thumbnails";
  refreshGroup.appendChild(refreshLabel);

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "settings-action-btn";
  refreshBtn.textContent = "Refresh all thumbnails (this will cycle tabs)";
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing…";
    await chrome.runtime.sendMessage({ type: "REFRESH_THUMBNAILS" });
    refreshBtn.textContent = "Done";
    setTimeout(() => {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh all thumbnails (this will cycle tabs)";
    }, 2000);
  });
  refreshGroup.appendChild(refreshBtn);
  tabsSection.appendChild(refreshGroup);

  // Order the sections: Appearance, Search, Tabs.
  panel.append(appearanceSection, searchSection, tabsSection);

  container.appendChild(panel);

  chrome.storage.sync
    .get([
      "newTabBehavior",
      "groupByDomain",
      "homepageUrl",
      "theme",
      "background",
      "localSearch",
      "searchProvider",
    ])
    .then((saved) => {
      if (saved.newTabBehavior) newTabBehavior = saved.newTabBehavior;
      groupByDomain = !!saved.groupByDomain;
      homepageUrl = saved.homepageUrl ?? "";
      currentTheme = saved.theme ?? "system";
      currentBg = saved.background ?? DEFAULT_BACKGROUND;
      toggleCheckbox.checked = groupByDomain;
      if (currentBg.type === "custom") {
        const background = currentBg;
        const customUrlPromise = getCustomBackgroundUrl();
        applyAccentFromBackground(background, customUrlPromise);
        customUrlPromise.then((url) => {
          customBgUrl = url;
          if (currentBg !== background) return;
          applyBackground(background, customBgUrl);
          renderBgSection();
        });
      }
      if (saved.localSearch) {
        localSearch = { ...localSearch, ...saved.localSearch };
      }
      syncLocalSearchCheckboxes(saved.localSearch);
      if (
        saved.searchProvider &&
        PROVIDERS.some((p) => p.id === saved.searchProvider)
      ) {
        searchProvider = saved.searchProvider;
      }
      syncNewTab();
      renderThemeButtons();
      renderBgSection();
      renderProviderCards();
    });

  syncNewTab();
  renderThemeButtons();
  renderBgSection();
  renderProviderCards();
}

// ── Auto accent: derive the accent hue from the active background ──
// The accent tracks the background's dominant hue; the theme keeps saturation
// and lightness (see meridian.css), and a contrast guard nudges lightness so
// the accent can never collapse into a same-toned solid background.

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Pick the most saturated stop of a gradient/solid — the color that gives
// the background its identity, not the muddy average of all stops.
function dominantHex(str) {
  const hexes = String(str).match(/#[0-9a-f]{6}|#[0-9a-f]{3}/gi);
  if (!hexes || !hexes.length) return null;
  let best = null;
  for (const hx of hexes) {
    const rgb = hexToRgb(hx);
    if (!rgb) continue;
    const hsl = rgbToHsl(...rgb);
    if (!best || hsl.s > best.s) best = hsl;
  }
  return best;
}

// Find an image's dominant *vivid* hue via a saturation-weighted histogram.
// A plain pixel average collapses to gray and throws the real color away.
// Also returns the image's overall luminance (all opaque pixels) so callers
// can decide whether content sitting on it needs light or dark text.
function analyzeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const BINS = 24;
        const weight = new Array(BINS).fill(0);
        const sSum = new Array(BINS).fill(0);
        const lSum = new Array(BINS).fill(0);
        const count = new Array(BINS).fill(0);
        let lumSum = 0;
        let lumN = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue;
          lumSum += relLum(data[i], data[i + 1], data[i + 2]);
          lumN += 1;
          const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          // Skip grays and near black/white — they carry no hue identity.
          if (hsl.s < 18 || hsl.l < 10 || hsl.l > 92) continue;
          const bin = Math.floor((hsl.h / 360) * BINS) % BINS;
          weight[bin] += hsl.s / 100; // vivid pixels weigh more
          sSum[bin] += hsl.s;
          lSum[bin] += hsl.l;
          count[bin] += 1;
        }
        const lum = lumN ? lumSum / lumN : null;
        let top = -1;
        let topW = 0;
        for (let b = 0; b < BINS; b += 1) {
          if (weight[b] > topW) {
            topW = weight[b];
            top = b;
          }
        }
        if (top < 0) return resolve({ dominant: null, lum }); // no vivid pixels
        resolve({
          dominant: {
            h: Math.round(((top + 0.5) / BINS) * 360),
            s: Math.round(sSum[top] / count[top]),
            l: Math.round(lSum[top] / count[top]),
          },
          lum,
        });
      } catch {
        resolve({ dominant: null, lum: null }); // cross-origin taint, etc.
      }
    };
    img.onerror = () => resolve({ dominant: null, lum: null });
    img.src = url;
  });
}

// Average relative luminance across every hex stop in a string.
function averageLumOfHexes(str) {
  const hexes = String(str).match(/#[0-9a-f]{6}|#[0-9a-f]{3}/gi);
  if (!hexes || !hexes.length) return null;
  let sum = 0;
  let n = 0;
  for (const hx of hexes) {
    const rgb = hexToRgb(hx);
    if (!rgb) continue;
    sum += relLum(...rgb);
    n += 1;
  }
  return n ? sum / n : null;
}

// Returns { dominant, lum } for the active background. `lum` is null for the
// "none" background, which follows the theme's --bg (read live at apply time).
async function analyzeBackground(bg, customDataUrl) {
  if (!bg || bg.type === "none") return { dominant: null, lum: null };
  if (bg.type === "solid") {
    const rgb = hexToRgb(bg.value);
    return {
      dominant: rgb ? rgbToHsl(...rgb) : null,
      lum: rgb ? relLum(...rgb) : null,
    };
  }
  if (bg.type === "gradient") {
    return { dominant: dominantHex(bg.value), lum: averageLumOfHexes(bg.value) };
  }
  if (bg.type === "photo") return analyzeImage(bg.value);
  if (bg.type === "custom") {
    return customDataUrl
      ? analyzeImage(customDataUrl)
      : { dominant: null, lum: null };
  }
  return { dominant: null, lum: null };
}

// ── Color math for the surface-contrast solver ──
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function relLum(r, g, b) {
  const a = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// Luminance of the actual --surface the accent renders on (cards, panels).
function surfaceLum() {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--surface")
    .trim();
  const rgb = hexToRgb(v);
  if (rgb) return relLum(...rgb);
  return docIsDark() ? 0.035 : 1;
}

// Derived accents run a touch under full saturation — neon reads cheap.
const ACCENT_SAT = 80;

// Last resolved dominant + background luminance, cached so a theme switch can
// re-run the solver and re-pick on-background text without re-sampling.
let lastDominant = null;
let lastBgLum = null;
let accentGeneration = 0;

function docIsDark() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDerivedAccent(dominant) {
  const root = document.documentElement;
  // Grayscale / very desaturated → no meaningful hue; use the default.
  if (!dominant || dominant.s < 12) {
    root.style.removeProperty("--accent-hue");
    root.style.removeProperty("--accent-sat");
    root.style.removeProperty("--accent-light");
    return;
  }

  // Solve for a lightness that clears a legible contrast against the SURFACE
  // (where the accent actually lives), searching in the safe direction and
  // staying inside a tasteful band so filled-accent glyphs stay readable too.
  const hue = dominant.h;
  const dark = docIsDark();
  const surf = surfaceLum();
  const target = 3.5;
  const floor = dark ? 48 : 30;
  const ceil = dark ? 70 : 50;
  let l = dark ? 58 : 44;
  const step = dark ? 2 : -2;
  for (let i = 0; i < 40; i += 1) {
    const [r, g, b] = hslToRgb(hue, ACCENT_SAT, l);
    if (contrastRatio(relLum(r, g, b), surf) >= target) break;
    l += step;
    if (l <= floor) {
      l = floor;
      break;
    }
    if (l >= ceil) {
      l = ceil;
      break;
    }
  }

  root.style.setProperty("--accent-hue", String(hue));
  root.style.setProperty("--accent-sat", `${ACCENT_SAT}%`);
  root.style.setProperty("--accent-light", `${l}%`);
}

// Content that sits directly on the background (lane headers) can't rely on the
// theme's text color — the wallpaper may be light or dark regardless of theme.
// Pick light or dark on-background text from the background's own luminance,
// plus a contrasting text-shadow scrim so it survives busy photos.
function applyOnBackground(lum) {
  const root = document.documentElement;
  let L = lum;
  if (L == null) {
    // "none" background follows the theme's --bg — read it live.
    const v = getComputedStyle(root).getPropertyValue("--bg").trim();
    const rgb = hexToRgb(v);
    L = rgb ? relLum(...rgb) : docIsDark() ? 0.02 : 0.9;
  }
  if (L < 0.4) {
    // Dark background → light text.
    root.style.setProperty("--on-bg", "rgba(255, 255, 255, 0.95)");
    root.style.setProperty("--on-bg-muted", "rgba(255, 255, 255, 0.72)");
    root.style.setProperty("--on-bg-shadow", "0 1px 3px rgba(0, 0, 0, 0.55)");
  } else {
    // Light background → dark text.
    root.style.setProperty("--on-bg", "rgba(0, 0, 0, 0.9)");
    root.style.setProperty("--on-bg-muted", "rgba(0, 0, 0, 0.6)");
    root.style.setProperty("--on-bg-shadow", "0 1px 2px rgba(255, 255, 255, 0.4)");
  }
}

export async function applyAccentFromBackground(bg, customDataUrl = null) {
  const generation = ++accentGeneration;
  const resolvedCustomDataUrl = await customDataUrl;
  if (generation !== accentGeneration) return;

  const { dominant, lum } = await analyzeBackground(bg, resolvedCustomDataUrl);
  if (generation !== accentGeneration) return;

  lastDominant = dominant;
  lastBgLum = lum;
  applyDerivedAccent(dominant);
  applyOnBackground(lum);
}

export function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === "light") {
    html.dataset.theme = "light";
  } else if (theme === "dark") {
    html.dataset.theme = "dark";
  } else {
    delete html.dataset.theme;
  }
  // Both the accent solver and the on-background text depend on the theme
  // (surface + the "none" background follow it) — re-run them on switch.
  applyDerivedAccent(lastDominant);
  applyOnBackground(lastBgLum);
}

export function applyBackground(bg, customDataUrl = null) {
  const root = document.documentElement;
  root.style.removeProperty("--bg");
  if (!bg || bg.type === "none") {
    root.style.removeProperty("--bg-image");
  } else if (bg.type === "solid") {
    root.style.removeProperty("--bg-image");
    root.style.setProperty("--bg", bg.value);
  } else if (bg.type === "gradient") {
    root.style.setProperty("--bg-image", bg.value);
  } else if (bg.type === "photo") {
    root.style.setProperty("--bg-image", `url("${bg.value}")`);
  } else if (bg.type === "custom") {
    if (customDataUrl) {
      root.style.setProperty("--bg-image", `url("${customDataUrl}")`);
    } else {
      root.style.removeProperty("--bg-image");
    }
  }
}
