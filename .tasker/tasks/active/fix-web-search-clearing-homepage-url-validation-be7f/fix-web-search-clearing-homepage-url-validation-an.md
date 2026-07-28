Implemented all three interaction fixes:

- Web searches submitted with Enter now use `clearSearch()`, clearing both the field and popup/query state.
- Homepage settings now accept only absolute HTTP(S) URLs, normalize valid values, expose inline accessible validation feedback, and guard startup navigation failures.
- Sidebar tab, previous-tab, and search-result rows now have focusability, accessible button names, Enter/Space activation, and visible focus styling.
- Kept the root and packaged extension sources synchronized.

Validation: `node --test tests/*.test.mjs` - 40 tests passed; affected JavaScript files also passed `node --check`, and `git diff --check` passed.