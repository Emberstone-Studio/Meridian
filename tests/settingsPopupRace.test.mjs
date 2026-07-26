import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Could not find ${signature}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not find the end of ${signature}`);
}

const source = await readFile(
  new URL("../meridian.js", import.meta.url),
  "utf8",
);

test("Settings invalidates retained-query results before taking popup ownership", () => {
  const calls = [];
  const openSettingsFromSearch = new Function(
    "searchBarApi",
    "clearBrowserSearch",
    "openSettings",
    `${extractFunction(source, "function openSettingsFromSearch(")}
     return openSettingsFromSearch;`,
  )(
    {
      getScope: () => "history",
      setScope: (scope) => calls.push(["scope", scope]),
    },
    () => calls.push(["clear"]),
    () => calls.push(["open"]),
  );

  openSettingsFromSearch();

  assert.deepEqual(calls, [
    ["scope", "all"],
    ["clear"],
    ["open"],
  ]);
});

test("clearing browser search invalidates every pending search generation", () => {
  const clearBrowserSearch = extractFunction(
    source,
    "function clearBrowserSearch(",
  );

  assert.match(clearBrowserSearch, /browserSearchActive = false/);
  assert.match(clearBrowserSearch, /browserSearchSequence \+= 1/);
  assert.match(clearBrowserSearch, /resultsPopup\?\.close\(\)/);
});
