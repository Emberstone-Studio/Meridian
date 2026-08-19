## Completed

- Added a `customBackgroundRevision` signal after successful IndexedDB saves and deletions.
- Added serialized, revision-aware blob URL refreshes that create the replacement before deferring revocation of the prior URL.
- Updated every open Meridian page to refetch and reapply appearance on image revisions.
- Updated an already-open Settings panel to refetch the custom thumbnail, preserve current selection for replacements, clear it on deletion, and rerender without reload.
- Mirrored all runtime changes into `meridian-extension`.
- Added regression coverage for second-document upload/deletion and listener wiring.

## Verification

- `node --test` — 156 tests passed.
- `node --check` passed for all changed source JavaScript entry points.
- `git diff --check` passed.
- Packaged parity test passed.