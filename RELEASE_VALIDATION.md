# Release validation

Validated on July 25, 2026 with Node.js 24.12.0 and Google Chrome
150.0.7871.182 on Windows.

## Automated validation

Commands run from the repository root:

```powershell
node --test tests/*.test.mjs

$jsFiles = rg --files -g '*.js' -g '!node_modules'
foreach ($file in $jsFiles) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $file" }
}

rg -n "google\.com/s2/favicons|icons\.duckduckgo\.com/ip|faviconkit\.com|favicons?\.clearbit\.com" . -g '!PRIVACY.md' -g '!tests/**' -g '!*.svg'

git diff --check
```

Results (automated suite rerun July 26, 2026 after the permission rework):

- `node --test`: 43 passed, 0 failed.
- `node --check`: all 40 JavaScript files parsed successfully.
- Third-party favicon-fallback scan: no shipped runtime matches.
- Source/package parity: every root runtime file and every file below
  `components/` and `utils/` matches its `meridian-extension/` release copy.
- `git diff --check`: passed.

The package-parity regression was also run before synchronizing the release
copy. It failed on the stale packaged `ContextMenu.js` and `WorkspaceLane.js`,
then passed after those files were brought in line with the tested source.

## Unpacked Chrome validation

Chrome was launched with a new temporary profile:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  --no-first-run `
  --no-default-browser-check `
  --disable-component-update `
  --disable-sync `
  --remote-debugging-port=0 `
  --user-data-dir='C:\Users\russp\AppData\Local\Temp\meridian-chrome-manual-30618620e6cb46e29abd7116a3709ac5' `
  chrome://extensions/
```

Developer mode was enabled and
`meridian-extension/` was selected through Chrome's **Load unpacked** control.
The loaded extension page and service worker used extension id
`efilfepjolncinpenanpkjlffakkpooe` in this temporary profile. DevTools Protocol
was used only after this normal UI-based load to exercise and inspect the
extension.

Smoke results:

- Startup rendered a complete Meridian page with one initial lane, two tab
  cards, and no extension-page exception.
- Local search returned an open-tab result and a web-search row. Clearing the
  query emptied the field and closed the results popup.
- `/` focused search and `Escape` removed focus.
- Settings opened with all theme and local-search controls. Changing the theme
  to Dark survived a full extension-page reload and applied `data-theme="dark"`;
  the temporary profile was restored to its original System setting afterward.
- A real Chrome tab group rendered as a Meridian lane. Native lane rename
  committed on Enter, restored the prior title on Escape, and committed on
  blur.
- Moving a tab with a Meridian assignment to a new native Chrome group removed
  the old assignment after the asynchronous operation completed.
- A full thumbnail refresh returned `{done: true}` and stored a JPEG data URL
  for an HTTPS tab. Test tabs, groups, assignments, and thumbnail data were
  removed afterward.
- The side panel rendered four rows. Rows exposed `role="button"` and
  `tabindex="0"`, and Enter activated the selected row.
- Bookmark and history permissions were absent in the fresh profile, matching
  the disabled-by-default optional-source behavior. Automated coverage verifies
  grant denial, disabling, and later revocation.

The clean extension-page and side-panel console captures contained no errors or
warnings. The service worker contained no unhandled exception. It did emit two
handled thumbnail warnings while the validation itself activated
Chrome-internal/extension pages: Chrome denied capture for an empty privileged
URL and for a page without an active-tab grant. The worker caught both failures,
continued running, and subsequently captured the HTTPS smoke-test tab.

## Chrome Web Store risk assessment

No code or automated-test release blocker remains.

The following publisher-side items remain blockers for a Chrome Web Store
submission until the publisher verifies them; repository validation cannot
waive them:

- Publish a reachable privacy-policy URL matching `PRIVACY.md` and reconcile
  the store's data-use answers with tab URLs/titles, optional bookmarks and
  history, captured page screenshots, and synced preferences.
- Provide and review the justification for persistent `<all_urls>`,
  `scripting`, `unlimitedStorage`, thumbnail capture, automatic page-metadata
  indexing, and the optional permissions.
- Confirm that the listing discloses fixed search-provider icon requests and
  Picsum photo requests, and audit the exact upload archive against the source
  tested here.

The handled capture warnings on privileged Chrome pages are not a functional
blocker, but they can appear in the service-worker console during ordinary use.
Chrome Web Store review may also scrutinize the broad host permission and the
storage of visible-page screenshots even though both are documented and used
by the shipped thumbnail feature.
