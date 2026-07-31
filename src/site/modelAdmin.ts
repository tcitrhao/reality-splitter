import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER
} from "../shared/storage";
import {
  validateProviderSettings,
  type ProviderProfile
} from "../shared/providerProfiles";
import type {
  ModelProfile,
  ModelRuntimeSettings,
  StoredSettings,
  WorkspaceMode
} from "../shared/types";

export type ConnectionState = {
  status: "idle" | "testing" | "success" | "error";
  message: string;
};

export type ModelPreset = {
  label: string;
  description: string;
  settings: Omit<ModelRuntimeSettings, "apiKey">;
};

export const MODEL_PRESETS: ModelPreset[] = [
  {
    label: "DeepSeek V4 Flash",
    description: "更快，适合高频短文拆解",
    settings: {
      provider: "openai-compatible",
      model: "deepseek-v4-flash",
      baseUrl: "https://api.deepseek.com/v1"
    }
  },
  {
    label: "DeepSeek V4 Pro",
    description: "更完整，适合复杂分析",
    settings: {
      provider: "openai-compatible",
      model: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com/v1"
    }
  },
  {
    label: "Kimi K2.6",
    description: "适合长文和联网核查",
    settings: {
      provider: "openai-compatible",
      model: "kimi-k2.6",
      baseUrl: "https://api.moonshot.cn/v1"
    }
  }
];

export const DEFAULT_CONNECTION_MESSAGE =
  "保存前可测试 API Key、模型名和接口地址。";

export function createBlankProfile(index: number): ModelProfile {
  return {
    id: createProfileId(),
    name: `模型配置 ${index + 1}`,
    provider: "openai-compatible",
    apiKey: "",
    model: "",
    baseUrl: ""
  };
}

export function createPresetProfile(
  preset: ModelPreset,
  existingProfiles: ModelProfile[]
): ModelProfile {
  return {
    id: createProfileId(),
    name: createUniqueName(preset.label, existingProfiles),
    apiKey: "",
    ...preset.settings
  };
}

export function getDraftDefault(
  settings: StoredSettings,
  mode: WorkspaceMode
): ModelProfile {
  return (
    settings.profiles.find(
      (profile) => profile.id === settings.defaultProfileIds[mode]
    ) ?? settings.profiles[0]
  );
}

export function normalizeProfileDraft(profile: ModelProfile): ModelProfile {
  return {
    ...profile,
    id: profile.id.trim(),
    name: profile.name.trim(),
    provider: profile.provider || DEFAULT_PROVIDER,
    apiKey: profile.apiKey.trim(),
    model: profile.model.trim() || DEFAULT_MODEL,
    baseUrl:
      profile.provider === "openai"
        ? DEFAULT_BASE_URL
        : profile.baseUrl.trim().replace(/\/+$/, "")
  };
}

export function validateProfileDraft(
  profile: ModelProfile,
  requireApiKey = false
): string | null {
  if (!profile.name.trim()) {
    return "请填写配置名称。";
  }

  if (requireApiKey && !profile.apiKey.trim()) {
    return "需要先填写 API Key。";
  }

  if (!profile.model.trim()) {
    return "请填写模型名称。";
  }

  if (profile.provider === "openai-compatible") {
    try {
      const url = new URL(profile.baseUrl);
      const localHosts = ["localhost", "127.0.0.1"];
      if (url.protocol !== "https:" && !localHosts.includes(url.hostname)) {
        return "接口地址必须使用 HTTPS；本地开发地址除外。";
      }
    } catch {
      return "Base URL 格式不正确。";
    }
  }

  return validateProviderSettings(normalizeProfileDraft(profile));
}

export function areAdminSettingsEqual(
  first: StoredSettings,
  second: StoredSettings
): boolean {
  return JSON.stringify({
    profiles: first.profiles,
    defaultProfileIds: first.defaultProfileIds
  }) === JSON.stringify({
    profiles: second.profiles,
    defaultProfileIds: second.defaultProfileIds
  });
}

export function isDefaultDirty(
  mode: WorkspaceMode,
  draft: StoredSettings,
  saved: StoredSettings
): boolean {
  const draftProfile = getDraftDefault(draft, mode);
  const savedProfile = getDraftDefault(saved, mode);
  return (
    draft.defaultProfileIds[mode] !== saved.defaultProfileIds[mode] ||
    JSON.stringify(draftProfile) !== JSON.stringify(savedProfile)
  );
}

export function getProfileLabel(profile: ProviderProfile): string {
  switch (profile) {
    case "deepseek":
      return "DeepSeek";
    case "kimi":
      return "Kimi";
    default:
      return "通用模型";
  }
}

function createUniqueName(
  preferredName: string,
  existingProfiles: ModelProfile[]
): string {
  const existingNames = new Set(existingProfiles.map((profile) => profile.name));
  if (!existingNames.has(preferredName)) {
    return preferredName;
  }

  let suffix = 2;
  while (existingNames.has(`${preferredName} ${suffix}`)) {
    suffix += 1;
  }
  return `${preferredName} ${suffix}`;
}

function createProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `model-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
