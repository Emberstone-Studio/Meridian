const TOOLBAR_ICON_SIZES = [16, 32];
const BRAND_DISC = "#2ed8b0";
const LIGHT_TOOLBAR_DISC = "#198a70";
const DARK_TOOLBAR_DISC = BRAND_DISC;

/* Chrome exposes exactly ONE action icon. chrome.action.setIcon repaints it
   everywhere the action appears — the toolbar, the puzzle-piece overflow menu,
   the pinned list — so there is no arrangement where the toolbar gets one
   treatment and the menu another. Whatever this returns is what the user sees
   in all of them. That is why the mark stays on-brand here rather than
   monochrome: a monochrome toolbar icon also means a monochrome icon in the
   extensions menu, where it sits in a list of competitors' colour marks and
   reads as unbranded.

   What genuinely has to adapt is lightness, not hue. Brand mint is 9.46:1
   against dark chrome but only 1.67:1 against a light toolbar, where the disc
   silhouette dissolves. So the mark keeps the brand hue in both and darkens to
   #198a70 on light chrome: 3.92:1 against the toolbar, with the ink counter
   still 3.38:1 inside the disc — both clear the 3:1 that non-text contrast
   asks for. This is the same rule the UI applies to --accent: one hue,
   lightness per surface.

   The artwork is img/icon-source.svg, the same ink-counter master the manifest
   PNGs render from, so the toolbar, the overflow menu, the extensions page and
   the Web Store all show one mark. Only the disc fill is rewritten; the counter
   is a stroked path in brand ink and is never recoloured. Comments are stripped
   before the rewrite so prose in the artwork can never capture the match. */
export function recolorToolbarSvg(svgText, isDark) {
  const disc = isDark ? DARK_TOOLBAR_DISC : LIGHT_TOOLBAR_DISC;
  return svgText
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      new RegExp(`(<circle\\b[^>]*\\bfill=)(["'])${BRAND_DISC}\\2`, "i"),
      (match, prefix, quote) => `${prefix}${quote}${disc}${quote}`,
    );
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
    const svgUrl = chrome.runtime.getURL("img/icon-source.svg");
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
