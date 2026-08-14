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

test("static manifest icons carry their own contrast and match the package", async () => {
  const sourceSvg = await readFile(
    new URL("../img/icon-source.svg", import.meta.url),
    "utf8",
  );
  // Brand mint disc with the counter filled in brand ink. The fill matters less
  // than the relationship: the M is 7.95:1 against the disc, so the mark stays
  // legible without knowing what it is composited over. A knockout would make
  // the counter transparent and drop to 1.67:1 on a light backdrop.
  assert.match(sourceSvg, /<circle[^>]+fill="#2ed8b0"/);
  assert.match(sourceSvg, /stroke="#0d2f28"/);
  assert.doesNotMatch(
    sourceSvg,
    /mask=/,
    "manifest icons must not knock the counter out",
  );

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

// These two failure modes are both silent, which is why they get a test rather
// than a comment. A malformed favicon does not render as broken — Chrome quietly
// keeps the previously cached icon, so a shipped-but-invalid file is
// indistinguishable from one that never shipped.
test("shipped icon SVGs are well-formed XML", async () => {
  for (const name of ["favicon.svg", "icon-source.svg", "Meridian.svg"]) {
    for (const directory of ["..", "../meridian-extension"]) {
      const svg = await readFile(
        new URL(`${directory}/img/${name}`, import.meta.url),
        "utf8",
      );
      // XML forbids a doubled hyphen inside a comment, so a CSS custom property
      // named in prose ("--brand-ink") silently invalidates the whole file.
      const comments = svg.match(/<!--[\s\S]*?-->/g) ?? [];
      for (const comment of comments) {
        assert.doesNotMatch(
          comment.slice(4, -3),
          /--/,
          `${directory}/img/${name}: doubled hyphen inside an XML comment`,
        );
      }
    }
  }
});

test("the toolbar mark stays rewritable by recolorToolbarSvg", async () => {
  const markUrl = new URL("../img/Meridian.svg", import.meta.url);
  const mark = await readFile(markUrl, "utf8");

  // recolorToolbarSvg rewrites the FIRST <svg ...> in the document, so a comment
  // mentioning an SVG open tag would hijack the rewrite and leave the real root
  // fill untouched — a near-black icon on dark chrome.
  assert.doesNotMatch(mark, /<!--[\s\S]*<svg[\s\S]*?-->/);

  for (const [isDark, expected] of [
    [false, "#1c1c1e"],
    [true, "#f5f5f7"],
  ]) {
    const root = recolorToolbarSvg(mark, isDark).match(/<svg[^>]*>/)[0];
    assert.match(root, new RegExp(`fill="${expected}"`));
    assert.equal(
      (root.match(/fill=/g) ?? []).length,
      1,
      "the root must carry exactly one fill for the rewrite to be unambiguous",
    );
  }
});
