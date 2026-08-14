const TOOLBAR_ICON_SIZES = [16, 32];
const LIGHT_TOOLBAR_COLOR = "#1c1c1e";
const DARK_TOOLBAR_COLOR = "#f5f5f7";

/* The toolbar mark is monochrome rather than brand mint on purpose. The browser
   toolbar is chrome we don't control, it sits beside a dozen other extension
   icons at 16px, and #2ed8b0 is only 1.67:1 on a light toolbar — the mark would
   dissolve. Recolouring per scheme is what keeps it legible on both.

   This imposes two constraints on img/Meridian.svg, which the file cannot
   restate itself (see below):

     1. The root element must carry a plain fill attribute, because the regex
        below rewrites exactly that. The circle must NOT declare its own fill —
        it inherits from the root. Do not reach for currentColor: that resolves
        against the `color` property, which nothing here sets, so the mark would
        render black on a dark toolbar.
     2. Keep that file free of XML comments. The regex takes the FIRST match in
        the document, so a comment mentioning an SVG open tag hijacks it — the
        comment gets rewritten and the real root fill is left untouched, which
        silently produces a near-black icon on dark chrome. */
export function recolorToolbarSvg(svgText, isDark) {
  const color = isDark ? DARK_TOOLBAR_COLOR : LIGHT_TOOLBAR_COLOR;
  return svgText.replace(/<svg\b([^>]*)>/, (svg, attributes) => {
    if (/\bfill=/.test(attributes)) {
      return svg.replace(/\bfill=(["']).*?\1/, `fill="${color}"`);
    }
    return `<svg fill="${color}"${attributes}>`;
  });
}

async function renderIconImageData(svgText) {
  const blobUrl = URL.createObjectURL(
    new Blob([svgText], { type: "image/svg+xml" }),
  );
  try {
    return Object.fromEntries(
      await Promise.all(
        TOOLBAR_ICON_SIZES.map(
          (size) =>
            new Promise((resolve, reject) => {
              const image = new Image();
              image.onload = () => {
                try {
                  const canvas = document.createElement("canvas");
                  canvas.width = size;
                  canvas.height = size;
                  const context = canvas.getContext("2d");
                  context.drawImage(image, 0, 0, size, size);
                  resolve([size, context.getImageData(0, 0, size, size)]);
                } catch (error) {
                  reject(error);
                }
              };
              image.onerror = reject;
              image.src = blobUrl;
            }),
        ),
      ),
    );
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function updateToolbarIcon(isDark) {
  try {
    const svgUrl = chrome.runtime.getURL("img/Meridian.svg");
    const svgText = await fetch(svgUrl).then((response) => response.text());
    const imageData = await renderIconImageData(
      recolorToolbarSvg(svgText, isDark),
    );
    await chrome.action.setIcon({ imageData });
    return true;
  } catch {
    // The manifest icon remains available if rendering or action access fails.
    return false;
  }
}

export function watchToolbarIconTheme() {
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const update = (event) => updateToolbarIcon(event.matches);
  updateToolbarIcon(scheme.matches);
  scheme.addEventListener("change", update);
  return () => scheme.removeEventListener("change", update);
}
