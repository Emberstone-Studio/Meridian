Updated `components/ContextMenu.js` to statically import `getWorkspaceData` alongside the other workspace manager helpers and replaced the dynamic import call with `getWorkspaceData()`.

Validation:
- `node --check components/ContextMenu.js` passed.
- Confirmed the dynamic workspace manager import is absent.
- `git diff --check` passed.