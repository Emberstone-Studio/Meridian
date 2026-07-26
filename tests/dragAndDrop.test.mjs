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

const laneSource = await readFile(
  new URL("../components/WorkspaceLane.js", import.meta.url),
  "utf8",
);
const meridianSource = await readFile(
  new URL("../meridian.js", import.meta.url),
  "utf8",
);

test("placeholder movement avoids a forced-layout animation loop", () => {
  const movePlaceholder = extractFunction(
    laneSource,
    "function movePlaceholder(",
  );
  const removePlaceholder = extractFunction(
    laneSource,
    "function removePlaceholder(",
  );

  assert.doesNotMatch(
    movePlaceholder + removePlaceholder,
    /getBoundingClientRect|offsetHeight|applyFlip/,
  );
});

test("browser-driven renders are deferred while a tab drag is active", () => {
  const scheduleRender = extractFunction(
    meridianSource,
    "function scheduleRender(",
  );

  assert.match(scheduleRender, /isTabDragActive\(\)/);
  assert.match(scheduleRender, /renderDeferredByDrag = true/);
  assert.match(
    meridianSource,
    /function flushDeferredDragRender\(\)[\s\S]*?scheduleRender\(\)/,
  );
});
