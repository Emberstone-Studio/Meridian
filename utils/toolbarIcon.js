const TOOLBAR_ICON_SIZES = [16, 32];
const LIGHT_TOOLBAR_COLOR = "#1c1c1e";
const DARK_TOOLBAR_COLOR = "#f5f5f7";

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
