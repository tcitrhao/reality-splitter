# Changelog

All notable product changes should be recorded here before a build is shared.

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
