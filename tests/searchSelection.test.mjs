import assert from "node:assert/strict";
import test from "node:test";

import { createSearchSelection } from "../components/SearchSelection.js";

class FakeClassList {
  constructor(...names) {
    this.values = new Set(names);
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeRow {
  constructor(name, className = "result-row") {
    this.name = name;
    this.classList = new FakeClassList(...className.split(" "));
    this.attributes = new Map();
    this.clicks = 0;
    this.scrolls = [];
    this.disabled = false;
    this.hidden = false;
  }

  matches(selector) {
    return selector
      .split(".")
      .filter(Boolean)
      .every((name) => this.classList.contains(name));
  }

  closest(selector) {
    return this.matches(selector) ? this : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  scrollIntoView(options) {
    this.scrolls.push(options);
  }

  click() {
    this.clicks += 1;
  }
}

class FakePanel {
  constructor(rows = []) {
    this.rows = rows;
    this.listeners = new Map();
  }

  querySelectorAll(selector) {
    return this.rows.filter((row) => row.matches(selector));
  }

  contains(node) {
    return this.rows.includes(node);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, target) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target });
    }
  }
}

function makePopup(rows = []) {
  let open = true;
  const openListeners = [];
  return {
    el: new FakePanel(rows),
    isOpen: () => open,
    addOpenChangeListener(listener) {
      openListeners.push(listener);
    },
    setOpen(next) {
      open = next;
      openListeners.forEach((listener) => listener(next));
    },
  };
}

test("Up and Down wrap through result rows across every search section", () => {
  const rows = [
    new FakeRow("Open Tabs"),
    new FakeRow("Bookmarks"),
    new FakeRow("History"),
    new FakeRow("Web"),
  ];
  const selection = createSearchSelection(makePopup(rows));

  for (const row of rows) {
    assert.equal(selection.move(1), true);
    assert.equal(selection.getSelected(), row);
    assert.deepEqual(row.scrolls.at(-1), { block: "nearest" });
    assert.equal(
      rows.filter((candidate) =>
        candidate.classList.contains("search-selection-active"),
      ).length,
      1,
    );
  }

  selection.move(1);
  assert.equal(selection.getSelected(), rows[0]);
  selection.move(-1);
  assert.equal(selection.getSelected(), rows.at(-1));
});

test("activation clicks only the current live row and empty results are safe", () => {
  const selected = new FakeRow("selected");
  const popup = makePopup([selected]);
  const selection = createSearchSelection(popup);

  assert.equal(selection.activate(), false);
  selection.move(1);
  assert.equal(selection.activate(), true);
  assert.equal(selected.clicks, 1);

  selection.reset();
  popup.el.rows = [];
  assert.equal(selection.move(1), false);
  assert.equal(selection.move(-1), false);
  assert.equal(selection.activate(), false);
});

test("async row replacement and popup visibility invalidate stale selection", () => {
  const oldRow = new FakeRow("old");
  const replacement = new FakeRow("replacement");
  const popup = makePopup([oldRow]);
  const selection = createSearchSelection(popup);

  selection.move(1);
  selection.reset();
  popup.el.rows = [replacement];

  assert.equal(
    oldRow.classList.contains("search-selection-active"),
    false,
  );
  assert.equal(selection.activate(), false);
  selection.move(1);
  assert.equal(selection.getSelected(), replacement);

  popup.setOpen(false);
  assert.equal(selection.getSelected(), null);
  assert.equal(
    replacement.classList.contains("search-selection-active"),
    false,
  );
});

test("option ids and active descendant stay synchronized across rerenders", () => {
  const first = new FakeRow("first");
  const second = new FakeRow("second");
  const popup = makePopup([first, second]);
  const activeChanges = [];
  const selection = createSearchSelection(popup, {
    idPrefix: "result",
    onActiveDescendantChange: (id) => activeChanges.push(id),
  });

  assert.equal(selection.sync(), 2);
  assert.match(first.id, /^result-\d+$/);
  assert.match(second.id, /^result-\d+$/);
  assert.notEqual(first.id, second.id);
  assert.equal(first.getAttribute("role"), "option");
  assert.equal(first.getAttribute("aria-selected"), "false");

  const stableId = first.id;
  selection.sync();
  assert.equal(first.id, stableId);

  selection.move(1);
  assert.equal(activeChanges.at(-1), first.id);
  assert.equal(first.getAttribute("aria-selected"), "true");

  const replacement = new FakeRow("replacement");
  popup.el.rows = [replacement];
  selection.sync();
  assert.equal(selection.getSelected(), null);
  assert.equal(activeChanges.at(-1), null);
  assert.equal(first.getAttribute("aria-selected"), "false");
  assert.equal(replacement.getAttribute("role"), "option");

  selection.move(1);
  popup.setOpen(false);
  assert.equal(activeChanges.at(-1), null);
});

test("scoped popups navigate their result rows and mouse hover stays in sync", () => {
  const tabControl = new FakeRow("tab", "bookmarks-tab");
  const first = new FakeRow("first", "bookmark-row");
  const second = new FakeRow("second", "bookmark-row");
  const popup = makePopup([tabControl, first, second]);
  const selection = createSearchSelection(popup, {
    rowSelector: ".bookmark-row",
  });

  selection.move(1);
  assert.equal(selection.getSelected(), first);
  popup.el.dispatch("pointerover", second);
  assert.equal(selection.getSelected(), second);
  assert.equal(
    first.classList.contains("search-selection-active"),
    false,
  );
  assert.equal(selection.activate(), true);
  assert.equal(second.clicks, 1);
});
