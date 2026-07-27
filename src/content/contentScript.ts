import { MESSAGE_TYPES, type AnalysisResponse, type CaptureInputMessage, type RuntimeResponse } from "../shared/messages";
import { PRODUCT_COPY } from "../shared/productCopy";
import type {
  AIResponse,
  AlternativesResult,
  DeescalateResult,
  ExperimentResult,
  LongformCheckResult,
  QuickAnalysisMode,
  SplitAnalysisResult,
  TweetInput,
  WorkspaceMode
} from "../shared/types";
import {
  collectPostRoots,
  detectPlatform,
  extractPostInputFromRoot,
  findButtonAnchor,
  findClosestPostRoot,
  getFallbackSelectionText,
  isRenderablePostRoot
} from "./platformExtractor";

const CAPTURE_INPUT_MESSAGE_TYPE = "CAPTURE_INPUT";
const PROCESSED_ATTR = "data-reality-splitter-bound";
const SIGNATURE_ATTR = "data-reality-splitter-signature";
const BUTTON_HOST_ATTR = "data-reality-splitter-button-host";
const STYLE_ID = "reality-splitter-content-style";
const TOAST_ID = "reality-splitter-toast";
const INLINE_PANEL_ID = "reality-splitter-inline-panel";
const INLINE_DRAWER_CLASS = "reality-splitter-drawer-open";
const WEIBO_NO_BUTTONS_CLASS = "reality-splitter-weibo-no-buttons";
const LEGACY_WEIBO_OVERLAY_ID = "reality-splitter-weibo-overlay";
const LEGACY_WEIBO_FLOATING_HOST_ID = "reality-splitter-weibo-floating-host";
const LEGACY_INLINE_SURFACE_SELECTOR = [
  "#reality-splitter-modal",
  "#reality-splitter-popup",
  "#reality-splitter-inline-overlay",
  ".reality-splitter-modal",
  ".reality-splitter-popup",
  "[data-reality-splitter-surface='modal']",
  "[aria-label='Reality Splitter'][role='dialog']"
].join(", ");
const SCAN_INTERVAL_MS = 1600;
const CONTENT_SCRIPT_VERSION = "0.1.9";
const SHOW_INLINE_MESSAGE_TYPE = "REALITY_SPLITTER_SHOW_INLINE_V5";

let lastSelection = "";
let intervalId: number | null = null;
let inlineQuickInput: TweetInput | null = null;
let inlineLongformInput: TweetInput | null = null;
let inlineWorkspaceMode: WorkspaceMode = "quick";
let inlineQuickResponse: AIResponse | null = null;
let inlineLongformResponse: AIResponse | null = null;
let inlineQuickError = "";
let inlineLongformError = "";
let inlineQuickLoading = false;
let inlineLongformLoading = false;
let inlineQuickActiveMode: QuickAnalysisMode | null = null;
let inlineQuickRequestId = 0;
let inlineLongformRequestId = 0;

declare global {
  interface Window {
    __realitySplitterBooted?: boolean | string;
  }
}

if (window.__realitySplitterBooted !== CONTENT_SCRIPT_VERSION) {
  window.__realitySplitterBooted = CONTENT_SCRIPT_VERSION;
  boot();
}

function boot() {
  injectStyles();
  bindSelectionListeners();
  bindRuntimeMessages();

  if (detectPlatform() === "weibo") {
    enforceWeiboButtonRemoval();
    return;
  }

  scanPosts(document);
  observeTimelineChanges();
  startPeriodicScan();
}

function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== SHOW_INLINE_MESSAGE_TYPE) {
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

    showInlinePanel({
      input: payload.input,
      workspaceMode: payload.workspaceMode === "longform" ? "longform" : "quick"
    });
    sendResponse({ ok: true, version: CONTENT_SCRIPT_VERSION });
    return false;
  });
}

function bindSelectionListeners() {
  const handleSelectionUpdate = () => {
    window.setTimeout(() => {
      void captureSelection();
    }, 0);
  };

  document.addEventListener("mouseup", handleSelectionUpdate, true);
  document.addEventListener("keyup", handleSelectionUpdate, true);
}

async function captureSelection() {
  const text = getFallbackSelectionText();

  if (!text || text === lastSelection) {
    return;
  }

  lastSelection = text;

  const input: TweetInput = {
    text,
    url: window.location.href
  };

  if (document.getElementById(INLINE_PANEL_ID)?.classList.contains("is-open")) {
    if (inlineWorkspaceMode === "longform") {
      inlineLongformInput = input;
      resetInlineLongformState();
    } else {
      inlineQuickInput = input;
      resetInlineQuickState();
    }
    renderInlinePanel();
  }
}

function scanPosts(root: ParentNode) {
  if (detectPlatform() === "weibo") {
    return;
  }

  const posts = collectPostRoots(root);
  for (const post of posts) {
    syncButton(post);
  }
}

