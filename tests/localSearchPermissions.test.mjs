import assert from "node:assert/strict";
import test from "node:test";

let localSearch;
let granted;
let requestResult;
let containsCalls;
let requested;
let removed;

globalThis.chrome = {
  storage: {
    sync: {
      async get() {
        return { localSearch: { ...localSearch } };
      },
      async set(value) {
        localSearch = { ...value.localSearch };
      },
    },
  },
  permissions: {
    async contains({ permissions }) {
      containsCalls.push(permissions[0]);
      return granted.has(permissions[0]);
    },
    async request({ permissions }) {
      requested.push(permissions[0]);
      if (requestResult) granted.add(permissions[0]);
      return requestResult;
    },
    async remove({ permissions }) {
      removed.push(permissions[0]);
      granted.delete(permissions[0]);
      return true;
    },
  },
};

const {
  disableRemovedLocalSearchPermissions,
  getEnabledLocalSearchSources,
  setLocalSearchSourceEnabled,
} = await import("../utils/localSearch.js");

test.beforeEach(() => {
  localSearch = { tabs: true, bookmarks: true, history: true };
  granted = new Set();
  requestResult = true;
  containsCalls = [];
  requested = [];
  removed = [];
});

test("effective sources require optional permission grants", async () => {
  granted.add("bookmarks");
  assert.deepEqual(await getEnabledLocalSearchSources(), {
    tabs: true,
    bookmarks: true,
    history: false,
  });
});

test("disabled optional sources do not inspect browser permissions", async () => {
  localSearch = { tabs: true, bookmarks: false, history: false };
  assert.deepEqual(await getEnabledLocalSearchSources(), localSearch);
  assert.deepEqual(containsCalls, []);
});

test("absent optional preferences stay disabled despite old grants", async () => {
  localSearch = { tabs: true };
  granted.add("bookmarks");
  granted.add("history");
  assert.deepEqual(await getEnabledLocalSearchSources(), {
    tabs: true,
    bookmarks: false,
    history: false,
  });
  assert.deepEqual(containsCalls, []);
});

test("enabling an optional source requests and records its permission", async () => {
  const result = await setLocalSearchSourceEnabled("bookmarks", true);
  assert.deepEqual(result, { enabled: true, denied: false });
  assert.deepEqual(requested, ["bookmarks"]);
  assert.equal(localSearch.bookmarks, true);
});

test("denied optional access remains disabled", async () => {
  requestResult = false;
  const result = await setLocalSearchSourceEnabled("history", true);
  assert.deepEqual(result, { enabled: false, denied: true });
  assert.equal(localSearch.history, false);
});

test("disabling an optional source removes its grant", async () => {
  granted.add("bookmarks");
  const result = await setLocalSearchSourceEnabled("bookmarks", false);
  assert.deepEqual(result, { enabled: false, denied: false });
  assert.deepEqual(removed, ["bookmarks"]);
  assert.equal(localSearch.bookmarks, false);
});

test("revoked permissions turn their saved sources off", async () => {
  const revoked = await disableRemovedLocalSearchPermissions({
    permissions: ["history"],
  });
  assert.deepEqual(revoked, ["history"]);
  assert.equal(localSearch.bookmarks, true);
  assert.equal(localSearch.history, false);
});
