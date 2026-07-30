import { PRODUCT_RELEASE } from "../../contracts/product";
import {
  setCurrentInput,
  setLongformInput,
  setWorkspaceMode
} from "../../shared/storage";
import type { TweetInput, WorkspaceMode } from "../../shared/types";

export async function openAnalysisSurface(params: {
  tabId?: number;
  windowId: number;
  input: TweetInput;
  workspaceMode: WorkspaceMode;
}): Promise<void> {
  if (params.tabId === undefined) {
    await openFallbackAnalysisSurface(params);
    return;
  }

  try {
    await sendDrawerMessage(params.tabId, params);
    return;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: params.tabId },
        files: ["contentScript.js"]
      });
      await sendDrawerMessage(params.tabId, params);
      return;
    } catch {
      await openFallbackAnalysisSurface(params);
    }
  }
}

export async function initializeSidePanelFallback(): Promise<void> {
  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: false
    });
  } catch {
    // Per-tab fallback still works when startup timing blocks this preference.
  }
}

export async function captureInputFromTab(tabId: number): Promise<TweetInput | null> {
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

      const hostname = window.location.hostname;
      const isTwitter =
        hostname === "x.com" ||
        hostname === "twitter.com" ||
        hostname.endsWith(".x.com") ||
        hostname.endsWith(".twitter.com");
      if (!isTwitter) {
        return null;
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
      const author = fallbackArticle
        .querySelector("div[data-testid='User-Name'] span")
        ?.textContent?.trim();
      const timestamp =
        fallbackArticle.querySelector("time")?.getAttribute("datetime") ?? undefined;
      const statusLink =
        fallbackArticle.querySelector<HTMLAnchorElement>("a[href*='/status/']");

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

async function sendDrawerMessage(
  tabId: number,
  params: {
    input: TweetInput;
    workspaceMode: WorkspaceMode;
  }
): Promise<void> {
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: PRODUCT_RELEASE.drawerMessageType,
    payload: {
      input: params.input,
      workspaceMode: params.workspaceMode
    }
  })) as { ok?: boolean; version?: string; error?: string } | undefined;

  if (!response?.ok || response.version !== PRODUCT_RELEASE.version) {
    throw new Error(response?.error || "Current-page drawer did not acknowledge the request");
  }
}

async function openFallbackAnalysisSurface(params: {
  tabId?: number;
  windowId: number;
  input: TweetInput;
  workspaceMode: WorkspaceMode;
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

  await openSidePanel(params.windowId, params.tabId);
}

async function openSidePanel(windowId: number, tabId?: number): Promise<void> {
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

  throw new Error("Unable to open Side Panel fallback");
}
