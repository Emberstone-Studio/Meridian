import assert from "node:assert/strict";
import test from "node:test";

import { createTabCard } from "../components/TabCard.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.style = { setProperty() {} };
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  replaceWith(replacement) {
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.children.splice(index, 1, replacement);
    replacement.parentNode = this.parentNode;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute() {}

  removeAttribute(name) {
    delete this[name];
  }

  matches() {
    return false;
  }
}

test("a failed thumbnail retries, keeps its local copy, and requests a later refresh", async () => {
  const thumbnail = "data:image/jpeg;base64,corrupt";
  const messages = [];
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
  };
  globalThis.chrome = {
    tabs: { update() {} },
    runtime: {
      async sendMessage(message) {
        messages.push(message);
        return { removed: true };
      },
    },
  };

  const card = createTabCard(
    { id: 7, title: "Example", url: "https://example.test" },
    thumbnail,
  );
  const image = card.children[0];
  image.onerror();
  assert.equal(card.children[0], image);
  assert.deepEqual(messages, []);

  image.onerror();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(card.children[0].className, "card-thumbnail-placeholder");
  assert.equal(card.children[0].textContent, "E");
  assert.deepEqual(messages, [{
    type: "MARK_THUMBNAIL_REFRESH_NEEDED",
    tabId: 7,
  }]);
});
