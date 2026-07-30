# Changelog

All notable product changes should be recorded here before a build is shared.

## Unreleased

### Changed

- Added the `R` icon, product name, and positioning line as a unified website brand lockup.
- Updated the homepage color system to match the extension's deep-green identity.
- Refined the hero actions, analysis example, and three-step workflow into clearer product surfaces.
- Added responsive behavior, reduced-motion support, and subtle first-load motion.

### Verification

- Production website build passes.
- Desktop and 390px mobile layouts were browser-tested with no horizontal overflow or console errors.

## 0.2.1 - 2026-07-29

### Added

- Added a public privacy policy page for Chrome Web Store submission.
- Added Chrome Web Store listing copy, permission justifications, and a release checklist.
- Added a website install-link switch that uses the Chrome Web Store URL when configured and keeps the GitHub release as a fallback.
- Added the public product homepage to the extension manifest.
- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V7` so existing tabs replace the previous extension script after the release update.

### Verification

- The extension package is built and inspected before submission.
- The website build includes the public privacy policy route.

## 0.2.0 - 2026-07-27

### Added

- Upgraded `options.html` into a dedicated model management console for the extension.
- Added independent save and connection-test controls for the short-text and longform models.
- Added DeepSeek V4 Flash / Pro and Kimi K2.6 presets without overwriting an existing API Key.
- Added a direct `模型后台` entry in the current-page drawer.
- Added live effective-model summaries, unsaved-change indicators, API Key visibility control, and provider-profile detection.

### Changed

- Model configuration tests now run through the background service worker and validate the real API address, key, model name, response, and latency.
- Saved settings continue to use the existing `chrome.storage.local` keys, so the upgrade preserves current DeepSeek and Kimi configuration.
- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V6`.

### Verification

- Added build contracts for the model-admin entry, runtime messages, connection test, independent controls, and registered options page.

## 0.1.9 - 2026-07-27

### Fixed

- Added one automatic retry for empty model responses, invalid JSON, request timeouts, transient network failures, rate limits and retryable 5xx responses.
- Increased the DeepSeek short-text output budget to reduce responses that end before producing usable JSON.
- Preserved the last successful result when a later request fails instead of replacing the result area with an empty state.
- Gave short-text and longform workspaces independent inputs, results, errors, active modes and loading states.
- Preserved each workspace result when switching between short-text and longform tabs.
- Allowed DeepSeek short-text analysis and Kimi longform checking to run concurrently.

### Changed

- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V5` so tabs with older shared-state scripts are upgraded before opening.

### Verified

- Added build contracts for independent workspace state and automatic retry support.
- Browser-tested result preservation across tab switches and concurrent short-text/longform requests.

## 0.1.8 - 2026-07-26

### Fixed

- Changed both right-click actions to only open the selected short-text or longform workspace with the selected text filled in.
- Removed automatic short-text analysis and automatic longform checking from the current-page drawer protocol.
- Removed the `autoRunMode` and `autoRunLongform` paths entirely so future callers cannot accidentally restore automatic model calls.

### Changed

- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V4` to isolate the manual-only interaction contract from older page scripts.

### Verified

- Added a build contract that rejects any automatic-run field in the Content Script or Service Worker.
- Browser-tested that opening short-text and longform workspaces makes zero analysis requests until the user presses an analysis button.

## 0.1.7 - 2026-07-26

### Fixed

- Made the X / Twitter content button open the drawer directly in the current Content Script instead of asking the Service Worker to reopen the interface.
- Replaced legacy modal nodes with a fresh `aside` drawer and removed stale inline positioning, `role="dialog"` and `aria-modal` attributes.
- Strengthened the drawer's critical positioning rules so host-page CSS cannot turn it into a centered overlay.
- Persisted X button input in the background without opening a second interface.

### Changed

- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V3` so tabs containing older scripts cannot answer the new request.

### Verified

- Added build contracts for the X local-drawer path and legacy-modal migration.
- Added a browser regression fixture that starts with a stale modal and verifies its replacement by a fixed `aside` drawer.

## 0.1.6 - 2026-07-25

### Fixed

- Removed the Weibo floating-button implementation and added a guard that removes button nodes left by older page scripts.
- Restored the drawer's interaction wording and result grouping to the established Side Panel product language.
- Fixed the fallback path so it preserves the selected text and workspace mode before opening the Side Panel.
- Removed the legacy popup-window fallback that exposed a third, drifting interaction surface.

### Changed

- Added a shared product-copy contract used by both the current-page drawer and React Side Panel.
- Updated product documentation to state explicitly that Weibo never receives an injected button.

### Verified

- Added build checks for shared copy, absence of Weibo button creation, absence of popup fallback, content-script packaging, and version alignment.
- Ran TypeScript, production build, build-contract checks, and browser regression tests.

## 0.1.5 - 2026-07-25

### Fixed

- Required the current-page drawer to acknowledge messages with its exact content-script version.
- Re-inject the current content script when an older page script ignores or incompletely handles a drawer request.
- Fixed context-menu tab checks so selected text is not silently discarded.

### Changed

- Replaced the read-only quick-mode preview with an editable text area for direct paste workflows.
- Automatically focus the quick input when the drawer opens without captured text.

### Verified

- Ran the full extension build and build-contract checks.
- Browser-tested selection delivery, direct paste, drawer rendering, and attention triage.

## 0.1.4 - 2026-07-24

### Fixed

- Made the toolbar action open the current-page drawer instead of Chrome's Side Panel.
- Added a versioned content-script handshake so pages that still contain the old popup script load the new drawer implementation.
- Allowed the drawer to open before text is captured, so users see the correct surface and can select content without falling back to a popup.
- Bundled the content script as a standalone IIFE so Chrome can execute it without unsupported module imports.
- Added build verification that rejects module-based content scripts and checks the drawer, attention-triage, Side Panel, and version contracts.

### Verified

- Ran `npm run build`.
- Smoke-tested the packaged drawer entry and attention-triage rendering.

## 0.1.3 - 2026-07-24

### Added

- Added attention triage to the split-analysis workflow so each result recommends whether to skip, skim, verify, save, or delay.
- Added a product iteration note in `docs/PRODUCT_ITERATION_ATTENTION_TRIAGE.md`.

### Changed

- Bumped the Chrome extension manifest version to match the attention-triage release.

### Verified

- Ran `npm run build`.
- Confirmed the generated `dist/manifest.json` version is `0.1.3`.

## 0.1.2 - 2026-07-24

### Added

- Added the current-page drawer flow so selected content can be analyzed without opening a separate side panel.
- Added extension icons and aligned the packaged manifest with Chrome extension requirements.

### Verified

- Ran `npm run build`.

## 0.1.1 - 2026-07-22

### Added

- Added local content-studio support for developing and reviewing product copy.

## 0.1.0 - Initial MVP

### Added

- Built the initial Reality Splitter Chrome extension workflow: content capture, mode selection, model call, structured output, and side-panel rendering.