function syncButton(postRoot: HTMLElement) {
  const nextSignature = computePostSignature(postRoot);
  const previousSignature = postRoot.getAttribute(SIGNATURE_ATTR);
  const hasButton = postRoot.querySelector(`[${BUTTON_HOST_ATTR}="true"]`) !== null;

  if (postRoot.getAttribute(PROCESSED_ATTR) === "true" && previousSignature === nextSignature && hasButton) {
    return;
  }

  cleanupInjectedButton(postRoot);
  injectButton(postRoot, nextSignature);
}

function injectButton(postRoot: HTMLElement, signature: string) {
  if (postRoot.getAttribute(PROCESSED_ATTR) === "true" && postRoot.getAttribute(SIGNATURE_ATTR) === signature) {
    return;
  }

  if (!isRenderablePostRoot(postRoot)) {
    postRoot.removeAttribute(PROCESSED_ATTR);
    postRoot.removeAttribute(SIGNATURE_ATTR);
    return;
  }

  const host = document.createElement("div");
  host.setAttribute(BUTTON_HOST_ATTR, "true");
  host.className = "reality-splitter-button-host";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "reality-splitter-button";
  button.textContent = PRODUCT_COPY.brand;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const postTarget = findClosestPostRoot(event.currentTarget as Node) ?? postRoot;
    const input = extractPostInputFromRoot(postTarget);

    if (!input?.text) {
      showToast("当前没有检测到推文文本，可以手动选中文字后再试。");
      return;
    }

    showInlinePanel({
      input,
      workspaceMode: "quick"
    });

    void sendCaptureMessage(input, false, "tweet_button").then((response) => {
      if (!response.ok) {
        showToast(response.error || "抽屉已打开，但扩展后台暂时没有响应。");
      }
    });
  });

  host.appendChild(button);

  const insertionTarget = findButtonAnchor(postRoot);
  if (!insertionTarget) {
    return;
  }

  insertionTarget.appendChild(host);
  postRoot.setAttribute(PROCESSED_ATTR, "true");
  postRoot.setAttribute(SIGNATURE_ATTR, signature);
}

function observeTimelineChanges() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        if (matchesPostRoot(node)) {
          syncButton(node);
          continue;
        }

        scanPosts(node);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function matchesPostRoot(node: HTMLElement): boolean {
  return findClosestPostRoot(node) === node;
}

function startPeriodicScan() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
  }

  intervalId = window.setInterval(() => {
    scanPosts(document);
  }, SCAN_INTERVAL_MS);

  let scrollTimer = 0;
  window.addEventListener(
    "scroll",
    () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        scanPosts(document);
      }, 120);
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      scanPosts(document);
    },
    { passive: true }
  );
}

