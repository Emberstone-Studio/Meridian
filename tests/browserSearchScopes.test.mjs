import test from "node:test";
import assert from "node:assert/strict";

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test${path}`,
  },
  storage: {
    local: {
      get: async () => ({}),
    },
  },
  bookmarks: {
    getTree: async () => [
      {
        children: [
          {
            title: "Folder",
            children: [
              {
                title: "Meridian",
                url: "https://example.com",
                parentId: "folder",
              },
            ],
          },
        ],
      },
    ],
    get: async () => [{ title: "Folder" }],
    search: async () => [],
  },
  history: {
    search: async ({ text }) => [
      {
        title: text ? `Result for ${text}` : "Recent page",
        url: "https://history.example",
        lastVisitTime: Date.now(),
      },
    ],
  },
};

const { search } = await import("../utils/browserSearch.js");

test("empty omni search returns no results", async () => {
  assert.deepEqual(await search(null), {
    tabs: [],
    bookmarks: [],
    history: [],
  });
});

test("empty bookmark scope lists bookmarks only", async () => {
  const results = await search(null, "bookmarks");
  assert.equal(results.bookmarks.length, 1);
  assert.equal(results.bookmarks[0].title, "Meridian");
  assert.deepEqual(results.tabs, []);
  assert.deepEqual(results.history, []);
});

test("empty history scope lists recent history only", async () => {
  const results = await search(null, "history");
  assert.equal(results.history.length, 1);
  assert.equal(results.history[0].title, "Recent page");
  assert.deepEqual(results.tabs, []);
  assert.deepEqual(results.bookmarks, []);
});
