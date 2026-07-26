export function faviconUrl(pageUrl) {
  if (!pageUrl) return "";
  try {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", "16");
    return url.toString();
  } catch {
    return "";
  }
}

export function faviconFallbackLetter(pageUrl) {
  try {
    return (
      new URL(pageUrl).hostname.replace(/^www\./, "").charAt(0).toUpperCase() ||
      "?"
    );
  } catch {
    return "?";
  }
}

function makeFaviconPlaceholder(pageUrl, className) {
  const placeholder = document.createElement("span");
  placeholder.className = `${className} favicon-placeholder`;
  placeholder.textContent = faviconFallbackLetter(pageUrl);
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

export function createFavicon(pageUrl, className) {
  const source = faviconUrl(pageUrl);
  if (!source) return makeFaviconPlaceholder(pageUrl, className);

  const image = document.createElement("img");
  image.className = className;
  image.alt = "";
  image.src = source;
  image.addEventListener(
    "error",
    () => image.replaceWith(makeFaviconPlaceholder(pageUrl, className)),
    { once: true },
  );
  return image;
}
