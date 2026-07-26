import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootManifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
);
const packagedManifest = JSON.parse(
  await readFile(
    new URL("../meridian-extension/manifest.json", import.meta.url),
    "utf8",
  ),
);

test("source and packaged manifests use the same minimum permissions", () => {
  assert.deepEqual(packagedManifest, rootManifest);
  assert.ok(rootManifest.permissions.includes("scripting"));
  assert.ok(!rootManifest.permissions.includes("bookmarks"));
  assert.ok(!rootManifest.permissions.includes("history"));
  assert.deepEqual(rootManifest.optional_permissions, ["bookmarks", "history"]);
  assert.deepEqual(rootManifest.host_permissions, ["<all_urls>"]);
});
