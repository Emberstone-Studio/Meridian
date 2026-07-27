import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { recolorToolbarSvg } from "../utils/toolbarIcon.js";

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path /></svg>';

test("toolbar SVG uses explicit contrasting colors for both browser modes", () => {
  assert.match(recolorToolbarSvg(svg, false), /fill="#1c1c1e"/);
  assert.match(recolorToolbarSvg(svg, true), /fill="#f5f5f7"/);
});

test("Meridian and the side panel both initialize adaptive toolbar icons", async () => {
  for (const path of [
    "../meridian.js",
    "../components/sidebar.js",
    "../meridian-extension/meridian.js",
    "../meridian-extension/components/sidebar.js",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /watchToolbarIconTheme\(\)/, path);
  }
});

test("the side panel uses a dashboard grid icon for the full Meridian view", async () => {
  for (const directory of ["..", "../meridian-extension"]) {
    const [html, css, script] = await Promise.all([
      readFile(
        new URL(`${directory}/components/sidebar.html`, import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(`${directory}/components/sidebar.css`, import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(`${directory}/components/sidebar.js`, import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(html, /aria-label="Open Meridian dashboard"/);
    assert.match(html, /<svg[\s\S]*id="sidebar-logo"/);
    assert.equal(
      (html.match(/<rect /g) ?? []).length,
      4,
      `${directory} should render a four-box grid`,
    );
    assert.match(css, /#sidebar-logo\s*{/);
    assert.doesNotMatch(css, /#sidebar-logo[\s\S]{0,120}filter:/);
    assert.doesNotMatch(script, /sidebar-logo['"]\)\.src/);
  }
});

test("static manifest icons use a dual-contrast source and match the package", async () => {
  const sourceSvg = await readFile(
    new URL("../img/icon-source.svg", import.meta.url),
    "utf8",
  );
  assert.match(sourceSvg, /<circle[^>]+fill="#f5f5f7"/);
  assert.match(sourceSvg, /<g fill="#1c1c1e"/);

  for (const size of [16, 32, 48, 128]) {
    const [sourceIcon, packagedIcon] = await Promise.all([
      readFile(new URL(`../img/icon${size}.png`, import.meta.url)),
      readFile(
        new URL(
          `../meridian-extension/img/icon${size}.png`,
          import.meta.url,
        ),
      ),
    ]);
    assert.deepEqual(packagedIcon, sourceIcon, `icon${size}.png`);
  }
});
