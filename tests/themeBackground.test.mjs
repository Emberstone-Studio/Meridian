import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the default background follows the effective theme with adjustable photo effects", async () => {
  const properties = new Map();
  globalThis.document = {
    documentElement: {
      dataset: {},
      style: {
        setProperty(name, value) {
          properties.set(name, value);
        },
        removeProperty(name) {
          properties.delete(name);
        },
      },
    },
  };
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
  };

  const {
    DEFAULT_BACKGROUND,
    applyAccentFromBackground,
    applyBackground,
    applyPhotoAdjustments,
    applyTheme,
  } = await import("../components/SettingsPanel.js?case=theme-background");

  assert.deepEqual(DEFAULT_BACKGROUND, { type: "theme", value: "topo" });

  applyBackground(DEFAULT_BACKGROUND);
  applyPhotoAdjustments(DEFAULT_BACKGROUND);

  assert.equal(properties.get("--bg-image"), "var(--default-bg-image)");
  assert.equal(properties.get("--photo-opacity"), "1");
  assert.equal(properties.get("--photo-blur"), "0px");
  assert.equal(properties.get("--photo-fade-color"), "var(--photo-fade-bw)");

  applyPhotoAdjustments(DEFAULT_BACKGROUND, {
    transparency: 75,
    blur: 12,
    fade: "accent",
  });
  await applyAccentFromBackground(DEFAULT_BACKGROUND);

  assert.equal(properties.get("--photo-opacity"), "0.25");
  assert.equal(properties.get("--photo-blur"), "12px");
  assert.equal(properties.get("--photo-fade-color"), "var(--accent)");

  applyTheme("dark");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(properties.has("--on-bg"), false);

  applyTheme("light");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(properties.has("--on-bg"), false);

  applyTheme("system");
  assert.equal("theme" in document.documentElement.dataset, false);
  assert.equal(properties.has("--on-bg"), false);
});

test("light and dark topo assets ship in both runtime trees", async () => {
  const css = await readFile(new URL("../meridian.css", import.meta.url), "utf8");
  assert.match(css, /--default-bg-image: url\("img\/topo-light\.webp"\)/);
  assert.match(css, /--default-bg-image: url\("img\/topo-dark\.webp"\)/);
  assert.doesNotMatch(css, /train\.webp/);

  await Promise.all(
    ["topo-light.webp", "topo-dark.webp"].flatMap((name) => [
      access(new URL(`../img/${name}`, import.meta.url)),
      access(new URL(`../meridian-extension/img/${name}`, import.meta.url)),
    ]),
  );
});
