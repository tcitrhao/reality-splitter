import type { ExternalAssistantTarget } from "../../shared/types";

export const EXTERNAL_ASSISTANT_TARGETS: Record<
  ExternalAssistantTarget,
  { label: string; url: string; originPattern: string }
> = {
  chatgpt: {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    originPattern: "https://chatgpt.com/*"
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://chat.deepseek.com/",
    originPattern: "https://chat.deepseek.com/*"
  }
};

export function isExternalAssistantTarget(
  target: string
): target is ExternalAssistantTarget {
  return target === "chatgpt" || target === "deepseek";
}

export function getExternalAssistantUrl(target: string): string | null {
  return isExternalAssistantTarget(target)
    ? EXTERNAL_ASSISTANT_TARGETS[target].url
    : null;
}
