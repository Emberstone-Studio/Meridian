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
  globalThis.chrome = {
    storage: { local: { get: async () => ({}), remove: async () => {} } },
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
  globalThis.URL = {
    createObjectURL(blob) {
      const url = `blob:fake/${created.length}`;
      created.push({ url, blob });
      return url;
    },
    revokeObjectURL() {},
  };
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
