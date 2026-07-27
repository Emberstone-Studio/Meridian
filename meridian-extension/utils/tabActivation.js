export async function activateTab(tabId, update = {}) {
  const tab = await chrome.tabs.update(tabId, { ...update, active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  return tab;
}
