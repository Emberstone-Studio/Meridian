Implemented the thumbnail-cache hardening follow-up.

- Serialized thumbnail saves, pruning, and eviction through the access-map mutation queue.
- Changed access metadata to `{ t, b }`, pruned from metadata without loading all thumbnail blobs, and corrected ASCII data URL byte accounting.
- Removed the unused unsafe `saveWorkspaceData` export.
- Swallowed queued mutation failures in all async tab event listeners.
- Updated thumbnail tests for the metadata shape and byte-based pruning.

Validation: `node --test tests/*.test.mjs` - 10 tests passed; `git diff --check` passed.