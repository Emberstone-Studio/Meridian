<!-- [task-doc-auto:add-show-tabs-from-all-windows-current-window-on-2ee6] -->
# Add "show tabs from all windows / current window only" setting under Tab Organization
_Auto-recorded on completion (2026-08-19T18:49:02.331Z)._

Implemented the new **Show tabs from all windows** setting under Tab Organization.

- Defaults to enabled, preserving the existing all-window grid behavior.
- Persists through `chrome.storage.sync` and dispatches `settings-changed` so the workspace rerenders immediately.
- Uses `{ currentWindow: true }` for the main grid tab query when disabled.
- Mirrored the SettingsPanel and Meridian changes into `meridian-extension/`.
- Left browser-search indexing and thumbnail caching global because they are shared background data stores rather than visible-grid selectors.
- Added `tests/tabWindowScope.test.mjs` regression coverage.

Validation: `node --test tests/*.test.mjs` — 139 passed; packaged parity and `git diff --check` also passed.
