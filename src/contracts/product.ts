import type { WorkspaceMode } from "../shared/types";

export const PRODUCT_RELEASE = {
  version: __REALITY_SPLITTER_VERSION__,
  drawerMessageType: "REALITY_SPLITTER_SHOW_INLINE_V10"
} as const;

export const PRODUCT_CONTRACT = {
  primarySurface: "current-page-drawer",
  analysisTrigger: "manual-only",
  sessionScope: "current-tab",
  workspaces: ["quick", "longform"] as const satisfies readonly WorkspaceMode[],
  independentWorkspaceState: true,
  modelAdminSurface: "options-page",
  fallbackSurface: "chrome-side-panel"
} as const;

export const PLATFORM_CAPABILITIES = {
  twitter: {
    captureSelection: true,
    injectPostButton: true
  },
  weibo: {
    captureSelection: true,
    injectPostButton: false
  },
  unknown: {
    captureSelection: true,
    injectPostButton: false
  }
} as const;

export type SupportedPlatform = keyof typeof PLATFORM_CAPABILITIES;
