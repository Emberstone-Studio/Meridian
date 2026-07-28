import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../components/SettingsPanel.js", import.meta.url),
  "utf8",
);

// Like tests/settingsPrivacyDisclosure.test.mjs, the Emberstone footer is a
// self-contained document.createElement tree with no chrome.* side effects, so
// we extract just that block and run it against a minimal fake DOM rather than
// booting the whole panel.
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
    attributes: {},
    children: [],
    classList: {
      _set: new Set(),
      add(name) {
        this._set.add(name);
      },
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener() {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
  };
}

function renderFooter() {
  const block = extractBlock(
    'const emberstoneFooter = document.createElement("div");',
    "emberstoneFooter.append(emberstoneLinks);",
  );

  const fakeDocument = {
    createElement: (tag) => fakeElement(tag),
  };

  const run = new Function(
    "document",
    `${block}\nreturn emberstoneFooter;`,
  );

  return run(fakeDocument);
}

function descendants(node, out = []) {
  for (const child of node.children ?? []) {
    out.push(child);
    descendants(child, out);
  }
  return out;
}

test("the footer renders two side-by-side links, each with an icon", () => {
  const footer = renderFooter();
  const all = descendants(footer);

  const links = all.filter((n) => n.tagName === "A");
  assert.equal(links.length, 2, "expected exactly two footer links");

  // No standalone credit paragraph or large logo — just the two buttons.
  assert.equal(
    all.some((n) => n.tagName === "P"),
    false,
    "did not expect a separate credit paragraph",
  );

  const site = links.find((l) => /emberstone-studio\.com/.test(l.href));
  assert.ok(site, "expected a link to the studio site");
  const siteLogo = site.children.find((n) => n.tagName === "IMG");
  assert.ok(siteLogo, "expected the studio brand mark inside the site link");
  // Root-relative, matching img/aurora.webp and the icon assets.
  assert.equal(siteLogo.src, "img/emberstone.svg");
  // Decorative image (the adjacent label names the studio) — hidden from AT.
  assert.equal(siteLogo.alt, "");
  assert.equal(siteLogo.attributes["aria-hidden"], "true");

  const coffee = links.find((l) => /ko-fi\.com/.test(l.href));
  assert.ok(coffee, "expected a Ko-fi link");
  const coffeeIcon = coffee.children.find(
    (n) => n.tagName === "SPAN" && n.attributes["aria-hidden"] === "true",
  );
  assert.ok(coffeeIcon, "expected an inline coffee icon inside the Ko-fi link");
});

test("the footer exposes both outbound links safely in a new tab", () => {
  const footer = renderFooter();
  const links = descendants(footer).filter((n) => n.tagName === "A");

  assert.equal(links.length, 2, "expected exactly two footer links");

  for (const link of links) {
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noopener noreferrer");
    // Styled as icon-above-label cards, matching the Theme/Search Engine
    // button idiom, via the dedicated .settings-emberstone-link class.
    assert.match(link.className, /settings-emberstone-link/);
  }

  const site = links.find((l) => /emberstone-studio\.com/.test(l.href));
  assert.ok(site, "expected a link to the studio site");
  assert.equal(site.href, "https://emberstone-studio.com");
  const siteLabel = site.children.find((n) => n.tagName === "SPAN");
  assert.match(siteLabel.textContent, /Emberstone Studio/i);

  const coffee = links.find((l) => /ko-fi\.com/.test(l.href));
  assert.ok(coffee, "expected a Ko-fi link");
  assert.equal(coffee.href, "https://ko-fi.com/emberstonestudio");
  const coffeeLabel = coffee.children.find(
    (n) => n.tagName === "SPAN" && !n.attributes["aria-hidden"],
  );
  assert.match(coffeeLabel.textContent, /coffee/i);
});

test("the footer is placed directly above the Privacy & Data disclosure", () => {
  // The panel appends the footer immediately before privacySection so it reads
  // as the last thing above the collapsed Privacy accordion.
  assert.match(
    source,
    /panel\.append\(\s*appearanceSection,\s*searchSection,\s*tabsSection,\s*emberstoneFooter,\s*privacySection,?\s*\)/,
  );
});

test("the studio logo asset resolves in both the source and packaged trees", async () => {
  await access(new URL("../img/emberstone.svg", import.meta.url));
  await access(
    new URL("../meridian-extension/img/emberstone.svg", import.meta.url),
  );
});

test("the Emberstone footer is mirrored into the packaged component", async () => {
  const packaged = await readFile(
    new URL("../meridian-extension/components/SettingsPanel.js", import.meta.url),
    "utf8",
  );
  assert.match(packaged, /settings-emberstone/);
  assert.match(packaged, /ko-fi\.com\/emberstonestudio/);
});
