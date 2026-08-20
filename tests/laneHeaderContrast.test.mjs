import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../meridian.css", import.meta.url), "utf8");
const workspaceLane = await readFile(
  new URL("../components/WorkspaceLane.js", import.meta.url),
  "utf8",
);

function ruleFor(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const end = css.indexOf("}", start);
  return css.slice(start, end + 1);
}

test("lane headers have no local scrim or isolated stacking context", () => {
  const header = ruleFor(".lane-header");
  assert.doesNotMatch(header, /--on-bg|position:|isolation:/);
  assert.doesNotMatch(css, /\.lane-header::before/);
});

test("resting lane-header controls invert the pixels directly beneath them", () => {
  for (const selector of [
    ".lane-title",
    ".lane-tab-count",
    ".lane-delete-btn",
    ".lane-collapse-btn",
  ]) {
    const rule = ruleFor(selector);
    assert.match(rule, /color: #fff;/, selector);
    assert.match(rule, /mix-blend-mode: difference;/, selector);
  }

  assert.match(ruleFor(".lane-tab-count"), /opacity: 0\.85;/);
  assert.match(workspaceLane, /<svg[^>]*stroke="currentColor"/);
});

test("surface-backed interaction states opt out of inverse blending", () => {
  for (const selector of [
    ".lane-title:focus",
    ".lane-title--editable:hover",
    ".lane-collapse-btn:hover",
    ".lane-delete-btn:hover",
  ]) {
    assert.match(ruleFor(selector), /mix-blend-mode: normal;/, selector);
  }
});