function injectStyles() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = `
    .reality-splitter-button-host {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      pointer-events: auto;
    }

    .reality-splitter-button {
      border: 1px solid rgba(79, 98, 86, 0.35);
      border-radius: 999px;
      background: rgba(239, 245, 242, 0.95);
      color: #1f4335;
      font: 600 12px/1.2 "Avenir Next", "Segoe UI", sans-serif;
      padding: 6px 10px;
      cursor: pointer;
      transition: background 120ms ease, transform 120ms ease;
    }

    html.${WEIBO_NO_BUTTONS_CLASS} [${BUTTON_HOST_ATTR}="true"],
    html.${WEIBO_NO_BUTTONS_CLASS} #${LEGACY_WEIBO_OVERLAY_ID},
    html.${WEIBO_NO_BUTTONS_CLASS} #${LEGACY_WEIBO_FLOATING_HOST_ID} {
      display: none !important;
    }

    .reality-splitter-button:hover {
      background: rgba(227, 238, 232, 0.98);
      transform: translateY(-1px);
    }

    .reality-splitter-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      z-index: 2147483647;
      transform: translateX(-50%) translateY(8px);
      max-width: min(560px, calc(100vw - 32px));
      padding: 10px 14px;
      border-radius: 14px;
      background: rgba(28, 47, 40, 0.94);
      color: #f4f7f5;
      font: 500 13px/1.4 "Avenir Next", "Segoe UI", sans-serif;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .reality-splitter-toast.is-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .reality-splitter-inline-panel {
      position: fixed !important;
      inset: 0 auto 0 0 !important;
      z-index: 2147483646 !important;
      display: block !important;
      width: var(--reality-splitter-drawer-width, min(420px, calc(100vw - 28px))) !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-width: calc(100vw - 28px) !important;
      max-height: none !important;
      margin: 0 !important;
      border-radius: 0 !important;
      background:
        radial-gradient(circle at 18% 0%, rgba(142, 181, 157, 0.26), transparent 34%),
        linear-gradient(180deg, #f8f5ec 0%, #eef5f0 100%);
      color: #17342b;
      border-right: 1px solid rgba(31, 67, 53, 0.16);
      box-shadow: 22px 0 54px rgba(18, 34, 28, 0.22);
      transform: translate3d(-104%, 0, 0) !important;
      transition: transform 180ms ease !important;
      contain: layout style paint;
      isolation: isolate;
      font: 500 14px/1.55 "Avenir Next", "Segoe UI", sans-serif;
      box-sizing: border-box;
    }

    html.${INLINE_DRAWER_CLASS} body {
      padding-left: var(--reality-splitter-drawer-width, min(420px, calc(100vw - 28px))) !important;
      transition: padding-left 180ms ease !important;
    }

    @media (max-width: 720px) {
      html.${INLINE_DRAWER_CLASS} body {
        padding-left: 0 !important;
      }
    }

    .reality-splitter-inline-panel.is-open {
      transform: translate3d(0, 0, 0) !important;
    }

    .reality-splitter-inline-panel * {
      box-sizing: border-box;
    }

    .rs-inline-shell {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px;
      overflow: auto;
    }

    .rs-inline-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .rs-inline-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .rs-inline-logo {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: #24483b;
      color: #f4efe4;
      font: 800 21px/1 Georgia, serif;
      box-shadow: 0 8px 22px rgba(36, 72, 59, 0.22);
      flex: 0 0 auto;
    }

    .rs-inline-title {
      margin: 0;
      color: #143127;
      font-size: 18px;
      line-height: 1.2;
      font-weight: 800;
    }

    .rs-inline-subtitle {
      margin: 4px 0 0;
      color: #587065;
      font-size: 12px;
      line-height: 1.35;
    }

    .rs-inline-close {
      width: 34px;
      height: 34px;
      border: 1px solid rgba(31, 67, 53, 0.18);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);
      color: #24483b;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }

    .rs-inline-tabs,
    .rs-inline-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .rs-inline-tab,
    .rs-inline-action,
    .rs-inline-run {
      border: 1px solid rgba(31, 67, 53, 0.18);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.7);
      color: #17342b;
      cursor: pointer;
      font: 750 13px/1.2 "Avenir Next", "Segoe UI", sans-serif;
      min-height: 42px;
      padding: 10px 12px;
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }

    .rs-inline-tab:hover,
    .rs-inline-action:hover,
    .rs-inline-run:hover {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.92);
    }

    .rs-inline-tab.is-active,
    .rs-inline-action.is-active {
      border-color: rgba(36, 72, 59, 0.42);
      background: rgba(222, 237, 228, 0.92);
    }

    .rs-inline-run {
      width: 100%;
      background: #24483b;
      color: #f8f5ec;
      border-color: #24483b;
    }

    .rs-inline-run:disabled,
    .rs-inline-action:disabled {
      cursor: progress;
      opacity: 0.72;
      transform: none;
    }

    .rs-inline-card {
      border: 1px solid rgba(31, 67, 53, 0.13);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.76);
      box-shadow: 0 16px 36px rgba(28, 47, 40, 0.08);
      padding: 16px;
    }

    .rs-inline-card h3 {
      margin: 0 0 10px;
      color: #143127;
      font-size: 15px;
      line-height: 1.25;
    }

    .rs-inline-section-label {
      margin: 14px 0 6px;
      color: #51675e;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .rs-inline-card p {
      margin: 0;
      white-space: pre-wrap;
    }

    .rs-inline-preview {
      max-height: 118px;
      overflow: auto;
      color: #2b4038;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .rs-inline-textarea {
      width: 100%;
      min-height: 190px;
      resize: vertical;
      border: 1px solid rgba(31, 67, 53, 0.16);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.78);
      color: #17342b;
      padding: 13px;
      font: 500 14px/1.55 "Avenir Next", "Segoe UI", sans-serif;
      outline: none;
    }

    .rs-inline-textarea--quick {
      min-height: 112px;
    }

    .rs-inline-list {
      margin: 0;
      padding-left: 18px;
    }

    .rs-inline-list li + li {
      margin-top: 8px;
    }

    .rs-inline-list li {
      white-space: pre-wrap;
    }

    .rs-inline-muted {
      color: #60766d;
    }

    .rs-inline-error {
      color: #8a4f2b;
      background: #fbefe5;
      border-color: rgba(138, 79, 43, 0.16);
    }

    .rs-inline-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .rs-inline-chip {
      border-radius: 999px;
      background: #e2eee7;
      color: #24483b;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 750;
    }
  `;

}

