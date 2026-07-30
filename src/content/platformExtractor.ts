import type { TweetInput } from "../shared/types";

type SupportedPlatform = "twitter" | "weibo" | "unknown";

const TWITTER_TEXT_SELECTOR = "div[data-testid='tweetText'], div[lang]";
const TWITTER_SKIP_TEXT_SELECTOR = [
  "[data-reality-splitter-button-host]",
  "div[role='group']",
  "button[data-testid]",
  "div[data-testid='socialContext']",
  "div[data-testid='caret']"
].join(", ");

const WEIBO_POST_SELECTOR = [
  "[data-testid='weibo-post']",
  ".Feed_wrap_3b6rw",
  ".card-feed",
  "[mid]"
].join(", ");

const WEIBO_TEXT_SELECTOR = [
  "[node-type='feed_list_content']",
  "[node-type='feed_list_reason']",
  "[class*='detail_wbtext']",
  "[class*='feed_list_content']",
  ".detail_wbtext_4CRf9",
  ".Feed_body_3R0rO .wbpro-feed-content",
  ".wbpro-feed-content .detail_wbtext_4CRf9",
  ".wbpro-feed-content .expand",
  ".wbpro-feed-content",
  ".Feed_body_3R0rO"
].join(", ");

const WEIBO_BODY_SELECTOR = [
  ".Feed_body_3R0rO",
  ".wbpro-feed-content",
  ".card-feed .content",
  ".woo-box-item-main"
].join(", ");

const WEIBO_SKIP_TEXT_SELECTOR = [
  "[data-reality-splitter-button-host]",
  ".toolbar_main_1FvF3",
  ".woo-box-flex.woo-box-alignCenter.woo-box-justifyCenter",
  ".head-info_time_6sFQg",
  ".head-info_from_3qWEK",
  "button",
  "svg"
].join(", ");

export function detectPlatform(hostname: string = window.location.hostname): SupportedPlatform {
  if (
    hostname === "x.com" ||
    hostname === "twitter.com" ||
    hostname.endsWith(".x.com") ||
    hostname.endsWith(".twitter.com")
  ) {
    return "twitter";
  }

  if (hostname === "weibo.com" || hostname.endsWith(".weibo.com")) {
    return "weibo";
  }

  return "unknown";
}

export function getPostRootSelector(platform: SupportedPlatform): string {
  switch (platform) {
    case "twitter":
      return "article";
    case "weibo":
      return WEIBO_POST_SELECTOR;
    default:
      return "";
  }
}

export function collectPostRoots(scope: ParentNode): HTMLElement[] {
  const platform = detectPlatform();

  if (platform === "weibo") {
    return collectWeiboPostRoots(scope);
  }

  if (platform === "twitter") {
    return Array.from(scope.querySelectorAll<HTMLElement>("article"));
  }

  return [];
}

export function findClosestPostRoot(node: Node | null): HTMLElement | null {
  if (!(node instanceof Element)) {
    return null;
  }

  const platform = detectPlatform();

  if (platform === "weibo") {
    return (
      node.closest<HTMLElement>(WEIBO_POST_SELECTOR) ||
      node.closest<HTMLElement>(WEIBO_BODY_SELECTOR) ||
      node.closest<HTMLElement>("[class*='content']") ||
      null
    );
  }

  return platform === "twitter" ? node.closest<HTMLElement>("article") : null;
}

export function isRenderablePostRoot(root: HTMLElement): boolean {
  const platform = detectPlatform();

  if (platform === "weibo") {
    const rect = root.getBoundingClientRect();
    return estimateWeiboTextLength(root) >= 16 && rect.height > 80 && rect.width > 220;
  }

  return platform === "twitter";
}

export function findButtonAnchor(root: HTMLElement): HTMLElement | null {
  const platform = detectPlatform();

  if (platform === "weibo") {
    return findWeiboButtonAnchor(root);
  }

  return platform === "twitter" ? findTwitterButtonAnchor(root) : null;
}

export function extractPostInputFromRoot(root: Element | null): TweetInput | null {
  const platform = detectPlatform();

  switch (platform) {
    case "twitter":
      return extractTwitterInputFromRoot(root);
    case "weibo":
      return extractWeiboInputFromRoot(root);
    default:
      return null;
  }
}

