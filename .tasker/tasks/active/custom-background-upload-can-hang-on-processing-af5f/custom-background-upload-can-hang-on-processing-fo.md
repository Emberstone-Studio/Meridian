Implemented invalid custom-background upload recovery.

- resizeToDataUrl() now revokes the blob URL and resolves null when image decoding fails.
- The upload handler surfaces the error, preserves stored background data, and re-enables the upload button.
- Added regression coverage for failed image decoding and object URL cleanup.

Verification: node --test tests/*.test.mjs (3 passed); syntax checks passed; git diff --check passed.