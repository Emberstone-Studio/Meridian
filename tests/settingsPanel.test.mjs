import assert from "node:assert/strict";
import test from "node:test";

import {
  compressBackgroundForSync,
  getCustomBackgroundDataUrl,
  resizeToDataUrl,
  SYNCED_BACKGROUND_KEY,
  USE_SYNCED_BACKGROUND_KEY,
} from "../components/SettingsPanel.js";

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

test("resizes custom backgrounds as WebP", async () => {
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
          return "data:image/webp;base64,test";
        },
      };
    },
  };

  const result = await resizeToDataUrl({}, 1200, 900, 0.75);

  assert.equal(result, "data:image/webp;base64,test");
  assert.deepEqual(encodedAs, {
    type: "image/webp",
    quality: 0.75,
    width: 1200,
    height: 600,
  });
});

test("compresses a synced background below the storage item budget", async () => {
  const attempts = [];

  globalThis.Image = class {
    width = 1600;
    height = 900;

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
          attempts.push({ type, quality, width: this.width, height: this.height });
          return attempts.length === 1
            ? `data:image/webp;base64,${"x".repeat(8000)}`
            : "data:image/webp;base64,synced";
        },
      };
    },
  };

  const result = await compressBackgroundForSync(
    "data:image/png;base64,local",
    7000,
  );

  assert.equal(result, "data:image/webp;base64,synced");
  assert.deepEqual(attempts.slice(0, 2), [
    { type: "image/webp", quality: 0.45, width: 640, height: 360 },
    { type: "image/webp", quality: 0.4, width: 461, height: 259 },
  ]);
});

test("the per-device setting chooses between local and synced backgrounds", async () => {
  let useSynced = false;
  globalThis.localStorage = {
    getItem() {
      return "data:image/webp;base64,local";
    },
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get() {
          return { [USE_SYNCED_BACKGROUND_KEY]: useSynced };
        },
      },
      sync: {
        async get() {
          return {
            [SYNCED_BACKGROUND_KEY]: "data:image/webp;base64,synced",
          };
        },
      },
    },
  };

  assert.equal(
    await getCustomBackgroundDataUrl(),
    "data:image/webp;base64,local",
  );
  useSynced = true;
  assert.equal(
    await getCustomBackgroundDataUrl(),
    "data:image/webp;base64,synced",
  );
});
