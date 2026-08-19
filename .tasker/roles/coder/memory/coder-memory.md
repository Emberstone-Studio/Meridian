# Coder Memory

*No entries yet.*

### fix-stale-search-results-race-in-handlebrowserqu-c50b
**Title:** Fix stale search results race in handleBrowserQuery
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### contextmenu-js-use-static-import-for-getworkspac-fabf
**Title:** ContextMenu.js: use static import for getWorkspaceData
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### serialize-chrome-storage-read-modify-write-to-fi-0606
**Title:** Serialize chrome.storage read-modify-write to fix lost-update races
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### thumbnails-add-unlimitedstorage-switch-capture-t-ec14
**Title:** Thumbnails: add unlimitedStorage + switch capture to WebP
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### sync-custom-background-across-devices-with-per-d-cae5
**Title:** Sync custom background across devices with per-device override
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### refreshallthumbnails-restore-active-tab-even-if-23bb
**Title:** refreshAllThumbnails: restore active tab even if capture throws mid-loop
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### custom-background-upload-can-hang-on-processing-af5f
**Title:** Custom background upload can hang on 'Processing…' for bad files
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### harden-thumbnail-cache-serialize-pruning-fix-byt-4568
**Title:** Harden thumbnail cache: serialize pruning + fix byte accounting
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### search-command-center-scoped-omni-search-bookmar-6909
**Title:** Search command center: scoped omni-search (Bookmarks/History) + relocate New Group
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-25

### gate-local-search-data-access-and-minimize-exten-e0ab
**Title:** Gate local search data access and minimize extension permissions
**Tags:** Maintenance
**Summary:** Optional bookmark/history search now requires both an explicit saved true preference and the corresponding Chrome permission. Missing preferences remain disabled even if an old grant exists, and no permission inspection or underlying…
**Key decisions:** 
**Status:** ready
**Last updated:** 2026-07-26

### remove-stale-closed-tabs-during-browser-search-i-d232
**Title:** Remove stale closed tabs during browser search index rebuild
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** ready
**Last updated:** 2026-07-26

### prevent-automatic-thumbnail-capture-from-saving-5df5
**Title:** Prevent automatic thumbnail capture from saving the wrong active tab
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** ready
**Last updated:** 2026-07-26

### investigate-blank-thumbnails-and-add-non-intrusi-3fba
**Title:** Investigate blank thumbnails and add non-intrusive lazy refresh
**Tags:** Bug
**Summary:** Completed the reviewer-requested hardening for the thumbnail-loss fix.
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-28

### add-automated-release-checks-in-ci-2918
**Title:** Add automated release checks in CI
**Tags:** Maintenance
**Summary:** Updated .github/workflows/release-checks.yml so the Node.js 24 release-check job preserves the test, JavaScript syntax, manifest parsing, and runtime mirror parity checks while validating committed whitespace over meaningful Git ranges:
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-28

## Chat pointers
- [bbbc6ea9] The icon in the sidebar (next to search) stopped working, (coder, 2026-07-27) → roles/coder/memory/chats/bbbc6ea9.json
- [4006e4ba] Review final Chrome validation results (tasker, designer, coder, reviewer, 2026-07-28) → roles/coder/memory/chats/4006e4ba.json

### set-aurora-webp-as-default-background-3f87
**Title:** Set aurora.webp as default background
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-28

### add-background-transparency-blur-sliders-to-phot-0674
**Title:** Add background transparency/blur sliders to Photos settings
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-28

### add-developed-by-emberstone-studio-footer-to-set-b708
**Title:** Add "Developed by Emberstone Studio" footer to Settings
**Tags:** 
**Summary:** _Not yet summarized._
**Key decisions:** 
**Status:** done
**Last updated:** 2026-07-28

### publish-meridian-v1-2-0-release-package-to-githu-44e0
**Title:** Publish Meridian v1.2.0 release package to GitHub
**Tags:** Release
**Summary:** Release: https://github.com/Emberstone-Studio/Meridian/releases/tag/v1.2.0
**Key decisions:** 
**Status:** done
**Last updated:** 2026-08-14

### switch-app-background-to-topo-light-topo-dark-sy-0283
**Title:** Switch app background to topo-light/topo-dark, sync with system theme
**Tags:** Feature
**Summary:** Replaced the shipped default with theme-aware topo wallpaper: img/topo-light.webp in light mode and img/topo-dark.webp in dark mode.
**Key decisions:** 
**Status:** done
**Last updated:** 2026-08-19

