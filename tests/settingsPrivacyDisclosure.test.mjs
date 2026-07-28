import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PRIVACY_POLICY_URL } from "../components/SettingsPanel.js";

const source = await readFile(
  new URL("../components/SettingsPanel.js", import.meta.url),
  "utf8",
);

// SettingsPanel.js builds the whole panel in one large function with real
// chrome.* side effects wired throughout. Rather than stub the entire panel,
// extract just the self-contained "Privacy & Data disclosure" block (a plain
// document.createElement tree with no chrome.* calls) and run it against a
// minimal fake DOM — the same approach tests/settingsPopupRace.test.mjs uses
// for isolating a function out of meridian.js.
function extractBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Could not find ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Could not find ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

function fakeElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    className: "",
    textContent: "",
    children: [],
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
  };
}

function renderPrivacyGroup() {
  const block = extractBlock(
    'const privacyGroup = document.createElement("div");',
    "privacySection.appendChild(privacyGroup);",
  );

  const fakeDocument = {
    createElement: (tag) => fakeElement(tag),
  };
  const privacySection = {
    appendChild(node) {
      this.child = node;
    },
  };

  const run = new Function(
    "document",
    "privacySection",
    "PRIVACY_POLICY_URL",
    `${block}\nreturn privacySection.child;`,
  );

  return run(fakeDocument, privacySection, PRIVACY_POLICY_URL);
}

test("the privacy disclosure explains automatic thumbnail capture and metadata indexing", () => {
  const group = renderPrivacyGroup();
  const text = group.children
    .filter((child) => child.tagName === "P")
    .map((p) => p.textContent)
    .join(" ");

  assert.match(text, /automatically captures a screenshot/i);
  assert.match(text, /live thumbnails/i);
  assert.match(text, /meta description/i);
  assert.match(text, /heading \(H1\/H2\)/i);
  assert.match(text, /open-tab search/i);
});

test("the privacy disclosure states data stays local and names the feature controls", () => {
  const group = renderPrivacyGroup();
  const text = group.children
    .filter((child) => child.tagName === "P")
    .map((p) => p.textContent)
    .join(" ");

  assert.match(text, /stored locally/i);
  assert.match(text, /no server/i);
  assert.match(text, /never uploads/i);
  assert.match(text, /Search options/);
  assert.match(text, /Thumbnails/);
});

test("the privacy disclosure does not imply bookmark/history access is automatic", () => {
  const group = renderPrivacyGroup();
  const text = group.children
    .filter((child) => child.tagName === "P")
    .map((p) => p.textContent)
    .join(" ");

  assert.match(text, /never automatic/i);
  assert.match(text, /only asks Chrome for that permission when you turn on/i);
});

test("the privacy disclosure links to the full privacy policy as a real, focusable link", () => {
  const group = renderPrivacyGroup();
  const link = group.children.find((child) => child.tagName === "A");

  assert.ok(link, "expected an <a> element linking to the privacy policy");
  assert.equal(link.href, PRIVACY_POLICY_URL);
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.match(link.textContent, /privacy policy/i);
  // A native <a href> is keyboard-focusable and reachable by screen readers
  // in normal document order without any extra ARIA wiring.
});

test("the disclosure is a native collapsed details section at the bottom of settings", () => {
  assert.match(
    source,
    /const privacySection = document\.createElement\("details"\);/,
  );
  assert.match(
    source,
    /const privacySummary = document\.createElement\("summary"\);/,
  );
  assert.match(
    source,
    /privacySummary\.textContent = "Privacy & Data";/,
  );
  // The Emberstone credit footer sits between Tabs and Privacy, but Privacy
  // & Data remains the last thing appended to the panel.
  assert.match(
    source,
    /panel\.append\(\s*appearanceSection,\s*searchSection,\s*tabsSection,\s*emberstoneFooter,\s*privacySection,?\s*\);/,
  );
  assert.doesNotMatch(source, /privacySection\.open\s*=\s*true/);
});
