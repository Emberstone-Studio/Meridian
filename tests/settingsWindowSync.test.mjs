import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createChromeStorage,
  deferred,
  extractFunction,
  extractStorageListener,
  flushAsyncWork,
} from "./runtimeHarness.mjs";

const [settingsSource, meridianSource] = await Promise.all([
  readFile(new URL("../components/SettingsPanel.js", import.meta.url), "utf8"),
  readFile(new URL("../meridian.js", import.meta.url), "utf8"),
]);

const DEFAULT_BACKGROUND = { type: "theme", value: "topo" };
const CUSTOM_BACKGROUND_REVISION_KEY = "customBackgroundRevision";

function createSettingsWindow(chrome, overrides = {}) {
  const controls = {
    newTabBehavior: { value: null, renders: 0 },
    homepageUrl: { value: null },
    groupByDomain: { checked: false },
    showTabsFromAllWindows: { checked: true },
    theme: { value: null, renders: 0 },
    background: { value: null, photoAdjust: null, customUrl: null, renders: 0 },
    localSearch: { value: null },
    searchProvider: { value: null, renders: 0 },
  };
  const appliedBackgrounds = [];
  const appliedAccents = [];
  const refreshCustomBackgroundUrl =
    overrides.refreshCustomBackgroundUrl ?? (async () => null);

  const build = new Function(
    "chrome",
    "controls",
    "appliedBackgrounds",
    "appliedAccents",
    "refreshCustomBackgroundUrl",
    "CUSTOM_BACKGROUND_REVISION_KEY",
    "DEFAULT_BACKGROUND",
    `
      let newTabBehavior = "meridian-view";
      let groupByDomain = false;
      let showTabsFromAllWindows = true;
      let homepageUrl = "";
      let currentTheme = "system";
      let currentBg = DEFAULT_BACKGROUND;
      let customBgUrl = null;
      let customBackgroundGeneration = 0;
      let photoAdjust = {};
      let searchProvider = "google";
      const toggleCheckbox = controls.groupByDomain;
      const windowToggleCheckbox = controls.showTabsFromAllWindows;
      const PROVIDERS = [{ id: "google" }, { id: "duckduckgo" }];

      function syncNewTab() {
        controls.newTabBehavior.value = newTabBehavior;
        controls.newTabBehavior.renders += 1;
        controls.homepageUrl.value = homepageUrl;
      }
      function renderThemeButtons() {
        controls.theme.value = currentTheme;
        controls.theme.renders += 1;
      }
      function renderBgSection() {
        controls.background.value = currentBg;
        controls.background.photoAdjust = photoAdjust;
        controls.background.customUrl = customBgUrl;
        controls.background.renders += 1;
      }
      function syncLocalSearchCheckboxes(value) {
        controls.localSearch.value = value;
      }
      function renderProviderCards() {
        controls.searchProvider.value = searchProvider;
        controls.searchProvider.renders += 1;
      }
      function initialPhotoAdjust(_background, value) {
        return { transparency: 0, blur: 0, fade: "bw", ...(value ?? {}) };
      }
      function applyBackground(background, url) {
        appliedBackgrounds.push({ background, url });
      }
      function applyAccentFromBackground(background, url) {
        appliedAccents.push({ background, url });
      }

      chrome.storage.onChanged.addListener(${extractStorageListener(settingsSource)});
    `,
  );

  build(
    chrome,
    controls,
    appliedBackgrounds,
    appliedAccents,
    refreshCustomBackgroundUrl,
    CUSTOM_BACKGROUND_REVISION_KEY,
    DEFAULT_BACKGROUND,
  );
  return { controls, appliedBackgrounds, appliedAccents };
}

function createAppearanceWindow(chrome, overrides = {}) {
  const calls = {
    themes: [],
    accents: [],
    backgrounds: [],
    photoAdjustments: [],
    customRefreshes: [],
  };

  const build = new Function(
    "chrome",
    "calls",
    "getCustomBackgroundUrl",
    "refreshCustomBackgroundUrl",
    "CUSTOM_BACKGROUND_REVISION_KEY",
    "DEFAULT_BACKGROUND",
    `
      let appearanceGeneration = 0;
      const searchBarApi = { getScope: () => "all", setScope: () => {} };
      const applyTheme = (theme) => calls.themes.push(theme);
      const applyAccentFromBackground = (background, url) =>
        calls.accents.push({ background, url });
      const applyBackground = (background, url) =>
        calls.backgrounds.push({ background, url });
      const applyPhotoAdjustments = (background, adjust) =>
        calls.photoAdjustments.push({ background, adjust });
      const initialPhotoAdjust = (_background, adjust) => adjust ?? {};
      const clearBrowserSearch = () => {};
      const syncScopeButtons = () => {};
      const scheduleRender = () => {};

      ${extractFunction(meridianSource, "async function applyStoredAppearance(")}
      chrome.storage.onChanged.addListener(${extractStorageListener(meridianSource)});
      return { applyStoredAppearance };
    `,
  );

  return {
    calls,
    ...build(
      chrome,
      calls,
      overrides.getCustomBackgroundUrl ?? (async () => null),
      (revision) => {
        calls.customRefreshes.push(revision);
        return (overrides.refreshCustomBackgroundUrl ?? (async () => null))(
          revision,
        );
      },
      CUSTOM_BACKGROUND_REVISION_KEY,
      DEFAULT_BACKGROUND,
    ),
  };
}

