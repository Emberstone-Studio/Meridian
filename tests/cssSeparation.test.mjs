import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".tasker" || entry.name === "tests") {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await javascriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("runtime JavaScript contains no embedded or direct CSS declarations", async () => {
  const files = await javascriptFiles(repoRoot);
  const forbidden = [
    /createElement\(\s*["']style["']\s*\)/,
    /\.style\.(?:cssText|[A-Za-z]+)\s*=/,
    /Object\.assign\([^,\n]*\.style\b/,
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        source,
        pattern,
        `${path.relative(repoRoot, file)} must keep CSS declarations in a stylesheet`,
      );
    }
  }
});

test("browser-result rules live in meridian.css", async () => {
  const css = await readFile(path.join(repoRoot, "meridian.css"), "utf8");
  for (const selector of [
    "#browser-search-results",
    ".search-results-section",
    ".result-row",
    ".search-clear-btn",
    ".search-web-go",
  ]) {
    assert.match(css, new RegExp(selector.replace(".", "\\.")));
  }
});

test("anything search has no stale grid-filter calls", async () => {
  for (const file of ["meridian.js", "meridian-extension/meridian.js"]) {
    const source = await readFile(path.join(repoRoot, file), "utf8");
    assert.doesNotMatch(
      source,
      /\bresetGridFilter\b/,
      `${file} must not call the removed grid-filter helper`,
    );
  }
});
