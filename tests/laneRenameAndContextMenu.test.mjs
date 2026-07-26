import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Could not find ${signature}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not find the end of ${signature}`);
}

class FakeEditableTitle {
  constructor(text) {
    this.textContent = text;
    this.contentEditable = "false";
    this.listeners = new Map();
    this.focused = false;
  }

  addEventListener(type, listener, options) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, once: options?.once === true });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      listeners.filter((entry) => entry.listener !== listener),
    );
  }

  dispatch(type, event = {}) {
    for (const entry of [...(this.listeners.get(type) ?? [])]) {
      entry.listener(event);
      if (entry.once) this.removeEventListener(type, entry.listener);
    }
  }

  focus() {
    this.focused = true;
  }

  blur() {
    if (!this.focused) return;
    this.focused = false;
    this.dispatch("blur");
  }
}

const laneSource = await readFile(
  new URL("../components/WorkspaceLane.js", import.meta.url),
  "utf8",
);
const startRenameSource = extractFunction(
  laneSource,
  "function startRename(",
);
const startRename = new Function(
  "document",
  `${startRenameSource}; return startRename;`,
)({
  execCommand(command) {
    assert.equal(command, "selectAll");
  },
});

function keyEvent(key) {
  return {
    key,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

test("lane rename accepts typing before Enter and commits only once", () => {
  const title = new FakeEditableTitle("Original");
  const commits = [];
  startRename(title, (name) => commits.push(name));

  title.textContent = "A";
  title.dispatch("keydown", keyEvent("A"));
  title.textContent = "Arbitrary renamed lane";
  title.dispatch("keydown", keyEvent("e"));
  const enter = keyEvent("Enter");
  title.dispatch("keydown", enter);
  title.blur();

  assert.equal(enter.defaultPrevented, true);
  assert.equal(title.contentEditable, "false");
  assert.equal(title.textContent, "Arbitrary renamed lane");
  assert.deepEqual(commits, ["Arbitrary renamed lane"]);
});

test("lane rename restores the original title on Escape after typing", () => {
  const title = new FakeEditableTitle("Original");
  const commits = [];
  startRename(title, (name) => commits.push(name));

  title.textContent = "Changed";
  title.dispatch("keydown", keyEvent("d"));
  const escape = keyEvent("Escape");
  title.dispatch("keydown", escape);
  title.blur();

  assert.equal(escape.defaultPrevented, true);
  assert.equal(title.contentEditable, "false");
  assert.equal(title.textContent, "Original");
  assert.deepEqual(commits, []);
});

test("lane rename commits once on blur after typing", () => {
  const title = new FakeEditableTitle("Original");
  const commits = [];
  startRename(title, (name) => commits.push(name));

  title.textContent = "Blurred title";
  title.dispatch("keydown", keyEvent("e"));
  title.blur();
  title.blur();

  assert.equal(title.contentEditable, "false");
  assert.deepEqual(commits, ["Blurred title"]);
});

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  add(...names) {
    names.forEach((name) => this.element.classes.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.element.classes.delete(name));
  }

  contains(name) {
    return this.element.classes.has(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.classes = new Set();
    this.classList = new FakeClassList(this);
    this.listeners = new Map();
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
    };
    this.textContent = "";
  }

  set className(value) {
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this.classes].join(" ");
  }

  set innerHTML(value) {
    assert.equal(value, "");
    this.children = [];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute() {}

  contains(target) {
    return (
      target === this || this.children.some((child) => child.contains(target))
    );
  }

  click() {
    this.listeners.get("click")?.({ stopPropagation() {} });
  }

  getBoundingClientRect() {
    return { right: 100, bottom: 100, width: 100, height: 100 };
  }
}

test("moving to a new native group clears the Meridian assignment before rename", async () => {
  const actions = [];
  const storage = {
    workspaces: {
      version: 2,
      workspaces: [
        { id: "unsorted", name: "Unsorted" },
        { id: "old-workspace", name: "Old workspace" },
      ],
      assignments: { 7: "old-workspace" },
    },
  };

  const body = new FakeElement("body");
  let resolveRename;
  const renameDispatched = new Promise((resolve) => {
    resolveRename = resolve;
  });
  globalThis.document = {
    body,
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    addEventListener() {},
    dispatchEvent(event) {
      actions.push("dispatch");
      resolveRename(event);
    },
  };
  globalThis.window = { innerWidth: 1000, innerHeight: 1000 };
  globalThis.requestAnimationFrame = (callback) => callback();
  globalThis.CustomEvent = class {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: structuredClone(storage[key]) };
        },
        async set(update) {
          actions.push("storage.set");
          Object.assign(storage, structuredClone(update));
        },
      },
    },
    tabs: {
      async group() {
        actions.push("group");
        return 42;
      },
      async ungroup() {
        actions.push("ungroup");
      },
    },
    tabGroups: {
      async query() {
        return [];
      },
      async update() {
        actions.push("update");
      },
    },
  };

  const { show } = await import("../components/ContextMenu.js?native-group-test");
  await show({ id: 7, groupId: -1 }, 0, 0);
  actions.length = 0;

  const menu = body.children[0];
  const moveToNewGroup = menu.children.find(
    (item) => item.textContent === "Move to new group",
  );
  moveToNewGroup.click();
  const renameEvent = await renameDispatched;

  assert.deepEqual(actions, ["group", "update", "storage.set", "dispatch"]);
  assert.equal(renameEvent.type, "focus-lane-rename");
  assert.deepEqual(renameEvent.detail, { laneId: "cg_42" });
  assert.equal(
    Object.hasOwn(storage.workspaces.assignments, "7"),
    false,
    "the old Meridian assignment must not reappear when the native group is removed",
  );
});
