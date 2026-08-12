import type { ExternalAssistantTarget } from "../../shared/types";

export type ExternalAssistantRegion = "china" | "us";

export interface ExternalAssistantTargetConfig {
  label: string;
  url: string;
  region: ExternalAssistantRegion;
  originPattern: string;
}

export const EXTERNAL_ASSISTANT_TARGETS: Record<
  ExternalAssistantTarget,
  ExternalAssistantTargetConfig
> = {
  chatgpt: {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    region: "us",
    originPattern: "https://chatgpt.com/*"
  },
  claude: {
    label: "Claude",
    url: "https://claude.ai/new",
    region: "us",
    originPattern: "https://claude.ai/*"
  },
  gemini: {
    label: "Gemini",
    url: "https://gemini.google.com/app",
    region: "us",
    originPattern: "https://gemini.google.com/*"
  },
  grok: {
    label: "Grok",
    url: "https://grok.com/",
    region: "us",
    originPattern: "https://grok.com/*"
  },
  perplexity: {
    label: "Perplexity",
    url: "https://www.perplexity.ai/",
    region: "us",
    originPattern: "https://www.perplexity.ai/*"
  },
  copilot: {
    label: "Microsoft Copilot",
    url: "https://copilot.microsoft.com/",
    region: "us",
    originPattern: "https://copilot.microsoft.com/*"
  },
  meta: {
    label: "Meta AI",
    url: "https://www.meta.ai/",
    region: "us",
    originPattern: "https://www.meta.ai/*"
  },
  poe: {
    label: "Poe",
    url: "https://poe.com/",
    region: "us",
    originPattern: "https://poe.com/*"
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://chat.deepseek.com/",
    region: "china",
    originPattern: "https://chat.deepseek.com/*"
  },
  doubao: {
    label: "豆包",
    url: "https://www.doubao.com/chat/",
    region: "china",
    originPattern: "https://www.doubao.com/*"
  },
  kimi: {
    label: "Kimi",
    url: "https://www.kimi.com/",
    region: "china",
    originPattern: "https://www.kimi.com/*"
  },
  qianwen: {
    label: "千问",
    url: "https://www.qianwen.com/",
    region: "china",
    originPattern: "https://www.qianwen.com/*"
  },
  yuanbao: {
    label: "腾讯元宝",
    url: "https://yuanbao.tencent.com/",
    region: "china",
    originPattern: "https://yuanbao.tencent.com/*"
  },
  wenxin: {
    label: "文心",
    url: "https://wenxin.baidu.com/",
    region: "china",
    originPattern: "https://wenxin.baidu.com/*"
  },
  zhipu: {
    label: "智谱清言",
    url: "https://chatglm.cn/",
    region: "china",
    originPattern: "https://chatglm.cn/*"
  },
  nami: {
    label: "纳米 AI",
    url: "https://www.n.cn/",
    region: "china",
    originPattern: "https://www.n.cn/*"
  }
};

export const EXTERNAL_ASSISTANT_GROUPS: Array<{
  id: ExternalAssistantRegion;
  label: string;
  targets: ExternalAssistantTarget[];
}> = [
  {
    id: "china",
    label: "中国",
    targets: [
      "doubao",
      "qianwen",
      "deepseek",
      "yuanbao",
      "kimi",
      "wenxin",
      "zhipu",
      "nami"
    ]
  },
  {
    id: "us",
    label: "美国",
    targets: [
      "chatgpt",
      "gemini",
      "claude",
      "grok",
      "copilot",
      "perplexity",
      "meta",
      "poe"
    ]
  }
];

export function isExternalAssistantTarget(
  target: string
): target is ExternalAssistantTarget {
  return Object.prototype.hasOwnProperty.call(EXTERNAL_ASSISTANT_TARGETS, target);
}

export function getExternalAssistantUrl(target: string): string | null {
  return isExternalAssistantTarget(target)
    ? EXTERNAL_ASSISTANT_TARGETS[target].url
    : null;
}
