import assert from "node:assert/strict";
import test from "node:test";

import { resizeThumbnailDataUrl } from "../utils/thumbnailImage.js";

test("full-window captures are resized to the bounded thumbnail resolution", async () => {
  const draws = [];
  const canvases = [];
  let closed = false;
  const outputBytes = new TextEncoder().encode("thumbnail");
  const platform = {
    async fetch(dataUrl) {
      assert.equal(dataUrl, "data:image/jpeg;base64,full-window");
      return { blob: async () => ({ type: "image/jpeg" }) };
    },
    async createImageBitmap() {
      return {
        width: 1920,
        height: 1080,
        close() {
          closed = true;
        },
      };
    },
    OffscreenCanvas: class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        canvases.push(this);
      }

      getContext(type) {
        assert.equal(type, "2d");
        return {
          drawImage: (...args) => draws.push(args),
        };
      }

      async convertToBlob(options) {
        assert.deepEqual(options, { type: "image/jpeg", quality: 0.72 });
        return {
          type: "image/jpeg",
          arrayBuffer: async () => outputBytes.buffer,
        };
      }
    },
    btoa(binary) {
      return Buffer.from(binary, "binary").toString("base64");
    },
  };

  const result = await resizeThumbnailDataUrl(
    "data:image/jpeg;base64,full-window",
    platform,
  );

  assert.equal(canvases[0].width, 960);
  assert.equal(canvases[0].height, 540);
  assert.deepEqual(draws[0].slice(1), [0, 0, 960, 540]);
  assert.equal(result, "data:image/jpeg;base64,dGh1bWJuYWls");
  assert.equal(closed, true);
});

test("decode failures reject without producing a replacement thumbnail", async () => {
  const platform = {
    async fetch() {
      return { blob: async () => ({ type: "image/jpeg" }) };
    },
    async createImageBitmap() {
      throw new Error("image decode failed");
    },
  };

  await assert.rejects(
    resizeThumbnailDataUrl("data:image/jpeg;base64,broken", platform),
    /image decode failed/,
  );
});