async function sendCaptureMessage(
  input: TweetInput,
  openPanel: boolean,
  source: CaptureInputMessage["payload"]["source"]
): Promise<RuntimeResponse> {
  try {
    return (await chrome.runtime.sendMessage({
      type: CAPTURE_INPUT_MESSAGE_TYPE,
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

function showToast(message: string) {
  let toast = document.getElementById(TOAST_ID);

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "reality-splitter-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(Number(toast.getAttribute("data-hide-timer") || "0"));
  const timerId = window.setTimeout(() => {
    toast?.classList.remove("is-visible");
  }, 2600);

  toast.setAttribute("data-hide-timer", String(timerId));
}

function showInlinePanel(params: {
  input: TweetInput;
  workspaceMode: WorkspaceMode;
}) {
  if (params.workspaceMode === "longform") {
    if (!isSameInlineInput(inlineLongformInput, params.input)) {
      inlineLongformInput = params.input;
      resetInlineLongformState();
    }
  } else if (!isSameInlineInput(inlineQuickInput, params.input)) {
    inlineQuickInput = params.input;
    resetInlineQuickState();
  }

  inlineWorkspaceMode = params.workspaceMode;
  renderInlinePanel();
}

function isSameInlineInput(current: TweetInput | null, next: TweetInput): boolean {
  return current?.text === next.text && current?.url === next.url;
}

function resetInlineQuickState() {
  inlineQuickRequestId += 1;
  inlineQuickResponse = null;
  inlineQuickError = "";
  inlineQuickLoading = false;
  inlineQuickActiveMode = null;
}

function resetInlineLongformState() {
  inlineLongformRequestId += 1;
  inlineLongformResponse = null;
  inlineLongformError = "";
  inlineLongformLoading = false;
}

function ensureInlinePanel(): HTMLElement {
  cleanupLegacyInlineSurfaces();
  let panel = document.getElementById(INLINE_PANEL_ID);

  if (
    panel &&
    (panel.tagName !== "ASIDE" || panel.getAttribute("data-reality-splitter-surface") !== "drawer")
  ) {
    const replacement = createInlinePanel();
    panel.replaceWith(replacement);
    return replacement;
  }

  if (!panel) {
    panel = createInlinePanel();
    document.body.appendChild(panel);
    return panel;
  }

  prepareInlinePanel(panel);
  return panel;
}

function createInlinePanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.id = INLINE_PANEL_ID;
  prepareInlinePanel(panel);
  return panel;
}

function prepareInlinePanel(panel: HTMLElement) {
  panel.removeAttribute("style");
  panel.removeAttribute("role");
  panel.removeAttribute("aria-modal");
  panel.removeAttribute("open");
  panel.className = "reality-splitter-inline-panel";
  panel.setAttribute("data-version", CONTENT_SCRIPT_VERSION);
  panel.setAttribute("data-reality-splitter-surface", "drawer");
  panel.setAttribute("aria-label", "Reality Splitter");
}

function cleanupLegacyInlineSurfaces() {
  document.querySelectorAll<HTMLElement>(LEGACY_INLINE_SURFACE_SELECTOR).forEach((element) => {
    if (element.id !== INLINE_PANEL_ID) {
      element.remove();
    }
  });

  document.documentElement.classList.remove(
    "reality-splitter-modal-open",
    "reality-splitter-popup-open"
  );
}

function renderInlinePanel() {
  const panel = ensureInlinePanel();
  panel.textContent = "";
  document.documentElement.classList.add(INLINE_DRAWER_CLASS);
  panel.classList.add("is-open");

  const shell = appendElement(panel, "div", "rs-inline-shell");
  const header = appendElement(shell, "header", "rs-inline-header");
  const brand = appendElement(header, "div", "rs-inline-brand");
  appendElement(brand, "div", "rs-inline-logo", "R");
  const titleWrap = appendElement(brand, "div");
  appendElement(titleWrap, "h2", "rs-inline-title", PRODUCT_COPY.title);
  appendElement(
    titleWrap,
    "p",
    "rs-inline-subtitle",
    inlineWorkspaceMode === "longform"
      ? PRODUCT_COPY.modes.longform.description
      : PRODUCT_COPY.modes.quick.description
  );

  const closeButton = appendElement(header, "button", "rs-inline-close", "×") as HTMLButtonElement;
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "关闭");
  closeButton.addEventListener("click", () => {
    closeInlinePanel();
  });

  const tabs = appendElement(shell, "div", "rs-inline-tabs");
  const quickTab = appendElement(
    tabs,
    "button",
    `rs-inline-tab ${inlineWorkspaceMode === "quick" ? "is-active" : ""}`,
    PRODUCT_COPY.modes.quick.title
  ) as HTMLButtonElement;
  const longformTab = appendElement(
    tabs,
    "button",
    `rs-inline-tab ${inlineWorkspaceMode === "longform" ? "is-active" : ""}`,
    PRODUCT_COPY.modes.longform.title
  ) as HTMLButtonElement;
  quickTab.type = "button";
  longformTab.type = "button";
  quickTab.addEventListener("click", () => {
    if (!inlineQuickInput && inlineLongformInput) {
      inlineQuickInput = { ...inlineLongformInput };
    }
    inlineWorkspaceMode = "quick";
    renderInlinePanel();
  });
  longformTab.addEventListener("click", () => {
    if (!inlineLongformInput && inlineQuickInput) {
      inlineLongformInput = { ...inlineQuickInput };
    }
    inlineWorkspaceMode = "longform";
    renderInlinePanel();
  });

  if (inlineWorkspaceMode === "longform") {
    renderInlineLongform(shell);
  } else {
    renderInlineQuick(shell);
  }

  const currentLoading =
    inlineWorkspaceMode === "longform" ? inlineLongformLoading : inlineQuickLoading;
  const currentError =
    inlineWorkspaceMode === "longform" ? inlineLongformError : inlineQuickError;
  const currentResponse =
    inlineWorkspaceMode === "longform" ? inlineLongformResponse : inlineQuickResponse;

  if (currentLoading) {
    appendCard(shell, PRODUCT_COPY.status.loadingTitle, PRODUCT_COPY.status.loadingBody);
  }

  if (currentError) {
    const errorCard = appendElement(shell, "section", "rs-inline-card rs-inline-error");
    appendElement(errorCard, "h3", "", PRODUCT_COPY.status.errorTitle);
    appendElement(errorCard, "p", "", currentError);
  }

  if (currentResponse) {
    renderInlineResult(shell, currentResponse);
  } else if (!currentLoading && !currentError) {
    appendCard(
      shell,
      PRODUCT_COPY.results.result,
      inlineWorkspaceMode === "longform"
        ? PRODUCT_COPY.status.emptyLongformResult
        : PRODUCT_COPY.status.emptyQuickResult
    );
  }
}

function closeInlinePanel() {
  document.getElementById(INLINE_PANEL_ID)?.classList.remove("is-open");
  document.documentElement.classList.remove(INLINE_DRAWER_CLASS);
}

function renderInlineQuick(shell: HTMLElement) {
  const previewCard = appendElement(shell, "section", "rs-inline-card");
  appendElement(previewCard, "h3", "", PRODUCT_COPY.input.quickTitle);
  const textarea = appendElement(
    previewCard,
    "textarea",
    "rs-inline-textarea rs-inline-textarea--quick"
  ) as HTMLTextAreaElement;
  textarea.value = inlineQuickInput?.text || "";
  textarea.placeholder = PRODUCT_COPY.input.quickPlaceholder;
  textarea.disabled = inlineQuickLoading;
  textarea.addEventListener("input", () => {
    inlineQuickInput = {
      ...(inlineQuickInput ?? { url: window.location.href }),
      text: textarea.value,
      url: inlineQuickInput?.url || window.location.href
    };
    inlineQuickResponse = null;
    inlineQuickError = "";
    inlineQuickActiveMode = null;
  });

  if (!textarea.value) {
    window.requestAnimationFrame(() => textarea.focus());
  }

  const actions = appendElement(shell, "div", "rs-inline-actions");
  for (const item of PRODUCT_COPY.actions) {
    const button = appendElement(
      actions,
      "button",
      `rs-inline-action ${inlineQuickActiveMode === item.mode ? "is-active" : ""}`,
      item.label
    ) as HTMLButtonElement;
    button.type = "button";
    button.disabled = inlineQuickLoading;
    button.addEventListener("click", () => {
      void runInlineQuickAnalysis(item.mode);
    });
  }
}

function renderInlineLongform(shell: HTMLElement) {
  const card = appendElement(shell, "section", "rs-inline-card");
  appendElement(card, "h3", "", PRODUCT_COPY.input.longformTitle);
  const textarea = appendElement(card, "textarea", "rs-inline-textarea") as HTMLTextAreaElement;
  textarea.value = inlineLongformInput?.text || "";
  textarea.placeholder = PRODUCT_COPY.input.longformPlaceholder;
  textarea.disabled = inlineLongformLoading;
  textarea.addEventListener("input", () => {
    inlineLongformInput = {
      ...(inlineLongformInput ?? { url: window.location.href }),
      text: textarea.value,
      url: inlineLongformInput?.url || window.location.href
    };
    inlineLongformResponse = null;
    inlineLongformError = "";
  });

  const runButton = appendElement(
    shell,
    "button",
    "rs-inline-run",
    inlineLongformLoading ? "核查中..." : "开始长文核查"
  ) as HTMLButtonElement;
  runButton.type = "button";
  runButton.disabled = inlineLongformLoading;
  runButton.addEventListener("click", () => {
    void runInlineLongformCheck();
  });
}

async function runInlineQuickAnalysis(mode: QuickAnalysisMode) {
  if (!inlineQuickInput?.text.trim()) {
    inlineQuickError = "还没有可分析的文本，请先选中一段内容。";
    renderInlinePanel();
    return;
  }

  const requestId = ++inlineQuickRequestId;
  const requestInput = { ...inlineQuickInput };
  inlineWorkspaceMode = "quick";
  inlineQuickLoading = true;
  inlineQuickError = "";
  inlineQuickActiveMode = mode;
  renderInlinePanel();

  try {
    const result = (await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RUN_INLINE_ANALYSIS,
      payload: {
        mode,
        input: requestInput
      }
    })) as AnalysisResponse;

    if (requestId !== inlineQuickRequestId) {
      return;
    }

    if (result.ok && result.data) {
      inlineQuickResponse = result.data;
      inlineQuickError = "";
    } else {
      inlineQuickError = result.error || "这次分析失败了，可以稍后再试。";
    }
  } catch {
    if (requestId === inlineQuickRequestId) {
      inlineQuickError = "扩展暂时没有响应，可以刷新页面后再试。";
    }
  } finally {
    if (requestId === inlineQuickRequestId) {
      inlineQuickLoading = false;
      renderInlinePanel();
    }
  }
}

async function runInlineLongformCheck() {
  if (!inlineLongformInput?.text.trim()) {
    inlineLongformError = "先贴一段想拆解的长文内容，再开始核查。";
    renderInlinePanel();
    return;
  }

  const requestId = ++inlineLongformRequestId;
  const requestInput = { ...inlineLongformInput };
  inlineWorkspaceMode = "longform";
  inlineLongformLoading = true;
  inlineLongformError = "";
  renderInlinePanel();

  try {
    const result = (await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RUN_INLINE_LONGFORM_CHECK,
      payload: {
        articleText: requestInput.text,
        referenceLinks: [],
        referenceNotes: ""
      }
    })) as AnalysisResponse;

    if (requestId !== inlineLongformRequestId) {
      return;
    }

    if (result.ok && result.data) {
      inlineLongformResponse = result.data;
      inlineLongformError = "";
    } else {
      inlineLongformError = result.error || "长文核查这次失败了，可以稍后再试。";
    }
  } catch {
    if (requestId === inlineLongformRequestId) {
      inlineLongformError = "扩展暂时没有响应，可以刷新页面后再试。";
    }
  } finally {
    if (requestId === inlineLongformRequestId) {
      inlineLongformLoading = false;
      renderInlinePanel();
    }
  }
}

