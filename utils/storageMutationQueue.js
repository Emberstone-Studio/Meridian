const mutationQueues = new Map();

export function mutateStorageValue(key, fallback, mutate) {
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    const result = await chrome.storage.local.get(key);
    const value = result[key] ?? structuredClone(fallback);
    const nextValue = (await mutate(value)) ?? value;
    await chrome.storage.local.set({ [key]: nextValue });
    return nextValue;
  });

  mutationQueues.set(key, operation);
  operation.then(
    () => {
      if (mutationQueues.get(key) === operation) mutationQueues.delete(key);
    },
    () => {
      if (mutationQueues.get(key) === operation) mutationQueues.delete(key);
    },
  );

  return operation;
}
