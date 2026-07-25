import assert from "node:assert/strict";
import test from "node:test";

import {
  evictThumbnail,
  getAllThumbnails,
  saveThumbnail,
} from "../utils/thumbnailCache.js";

function installStorage(initial = {}) {
  const values = { ...initial };
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (keys === null) return { ...values };
          const requested = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            requested
              .filter((key) => Object.hasOwn(values, key))
              .map((key) => [key, values[key]]),
          );
        },
        async set(next) {
          Object.assign(values, next);
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete values[key];
          }
        },
      },
    },
  };
  return values;
}

test("keeps the 200 most recently saved thumbnails", async () => {
  const initial = {};
  const access = {};
  for (let i = 0; i < 200; i += 1) {
    initial[`thumb_${i}`] = `data:image/webp;base64,${i}`;
    access[`thumb_${i}`] = i;
  }
  initial.thumbnailCacheAccess = access;
  const values = installStorage(initial);

  await saveThumbnail(200, "data:image/webp;base64,new");

  assert.equal(values.thumb_0, undefined);
  assert.equal(values.thumb_200, "data:image/webp;base64,new");
  assert.equal(Object.keys(await getAllThumbnails()).length, 200);
});

test("eviction removes thumbnail data and recency metadata", async () => {
  const values = installStorage({
    thumb_7: "data:image/webp;base64,test",
    thumbnailCacheAccess: { thumb_7: 1 },
  });

  await evictThumbnail(7);

  assert.equal(values.thumb_7, undefined);
  assert.deepEqual(values.thumbnailCacheAccess, {});
});