function renderInlineResult(parent: HTMLElement, response: AIResponse) {
  switch (response.mode) {
    case "split":
      renderSplitResult(parent, response.result as SplitAnalysisResult);
      return;
    case "deescalate":
      renderDeescalateResult(parent, response.result as DeescalateResult);
      return;
    case "alternatives":
      renderAlternativesResult(parent, response.result as AlternativesResult);
      return;
    case "experiment":
      renderExperimentResult(parent, response.result as ExperimentResult);
      return;
    case "longform":
      renderLongformResult(parent, response.result as LongformCheckResult);
      return;
    default:
      appendCard(parent, "结果", "这次没有可展示的结果。");
  }
}

function renderSplitResult(parent: HTMLElement, result: SplitAnalysisResult) {
  appendAttentionTriageCard(parent, result);

  const labels = Array.isArray(result.propagationLabels) ? result.propagationLabels : [];
  const labelCard = appendElement(parent, "section", "rs-inline-card");
  appendElement(labelCard, "h3", "", PRODUCT_COPY.results.quickLabels);
  if (labels.length) {
    const row = appendElement(labelCard, "div", "rs-inline-chip-row");
    labels.forEach((item) => appendElement(row, "span", "rs-inline-chip", item));
  } else {
    appendElement(labelCard, "p", "rs-inline-muted", "这次还没有稳定识别出明显传播机制标签。");
  }

  appendListCard(parent, PRODUCT_COPY.results.facts, result.observableFacts, "没有明显可观察事实。");

  const opinionCard = appendSectionCard(parent, PRODUCT_COPY.results.opinionsAndInferences);
  appendListSection(opinionCard, PRODUCT_COPY.results.authorOpinion, result.opinions, "没有明显观点表达。");
  appendListSection(opinionCard, PRODUCT_COPY.results.authorInference, result.inferences, "没有明显推断。");
  appendListSection(opinionCard, PRODUCT_COPY.results.predictions, result.predictions, "没有明确预测。");

  const anxietyCard = appendSectionCard(parent, PRODUCT_COPY.results.anxietyBreakdown);
  appendListSection(anxietyCard, PRODUCT_COPY.results.anxietyThemes, result.anxietyThemes, "没有明显焦虑主题。");
  appendListSection(anxietyCard, PRODUCT_COPY.results.viralityHooks, result.viralityHooks, "没有明显传播钩子。");

  const stimulusCard = appendSectionCard(parent, PRODUCT_COPY.results.stimulusSignals);
  appendTriggerSection(stimulusCard, PRODUCT_COPY.results.emotionalSignals, result.emotionalTriggers);
  appendListSection(
    stimulusCard,
    PRODUCT_COPY.results.manipulationSignals,
    result.manipulationSignals,
    "没有明显操纵性线索。"
  );
  appendListSection(
    stimulusCard,
    PRODUCT_COPY.results.sourceIssues,
    result.sourceReliabilityIssues,
    "没有明显来源可靠性问题。"
  );
  appendListSection(stimulusCard, PRODUCT_COPY.results.callsToAction, result.callsToAction, "没有明显行动号召。");
  appendTextSection(
    stimulusCard,
    PRODUCT_COPY.results.evidenceStrength,
    mapEvidenceStrength(result.evidenceStrength)
  );

  const supportCard = appendSectionCard(parent, PRODUCT_COPY.results.slowingSupport);
  appendListSection(
    supportCard,
    PRODUCT_COPY.results.alternatives,
    result.alternativeExplanations,
    "暂无更合适的替代解释。"
  );
  appendTextSection(
    supportCard,
    PRODUCT_COPY.results.cognitiveRisk,
    result.cognitiveRiskNote || "这次没有返回额外提醒。"
  );
  appendTextSection(
    supportCard,
    PRODUCT_COPY.results.neutralRewrite,
    result.neutralRewrite || "这次没有返回改写内容。"
  );
  appendListSection(
    supportCard,
    PRODUCT_COPY.results.verification,
    result.lowCostVerification,
    "暂无验证建议。"
  );
}

