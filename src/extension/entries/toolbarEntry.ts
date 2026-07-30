import { captureInputFromTab, openAnalysisSurface } from "./openDrawer";

export async function handleToolbarEntry(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || tab.windowId === undefined) {
    return;
  }

  const extractedInput = await captureInputFromTab(tab.id).catch(() => null);
  const input = {
    ...(extractedInput ?? { text: "" }),
    url: extractedInput?.url || tab.url
  };

  await openAnalysisSurface({
    tabId: tab.id,
    windowId: tab.windowId,
    input,
    workspaceMode: "quick"
  });
}
