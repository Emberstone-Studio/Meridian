import assert from "node:assert/strict";
import test from "node:test";

import {
  evictThumbnail,
  getAllThumbnails,
  removeThumbnailIfMatches,
  saveThumbnail,
} from "../utils/thumbnailCache.js";

function installStorage(initial = {}, options = {}) {
  const values = { ...initial };
  const events = {
    queries: [],
    removes: [],
    sets: [],
  };
  globalThis.chrome = {
    tabs: {
      async query(query) {
        events.queries.push(query);
        return options.tabs ?? [];
      },
    },
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
          events.sets.push(next);
          if (options.failSet?.(next)) throw new Error("storage write failed");
          Object.assign(values, next);
        },
        async remove(keys) {
          events.removes.push(Array.isArray(keys) ? [...keys] : [keys]);
          if (options.failRemove?.(keys)) {
            throw new Error("storage removal failed");
          }
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete values[key];
          }
        },
      },
    },
  };
  return { events, values };
}

test("keeps the 200 most recently saved thumbnails", async () => {
  const initial = {};
  const access = {};
  for (let i = 0; i < 200; i += 1) {
    initial[`thumb_${i}`] = `data:image/webp;base64,${i}`;
    access[`thumb_${i}`] = {
      t: i,
      b: initial[`thumb_${i}`].length,
    };
  }
  initial.thumbnailCacheAccess = access;
  const { values } = installStorage(initial);

  await saveThumbnail(200, "data:image/webp;base64,new");

  assert.equal(values.thumb_0, undefined);
  assert.equal(values.thumb_200, "data:image/webp;base64,new");
  assert.equal(
    values.thumbnailCacheAccess.thumb_200.b,
    "data:image/webp;base64,new".length,
  );
  assert.equal(Object.keys(await getAllThumbnails()).length, 200);
});

test("eviction removes thumbnail data and recency metadata", async () => {
  const { values } = installStorage({
    thumb_7: "data:image/webp;base64,test",
    thumbnailCacheAccess: {
      thumb_7: { t: 1, b: "data:image/webp;base64,test".length },
    },
  });

  await evictThumbnail(7);

  assert.equal(values.thumb_7, undefined);
  assert.deepEqual(values.thumbnailCacheAccess, {});
});

test("reconciles access metadata against actual thumbnail keys and bytes", async () => {
  const { values } = installStorage({
    thumb_1: "old",
    thumb_2: "orphan",
    thumbnailCacheAccess: {
      thumb_1: { t: 1, b: 50 * 1024 * 1024 },
      thumb_99: { t: 2, b: 1000 },
    },
  }, {
    tabs: [{ id: 1 }, { id: 3 }],
  });

  await saveThumbnail(3, "n\u00e9w");

  assert.equal(values.thumb_1, "old");
  assert.equal(values.thumb_2, "orphan");
  assert.equal(values.thumb_3, "n\u00e9w");
  assert.deepEqual(
    Object.keys(values.thumbnailCacheAccess).sort(),
    ["thumb_1", "thumb_2", "thumb_3"],
  );
  assert.equal(values.thumbnailCacheAccess.thumb_1.b, 3);
  assert.equal(values.thumbnailCacheAccess.thumb_2.b, 6);
  assert.equal(values.thumbnailCacheAccess.thumb_3.b, 4);
});

test("entry pressure removes closed-tab thumbnails before any live thumbnail", async () => {
  const initial = {};
  const access = {};
  const tabs = [];
  for (let i = 0; i < 200; i += 1) {
    initial[`thumb_${i}`] = `thumbnail-${i}`;
    access[`thumb_${i}`] = { t: i, b: initial[`thumb_${i}`].length };
    if (i !== 0) tabs.push({ id: i });
  }
  initial.thumbnailCacheAccess = access;
  tabs.push({ id: 200 });
  const { values } = installStorage(initial, { tabs });

  await saveThumbnail(200, "new-live-thumbnail");

  assert.equal(values.thumb_0, undefined);
  for (let i = 1; i <= 200; i += 1) {
    assert.ok(values[`thumb_${i}`], `live thumbnail ${i} was preserved`);
  }
  assert.equal(Object.keys(await getAllThumbnails()).length, 200);
});

test("live thumbnails remain deterministic soft-cap entries under entry pressure", async () => {
  const initial = {};
  const access = {};
  const tabs = [];
  for (let i = 0; i < 200; i += 1) {
    initial[`thumb_${i}`] = `thumbnail-${i}`;
    access[`thumb_${i}`] = { t: i, b: initial[`thumb_${i}`].length };
    tabs.push({ id: i });
  }
  initial.thumbnailCacheAccess = access;
  tabs.push({ id: 200 });
  const { values } = installStorage(initial, { tabs });

  await saveThumbnail(200, "new-live-thumbnail");

  assert.equal(Object.keys(await getAllThumbnails()).length, 201);
  for (let i = 0; i <= 200; i += 1) {
    assert.ok(values[`thumb_${i}`], `live thumbnail ${i} was preserved`);
  }
});

