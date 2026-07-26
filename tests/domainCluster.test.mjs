import assert from "node:assert/strict";
import test from "node:test";

import {
  clusterTabsByDomain,
  getRootDomain,
} from "../utils/domainCluster.js";

test("registrable domains remain distinct beneath multi-label public suffixes", () => {
  assert.equal(getRootDomain("https://news.bbc.co.uk/story"), "bbc.co.uk");
  assert.equal(
    getRootDomain("https://www.example.co.uk/article"),
    "example.co.uk",
  );
  assert.equal(getRootDomain("https://a.b.example.com.au"), "example.com.au");

  const clusters = clusterTabsByDomain([
    { id: 1, url: "https://news.bbc.co.uk/one" },
    { id: 2, url: "https://sport.bbc.co.uk/two" },
    { id: 3, url: "https://www.example.co.uk/one" },
    { id: 4, url: "https://shop.example.co.uk/two" },
  ]);

  assert.deepEqual(
    [...clusters.entries()].map(([name, tabs]) => [
      name,
      tabs.map((tab) => tab.id),
    ]),
    [
      ["Bbc", [1, 2]],
      ["Example", [3, 4]],
    ],
  );
});

test("private PSL suffixes produce separate registrable domains", () => {
  assert.equal(
    getRootDomain("https://alpha.github.io/dashboard"),
    "alpha.github.io",
  );
  assert.equal(
    getRootDomain("https://beta.github.io/dashboard"),
    "beta.github.io",
  );
});