function appendAttentionTriageCard(parent: HTMLElement, result: SplitAnalysisResult) {
  const triage = result.attentionTriage ?? {
    recommendedAction: "skim",
    attentionCost: "low",
    reason: "这次没有稳定返回注意力分诊，建议先低成本扫读。",
    nextStep: "如果和当前目标无关，可以直接跳过。"
  };
  const card = appendElement(parent, "section", "rs-inline-card");
  appendElement(card, "h3", "", PRODUCT_COPY.results.attentionTriage);
  appendElement(
    card,
    "p",
    "",
    `${mapAttentionAction(triage.recommendedAction)} · 注意力成本：${mapAttentionCost(triage.attentionCost)}`
  );
  appendElement(card, "p", "rs-inline-muted", triage.reason || "这次没有返回分诊原因。");
  appendTextSection(
    card,
    PRODUCT_COPY.results.nextStep,
    triage.nextStep || "先不要立刻行动，保留一点判断空间。"
  );
}

function renderDeescalateResult(parent: HTMLElement, result: DeescalateResult) {
  appendCard(
    parent,
    PRODUCT_COPY.results.neutralRewrite,
    result.neutralRewrite || "这次没有返回改写内容。"
  );
  appendListCard(
    parent,
    PRODUCT_COPY.results.removedStimulus,
    result.removedStimulusPatterns,
    "没有明确标出刺激模式。"
  );
  appendListCard(
    parent,
    PRODUCT_COPY.results.uncertainty,
    result.uncertaintyNotes,
    "没有额外不确定性提示。"
  );
}