### add-hover-to-remove-control-for-selected-preset-c684
**Title:** Add hover-to-remove control for selected color/photo/theme backgrounds
**Tags:** Feature
**Summary:** Implemented hover-to-remove controls for selected color, gradient, stock-photo, and topo presets. Removing a preset restores the theme-aware topo default. Replaced the diagonal No background swatch with a complementary Garnet solid,…
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### fix-hover-remove-swatch-alignment-drop-default-t-b263
**Title:** Fix hover-remove swatch alignment + drop default theme background from Photos list
**Tags:** Bug
**Summary:** Implemented the Background panel follow-up fixes in the source and packaged-extension mirrors.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### rename-duplicate-midnight-gradient-swatch-to-twi-c708
**Title:** Rename duplicate "Midnight" gradient swatch to "Twilight"
**Tags:** Bug
**Summary:** Renamed the g1 gradient swatch label from Midnight to Twilight in both components/SettingsPanel.js and meridian-extension/components/SettingsPanel.js. Preserved the solid Midnight label, preset ID, and gradient value. Verification…
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### fix-vertical-misalignment-of-group-header-count-6921
**Title:** Fix vertical misalignment of group header count badge (lane-tab-count)
**Tags:** Bug
**Summary:** Fixed the group-header count alignment in both shipped CSS copies.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### fix-muddy-hover-overlay-color-and-swatch-border-ee31
**Title:** Fix swatch/border animation desync on preset swatch hover
**Tags:** Bug
**Summary:** Implemented the preset swatch hover/outline synchronization fix.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### add-show-tabs-from-all-windows-current-window-on-2ee6
**Title:** Add "show tabs from all windows / current window only" setting under Tab Organization
**Tags:** Feature
**Summary:** Implemented the new Show tabs from all windows setting under Tab Organization.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### remove-icon-shows-on-unselected-custom-photo-all-4ca5
**Title:** Remove-icon (✕) shows on unselected custom photo, allowing accidental deletion instead of reselect
**Tags:** Bug
**Summary:** Implemented the active-only custom-image removal behavior in both runtime copies of SettingsPanel.js. An inactive custom-photo tile now remains a normal selectable tile and does not render the remove button; the remove affordance is…
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### critical-entering-url-search-in-a-second-window-6080
**Title:** CRITICAL: entering URL/search in a second window opens infinite Meridian tabs
**Tags:** Bug
**Summary:** Fixed the runaway second-window navigation loop.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### settings-not-syncing-across-windows-new-window-d-79ae
**Title:** Settings not syncing across windows — new window doesn't reflect other window's settings
**Tags:** Bug
**Summary:** Added a comprehensive chrome.storage.onChanged subscriber so all settings-panel controls update from the shared sync store across open windows.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### reorder-search-engine-options-google-bing-duckdu-55fd
**Title:** Reorder search engine options: Google, Bing, DuckDuckGo, Brave
**Tags:** Maintenance
**Summary:** Updated the shared search-provider ordering in both runtime trees:
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### add-missing-top-padding-to-settings-privacy-data-7992
**Title:** Add missing top padding to Settings > Privacy & Data section
**Tags:** Bug
**Summary:** Implemented the missing Settings > Privacy & Data spacing. Added an explicit 28px top margin for .settings-section.settings-privacy-section in both meridian.css and meridian-extension/meridian.css, matching the standard section spacing…
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### unhandled-promise-rejection-in-background-js-323-d009
**Title:** Unhandled promise rejection in background.js:323 (chrome.tabs.onAttached → normalizeMeridianTab)
**Tags:** Bug
**Summary:** Guarded chrome.tabs.update in normalizeMeridianTab so tab attach/detach races resolve without an unhandled rejection.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### fix-keyboard-semantics-for-selected-background-s-92a9
**Title:** Fix keyboard semantics for selected background swatch removal
**Tags:** Bug
**Summary:** Implemented the selected preset swatch keyboard/accessibility fix.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### synchronize-custom-background-image-lifecycle-ac-3501
**Title:** Synchronize custom background image lifecycle across open windows
**Tags:** Bug
**Summary:** Added a customBackgroundRevision signal after successful IndexedDB saves and deletions.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### do-not-persist-stale-meridian-tab-ids-after-norm-1b57
**Title:** Do not persist stale Meridian tab IDs after normalization failure
**Tags:** Bug
**Summary:** Implemented the stale Meridian tab normalization fix.
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

### replace-source-pattern-settings-tests-with-behav-30d4
**Title:** Replace source-pattern settings tests with behavioral multi-window regressions
**Tags:** Maintenance
**Summary:** Replaced the source-pattern settings suites with behavior-level regressions driven by a shared fake chrome.storage.onChanged emitter. The tests now execute the production storage callbacks, appearance loader, render scheduler, and…
**Key decisions:** 
**Status:** in_review
**Last updated:** 2026-08-19