export function getFallbackSelectionText(): string {
  const selectedText = window.getSelection()?.toString() ?? "";
  return normalizeText(selectedText);
}

function extractTwitterInputFromRoot(root: Element | null): TweetInput | null {
  if (!root) {
    return null;
  }

  const text = extractTwitterTextFromRoot(root);

  if (!text) {
    const fallback = getFallbackSelectionText();
    return fallback ? { text: fallback, url: window.location.href } : null;
  }

  const author = root.querySelector("div[data-testid='User-Name'] span")?.textContent?.trim() || undefined;
  const timestamp = root.querySelector("time")?.getAttribute("datetime") ?? undefined;
  const statusLink = root.querySelector<HTMLAnchorElement>("a[href*='/status/']");

  return {
    text,
    author,
    timestamp,
    url: statusLink?.href || window.location.href
  };
}

function extractTwitterTextFromRoot(root: Element): string {
  const textBlocks = Array.from(root.querySelectorAll<HTMLElement>(TWITTER_TEXT_SELECTOR))
    .map((element) => normalizeText(element.innerText))
    .filter((text) => Boolean(text) && !isTwitterNoiseText(text));

  const deduplicated = deduplicateOrdered(textBlocks);

  if (deduplicated.length > 0) {
    return deduplicated.join("\n");
  }

  return extractFallbackText(root, TWITTER_SKIP_TEXT_SELECTOR, isTwitterNoiseText, looksLikeTwitterMetaLine);
}

function extractWeiboInputFromRoot(root: Element | null): TweetInput | null {
  if (!root) {
    return null;
  }

  const text = extractWeiboTextFromRoot(root);

  if (!text) {
    const fallback = getFallbackSelectionText();
    return fallback ? { text: fallback, url: window.location.href } : null;
  }

  const author = extractWeiboAuthor(root);
  const timestamp = extractWeiboTimestamp(root);
  const url = extractWeiboUrl(root);

  return {
    text,
    author,
    timestamp,
    url
  };
}

function extractWeiboTextFromRoot(root: Element): string {
  const textBlocks = Array.from(root.querySelectorAll<HTMLElement>(WEIBO_TEXT_SELECTOR))
    .map((element) => normalizeText(element.innerText))
    .filter((text) => Boolean(text) && !isWeiboNoiseText(text));

  const deduplicated = deduplicateOrdered(textBlocks);

  if (deduplicated.length > 0) {
    return deduplicated.join("\n");
  }

  return extractFallbackText(root, WEIBO_SKIP_TEXT_SELECTOR, isWeiboNoiseText, looksLikeWeiboMetaLine);
}

function extractWeiboAuthor(root: Element): string | undefined {
  const authorNode = root.querySelector<HTMLElement>(
    ".head_nick_1yix2, .woo-font--extraBold, a[aria-label*='的微博'], .ALink_none_1w6rm"
  );
  const value = authorNode?.innerText?.trim();
  return value || undefined;
}

function extractWeiboTimestamp(root: Element): string | undefined {
  const timeNode = root.querySelector<HTMLElement>(
    ".head-info_time_6sFQg, [node-type='feed_list_item_date'], .from a"
  );
  const value = normalizeText(timeNode?.innerText || "");
  return value || undefined;
}

function extractWeiboUrl(root: Element): string | undefined {
  const permalink = root.querySelector<HTMLAnchorElement>(
    "a[href*='/status/'], a[href*='weibo.com/detail/'], a[href*='m.weibo.cn/detail/']"
  );

  if (permalink?.href) {
    return permalink.href;
  }

  return window.location.href;
}

function findWeiboButtonAnchor(root: HTMLElement): HTMLElement | null {
  const textBlocks = Array.from(root.querySelectorAll<HTMLElement>(WEIBO_TEXT_SELECTOR)).filter(
    (element) => normalizeText(element.innerText).length > 0
  );

  if (textBlocks.length > 0) {
    const lastTextBlock = textBlocks[textBlocks.length - 1];
    return lastTextBlock;
  }

  return (
    root.querySelector<HTMLElement>(WEIBO_BODY_SELECTOR) ||
    root.querySelector<HTMLElement>("[class*='content']") ||
    root
  );
}

