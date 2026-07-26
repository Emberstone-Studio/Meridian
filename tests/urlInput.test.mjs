import assert from "node:assert/strict";
import test from "node:test";

import { normalizeUrlInput } from "../utils/urlInput.js";

test("normalizes explicit and scheme-less web URLs", () => {
  assert.equal(
    normalizeUrlInput("https://example.com/docs?q=search"),
    "https://example.com/docs?q=search",
  );
  assert.equal(
    normalizeUrlInput("example.com/docs"),
    "https://example.com/docs",
  );
  assert.equal(
    normalizeUrlInput("www.example.com"),
    "https://www.example.com/",
  );
});

test("recognizes local development and IP addresses", () => {
  assert.equal(
    normalizeUrlInput("localhost:3000/settings"),
    "http://localhost:3000/settings",
  );
  assert.equal(
    normalizeUrlInput("127.0.0.1:8080"),
    "http://127.0.0.1:8080/",
  );
  assert.equal(
    normalizeUrlInput("[::1]:4173"),
    "http://[::1]:4173/",
  );
});

test("keeps ambiguous or unsafe input as a search query", () => {
  for (const input of [
    "meridian browser",
    "meridian",
    "javascript:alert(1)",
    "data:text/html,test",
    "user@example.com",
    "not a url.com",
  ]) {
    assert.equal(normalizeUrlInput(input), null, input);
  }
});
