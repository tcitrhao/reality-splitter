import {
  MESSAGE_TYPES,
  type CaptureInputMessage,
  type OpenModelAdminMessage,
  type RunInlineAnalysisMessage,
  type RunInlineLongformCheckMessage,
  type RunLongformCheckMessage,
  type RunAnalysisMessage,
  type RuntimeMessage,
  type RuntimeResponse,
  type TestModelConnectionMessage
} from "../shared/messages";
import {
  runAnalysis,
  runLongformCheck,
  testModelConnection,
  toUserMessage
} from "../shared/aiClient";
import {
  getCurrentInput,
  setCurrentInput,
  setLongformInput,
  setWorkspaceMode,
  setUiError
} from "../shared/storage";
import type { AIResponse, ModelConnectionTestResult, TweetInput } from "../shared/types";

const CONTEXT_MENU_ROOT_ID = "reality-splitter-root";
const CONTEXT_MENU_QUICK_ID = "reality-splitter-quick";
const CONTEXT_MENU_LONGFORM_ID = "reality-splitter-longform";
const CONTENT_SHOW_INLINE_MESSAGE = "REALITY_SPLITTER_SHOW_INLINE_V7";
const CONTENT_SCRIPT_VERSION = "0.2.1";

void initializeSidePanelBehavior();
void initializeContextMenus();

chrome.runtime.onInstalled.addListener(() => {
  void initializeSidePanelBehavior();
  void initializeContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeSidePanelBehavior();
  void initializeContextMenus();
});

chrome.action.onClicked.addListener((tab) => {
  void handleToolbarAction(tab).catch((error) => {
    void setUiError(toUserMessage(error));
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab).catch((error) => {
    void setUiError(toUserMessage(error));
  });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: toUserMessage(error)
      } satisfies RuntimeResponse);
    });

  return true;
});

async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<RuntimeResponse> {
  switch (message.type) {
    case MESSAGE_TYPES.CAPTURE_INPUT:
      await handleCapturedInput(message as CaptureInputMessage, sender);
      return { ok: true };
    case MESSAGE_TYPES.RUN_ANALYSIS:
      return handleRunAnalysis(message as RunAnalysisMessage);
    case MESSAGE_TYPES.RUN_LONGFORM_CHECK:
      return handleRunLongformCheck(message as RunLongformCheckMessage);
    case MESSAGE_TYPES.RUN_INLINE_ANALYSIS:
      return handleRunInlineAnalysis(message as RunInlineAnalysisMessage);
    case MESSAGE_TYPES.RUN_INLINE_LONGFORM_CHECK:
      return handleRunInlineLongformCheck(message as RunInlineLongformCheckMessage);
    case MESSAGE_TYPES.OPEN_MODEL_ADMIN:
      return handleOpenModelAdmin(message as OpenModelAdminMessage);
    case MESSAGE_TYPES.TEST_MODEL_CONNECTION:
      return handleTestModelConnection(message as TestModelConnectionMessage);
    default:
      return {
        ok: false,
        error: "暂不支持这个操作。"
      };
  }
}

async function handleOpenModelAdmin(
  _message: OpenModelAdminMessage
): Promise<RuntimeResponse> {
  await chrome.runtime.openOptionsPage();
  return { ok: true };
}

async function handleTestModelConnection(
  message: TestModelConnectionMessage
): Promise<RuntimeResponse<ModelConnectionTestResult>> {
  try {
    const result = await testModelConnection(message.payload.mode, message.payload.settings);
    return {
      ok: true,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error)
    };
  }
}

async function handleCapturedInput(
  message: CaptureInputMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  await Promise.all([
    setCurrentInput(message.payload.input),
    setWorkspaceMode("quick")
  ]);

  if (message.payload.openPanel && sender.tab?.windowId !== undefined) {
    try {
      await openInlineAnalysisSurface({
        tabId: sender.tab.id,
        windowId: sender.tab.windowId,
        input: message.payload.input,
        workspaceMode: "quick"
      });
      await setUiError(null);
      return;
    } catch {
      await setUiError("已抓到这条内容，但当前页面抽屉没有自动打开。可以刷新页面后再试。");
      throw new Error("已抓到这条内容，但当前页面抽屉没有自动打开。可以刷新页面后再试。");
    }
  }

  await setUiError(null);
}