function findTwitterButtonAnchor(root: HTMLElement): HTMLElement | null {
  const actionGroup = root.querySelector("div[role='group']");
  return actionGroup?.parentElement || (root.lastElementChild as HTMLElement) || root;
}

function extractFallbackText(
  root: Element,
  skipSelector: string,
  isNoiseText: (text: string) => boolean,
  looksLikeMetaLine: (text: string) => boolean
): string {
  const clone = root.cloneNode(true);

  if (!(clone instanceof HTMLElement)) {
    return "";
  }

  clone.querySelectorAll(skipSelector).forEach((node) => node.remove());

  const fallbackLines = clone.innerText
    .split("\n")
    .map((line) => normalizeText(line))
    .filter((line) => Boolean(line) && !isNoiseText(line) && !looksLikeMetaLine(line));

  return deduplicateOrdered(fallbackLines).join("\n");
}

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isTwitterNoiseText(text: string): boolean {
  const noisePatterns = [
    /^show more$/i,
    /^translate post$/i,
    /^alt$/i,
    /^replying to /i,
    /^·$/,
    /^\d+[kKmM]?\s*(reply|replies|repost|reposts|like|likes|view|views)$/i,
    /^\d+[kKmM]?$/,
    /^(reply|repost|like|view)$/i
  ];

  return noisePatterns.some((pattern) => pattern.test(text));
}

function looksLikeTwitterMetaLine(text: string): boolean {
  const metaPatterns = [
    /^@\w+/,
    /^\d{1,2}:\d{2}\s*(AM|PM)$/i,
    /^\d{4}-\d{2}-\d{2}/,
    /^·\s*\d+/,
    /^(follow|following|verified)$/i
  ];

  return metaPatterns.some((pattern) => pattern.test(text));
}

function isWeiboNoiseText(text: string): boolean {
  const noisePatterns = [
    /^赞$/i,
    /^评论$/i,
    /^转发$/i,
    /^收藏$/i,
    /^分享$/i,
    /^置顶$/i,
    /^展开$/i,
    /^收起$/i,
    /^热度$/i,
    /^\d+$/,
    /^\d+\s*(赞|评论|转发|收藏)$/i
  ];

  return noisePatterns.some((pattern) => pattern.test(text));
}

function looksLikeWeiboMetaLine(text: string): boolean {
  const metaPatterns = [
    /^@[^ ]+/,
    /^(今天|昨天|\d{1,2}-\d{1,2}|\d{4}-\d{1,2}-\d{1,2})/,
    /^(来自|发布于|已编辑)/,
    /^(赞|评论|转发)\s*\d*/i
  ];

  return metaPatterns.some((pattern) => pattern.test(text));
}

function deduplicateOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function collectWeiboPostRoots(scope: ParentNode): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];

  const pushIfNew = (element: HTMLElement | null) => {
    if (!element || seen.has(element)) {
      return;
    }

    seen.add(element);
    result.push(element);
  };

  if (scope instanceof HTMLElement && normalizeText(scope.innerText).length > 0) {
    pushIfNew(
      scope.closest<HTMLElement>(WEIBO_POST_SELECTOR) ||
        scope.closest<HTMLElement>(WEIBO_BODY_SELECTOR) ||
        scope.closest<HTMLElement>("[class*='content']")
    );
  }

  for (const textBlock of Array.from(scope.querySelectorAll<HTMLElement>(WEIBO_TEXT_SELECTOR))) {
    if (normalizeText(textBlock.innerText).length === 0) {
      continue;
    }

    pushIfNew(
      textBlock.closest<HTMLElement>(WEIBO_POST_SELECTOR) ||
        textBlock.closest<HTMLElement>(WEIBO_BODY_SELECTOR) ||
        textBlock.parentElement
    );
  }

  for (const postRoot of Array.from(scope.querySelectorAll<HTMLElement>(WEIBO_POST_SELECTOR))) {
    pushIfNew(postRoot);
  }

  return result;
}

function estimateWeiboTextLength(root: HTMLElement): number {
  const textBlocks = Array.from(root.querySelectorAll<HTMLElement>(WEIBO_TEXT_SELECTOR))
    .map((element) => normalizeText(element.innerText))
    .filter(Boolean);

  if (textBlocks.length > 0) {
    return textBlocks.join("\n").length;
  }

  return normalizeText(root.innerText).length;
}
