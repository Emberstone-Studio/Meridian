import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { recolorToolbarSvg } from "../utils/toolbarIcon.js";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  '<circle cx="64" cy="64" r="52" fill="#2ed8b0"/>' +
  '<path stroke="#0d2f28" /></svg>';

// One action icon serves the toolbar AND the extensions overflow menu, so the
// mark stays in the brand hue for both and only shifts lightness to survive a
// light toolbar. A monochrome result here would be a white mark in the menu.
test("the toolbar mark keeps the brand hue and adapts lightness per scheme", () => {
  assert.match(recolorToolbarSvg(svg, false), /fill="#198a70"/);
  assert.match(recolorToolbarSvg(svg, true), /fill="#2ed8b0"/);

  for (const isDark of [false, true]) {
    assert.match(
      recolorToolbarSvg(svg, isDark),
      /stroke="#0d2f28"/,
      "the ink counter is never recoloured",
    );
  }
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
  for (const name of ["favicon.svg", "icon-source.svg"]) {
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

// The toolbar renders the same master the manifest PNGs do, so a change to that
// artwork's disc fill silently stops the per-scheme rewrite from matching and
// ships a mint icon onto light chrome at 1.67:1. Pin the contract.
test("the shipped master stays rewritable by recolorToolbarSvg", async () => {
  for (const directory of ["..", "../meridian-extension"]) {
    const mark = await readFile(
      new URL(`${directory}/img/icon-source.svg`, import.meta.url),
      "utf8",
    );

    for (const [isDark, expected] of [
      [false, "#198a70"],
      [true, "#2ed8b0"],
    ]) {
      const recoloured = recolorToolbarSvg(mark, isDark);
      const circle = recoloured.match(/<circle[^>]*>/)[0];
      assert.match(circle, new RegExp(`fill="${expected}"`), directory);
      assert.doesNotMatch(
        recoloured,
        /<!--/,
        "comments are stripped so prose cannot capture the rewrite",
      );
    }
  }
});