test("actual stored bytes, not stale metadata, drive byte-pressure pruning", async () => {
  const oversized = "x".repeat(50 * 1024 * 1024 + 1);
  const { values } = installStorage({
    thumb_1: oversized,
    thumbnailCacheAccess: {
      thumb_1: { t: 1, b: 1 },
    },
  }, {
    tabs: [{ id: 2 }],
  });

  await saveThumbnail(2, "new-live-thumbnail");

  assert.equal(values.thumb_1, undefined);
  assert.equal(values.thumb_2, "new-live-thumbnail");
  assert.deepEqual(Object.keys(values.thumbnailCacheAccess), ["thumb_2"]);
});

test("a failed incoming write never deletes or replaces valid cached data", async () => {
  const initial = {
    thumb_200: "previous-valid-thumbnail",
  };
  const access = {
    thumb_200: { t: 200, b: "previous-valid-thumbnail".length },
  };
  for (let i = 0; i < 200; i += 1) {
    initial[`thumb_${i}`] = `thumbnail-${i}`;
    access[`thumb_${i}`] = { t: i, b: initial[`thumb_${i}`].length };
  }
  initial.thumbnailCacheAccess = access;
  const { events, values } = installStorage(initial, {
    tabs: [{ id: 200 }],
    failSet: (next) => Object.hasOwn(next, "thumb_200"),
  });

  await assert.rejects(
    saveThumbnail(200, "failed-replacement"),
    /storage write failed/,
  );

  assert.equal(values.thumb_200, "previous-valid-thumbnail");
  assert.equal(events.removes.length, 0);
  assert.equal(Object.keys(await getAllThumbnails()).length, 201);
});

test("decode recovery only removes the exact failed thumbnail value", async () => {
  const { values } = installStorage({
    thumb_7: "new-valid-thumbnail",
    thumbnailCacheAccess: {
      thumb_7: { t: 1, b: "new-valid-thumbnail".length },
    },
  });

  assert.equal(await removeThumbnailIfMatches(7, "stale-corrupt-thumbnail"), false);
  assert.equal(values.thumb_7, "new-valid-thumbnail");

  assert.equal(await removeThumbnailIfMatches(7, "new-valid-thumbnail"), true);
  assert.equal(values.thumb_7, undefined);
  assert.deepEqual(values.thumbnailCacheAccess, {});
});

test("a failed orphan removal retains matching metadata for later reconciliation", async () => {
  const initial = {};
  const access = {};
  for (let i = 0; i < 200; i += 1) {
    initial[`thumb_${i}`] = `thumbnail-${i}`;
    access[`thumb_${i}`] = { t: i, b: initial[`thumb_${i}`].length };
  }
  initial.thumbnailCacheAccess = access;
  const { values } = installStorage(initial, {
    tabs: [{ id: 200 }],
    failRemove: () => true,
  });

  await saveThumbnail(200, "new-live-thumbnail");

  assert.equal(values.thumb_0, "thumbnail-0");
  assert.equal(values.thumbnailCacheAccess.thumb_0.b, "thumbnail-0".length);
  assert.equal(values.thumb_200, "new-live-thumbnail");
  assert.equal(
    values.thumbnailCacheAccess.thumb_200.b,
    "new-live-thumbnail".length,
  );
});

test("concurrent saves serialize complete thumbnail and metadata mutations", async () => {
  const { values } = installStorage({}, {
    tabs: [{ id: 1 }, { id: 2 }],
  });

  await Promise.all([
    saveThumbnail(1, "first-thumbnail"),
    saveThumbnail(2, "second-thumbnail"),
  ]);

  assert.equal(values.thumb_1, "first-thumbnail");
  assert.equal(values.thumb_2, "second-thumbnail");
  assert.deepEqual(
    Object.keys(values.thumbnailCacheAccess).sort(),
    ["thumb_1", "thumb_2"],
  );
});

test("a save racing failed-image cleanup cannot remove the replacement", async () => {
  const corruptThumbnail = "corrupt-thumbnail";
  const replacementThumbnail = "replacement-thumbnail";
  const { values } = installStorage({
    thumb_7: corruptThumbnail,
    thumbnailCacheAccess: {
      thumb_7: { t: 1, b: corruptThumbnail.length },
    },
  }, {
    tabs: [{ id: 7 }],
  });

  await Promise.all([
    saveThumbnail(7, replacementThumbnail),
    removeThumbnailIfMatches(7, corruptThumbnail),
  ]);

  assert.equal(values.thumb_7, replacementThumbnail);
  assert.equal(
    values.thumbnailCacheAccess.thumb_7.b,
    replacementThumbnail.length,
  );
});
