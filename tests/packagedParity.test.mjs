import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import test from "node:test";

const rootRuntimeFiles = [
  "background.js",
  "manifest.json",
  "meridian.css",
  "meridian.html",
  "meridian.js",
];

async function filesBelow(directory) {
  const directoryUrl = new URL(`../${directory}/`, import.meta.url);
  const directoryPath = fileURLToPath(directoryUrl);
  const entries = await readdir(directoryUrl, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(directoryPath, join(entry.parentPath, entry.name))
        .split(sep)
        .join("/"),
    )
    .map((path) => `${directory}/${path}`)
    .sort();
}

test("the packaged extension matches every runtime source file", async () => {
  const runtimeFiles = [
    ...rootRuntimeFiles,
    ...(await filesBelow("components")),
    ...(await filesBelow("utils")),
  ];

  for (const path of runtimeFiles) {
    const [source, packaged] = await Promise.all([
      readFile(new URL(`../${path}`, import.meta.url), "utf8"),
      readFile(new URL(`../meridian-extension/${path}`, import.meta.url), "utf8"),
    ]);
    assert.equal(
      packaged.replaceAll("\r\n", "\n"),
      source.replaceAll("\r\n", "\n"),
      path,
    );
  }
});
