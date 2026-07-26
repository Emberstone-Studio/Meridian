/**
 * Open a URL from Meridian without destroying the pinned dashboard.
 *
 * A pinned Meridian tab is persistent, so launches open beside it. An
 * unpinned Meridian page is a disposable New Tab instance, so it navigates in
 * place. If Chrome cannot identify the current tab, opening a new tab is the
 * safest fallback.
 */
export async function openUrlFromMeridian(url, tabs = chrome.tabs) {
  if (!url) return null;

  let currentTab = null;
  try {
    currentTab = await tabs.getCurrent();
  } catch {
    // Fall through to a new tab if this page has no readable tab context.
  }

  if (currentTab?.pinned !== true && currentTab?.id != null) {
    return tabs.update(currentTab.id, { url });
  }

  return tabs.create({ url });
}
