## Completed

- Added a comprehensive `chrome.storage.onChanged` subscriber so all settings-panel controls update from the shared sync store across open windows.
- Updated live Meridian pages to reapply theme/background settings, refresh local-search scope controls, and rerender tab organization when synced preferences change.
- Mirrored all runtime changes into `meridian-extension/` and added cross-window regression coverage.

## Verification

- `node --check` passed for all four changed runtime files.
- `node --test tests/*.test.mjs`: 144 passed, 0 failed.
- `git diff --check` passed.
- Source/package parity confirmed with `cmp` and the packaged parity test.

Final report format: Markdown in the `output` field of a Tasker `kind: "complete"` report.