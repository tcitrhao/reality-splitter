import { PRODUCT_RELEASE } from "../contracts/product";
import { createDrawerController } from "../extension/drawer/drawerController";
import {
  enforceWeiboButtonRemoval,
  startXEntry
} from "../extension/entries/xEntry";
import {
  MESSAGE_TYPES,
  type CaptureInputMessage,
  type RuntimeResponse
} from "../shared/messages";
import type { TweetInput, WorkspaceMode } from "../shared/types";
import { injectPageStyles } from "./pageStyles";
import { detectPlatform, getFallbackSelectionText } from "./platformExtractor";
import { showPageToast } from "./toast";

type ContentRuntimeMessageListener = Parameters<
  typeof chrome.runtime.onMessage.addListener
>[0];

const LEGACY_INLINE_SURFACE_SELECTOR = [
  "#reality-splitter-modal",
  "#reality-splitter-popup",
  "#reality-splitter-inline-overlay",
  ".reality-splitter-modal",
  ".reality-splitter-popup",
  "[data-reality-splitter-surface='modal']",
  "[aria-label='Reality Splitter'][role='dialog']"
].join(", ");

declare global {
  interface Window {
    __realitySplitterBooted?: string;
    __realitySplitterCleanup?: () => void;
    __realitySplitterRuntimeMessageListener?: ContentRuntimeMessageListener;
  }
}

cleanupPreviousRuntime();

const drawer = createDrawerController(showPageToast);
const cleanupRuntimeMessages = bindRuntimeMessages();
const cleanupPageEntry = bootPageEntry();

window.__realitySplitterBooted = PRODUCT_RELEASE.version;
window.__realitySplitterCleanup = () => {
  cleanupRuntimeMessages();
  cleanupPageEntry();
  drawer.destroy();
};

function bootPageEntry(): () => void {
  injectPageStyles();
  const cleanupSelection = bindSelectionListeners();
  const platform = detectPlatform();

  if (platform === "weibo") {
    enforceWeiboButtonRemoval();
    return cleanupSelection;
  }

  if (platform !== "twitter") {
    return cleanupSelection;
  }

  const cleanupXEntry = startXEntry({
    openQuickDrawer: (input) => openDrawer(input, "quick"),
    persistInput: (input) => sendCaptureMessage(input, false, "tweet_button"),
    showToast: showPageToast
  });

  return () => {
    cleanupSelection();
    cleanupXEntry();
  };
}

function bindRuntimeMessages(): () => void {
  const listener: ContentRuntimeMessageListener = (message, _sender, sendResponse) => {
    if (message?.type !== PRODUCT_RELEASE.drawerMessageType) {
      return false;
    }

    const payload = message.payload as {
      input?: TweetInput;
      workspaceMode?: WorkspaceMode;
    };

    if (!payload.input) {
      sendResponse({ ok: false, error: "没有收到分析任务。" });
      return false;
    }

    openDrawer(
      payload.input,
      payload.workspaceMode === "longform" ? "longform" : "quick"
    );
    sendResponse({ ok: true, version: PRODUCT_RELEASE.version });
    return false;
  };

  window.__realitySplitterRuntimeMessageListener = listener;
  chrome.runtime.onMessage.addListener(listener);

  return () => {
    try {
      chrome.runtime.onMessage.removeListener(listener);
    } catch {
      // Extension reloads can invalidate the previous Chrome context.
    }
  };
}

function cleanupPreviousRuntime() {
  try {
    window.__realitySplitterCleanup?.();
  } catch {
    // Old extension contexts may no longer have working Chrome APIs.
  }

  const previousListener = window.__realitySplitterRuntimeMessageListener;
  if (previousListener) {
    try {
      chrome.runtime.onMessage.removeListener(previousListener);
    } catch {
      // The previous listener may belong to an invalidated extension context.
    }
  }
}

function bindSelectionListeners(): () => void {
  let lastSelection = "";
  const updateSelection = () => {
    window.setTimeout(() => {
      const text = getFallbackSelectionText();
      if (!text || text === lastSelection) {
        return;
      }

      lastSelection = text;
      if (drawer.isOpen()) {
        drawer.updateCurrentSelection({
          text,
          url: window.location.href
        });
      }
    }, 0);
  };

  document.addEventListener("mouseup", updateSelection, true);
  document.addEventListener("keyup", updateSelection, true);

  return () => {
    document.removeEventListener("mouseup", updateSelection, true);
    document.removeEventListener("keyup", updateSelection, true);
  };
}

function openDrawer(input: TweetInput, workspaceMode: WorkspaceMode) {
  cleanupLegacyInlineSurfaces();
  drawer.open(input, workspaceMode);
}

function cleanupLegacyInlineSurfaces() {
  document.querySelectorAll<HTMLElement>(LEGACY_INLINE_SURFACE_SELECTOR).forEach((element) => {
    if (element.id !== "reality-splitter-inline-panel") {
      element.remove();
    }
  });

  document.documentElement.classList.remove(
    "reality-splitter-modal-open",
    "reality-splitter-popup-open"
  );
}

async function sendCaptureMessage(
  input: TweetInput,
  openPanel: boolean,
  source: CaptureInputMessage["payload"]["source"]
): Promise<RuntimeResponse> {
  try {
    return (await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CAPTURE_INPUT,
      payload: {
        input,
        openPanel,
        source
      }
    } satisfies CaptureInputMessage)) as RuntimeResponse;
  } catch {
    return {
      ok: false,
      error: "扩展暂时没有响应，可以刷新页面后再试。"
    };
  }
}