async function handleRunAnalysis(
  message: RunAnalysisMessage
): Promise<RuntimeResponse<AIResponse>> {
  const currentInput = await getCurrentInput();

  if (!currentInput?.text) {
    return {
      ok: false,
      error: "还没有可分析的文本，请先选中一段内容。"
    };
  }

  try {
    const result = await runAnalysis(message.payload.mode, currentInput);
    await setUiError(null);

    return {
      ok: true,
      data: result
    };
  } catch (error) {
    const userMessage = toUserMessage(error);
    await setUiError(userMessage);

    return {
      ok: false,
      error: userMessage
    };
  }
}

async function handleRunLongformCheck(
  message: RunLongformCheckMessage
): Promise<RuntimeResponse<AIResponse>> {
  try {
    const result = await runLongformCheck(message.payload);
    await setUiError(null);

    return {
      ok: true,
      data: result
    };
  } catch (error) {
    const userMessage = toUserMessage(error);
    await setUiError(userMessage);

    return {
      ok: false,
      error: userMessage
    };
  }
}

async function handleRunInlineAnalysis(
  message: RunInlineAnalysisMessage
): Promise<RuntimeResponse<AIResponse>> {
  if (!message.payload.input?.text) {
    return {
      ok: false,
      error: "还没有可分析的文本，请先选中一段内容。"
    };
  }

  try {
    const result = await runAnalysis(message.payload.mode, message.payload.input);
    return {
      ok: true,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error)
    };
  }
}

async function handleRunInlineLongformCheck(
  message: RunInlineLongformCheckMessage
): Promise<RuntimeResponse<AIResponse>> {
  try {
    const result = await runLongformCheck(message.payload);
    return {
      ok: true,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error)
    };
  }
}

async function handleToolbarAction(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || tab.windowId === undefined) {
    return;
  }

  const extractedInput = await captureInputFromActiveTab(tab.id).catch(() => null);
  const input = {
    ...(extractedInput ?? { text: "" }),
    url: extractedInput?.url || tab.url
  };

  await openInlineAnalysisSurface({
    tabId: tab.id,
    windowId: tab.windowId,
    input,
    workspaceMode: "quick"
  });
  await setUiError(null);
}

async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  const selectedText = normalizeSelectionText(info.selectionText);
  if (!selectedText || tab?.id === undefined || tab.windowId === undefined) {
    return;
  }

  const selectionInput = buildSelectionInput(selectedText, info, tab);

  if (info.menuItemId === CONTEXT_MENU_QUICK_ID) {
    await openInlineAnalysisSurface({
      tabId: tab.id,
      windowId: tab.windowId,
      input: selectionInput,
      workspaceMode: "quick"
    });
    await setUiError(null);
    return;
  }

  if (info.menuItemId === CONTEXT_MENU_LONGFORM_ID) {
    await openInlineAnalysisSurface({
      tabId: tab.id,
      windowId: tab.windowId,
      input: selectionInput,
      workspaceMode: "longform"
    });
    await setUiError(null);
  }
}

