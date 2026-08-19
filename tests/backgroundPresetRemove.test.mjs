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

const settings = await readFile(
  new URL("../components/SettingsPanel.js", import.meta.url),
  "utf8",
);
const css = await readFile(new URL("../meridian.css", import.meta.url), "utf8");

const documentStub = {
  activeElement: null,
  createElement(tagName) {
    return new TestElement(tagName);
  },
};

class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { setProperty() {} };
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  focus() {
    documentStub.activeElement = this;
  }

  dispatchEvent(event) {
    Object.defineProperty(event, "target", {
      configurable: true,
      value: this,
    });
    let propagationStopped = false;
    const stopPropagation = event.stopPropagation.bind(event);
    event.stopPropagation = () => {
      propagationStopped = true;
      stopPropagation();
    };

    let current = this;
    do {
      for (const listener of current.listeners.get(event.type) ?? []) {
        listener.call(current, event);
      }
      current =
        event.bubbles && !propagationStopped ? current.parentElement : null;
    } while (current);

    return !event.defaultPrevented;
  }
}

function keyboardEvent(type, key) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { value: key });
  return event;
}

function activateButtonWithKeyboard(button, key) {
  button.focus();
  const keydownAllowed = button.dispatchEvent(keyboardEvent("keydown", key));
  const keyupAllowed =
    key === " " ? button.dispatchEvent(keyboardEvent("keyup", key)) : true;
  if (keydownAllowed && keyupAllowed) {
    button.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
  }
}

function createMakeSwatch(selections) {
  return new Function(
    "document",
    "selectBg",
    "DEFAULT_BACKGROUND",
    `${extractFunction(settings, "function makeSwatch(opts)")}; return makeSwatch;`,
  )(
    documentStub,
    (type, value) => selections.push({ type, value }),
    { type: "theme", value: "topo" },
  );
}

test("preset selection and removal are sibling native buttons", () => {
  const selections = [];
  let activations = 0;
  const makeSwatch = createMakeSwatch(selections);
  const selected = makeSwatch({
    selected: true,
    background: "#ffffff",
    label: "White",
    onClick() {
      activations += 1;
    },
  });

  assert.equal(selected.className, "settings-bg-preset selected");
  assert.equal(selected.attributes.has("role"), false);
  assert.equal(selected.tabIndex, undefined);
  assert.equal(selected.children.length, 2);

  const [selectBtn, removeBtn] = selected.children;
  assert.equal(selectBtn.tagName, "button");
  assert.equal(selectBtn.type, "button");
  assert.equal(
    selectBtn.className,
    "settings-bg-swatch settings-bg-preset-select",
  );
  assert.equal(selectBtn.attributes.get("aria-label"), "White");
  assert.equal(selectBtn.attributes.get("aria-pressed"), "true");
  assert.equal(removeBtn.tagName, "button");
  assert.equal(removeBtn.className, "settings-bg-preset-remove");
  assert.equal(
    removeBtn.attributes.get("aria-label"),
    "Remove White background",
  );
  assert.equal(selectBtn.parentElement, selected);
  assert.equal(removeBtn.parentElement, selected);

  selectBtn.dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(activations, 1);
  removeBtn.dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(activations, 1);
  assert.deepEqual(selections, [{ type: "theme", value: "topo" }]);

  const unselected = makeSwatch({
    selected: false,
    label: "Black",
    onClick() {},
  });
  assert.equal(unselected.children.length, 1);
  assert.equal(unselected.children[0].attributes.get("aria-pressed"), "false");
});

for (const key of ["Enter", " "]) {
  test(`focused preset remove button handles ${JSON.stringify(key)} without selecting`, () => {
    const selections = [];
    let activations = 0;
    const selected = createMakeSwatch(selections)({
      selected: true,
      label: "White",
      onClick() {
        activations += 1;
      },
    });
    const removeBtn = selected.children[1];

    activateButtonWithKeyboard(removeBtn, key);

    assert.equal(documentStub.activeElement, removeBtn);
    assert.equal(activations, 0);
    assert.deepEqual(selections, [{ type: "theme", value: "topo" }]);
  });
}

test("the custom image exposes its remove control only while selected", () => {
  assert.match(
    settings,
    /const customSelected = currentBg\.type === "custom";/,
  );
  assert.match(
    settings,
    /if \(customSelected\) \{\s*const removeBtn = document\.createElement\("button"\);\s*removeBtn\.type = "button";\s*removeBtn\.className = "settings-bg-custom-remove";/,
  );
});

test("the background grids include White and keep topo implicit", () => {
  assert.match(settings, /value: "#ffffff", label: "White"/);
  assert.doesNotMatch(settings, /label: "Garnet"/);
  assert.doesNotMatch(settings, /label: "No background"/);
  assert.doesNotMatch(settings, /settings-bg-swatch--none/);
  assert.doesNotMatch(settings, /label: "Topographic"/);
  assert.doesNotMatch(settings, /background: "var\(--default-bg-image\)"/);
  assert.match(settings, /generateSeeds\(11/);

  assert.match(
    css,
    /\.settings-bg-preset:hover \.settings-bg-preset-remove/,
  );
  assert.match(css, /\.settings-bg-custom:hover,\s*\.settings-bg-preset:hover/);
  assert.match(
    css,
    /\.settings-bg-custom\.selected,\s*\.settings-bg-preset\.selected/,
  );
  assert.match(
    css,
    /\.settings-bg-swatch \{[\s\S]*?transition:\s*box-shadow var\(--transition\),\s*transform var\(--transition\);/,
  );
  assert.match(
    settings,
    /swatch\.className =\s*"settings-bg-preset" \+ \(opts\.selected \? " selected" : ""\)/,
  );
  assert.match(
    settings,
    /selectBtn\.className = "settings-bg-swatch settings-bg-preset-select";/,
  );
  assert.match(css, /\.settings-bg-preset-select \{[\s\S]*?inset: 0;/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(
    css,
    /\.settings-bg-preset:hover > \.settings-bg-swatch/,
  );
  assert.doesNotMatch(css, /\.settings-bg-swatch--none/);
});
