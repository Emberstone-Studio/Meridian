import test from "node:test";
import assert from "node:assert/strict";

const localState = {
  tabSearchIndex: {
    7: {
      tabId: 7,
      title: "Project Dashboard",
      url: "https://tabs.example/dashboard",
      domain: "tabs.example",
      metaDescription: "",
      workspaceName: "Work",
      lastActive: Date.now(),
    },
  },
};
let tabIndexReads = 0;
let bookmarkQueries = 0;
let historyQueries = 0;

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test${path}`,
  },
  storage: {
    local: {
      get: async (key) => {
        if (key === "tabSearchIndex") tabIndexReads += 1;
        return typeof key === "string" ? { [key]: localState[key] } : localState;
      },
    },
  },
  bookmarks: {
    getTree: async () => {
      bookmarkQueries += 1;
      return [
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
      ];
    },
    get: async () => [{ title: "Folder" }],
    search: async () => {
      bookmarkQueries += 1;
      return [];
    },
  },
  history: {
    search: async ({ text }) => {
      historyQueries += 1;
      return [
        {
          title: text ? `Result for ${text}` : "Recent page",
          url: "https://history.example",
          lastVisitTime: Date.now(),
        },
      ];
    },
  },
};

const { search } = await import("../utils/browserSearch.js");

function assertLocalFavicon(value, pageUrl) {
  const favicon = new URL(value);
  assert.equal(favicon.protocol, "chrome-extension:");
  assert.equal(favicon.pathname, "/_favicon/");
  assert.equal(favicon.searchParams.get("pageUrl"), pageUrl);
}

test("empty omni search returns no results", async () => {
  assert.deepEqual(await search(null), {
    tabs: [],
    bookmarks: [],
    history: [],
  });
});

test("empty bookmark scope lists bookmarks only", async () => {
  const results = await search(null, "bookmarks", { bookmarks: true });
  assert.equal(results.bookmarks.length, 1);
  assert.equal(results.bookmarks[0].title, "Meridian");
  assertLocalFavicon(results.bookmarks[0].favicon, "https://example.com");
  assert.deepEqual(results.tabs, []);
  assert.deepEqual(results.history, []);
});

test("empty history scope lists recent history only", async () => {
  const results = await search(null, "history", { history: true });
  assert.equal(results.history.length, 1);
  assert.equal(results.history[0].title, "Recent page");
  assertLocalFavicon(results.history[0].favicon, "https://history.example");
  assert.deepEqual(results.tabs, []);
  assert.deepEqual(results.bookmarks, []);
});

test("omni search returns tab results with local favicons", async () => {
  const results = await search("Dashboard");
  assert.equal(results.tabs.length, 1);
  assert.equal(results.tabs[0].tabId, 7);
  assertLocalFavicon(
    results.tabs[0].favicon,
    "https://tabs.example/dashboard",
  );
});

test("disabled sources do not invoke any underlying search", async () => {
  const before = { tabIndexReads, bookmarkQueries, historyQueries };
  assert.deepEqual(
    await search("Dashboard", "all", {
      tabs: false,
      bookmarks: false,
      history: false,
    }),
    { tabs: [], bookmarks: [], history: [] },
  );
  assert.deepEqual(
    { tabIndexReads, bookmarkQueries, historyQueries },
    before,
  );
});
