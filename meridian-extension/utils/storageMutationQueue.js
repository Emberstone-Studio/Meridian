const mutationQueues = new Map();

export function queueStorageMutation(key, operation) {
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  const queued = previous.catch(() => {}).then(operation);

  mutationQueues.set(key, queued);
  queued.then(
    () => {
      if (mutationQueues.get(key) === queued) mutationQueues.delete(key);
    },
    () => {
      if (mutationQueues.get(key) === queued) mutationQueues.delete(key);
    },
  );

  return queued;
}

export function mutateStorageValue(key, fallback, mutate) {
  return queueStorageMutation(key, async () => {
    const result = await chrome.storage.local.get(key);
    const value = result[key] ?? structuredClone(fallback);
    const nextValue = (await mutate(value)) ?? value;
    await chrome.storage.local.set({ [key]: nextValue });
    return nextValue;
  });
}
