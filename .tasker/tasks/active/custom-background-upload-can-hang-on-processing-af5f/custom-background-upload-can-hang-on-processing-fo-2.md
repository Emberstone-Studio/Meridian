Implemented and verified invalid custom-background upload recovery.

- `resizeToDataUrl()` revokes the blob URL and resolves `null` when image decoding fails.
- The upload handler displays an error for a null result and always re-enables the upload button through `finally`.
- Regression coverage verifies failed decoding settles and cleans up the object URL.

Verification: `node --test tests/*.test.mjs` (3 passed), syntax checks passed, `git diff --check` passed, and the worktree is clean.