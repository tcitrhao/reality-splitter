import { toUserMessage } from "../application/errors/userVisibleError";
import {
  handleContextMenuEntry,
  initializeContextMenuEntry
} from "../extension/entries/contextMenuEntry";
import {
  initializeSidePanelFallback,
  openAnalysisSurface
} from "../extension/entries/openDrawer";
import { handleToolbarEntry } from "../extension/entries/toolbarEntry";
import { sendToExternalAssistant } from "../infrastructure/externalAssistants/oneClickSend";
import { isExternalAssistantTarget } from "../infrastructure/externalAssistants/targets";
import {
  MESSAGE_TYPES,
  type CaptureInputMessage,
  type OpenExternalAssistantMessage,
  type OpenModelAdminMessage,
  type RunAnalysisMessage,
  type RunInlineAnalysisMessage,
  type RunInlineLongformCheckMessage,
  type RunLongformCheckMessage,
  type RuntimeMessage,
  type RuntimeResponse,
  type TestModelConnectionMessage
} from "../shared/messages";
import { testModelConnection } from "../shared/aiClient";
import {
  getCurrentInput,
  setCurrentInput,
  setUiError,
  setWorkspaceMode
} from "../shared/storage";
import type { AIResponse, ModelConnectionTestResult } from "../shared/types";
import { runLongformCheckSkill } from "../skills/longform-check";
import { runQuickAnalysisSkill } from "../skills/quick-analysis";

void initializeExtensionEntries();

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtensionEntries();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeExtensionEntries();
});

chrome.action.onClicked.addListener((tab) => {
  void handleToolbarEntry(tab)
    .then(() => setUiError(null))
    .catch((error) => setUiError(toUserMessage(error)));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuEntry(info, tab)
    .then((handled) => (handled ? setUiError(null) : undefined))
    .catch((error) => setUiError(toUserMessage(error)));
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

async function initializeExtensionEntries() {
  await Promise.all([
    initializeSidePanelFallback(),
    initializeContextMenuEntry()
  ]);
}

async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<RuntimeResponse> {
  switch (message.type) {
    case MESSAGE_TYPES.CAPTURE_INPUT:
      return handleCapturedInput(message as CaptureInputMessage, sender);
    case MESSAGE_TYPES.RUN_ANALYSIS:
      return handleStoredQuickAnalysis(message as RunAnalysisMessage);
    case MESSAGE_TYPES.RUN_LONGFORM_CHECK:
      return runLongformSkill(message as RunLongformCheckMessage);
    case MESSAGE_TYPES.RUN_INLINE_ANALYSIS:
      return runInlineQuickSkill(message as RunInlineAnalysisMessage);
    case MESSAGE_TYPES.RUN_INLINE_LONGFORM_CHECK:
      return runLongformSkill(message as RunInlineLongformCheckMessage);
    case MESSAGE_TYPES.OPEN_MODEL_ADMIN:
      return handleOpenModelAdmin(message as OpenModelAdminMessage);
    case MESSAGE_TYPES.OPEN_EXTERNAL_ASSISTANT:
      return handleOpenExternalAssistant(message as OpenExternalAssistantMessage);
    case MESSAGE_TYPES.TEST_MODEL_CONNECTION:
      return handleTestModelConnection(message as TestModelConnectionMessage);
    default:
      return {
        ok: false,
        error: "暂不支持这个操作。"
      };
  }
}

async function handleCapturedInput(
  message: CaptureInputMessage,
  sender: chrome.runtime.MessageSender
): Promise<RuntimeResponse> {
  await Promise.all([
    setCurrentInput(message.payload.input),
    setWorkspaceMode("quick")
  ]);

  if (
    message.payload.openPanel &&
    sender.tab?.id !== undefined &&
    sender.tab.windowId !== undefined
  ) {
    await openAnalysisSurface({
      tabId: sender.tab.id,
      windowId: sender.tab.windowId,
      input: message.payload.input,
      workspaceMode: "quick"
    });
  }

  await setUiError(null);
  return { ok: true };
}

async function handleStoredQuickAnalysis(
  message: RunAnalysisMessage
): Promise<RuntimeResponse<AIResponse>> {
  const input = await getCurrentInput();
  if (!input?.text) {
    return {
      ok: false,
      error: "还没有可分析的文本，请粘贴内容，或通过右键菜单发送选中文字。"
    };
  }

  return runQuickSkill(message.payload.mode, input, {
    freshPerspective: message.payload.freshPerspective,
    focusedSplit: message.payload.focusedSplit,
    analysisContext: message.payload.analysisContext
  });
}

async function runInlineQuickSkill(
  message: RunInlineAnalysisMessage
): Promise<RuntimeResponse<AIResponse>> {
  if (!message.payload.input?.text) {
    return {
      ok: false,
      error: "还没有可分析的文本，请粘贴内容，或通过右键菜单发送选中文字。"
    };
  }

  return runQuickSkill(
    message.payload.mode,
    message.payload.input,
    {
      freshPerspective: message.payload.freshPerspective,
      focusedSplit: message.payload.focusedSplit,
      analysisContext: message.payload.analysisContext
    }
  );
}

async function runQuickSkill(
  mode: RunInlineAnalysisMessage["payload"]["mode"],
  input: RunInlineAnalysisMessage["payload"]["input"],
  options: {
    freshPerspective?: boolean;
    focusedSplit?: boolean;
    analysisContext?: string;
  } = {}
): Promise<RuntimeResponse<AIResponse>> {
  try {
    const result = await runQuickAnalysisSkill(mode, input, options);
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
async function runLongformSkill(
  message: RunLongformCheckMessage | RunInlineLongformCheckMessage
): Promise<RuntimeResponse<AIResponse>> {
  try {
    const result = await runLongformCheckSkill(message.payload);
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

async function handleOpenModelAdmin(
  _message: OpenModelAdminMessage
): Promise<RuntimeResponse> {
  await chrome.runtime.openOptionsPage();
  return { ok: true };
}

async function handleOpenExternalAssistant(
  message: OpenExternalAssistantMessage
): Promise<RuntimeResponse> {
  if (!isExternalAssistantTarget(message.payload.target)) {
    return {
      ok: false,
      error: "暂不支持这个外部 AI。"
    };
  }

  const result = await sendToExternalAssistant(message.payload);
  return { ok: true, data: result };
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
