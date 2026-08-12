import type {
  ExternalAssistantLaunchResult,
  ExternalAssistantSearchStatus,
  ExternalAssistantTarget
} from "../../shared/types";

/**
 * Runs inside the target chat page. Keep this function self-contained because
 * chrome.scripting serializes it without the surrounding module scope.
 */
export async function runExternalAssistantPageAutomation(
  target: ExternalAssistantTarget,
  prompt: string,
  requireWebSearch: boolean
): Promise<ExternalAssistantLaunchResult> {
  const sleep = (milliseconds: number) =>
    new Promise<void>((resolvePromise) => window.setTimeout(resolvePromise, milliseconds));

  const isVisible = (element: Element): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0 &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  };

  const waitFor = async <T>(
    resolveValue: () => T | null,
    timeoutMs: number
  ): Promise<T | null> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = resolveValue();
      if (value) {
        return value;
      }
      await sleep(200);
    }
    return null;
  };

  const findComposer = (): HTMLElement | null => {
    const targetSelectors: Partial<Record<ExternalAssistantTarget, string[]>> = {
      chatgpt: ["#prompt-textarea", "textarea[data-testid*='prompt']"],
      claude: [
        "[contenteditable='true'].ProseMirror",
        "[contenteditable='true'][data-placeholder]"
      ],
      gemini: [
        "rich-textarea [contenteditable='true']",
        ".ql-editor[contenteditable='true']"
      ],
      copilot: ["textarea#userInput", "textarea[data-testid*='chat-input']"],
      meta: ["[contenteditable='true'][role='textbox']"],
      poe: ["textarea[placeholder*='Talk']", "textarea[placeholder*='Message']"],
      doubao: ["textarea[data-testid*='chat']", "[contenteditable='true'].ProseMirror"],
      kimi: ["[contenteditable='true'].ProseMirror", "textarea[placeholder]"],
      qianwen: ["textarea[placeholder]", "[contenteditable='true'].ProseMirror"],
      yuanbao: ["textarea[placeholder]", "[contenteditable='true'][role='textbox']"],
      wenxin: ["textarea[placeholder]", "[contenteditable='true'][role='textbox']"],
      zhipu: ["textarea[placeholder]", "[contenteditable='true'].ProseMirror"],
      nami: ["textarea[placeholder]", "[contenteditable='true'][role='textbox']"]
    };
    const selectors = [
      ...(targetSelectors[target] ?? []),
      "textarea[placeholder]",
      "textarea",
      "[contenteditable='true'][role='textbox']",
      "[contenteditable='true'][data-virtualkeyboard]",
      "[contenteditable='true']"
    ];

    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const composer = candidates.find(
        (candidate) =>
          isVisible(candidate) &&
          candidate.getAttribute("aria-disabled") !== "true" &&
          !candidate.hasAttribute("disabled")
      );
      if (composer instanceof HTMLElement) {
        return composer;
      }
    }
    return null;
  };

  const getComposerSurface = (composer: HTMLElement): ParentNode => {
    const form = composer.closest("form");
    if (form) {
      return form;
    }

    let ancestor = composer.parentElement;
    for (let depth = 0; ancestor && depth < 6; depth += 1) {
      if (ancestor.querySelectorAll("button, [role='button']").length >= 2) {
        return ancestor;
      }
      ancestor = ancestor.parentElement;
    }
    return document;
  };

  const normalizedLabel = (element: Element): string =>
    [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const isControlActive = (element: Element): boolean => {
    const attributes = [
      element.getAttribute("aria-pressed"),
      element.getAttribute("aria-checked"),
      element.getAttribute("data-state"),
      element.getAttribute("data-active"),
      element.getAttribute("data-selected")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const className = String(element.getAttribute("class") || "").toLowerCase();
    return (
      /\b(true|on|checked|active|selected)\b/.test(attributes) ||
      /\b(active|selected|checked)\b/.test(className)
    );
  };

  const findSearchControl = (surface: ParentNode): HTMLElement | null => {
    const controls = Array.from(surface.querySelectorAll("button, [role='button']"));
    const exactLabels =
      target === "chatgpt"
        ? ["search", "web search", "搜索", "网页搜索"]
        : ["联网搜索", "web search", "search"];

    const control = controls.find((candidate) => {
      if (!isVisible(candidate) || candidate.getAttribute("aria-disabled") === "true") {
        return false;
      }
      const label = normalizedLabel(candidate);
      const testId = candidate.getAttribute("data-testid")?.toLowerCase() || "";
      if (target === "chatgpt" && testId.includes("composer") && testId.includes("search")) {
        return true;
      }
      return exactLabels.some(
        (expected) => label === expected || label.startsWith(`${expected} `)
      );
    });
    return control instanceof HTMLElement ? control : null;
  };

  const enableWebSearch = async (
    surface: ParentNode
  ): Promise<ExternalAssistantSearchStatus> => {
    if (!requireWebSearch) {
      return "not_requested";
    }

    const control = findSearchControl(surface);
    if (!control) {
      return target === "chatgpt" ? "automatic" : "unavailable";
    }

    if (!isControlActive(control)) {
      control.click();
      await sleep(350);
    }
    return "enabled";
  };

  const readComposerText = (composer: HTMLElement): string => {
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return composer.value;
    }
    return composer.innerText || composer.textContent || "";
  };

  const fillComposer = (composer: HTMLElement): boolean => {
    composer.focus();

    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype =
        composer instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(composer, prompt);
      composer.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: prompt
        })
      );
      composer.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(composer);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const inserted = document.execCommand("insertText", false, prompt);
      if (!inserted || !readComposerText(composer).trim()) {
        composer.replaceChildren(document.createTextNode(prompt));
        composer.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: prompt
          })
        );
      }
    }

    const actual = readComposerText(composer).replace(/\s+/g, "").trim();
    const expectedStart = prompt.replace(/\s+/g, "").trim().slice(0, 80);
    return actual.startsWith(expectedStart);
  };

  const findSendControl = (
    composer: HTMLElement,
    surface: ParentNode
  ): HTMLElement | null => {
    const selectors = [
      "button[data-testid='send-button']",
      "button[data-testid*='send']",
      "button[type='submit']",
      "button[aria-label*='Send']",
      "button[aria-label*='send']",
      "button[aria-label*='发送']",
      "button[aria-label*='提交']",
      "button[title*='发送']",
      "[role='button'][aria-label*='发送']",
      "[role='button'][aria-label*='Send']"
    ];

    for (const selector of selectors) {
      const candidates = Array.from(surface.querySelectorAll(selector));
      const control = candidates.find(
        (candidate) =>
          isVisible(candidate) &&
          candidate.getAttribute("aria-disabled") !== "true" &&
          !candidate.hasAttribute("disabled")
      );
      if (control instanceof HTMLElement) {
        return control;
      }
    }

    const controls = Array.from(surface.querySelectorAll("button, [role='button']"));
    const labelledSendControl = controls.find((candidate) => {
      if (
        !isVisible(candidate) ||
        candidate.getAttribute("aria-disabled") === "true" ||
        candidate.hasAttribute("disabled")
      ) {
        return false;
      }
      return /(^|\s)(send|submit|发送|提交)(\s|$)/i.test(normalizedLabel(candidate));
    });
    return labelledSendControl instanceof HTMLElement ? labelledSendControl : null;
  };

  const composer = await waitFor(findComposer, 20_000);
  if (!composer) {
    return {
      target,
      filled: false,
      submitted: false,
      searchStatus: requireWebSearch ? "unavailable" : "not_requested",
      reason: "composer_not_found"
    };
  }

  const surface = getComposerSurface(composer);
  const searchStatus = await enableWebSearch(surface);
  const filled = fillComposer(composer);
  if (!filled) {
    return {
      target,
      filled: false,
      submitted: false,
      searchStatus,
      reason: "prompt_not_filled"
    };
  }

  const sendControl = await waitFor(
    () => findSendControl(composer, surface),
    4_000
  );
  if (!sendControl) {
    return {
      target,
      filled: true,
      submitted: false,
      searchStatus,
      reason: "send_not_found"
    };
  }

  sendControl.click();
  return {
    target,
    filled: true,
    submitted: true,
    searchStatus
  };
}
