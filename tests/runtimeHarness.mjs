import assert from "node:assert/strict";

export function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Could not find ${signature}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find the end of ${signature}`);
}

export function extractStorageListener(source) {
  const marker = "chrome.storage.onChanged.addListener(";
  const callStart = source.lastIndexOf(marker);
  assert.notEqual(callStart, -1, "Could not find the storage listener");
  const callbackStart = callStart + marker.length;
  const bodyStart = source.indexOf("{", callbackStart);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) {
      return source.slice(callbackStart, i + 1);
    }
  }
  throw new Error("Could not find the end of the storage listener");
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function selectKeys(values, keys) {
  if (keys == null) return { ...values };
  if (typeof keys === "string") return { [keys]: values[keys] };
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, values[key]]));
  }
  return Object.fromEntries(
    Object.entries(keys).map(([key, fallback]) => [
      key,
      values[key] ?? fallback,
    ]),
  );
}

export function createChromeStorage(initial = {}) {
  const values = {
    sync: { ...(initial.sync ?? {}) },
    local: { ...(initial.local ?? {}) },
  };
  const listeners = [];

  function emit(area, changes) {
    for (const listener of [...listeners]) listener(changes, area);
  }

  function makeArea(area) {
    return {
      async get(keys) {
        return selectKeys(values[area], keys);
      },
      async set(next) {
        const changes = {};
        for (const [key, newValue] of Object.entries(next)) {
          changes[key] = { oldValue: values[area][key], newValue };
          values[area][key] = newValue;
        }
        emit(area, changes);
      },
    };
  }

  return {
    chrome: {
      storage: {
        sync: makeArea("sync"),
        local: makeArea("local"),
        onChanged: {
          addListener(listener) {
            listeners.push(listener);
          },
        },
      },
    },
    emit,
    values,
  };
}

export async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
