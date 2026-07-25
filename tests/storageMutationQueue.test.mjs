import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../utils/storageMutationQueue.js", import.meta.url),
  "utf8",
);
const { mutateStorageValue } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("serializes concurrent read-modify-write operations for one key", async () => {
  const storage = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
          return { [key]: structuredClone(storage[key]) };
        },
        async set(update) {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
          Object.assign(storage, structuredClone(update));
        },
      },
    },
  };

  await Promise.all(
    Array.from({ length: 20 }, (_, tabId) =>
      mutateStorageValue("index", {}, (index) => {
        index[tabId] = { tabId };
      }),
    ),
  );

  assert.equal(Object.keys(storage.index).length, 20);
});

test("a failed mutation does not block later mutations", async () => {
  const storage = { state: { count: 0 } };
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: structuredClone(storage[key]) };
        },
        async set(update) {
          Object.assign(storage, structuredClone(update));
        },
      },
    },
  };

  await assert.rejects(
    mutateStorageValue("state", {}, () => {
      throw new Error("failed");
    }),
  );
  await mutateStorageValue("state", {}, (state) => {
    state.count++;
  });

  assert.equal(storage.state.count, 1);
});