async function captureInputFromActiveTab(tabId: number): Promise<TweetInput | null> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const normalizeText = (value: string) =>
        value
          .replace(/\u00a0/g, " ")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

      const selected = normalizeText(window.getSelection()?.toString() ?? "");
      if (selected) {
        return {
          text: selected,
          url: window.location.href
        };
      }

      const candidateArticles = Array.from(document.querySelectorAll("article"));
      const hoveredArticle = candidateArticles.find((article) => article.matches(":hover"));
      const fallbackArticle =
        hoveredArticle ??
        candidateArticles.find((article) => {
          const rect = article.getBoundingClientRect();
          return rect.top >= 0 && rect.top < window.innerHeight * 0.65;
        }) ??
        candidateArticles[0];

      if (!fallbackArticle) {
        return null;
      }

      const textBlocks = Array.from(
        fallbackArticle.querySelectorAll<HTMLElement>("div[data-testid='tweetText'], div[lang]")
      )
        .map((element) => normalizeText(element.innerText))
        .filter(Boolean);

      const text = Array.from(new Set(textBlocks)).join("\n");
      const author = fallbackArticle.querySelector("div[data-testid='User-Name'] span")?.textContent?.trim();
      const timestamp = fallbackArticle.querySelector("time")?.getAttribute("datetime") ?? undefined;
      const statusLink = fallbackArticle.querySelector<HTMLAnchorElement>("a[href*='/status/']");

      return text
        ? {
            text,
            author: author || undefined,
            timestamp,
            url: statusLink?.href || window.location.href
          }
        : null;
    }
  });

  return (results[0]?.result as TweetInput | null | undefined) ?? null;
}

async function openSidePanelForWindow(windowId: number, tabId?: number): Promise<void> {
  if (tabId !== undefined) {
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true
      });
      await chrome.sidePanel.open({ tabId });
      return;
    } catch {
      // Fall through to window-level open.
    }
  }

  try {
    await chrome.sidePanel.open({ windowId });
    return;
  } catch {
    if (tabId !== undefined) {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true
      });
      await chrome.sidePanel.open({ tabId });
      return;
    }
  }

  throw new Error("Unable to open side panel");
}

async function openInlineAnalysisSurface(params: {
  tabId?: number;
  windowId: number;
  input: TweetInput;
  workspaceMode: "quick" | "longform";
}): Promise<void> {
  if (params.tabId === undefined) {
    await openFallbackAnalysisSurface(params);
    return;
  }

  try {
    await sendInlineMessage(params.tabId, params);
    return;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: params.tabId },
        files: ["contentScript.js"]
      });
      await sendInlineMessage(params.tabId, params);
      return;
    } catch {
      await openFallbackAnalysisSurface(params);
    }
  }
}

async function sendInlineMessage(
  tabId: number,
  params: {
    input: TweetInput;
    workspaceMode: "quick" | "longform";
  }
): Promise<void> {
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: CONTENT_SHOW_INLINE_MESSAGE,
    payload: {
      input: params.input,
      workspaceMode: params.workspaceMode
    }
  })) as { ok?: boolean; version?: string; error?: string } | undefined;

  if (!response?.ok || response.version !== CONTENT_SCRIPT_VERSION) {
    throw new Error(response?.error || "Current-page drawer did not acknowledge the request");
  }
}

async function openFallbackAnalysisSurface(params: {
  tabId?: number;
  windowId: number;
  input: TweetInput;
  workspaceMode: "quick" | "longform";
}): Promise<void> {
  if (params.workspaceMode === "longform") {
    await Promise.all([
      setWorkspaceMode("longform"),
      setLongformInput({
        articleText: params.input.text,
        referenceLinks: [],
        referenceNotes: ""
      })
    ]);
  } else {
    await Promise.all([
      setWorkspaceMode("quick"),
      setCurrentInput(params.input)
    ]);
  }

  await openSidePanelForWindow(params.windowId, params.tabId);
}

async function initializeSidePanelBehavior(): Promise<void> {
  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: false
    });
  } catch {
    // Ignore startup timing issues. Per-tab open still runs on demand.
  }
}

async function initializeContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ROOT_ID,
    title: "发送到 Reality Splitter",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_QUICK_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "短文模式",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENU_LONGFORM_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: "长文模式",
    contexts: ["selection"]
  });
}

function normalizeSelectionText(value?: string): string {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSelectionInput(
  text: string,
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): TweetInput {
  return {
    text,
    url: info.pageUrl || tab?.url
  };
}
