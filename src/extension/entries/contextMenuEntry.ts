import type { TweetInput } from "../../shared/types";
import { openAnalysisSurface } from "./openDrawer";

const CONTEXT_MENU_ROOT_ID = "reality-splitter-root";
const CONTEXT_MENU_QUICK_ID = "reality-splitter-quick";
const CONTEXT_MENU_LONGFORM_ID = "reality-splitter-longform";

export async function initializeContextMenuEntry(): Promise<void> {
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

export async function handleContextMenuEntry(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<boolean> {
  const selectedText = normalizeSelectionText(info.selectionText);
  if (!selectedText || tab?.id === undefined || tab.windowId === undefined) {
    return false;
  }

  const input = buildSelectionInput(selectedText, info, tab);
  if (info.menuItemId === CONTEXT_MENU_QUICK_ID) {
    await openAnalysisSurface({
      tabId: tab.id,
      windowId: tab.windowId,
      input,
      workspaceMode: "quick"
    });
    return true;
  }

  if (info.menuItemId === CONTEXT_MENU_LONGFORM_ID) {
    await openAnalysisSurface({
      tabId: tab.id,
      windowId: tab.windowId,
      input,
      workspaceMode: "longform"
    });
    return true;
  }

  return false;
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
  tab: chrome.tabs.Tab
): TweetInput {
  return {
    text,
    url: info.pageUrl || tab.url
  };
}
