<!-- [task-doc-auto:reorder-search-engine-options-google-bing-duckdu-55fd] -->
# Reorder search engine options: Google, Bing, DuckDuckGo, Brave
_Auto-recorded on completion (2026-08-19T19:38:22.245Z)._

Updated the shared search-provider ordering in both runtime trees:

- `components/SearchBar.js`
- `meridian-extension/components/SearchBar.js`

The Settings selector now renders **Google, Bing, DuckDuckGo, Brave**. Engine IDs, names, URLs, and favicons are unchanged.

Validation:

- Confirmed the provider IDs appear in the requested order in both files.
- `git diff --check` passed.
- `node --test tests/*.test.mjs` passed: **145/145 tests**.