test("changes from one context update another window's controls and appearance", async () => {
  const { chrome } = createChromeStorage();
  const settingsWindow = createSettingsWindow(chrome);
  const appearanceWindow = createAppearanceWindow(chrome);
  const background = { type: "solid", value: "#123456" };
  const photoAdjust = { transparency: 25, blur: 4, fade: "accent" };
  const localSearch = { tabs: true, bookmarks: true, history: false };

  await chrome.storage.sync.set({
    newTabBehavior: "open-homepage",
    homepageUrl: "https://example.test/",
    groupByDomain: true,
    showTabsFromAllWindows: false,
    theme: "dark",
    background,
    photoAdjust,
    localSearch,
    searchProvider: "duckduckgo",
  });
  await flushAsyncWork();

  assert.equal(settingsWindow.controls.newTabBehavior.value, "open-homepage");
  assert.equal(
    settingsWindow.controls.homepageUrl.value,
    "https://example.test/",
  );
  assert.equal(settingsWindow.controls.groupByDomain.checked, true);
  assert.equal(settingsWindow.controls.showTabsFromAllWindows.checked, false);
  assert.equal(settingsWindow.controls.theme.value, "dark");
  assert.deepEqual(settingsWindow.controls.background.value, background);
  assert.deepEqual(settingsWindow.controls.background.photoAdjust, photoAdjust);
  assert.deepEqual(settingsWindow.controls.localSearch.value, localSearch);
  assert.equal(settingsWindow.controls.searchProvider.value, "duckduckgo");

  assert.equal(appearanceWindow.calls.themes.at(-1), "dark");
  assert.deepEqual(appearanceWindow.calls.backgrounds.at(-1), {
    background,
    url: null,
  });
  assert.deepEqual(appearanceWindow.calls.photoAdjustments.at(-1), {
    background,
    adjust: photoAdjust,
  });
});

test("custom image upload and deletion revisions invalidate every open window", async () => {
  const { chrome, emit } = createChromeStorage({
    sync: { background: { type: "custom", value: "" } },
  });
  const urls = new Map([
    ["upload-revision", "blob:uploaded"],
    ["delete-revision", null],
  ]);
  let activeUrl = null;
  const refreshCustomBackgroundUrl = async (revision) => {
    activeUrl = urls.get(revision);
    return activeUrl;
  };
  const settingsWindow = createSettingsWindow(chrome, {
    refreshCustomBackgroundUrl,
  });
  const appearanceWindow = createAppearanceWindow(chrome, {
    refreshCustomBackgroundUrl,
    getCustomBackgroundUrl: async () => activeUrl,
  });

  await chrome.storage.sync.set({ background: { type: "custom", value: "" } });
  await flushAsyncWork();
  settingsWindow.appliedBackgrounds.length = 0;
  appearanceWindow.calls.backgrounds.length = 0;

  emit("local", {
    [CUSTOM_BACKGROUND_REVISION_KEY]: { newValue: "upload-revision" },
  });
  await flushAsyncWork();

  assert.equal(settingsWindow.controls.background.customUrl, "blob:uploaded");
  assert.equal(settingsWindow.appliedBackgrounds.at(-1).url, "blob:uploaded");
  assert.equal(appearanceWindow.calls.backgrounds.at(-1).url, "blob:uploaded");

  emit("local", {
    [CUSTOM_BACKGROUND_REVISION_KEY]: { newValue: "delete-revision" },
  });
  await flushAsyncWork();

  assert.equal(settingsWindow.controls.background.customUrl, null);
  assert.equal(settingsWindow.appliedBackgrounds.at(-1).url, null);
  assert.equal(appearanceWindow.calls.backgrounds.at(-1).url, null);
  assert.deepEqual(appearanceWindow.calls.customRefreshes, [
    "upload-revision",
    "delete-revision",
  ]);
});

test("newer theme and background state wins when older async work finishes last", async () => {
  const listeners = [];
  const reads = [];
  const chrome = {
    storage: {
      sync: {
        get() {
          const request = deferred();
          reads.push(request);
          return request.promise;
        },
      },
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
    },
  };
  const oldCustomUrl = deferred();
  const window = createAppearanceWindow(chrome, {
    getCustomBackgroundUrl: () => oldCustomUrl.promise,
  });
  const oldBackground = { type: "custom", value: "" };
  const newBackground = { type: "solid", value: "#abcdef" };

  listeners[0](
    {
      theme: { newValue: "dark" },
      background: { newValue: oldBackground },
    },
    "sync",
  );
  reads[0].resolve({ theme: "dark", background: oldBackground });
  await flushAsyncWork();

  listeners[0](
    {
      theme: { newValue: "light" },
      background: { newValue: newBackground },
    },
    "sync",
  );
  reads[1].resolve({ theme: "light", background: newBackground });
  await flushAsyncWork();
  oldCustomUrl.resolve("blob:stale");
  await flushAsyncWork();

  assert.equal(window.calls.themes.at(-1), "light");
  assert.deepEqual(window.calls.backgrounds, [
    { background: newBackground, url: null },
  ]);
  assert.deepEqual(window.calls.photoAdjustments, [
    { background: newBackground, adjust: {} },
  ]);
});