function renderAlternativesResult(parent: HTMLElement, result: AlternativesResult) {
  const items = Array.isArray(result.alternatives)
    ? result.alternatives.map((item) => `${item.explanation || "替代解释"}：${item.whyPossible || "没有返回额外说明。"}`)
    : [];
  appendListCard(parent, PRODUCT_COPY.results.alternatives, items, "这次没有返回可用的替代解释。");
}

function renderExperimentResult(parent: HTMLElement, result: ExperimentResult) {
  appendCard(
    parent,
    PRODUCT_COPY.results.experiment,
    result.suggestedExperiment || "这次没有返回实验建议。"
  );
  appendListCard(parent, PRODUCT_COPY.results.steps, result.steps, "没有返回步骤。");
  const boundaryCard = appendSectionCard(parent, PRODUCT_COPY.results.boundary);
  appendTextSection(
    boundaryCard,
    PRODUCT_COPY.results.timeLimit,
    result.timeLimit || "这次没有返回时间限制。"
  );
  appendTextSection(
    boundaryCard,
    PRODUCT_COPY.results.allInReplacement,
    result.allInReplacement || "这次没有返回替代方案。"
  );
}

function renderLongformResult(parent: HTMLElement, result: LongformCheckResult) {
  appendEvidenceCard(
    parent,
    PRODUCT_COPY.results.longformFacts,
    result.facts,
    "这次没有稳定提取出可核查事实。"
  );
  appendEvidenceCard(
    parent,
    PRODUCT_COPY.results.longformOpinions,
    result.opinions,
    "这次没有稳定提取出明确观点。"
  );
}

function appendSectionCard(parent: HTMLElement, title: string): HTMLElement {
  const card = appendElement(parent, "section", "rs-inline-card");
  appendElement(card, "h3", "", title);
  return card;
}

function appendSectionLabel(parent: HTMLElement, title: string) {
  appendElement(parent, "h4", "rs-inline-section-label", title);
}

function appendTextSection(parent: HTMLElement, title: string, body: string) {
  appendSectionLabel(parent, title);
  appendElement(parent, "p", body ? "" : "rs-inline-muted", body || "暂无内容。");
}

