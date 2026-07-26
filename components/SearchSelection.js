let nextOptionId = 0;

export function createSearchSelection(
  popup,
  {
    rowSelector = ".result-row",
    idPrefix = "search-option",
    onActiveDescendantChange,
  } = {},
) {
  let selected = null;
  let activeDescendant = null;

  function candidates() {
    return [...(popup.el.querySelectorAll?.(rowSelector) ?? [])].filter(
      (row) =>
        !row.disabled &&
        !row.hidden &&
        row.getAttribute("aria-hidden") !== "true",
    );
  }

  function prepareRows() {
    const available = candidates();
    for (const row of available) {
      if (!row.id) row.id = `${idPrefix}-${++nextOptionId}`;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(row === selected));
    }
    return available;
  }

  function rows() {
    if (!popup.isOpen()) return [];
    return prepareRows();
  }

  function notifyActiveDescendant(row) {
    const next = row?.id || null;
    if (activeDescendant === next) return;
    activeDescendant = next;
    onActiveDescendantChange?.(next);
  }

  function setSelected(row, { scroll = false } = {}) {
    if (selected && selected !== row) {
      selected.classList.remove("search-selection-active");
      selected.setAttribute("aria-selected", "false");
    }

    selected = row && popup.el.contains(row) ? row : null;
    if (!selected) {
      notifyActiveDescendant(null);
      return;
    }

    selected.classList.add("search-selection-active");
    selected.setAttribute("aria-selected", "true");
    notifyActiveDescendant(selected);
    if (scroll) {
      selected.scrollIntoView?.({ block: "nearest" });
    }
  }

  function reset() {
    if (selected) {
      selected.classList.remove("search-selection-active");
      selected.setAttribute("aria-selected", "false");
    }
    selected = null;
    notifyActiveDescendant(null);
  }

  function sync() {
    const available = prepareRows();
    if (selected && !available.includes(selected)) reset();
    return available.length;
  }

  function move(delta) {
    const available = rows();
    if (!available.length) {
      reset();
      return false;
    }

    const current = available.indexOf(selected);
    const next =
      current === -1
        ? delta < 0
          ? available.length - 1
          : 0
        : (current + delta + available.length) % available.length;
    setSelected(available[next], { scroll: true });
    return true;
  }

  function activate() {
    const available = rows();
    if (!selected || !available.includes(selected)) {
      reset();
      return false;
    }
    selected.click();
    return true;
  }

  function selectFromPointer(event) {
    const row = event.target.closest?.(rowSelector);
    if (row && popup.el.contains(row)) setSelected(row);
  }

  popup.el.addEventListener("pointerover", selectFromPointer);
  popup.el.addEventListener("pointerdown", selectFromPointer);
  popup.addOpenChangeListener?.(reset);

  return {
    move,
    activate,
    reset,
    sync,
    getSelected: () => selected,
  };
}
