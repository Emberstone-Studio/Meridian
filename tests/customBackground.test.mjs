import assert from "node:assert/strict";
import test from "node:test";

// Minimal in-memory IndexedDB stand-in covering the open/put/get surface
// that customBackground.js uses.
function installFakeIndexedDB() {
  const store = new Map();
  globalThis.indexedDB = {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          transaction() {
            return {
              objectStore() {
                return {
                  put(value, key) {
                    store.set(key, value);
                  },
                  delete(key) {
                    store.delete(key);
                  },
                  get(key) {
                    const getReq = {};
                    queueMicrotask(() => {
                      getReq.result = store.get(key);
                      getReq.onsuccess?.();
                    });
                    return getReq;
                  },
                };
              },
              set oncomplete(fn) {
                queueMicrotask(fn);
              },
              set onerror(_fn) {},
            };
          },
          close() {},
        };
        req.onsuccess?.();
      });
      return req;
    },
  };
  return store;
}

function installStubs() {
  const revisions = [];
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({}),
        remove: async () => {},
        set: async (values) => revisions.push(values),
      },
    },
  };
  globalThis.localStorage = {
    _m: new Map(),
    getItem(k) {
      return this._m.has(k) ? this._m.get(k) : null;
    },
    setItem(k, v) {
      this._m.set(k, v);
    },
    removeItem(k) {
      this._m.delete(k);
    },
  };
  const created = [];
  created.revoked = [];
  globalThis.URL = {
    createObjectURL(blob) {
      const url = `blob:fake/${created.length}`;
      created.push({ url, blob });
      return url;
    },
    revokeObjectURL(url) {
      created.revoked.push(url);
    },
  };
  created.revisions = revisions;
  return created;
}

test("stores the raw blob and returns a blob: URL for it", async () => {
  installFakeIndexedDB();
  const created = installStubs();
  const { saveCustomBackground, getCustomBackgroundUrl } = await import(
    `../utils/customBackground.js?case=roundtrip`
  );

  const file = { type: "image/png", size: 18_000_000 };
  await saveCustomBackground(file);
  const url = await getCustomBackgroundUrl();

  assert.equal(url, "blob:fake/0");
  assert.equal(created[0].blob, file, "the original file bytes are handed to URL");
});

test("falls back to a legacy data URL when IndexedDB is empty", async () => {
  installFakeIndexedDB();
  installStubs();
  globalThis.localStorage.setItem(
    "meridian_bg_custom",
    "data:image/jpeg;base64,legacy",
  );
  const { getCustomBackgroundUrl } = await import(
    `../utils/customBackground.js?case=legacy`
  );

  const url = await getCustomBackgroundUrl();

  assert.equal(url, "data:image/jpeg;base64,legacy");
});

test("shares one live blob URL across consumers until the image changes", async () => {
  installFakeIndexedDB();
  const created = installStubs();
  const {
    saveCustomBackground,
    getCustomBackgroundUrl,
    refreshCustomBackgroundUrl,
  } = await import(
    `../utils/customBackground.js?case=shared-url`
  );

  const firstFile = { type: "image/png", size: 1_000 };
  await saveCustomBackground(firstFile);
  const [firstUrl, secondUrl] = await Promise.all([
    getCustomBackgroundUrl(),
    getCustomBackgroundUrl(),
  ]);

  assert.equal(firstUrl, "blob:fake/0");
  assert.equal(secondUrl, firstUrl);
  assert.equal(created.length, 1);
  assert.deepEqual(created.revoked, []);

  const replacement = { type: "image/jpeg", size: 2_000 };
  const revision = await saveCustomBackground(replacement);
  assert.deepEqual(created.revoked, [], "the displayed URL remains live");
  assert.equal(
    await refreshCustomBackgroundUrl(revision),
    "blob:fake/1",
  );
  assert.deepEqual(created.revoked, [], "revocation waits for consumers");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(created.revoked, [firstUrl]);
  assert.equal(created[1].blob, replacement);
  assert.equal(created.revisions.length, 2);
});

test("a second document refreshes uploads and deletion from revision signals", async () => {
  installFakeIndexedDB();
  const created = installStubs();
  const firstDocument = await import(
    `../utils/customBackground.js?case=first-document`
  );
  const secondDocument = await import(
    `../utils/customBackground.js?case=second-document`
  );

  const firstRevision = await firstDocument.saveCustomBackground({ id: 1 });
  assert.equal(
    await secondDocument.refreshCustomBackgroundUrl(firstRevision),
    "blob:fake/0",
  );

  const secondRevision = await firstDocument.saveCustomBackground({ id: 2 });
  const replacementUrl =
    await secondDocument.refreshCustomBackgroundUrl(secondRevision);
  assert.equal(replacementUrl, "blob:fake/1");
  assert.deepEqual(created.revoked, []);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(created.revoked, ["blob:fake/0"]);

  const deletionRevision = await firstDocument.clearCustomBackground();
  assert.equal(
    await secondDocument.refreshCustomBackgroundUrl(deletionRevision),
    null,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(created.revoked, ["blob:fake/0", replacementUrl]);
  assert.equal(created.revisions.length, 3);
});