function appendListSection(
  parent: HTMLElement,
  title: string,
  items: string[] | undefined,
  emptyText: string
) {
  appendSectionLabel(parent, title);
  appendInlineList(parent, items, emptyText);
}

function appendTriggerSection(
  parent: HTMLElement,
  title: string,
  items: SplitAnalysisResult["emotionalTriggers"] | undefined
) {
  appendSectionLabel(parent, title);
  const normalizedItems = Array.isArray(items) ? items : [];
  if (!normalizedItems.length) {
    appendElement(parent, "p", "rs-inline-muted", "没有明显刺激信号。");
    return;
  }

  const list = appendElement(parent, "ul", "rs-inline-list");
  normalizedItems.forEach((item) => {
    appendElement(
      list,
      "li",
      "",
      `${item.text || "未命名信号"} · ${item.type || "未分类"} · ${mapIntensity(item.intensity)}`
    );
  });
}

function appendEvidenceCard(
  parent: HTMLElement,
  title: string,
  items: LongformCheckResult["facts"],
  emptyText: string
) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const card = appendElement(parent, "section", "rs-inline-card");
  appendElement(card, "h3", "", title);

  if (!normalizedItems.length) {
    appendElement(card, "p", "rs-inline-muted", emptyText);
    return;
  }

  const list = appendElement(card, "ul", "rs-inline-list");
  normalizedItems.forEach((item) => {
    const verdict = item.verdict === "supported" ? "有证据" : "无证据";
    appendElement(list, "li", "", `${item.claim || "未命名说法"}（${verdict}）\n${item.evidenceNote || "没有返回具体说明。"}\n参考依据：${item.sourceHint || "未明确说明来源"}`);
  });
}

function appendListCard(parent: HTMLElement, title: string, items: string[] | undefined, emptyText: string) {
  const card = appendElement(parent, "section", "rs-inline-card");
  appendElement(card, "h3", "", title);
  appendInlineList(card, items, emptyText);
}

function appendInlineList(parent: HTMLElement, items: string[] | undefined, emptyText: string) {
  const normalizedItems = safeArray(items);
  if (!normalizedItems.length) {
    appendElement(parent, "p", "rs-inline-muted", emptyText);
    return;
  }

  const list = appendElement(parent, "ul", "rs-inline-list");
  normalizedItems.forEach((item) => appendElement(list, "li", "", item));
}

function appendCard(parent: HTMLElement, title: string, body: string) {
  const card = appendElement(parent, "section", "rs-inline-card");
  appendElement(card, "h3", "", title);
  appendElement(card, "p", body ? "" : "rs-inline-muted", body || "暂无内容。");
}

function appendElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tagName: K,
  className = "",
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  parent.appendChild(element);
  return element;
}

function safeArray(value: string[] | undefined): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function mapAttentionAction(value: SplitAnalysisResult["attentionTriage"]["recommendedAction"]): string {
  const labels = {
    skip: "建议跳过",
    skim: "低成本扫读",
    verify: "先验证",
    save: "值得保存",
    delay: "延迟行动"
  };

  return labels[value] || "低成本扫读";
}

function mapAttentionCost(value: SplitAnalysisResult["attentionTriage"]["attentionCost"]): string {
  const labels = {
    low: "低",
    medium: "中",
    high: "高"
  };

  return labels[value] || "低";
}

function mapEvidenceStrength(value: SplitAnalysisResult["evidenceStrength"]): string {
  const labels = {
    strong: "强",
    medium: "中",
    weak: "弱",
    unclear: "无法判断"
  };

  return labels[value] || "无法判断";
}

function mapIntensity(
  value: SplitAnalysisResult["emotionalTriggers"][number]["intensity"]
): string {
  const labels = {
    low: "低",
    medium: "中",
    high: "高"
  };

  return labels[value] || "低";
}

function cleanupInjectedButton(postRoot: HTMLElement) {
  postRoot.querySelectorAll(`[${BUTTON_HOST_ATTR}="true"]`).forEach((node) => node.remove());
  postRoot.removeAttribute(PROCESSED_ATTR);
  postRoot.removeAttribute(SIGNATURE_ATTR);
}

function computePostSignature(postRoot: HTMLElement): string {
  return postRoot.innerText.replace(/\s+/g, " ").trim().slice(0, 160);
}

function enforceWeiboButtonRemoval() {
  document.documentElement.classList.add(WEIBO_NO_BUTTONS_CLASS);
  cleanupLegacyWeiboButtons();

  const observer = new MutationObserver(() => {
    cleanupLegacyWeiboButtons();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function cleanupLegacyWeiboButtons() {
  document.querySelectorAll(`[${BUTTON_HOST_ATTR}="true"]`).forEach((node) => {
    if (node instanceof HTMLElement) {
      node.remove();
    }
  });

  document.getElementById(LEGACY_WEIBO_OVERLAY_ID)?.remove();
  document.getElementById(LEGACY_WEIBO_FLOATING_HOST_ID)?.remove();
}
