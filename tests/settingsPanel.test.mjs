import assert from "node:assert/strict";
import test from "node:test";

import { resizeToDataUrl } from "../components/SettingsPanel.js";

test("returns null and revokes the object URL when an image cannot be decoded", async () => {
  const revokedUrls = [];

  globalThis.URL = {
    createObjectURL() {
      return "blob:invalid-image";
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };
  globalThis.Image = class {
    set src(_url) {
      queueMicrotask(() => this.onerror());
    }
  };

  const result = await resizeToDataUrl({ type: "image/png" });

  assert.equal(result, null);
  assert.deepEqual(revokedUrls, ["blob:invalid-image"]);
});

test("resizes custom backgrounds as JPEG", async () => {
  let encodedAs;

  globalThis.URL = {
    createObjectURL() {
      return "blob:valid-image";
    },
    revokeObjectURL() {},
  };
  globalThis.Image = class {
    width = 2400;
    height = 1200;

    set src(_url) {
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement() {
      return {
        getContext() {
          return { drawImage() {} };
        },
        toDataURL(type, quality) {
          encodedAs = { type, quality, width: this.width, height: this.height };
          return "data:image/jpeg;base64,test";
        },
      };
    },
  };

  const result = await resizeToDataUrl({}, 1200, 900, 0.75);

  assert.equal(result, "data:image/jpeg;base64,test");
  assert.deepEqual(encodedAs, {
    type: "image/jpeg",
    quality: 0.75,
    width: 1200,
    height: 600,
  });
});
