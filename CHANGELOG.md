# Changelog

All notable product changes should be recorded here before a build is shared.

## Unreleased

## 0.3.3 - 2026-07-31

### Fixed

- Prevented page selections made during an active analysis from replacing the current input, clearing the drawer, or invalidating the in-flight response.

### Verification

- Added a TabSession regression that preserves the active input, loading state and request ID when the user selects other page text during analysis.

## 0.3.2 - 2026-07-31

### Changed

- Simplified the offline installation section by removing its English eyebrow.
- Lowered the homepage hero `R` artwork for a more balanced composition.
- Added a shared copyright and privacy footer across the public website.
- Centered and lowered the offline installation introduction.
- Simplified the footer to the copyright line only.
- Added the `v0.2.2` website iteration record to the public iteration timeline.
- Added product versions to the primary Chrome Web Store and offline ZIP filenames.
- Updated the website download URL, button, installation copy, and iteration timeline to the current package version.
- Kept stable unversioned ZIP aliases for compatibility with previously published links.

## 0.3.1 - 2026-07-30

### Fixed

- Built the React content script against the production runtime so the bundle no longer references Node's unavailable `process` global and crashes at startup in Chrome.
- Removed the unknown `permissions` entry from the Manifest V3 permission list.

### Added

- Added a release guard that rejects content-script bundles containing Node `process` references.
- Added a release guard that rejects the invalid Manifest permission.
- Added a real Chrome extension smoke-test harness for Chrome for Testing or Chromium.

### Verification

- Reloaded the unpacked `dist` build in Chrome 150 and confirmed the Service Worker starts without extension errors.
- Confirmed real Chrome injection acknowledges version `0.3.1`, opens the Shadow DOM drawer, switches between short-text and longform workspaces, and preserves the input.
- TypeScript checks, architecture tests, packaged entry tests, production build verification, and both release archive integrity checks pass.

## 0.3.0 - 2026-07-30

### Changed

- Replaced the duplicated native-DOM page drawer with a React drawer that reuses the same action and result components as the Side Panel fallback.
- Added an isolated per-tab `TabSession` with independent short-text and longform inputs, results, errors, loading state and stale-request protection.
- Split toolbar, context-menu, current-page drawer and X button behavior into explicit entry adapters.
- Reduced `contentScript.ts` from 1,442 lines to under 200 lines and `serviceWorker.ts` from 524 lines to about 220 lines.
- Split input preparation, model response parsing, OpenAI-Compatible protocol handling and Kimi web-search tools out of `aiClient.ts`.
- Routed background analysis through explicit `quick-analysis` and `longform-check` Skill contracts.
- Advanced the drawer protocol to `REALITY_SPLITTER_SHOW_INLINE_V10`.

### Added

- Added an executable product contract for manual-only analysis, current-tab session ownership, independent workspaces and platform capabilities.
- Added architecture guards that fail the build when orchestration files grow back into monoliths or bypass Skill, session, UI-sharing and provider boundaries.
- Added a `TabSession` regression suite covering manual opening, concurrent workspaces, result preservation, input isolation and stale responses.
- Added packaged Service Worker entry tests for toolbar, short-text context menu and longform context menu delivery.
- Added `docs/PRODUCT_TECH_ARCHITECTURE.md` as the product and technical architecture source of truth.

### Verification

- TypeScript checks, the `TabSession` contract suite and production extension build pass.
- Browser regression confirms manual-only opening, shared React result rendering, short/long result preservation, same-version reinjection with one listener and one drawer, and no X button on generic pages.
- Desktop and 390px mobile drawer layouts have no console errors or horizontal overflow.

## 0.2.3 - 2026-07-30

### Fixed

- Rebuilt the current-page drawer message listener after an extension reload, even when the page still carries the same version marker.
- Prevented generic websites from receiving the X-only per-post button after a toolbar or context-menu injection.
- Limited toolbar article capture to X / Twitter while preserving selected-text capture on other websites.
- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V9`.

### Verification

- TypeScript checks and the production extension build pass.
- Short-text and longform context-menu delivery open the correct workspace without starting analysis.
- Same-version extension reload restores exactly one active drawer listener.
- Generic pages do not receive X-only post buttons, and the browser regression reports no console errors.
- Chrome Web Store and offline ZIP archives pass integrity checks and contain manifest version `0.2.3`.

## 0.2.2 - 2026-07-30

### Changed

- Added the `R` icon, product name, and positioning line as a unified website brand lockup.
- Updated the homepage color system to match the extension's deep-green identity.
- Refined the hero actions, analysis example, and three-step workflow into clearer product surfaces.
- Added responsive behavior, reduced-motion support, and subtle first-load motion.
- Changed the GitHub download fallback to a dedicated offline-install package.
- Added a visible three-step offline installation guide to the product homepage.
- Advanced the drawer handshake to `REALITY_SPLITTER_SHOW_INLINE_V8` for the `0.2.2` package.

### Added

- Added `reality-splitter-offline.zip`, which extracts into a single `Reality Splitter` folder and includes `INSTALL.txt`.
- Kept `reality-splitter-chrome.zip` as the separate Chrome Web Store upload package.

### Verification

- Production website build passes.
- Desktop and 390px mobile layouts were browser-tested with no horizontal overflow or console errors.
- Both release archives pass ZIP integrity checks and contain the expected Manifest V3 package.

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
