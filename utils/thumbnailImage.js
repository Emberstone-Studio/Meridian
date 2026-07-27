const MAX_WIDTH = 960;
const MAX_HEIGHT = 600;
const JPEG_QUALITY = 0.72;

async function blobToDataUrl(blob, platform) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${platform.btoa(binary)}`;
}

export async function resizeThumbnailDataUrl(dataUrl, platform = globalThis) {
  const response = await platform.fetch(dataUrl);
  const sourceBlob = await response.blob();
  const bitmap = await platform.createImageBitmap(sourceBlob);
  try {
    const scale = Math.min(
      1,
      MAX_WIDTH / bitmap.width,
      MAX_HEIGHT / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new platform.OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, width, height);
    const thumbnailBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });
    return blobToDataUrl(thumbnailBlob, platform);
  } finally {
    bitmap.close();
  }
}
