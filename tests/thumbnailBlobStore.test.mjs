import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteThumbnailBlobs,
  getAllThumbnailBlobs,
  getAllThumbnailDisplayUrls,
  getThumbnailBlob,
  saveThumbnailBlob,
  thumbnailDataUrlToBlob,
} from "../utils/thumbnailBlobStore.js";

function installFakeIndexedDb() {
  const values = new Map();
  globalThis.indexedDB = {
    open() {
      const openRequest = {};
      queueMicrotask(() => {
        openRequest.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          close() {},
          transaction() {
            return {
              objectStore() {
                const request = (value) => {
                  const result = {};
                  queueMicrotask(() => {
                    result.result = value();
                    result.onsuccess?.();
                  });
                  return result;
                };
                return {
                  get: (key) => request(() => values.get(key)),
                  getAll: () => request(() => [...values.values()]),
                  getAllKeys: () => request(() => [...values.keys()]),
                  put(value, key) {
                    values.set(key, value);
                  },
                  add(value, key) {
                    const result = {};
                    queueMicrotask(() => {
                      if (values.has(key)) {
                        result.error = new Error("ConstraintError");
                        result.onerror?.();
                        return;
                      }
                      values.set(key, value);
                      result.onsuccess?.();
                    });
                    return result;
                  },
                  delete(key) {
                    values.delete(key);
                  },
                };
              },
              set oncomplete(callback) {
                queueMicrotask(callback);
              },
              set onerror(_callback) {},
              set onabort(_callback) {},
            };
          },
        };
        openRequest.onsuccess?.();
      });
      return openRequest;
    },
  };
  return values;
}

test("thumbnail blob storage validates and preserves encoded image bytes", async () => {
  const blob = await thumbnailDataUrlToBlob(
    "data:image/png;base64,iVBORw0KGgo=",
  );

  assert.equal(blob.type, "image/png");
  assert.ok(blob.size > 0);
});

test("thumbnail blob storage rejects non-image and empty values", async () => {
  await assert.rejects(
    thumbnailDataUrlToBlob("not-an-image"),
    /image data URL/,
  );
  await assert.rejects(
    thumbnailDataUrlToBlob("data:text/plain;base64,dGV4dA=="),
    /image data URL/,
  );
});

test("thumbnail blobs round-trip through IndexedDB and expose reusable display URLs", async () => {
  installFakeIndexedDb();
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

  await saveThumbnailBlob(7, dataUrl, "https://example.test");
  const stored = await getThumbnailBlob(7);
  assert.equal(stored.tabUrl, "https://example.test");
  assert.equal(stored.blob.type, "image/png");

  const records = await getAllThumbnailBlobs();
  assert.equal(records.length, 1);
  assert.equal(records[0].tabId, "7");

  const firstUrls = await getAllThumbnailDisplayUrls();
  const secondUrls = await getAllThumbnailDisplayUrls();
  assert.match(firstUrls["7"], /^blob:/);
  assert.equal(secondUrls["7"], firstUrls["7"]);

  await deleteThumbnailBlobs([7]);
  assert.equal(await getThumbnailBlob(7), null);
  assert.deepEqual(await getAllThumbnailDisplayUrls(), {});
});

test("restored tabs recover thumbnails by URL when Chrome changes tab ids", async () => {
  installFakeIndexedDb();
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

  await saveThumbnailBlob(7, dataUrl, "https://example.test/restored");

  const restored = await getAllThumbnailDisplayUrls([
    { id: 91, url: "https://example.test/restored" },
  ]);

  assert.match(restored["91"], /^blob:/);
  assert.equal(restored["7"], undefined);
});
