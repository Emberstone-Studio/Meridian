import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test${path}`,
  },
};

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.attributes = {};
    this.listeners = {};
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  replaceWith(replacement) {
    this.replacement = replacement;
  }
}

globalThis.document = {
  createElement: (tagName) => new FakeElement(tagName),
};

const { createFavicon, faviconUrl } = await import("../utils/favicon.js");

const pageUrls = {
  tab: "https://tabs.example/dashboard",
  bookmark: "https://bookmarks.example/saved",
  history: "https://history.example/visited",
};

test("tabs, bookmarks, and history use Chrome's packaged favicon endpoint", () => {
  for (const [source, pageUrl] of Object.entries(pageUrls)) {
    const result = new URL(faviconUrl(pageUrl));
    assert.equal(result.protocol, "chrome-extension:", source);
    assert.equal(result.hostname, "test", source);
    assert.equal(result.pathname, "/_favicon/", source);
    assert.equal(result.searchParams.get("pageUrl"), pageUrl, source);
    assert.equal(result.searchParams.get("size"), "16", source);
  }
});

test("a missing page URL renders an in-package placeholder immediately", () => {
  const placeholder = createFavicon("", "tab-favicon");

  assert.equal(placeholder.tagName, "SPAN");
  assert.equal(placeholder.className, "tab-favicon favicon-placeholder");
  assert.equal(placeholder.textContent, "?");
  assert.equal(placeholder.attributes["aria-hidden"], "true");
});

test("a failed favicon load is replaced with a local letter placeholder", () => {
  const image = createFavicon("https://www.example.com/page", "bookmark-favicon");

  assert.equal(image.tagName, "IMG");
  assert.match(image.src, /^chrome-extension:\/\/test\/_favicon\//);
  image.listeners.error();

  assert.equal(image.replacement.tagName, "SPAN");
  assert.equal(
    image.replacement.className,
    "bookmark-favicon favicon-placeholder",
  );
  assert.equal(image.replacement.textContent, "E");
});

test("neither shipped sidebar contains the Google S2 favicon service", async () => {
  const sidebars = await Promise.all([
    readFile(new URL("../components/sidebar.js", import.meta.url), "utf8"),
    readFile(
      new URL("../meridian-extension/components/sidebar.js", import.meta.url),
      "utf8",
    ),
  ]);

  for (const sidebar of sidebars) {
    assert.doesNotMatch(sidebar, /google\.com\/s2\/favicons/);
    assert.match(sidebar, /createFavicon\(url, 'tab-favicon'\)/);
    assert.match(sidebar, /makeFaviconImg\(item\.url\)/);
  }
});
