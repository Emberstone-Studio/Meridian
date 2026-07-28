Implemented accessible combobox/listbox behavior for Meridian search in both root and packaged extension sources.

- Added combobox state to the search input with synchronized `aria-expanded`, `aria-controls`, `aria-autocomplete`, and `aria-activedescendant`.
- Added listbox/group/option semantics, stable unique option IDs, `aria-selected`, and popup-close/asynchronous-rerender cleanup while preserving existing button, folder, pointer, Enter, Arrow key, Web fallback, direct URL, and navigation behavior.
- Added a deduplicated polite live region for loading, scope changes, result counts, empty results, permission-disabled sources, and load failures.
- Added regression tests for popup roles, combobox state transitions, active option movement/replacement/closing, scope announcements, permission announcements, empty announcements, and result counts.
- Mirrored all runtime changes to `meridian-extension/`.

Validation: `node --test tests/*.test.mjs` - 74 passed, 0 failed. `git diff --check` passed. Packaged runtime parity passed.