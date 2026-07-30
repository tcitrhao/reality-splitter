import { PRODUCT_COPY } from "../../shared/productCopy";
import type { RuntimeResponse } from "../../shared/messages";
import type { TweetInput } from "../../shared/types";
import {
  collectPostRoots,
  extractPostInputFromRoot,
  findButtonAnchor,
  findClosestPostRoot,
  isRenderablePostRoot
} from "../../content/platformExtractor";

const PROCESSED_ATTR = "data-reality-splitter-bound";
const SIGNATURE_ATTR = "data-reality-splitter-signature";
const SCAN_INTERVAL_MS = 1600;

export const BUTTON_HOST_ATTR = "data-reality-splitter-button-host";
export const WEIBO_NO_BUTTONS_CLASS = "reality-splitter-weibo-no-buttons";
export const LEGACY_WEIBO_OVERLAY_ID = "reality-splitter-weibo-overlay";
export const LEGACY_WEIBO_FLOATING_HOST_ID = "reality-splitter-weibo-floating-host";

interface XEntryDependencies {
  openQuickDrawer: (input: TweetInput) => void;
  persistInput: (input: TweetInput) => Promise<RuntimeResponse>;
  showToast: (message: string) => void;
}

export function startXEntry(dependencies: XEntryDependencies): () => void {
  removeInjectedButtons();

  const scan = (root: ParentNode) => {
    collectPostRoots(root).forEach((post) => syncButton(post, dependencies));
  };
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        const closestRoot = findClosestPostRoot(node);
        if (closestRoot === node) {
          syncButton(node, dependencies);
        } else {
          scan(node);
        }
      }
    }
  });
  let scrollTimer = 0;
  const scanDocument = () => scan(document);
  const handleScroll = () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(scanDocument, 120);
  };

  scan(document);
  observer.observe(document.body, { childList: true, subtree: true });
  const intervalId = window.setInterval(scanDocument, SCAN_INTERVAL_MS);
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", scanDocument, { passive: true });

  return () => {
    observer.disconnect();
    window.clearInterval(intervalId);
    window.clearTimeout(scrollTimer);
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", scanDocument);
  };
}

export function enforceWeiboButtonRemoval() {
  document.documentElement.classList.add(WEIBO_NO_BUTTONS_CLASS);
  removeInjectedButtons();
  document.getElementById(LEGACY_WEIBO_OVERLAY_ID)?.remove();
  document.getElementById(LEGACY_WEIBO_FLOATING_HOST_ID)?.remove();
}

function syncButton(postRoot: HTMLElement, dependencies: XEntryDependencies) {
  const nextSignature = computePostSignature(postRoot);
  const previousSignature = postRoot.getAttribute(SIGNATURE_ATTR);
  const hasButton = postRoot.querySelector(`[${BUTTON_HOST_ATTR}="true"]`) !== null;

  if (
    postRoot.getAttribute(PROCESSED_ATTR) === "true" &&
    previousSignature === nextSignature &&
    hasButton
  ) {
    return;
  }

  cleanupInjectedButton(postRoot);
  injectButton(postRoot, nextSignature, dependencies);
}

function injectButton(
  postRoot: HTMLElement,
  signature: string,
  dependencies: XEntryDependencies
) {
  if (!isRenderablePostRoot(postRoot)) {
    postRoot.removeAttribute(PROCESSED_ATTR);
    postRoot.removeAttribute(SIGNATURE_ATTR);
    return;
  }

  const insertionTarget = findButtonAnchor(postRoot);
  if (!insertionTarget) {
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
      dependencies.showToast("当前没有检测到推文文本，可以手动选中文字后再试。");
      return;
    }

    dependencies.openQuickDrawer(input);
    void dependencies.persistInput(input).then((response) => {
      if (!response.ok) {
        dependencies.showToast(response.error || "抽屉已打开，但扩展后台暂时没有响应。");
      }
    });
  });

  host.appendChild(button);
  insertionTarget.appendChild(host);
  postRoot.setAttribute(PROCESSED_ATTR, "true");
  postRoot.setAttribute(SIGNATURE_ATTR, signature);
}

function cleanupInjectedButton(postRoot: HTMLElement) {
  postRoot.querySelectorAll(`[${BUTTON_HOST_ATTR}="true"]`).forEach((element) => element.remove());
  postRoot.removeAttribute(PROCESSED_ATTR);
  postRoot.removeAttribute(SIGNATURE_ATTR);
}

function removeInjectedButtons() {
  document.querySelectorAll(`[${BUTTON_HOST_ATTR}="true"]`).forEach((element) => element.remove());
  document.querySelectorAll<HTMLElement>(`[${PROCESSED_ATTR}]`).forEach((element) => {
    element.removeAttribute(PROCESSED_ATTR);
    element.removeAttribute(SIGNATURE_ATTR);
  });
}

function computePostSignature(postRoot: HTMLElement): string {
  return extractPostInputFromRoot(postRoot)?.text.slice(0, 180) || "";
}
