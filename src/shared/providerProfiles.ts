import type { ModelRuntimeSettings } from "./types";

const DEEPSEEK_MODELS = new Set(["deepseek-v4-pro", "deepseek-v4-flash"]);
export type ProviderProfile = "deepseek" | "kimi" | "zhipu" | "generic";

export function detectProviderProfile(settings: ModelRuntimeSettings): ProviderProfile {
  const normalizedModel = settings.model.trim().toLowerCase();

  if (
    normalizedModel.includes("kimi") ||
    normalizedModel.includes("moonshot") ||
    /^k\d/.test(normalizedModel) ||
    normalizedModel.includes("k2.6") ||
    normalizedModel.includes("k1.5")
  ) {
    return "kimi";
  }

  if (normalizedModel.startsWith("glm-") || normalizedModel.includes("chatglm")) {
    return "zhipu";
  }

  try {
    const rawUrl = settings.baseUrl || "";
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("deepseek.com")) {
      return "deepseek";
    }

    if (hostname.includes("moonshot.cn") || hostname.includes("moonshot.ai") || hostname.includes("kimi")) {
      return "kimi";
    }

    if (
      hostname.includes("bigmodel.cn") ||
      hostname.includes("zhipuai.cn") ||
      hostname === "api.z.ai"
    ) {
      return "zhipu";
    }

    return "generic";
  } catch {
    return "generic";
  }
}

export function validateProviderSettings(settings: ModelRuntimeSettings): string | null {
  const model = settings.model.trim();

  if (!model) {
    return "模型名称还是空的，请先填写后再试。";
  }

  if (detectProviderProfile(settings) === "deepseek" && !DEEPSEEK_MODELS.has(model)) {
    return `当前生效的模型名是“${model}”，但 DeepSeek 这里需要使用 deepseek-v4-pro 或 deepseek-v4-flash。请改完后重新点一次“保存设置”。`;
  }

  return null;
}
