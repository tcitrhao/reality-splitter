import type {
  ExternalAssistantLaunchResult,
  ExternalAssistantTarget
} from "../../shared/types";
import { runExternalAssistantPageAutomation } from "./pageAutomation";
import { EXTERNAL_ASSISTANT_TARGETS } from "./targets";

const TAB_READY_TIMEOUT_MS = 20_000;

export interface OneClickSendInput {
  target: ExternalAssistantTarget;
  prompt: string;
  requireWebSearch: boolean;
}

export async function sendToExternalAssistant(
  input: OneClickSendInput
): Promise<ExternalAssistantLaunchResult> {
  const target = EXTERNAL_ASSISTANT_TARGETS[input.target];
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("没有可发送的拆解内容。");
  }

  const tab = await chrome.tabs.create({ url: target.url, active: true });
  if (tab.id === undefined) {
    throw new Error(`${target.label} 已打开，但没有获得可操作的标签页。`);
  }

  await waitForTabReady(tab.id, tab.status);

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: runExternalAssistantPageAutomation,
      args: [input.target, prompt, input.requireWebSearch]
    });

    if (!injection?.result) {
      throw new Error("目标页面没有返回自动发送结果。");
    }
    return injection.result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${target.label} 已打开，但暂时无法自动填写。请在页面登录后粘贴已复制的指令。${
        detail ? `（${detail}）` : ""
      }`
    );
  }
}

async function waitForTabReady(tabId: number, initialStatus?: string): Promise<void> {
  if (initialStatus === "complete") {
    return;
  }

  const currentTab = await chrome.tabs.get(tabId).catch(() => null);
  if (currentTab?.status === "complete") {
    return;
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const timeout = globalThis.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      rejectPromise(new Error("目标页面加载超时。"));
    }, TAB_READY_TIMEOUT_MS);

    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      globalThis.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolvePromise();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}
