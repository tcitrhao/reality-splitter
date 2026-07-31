import type {
  DefaultModelProfileIds,
  ModelProfile,
  ModelRuntimeSettings,
  StoredSettings,
  WorkspaceMode
} from "./types";

export const DEFAULT_PROVIDER = "openai";
export const DEFAULT_MODEL = "gpt-4.1-mini";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_PROFILE_ID = "default-model";

export function createDefaultSettings(): StoredSettings {
  return createStoredSettings(
    [createDefaultProfile()],
    {
      quick: DEFAULT_PROFILE_ID,
      longform: DEFAULT_PROFILE_ID
    }
  );
}

export function createStoredSettings(
  profiles: ModelProfile[],
  requestedDefaults: Partial<DefaultModelProfileIds>
): StoredSettings {
  const normalizedProfiles = normalizeProfiles(profiles);
  const fallbackId = normalizedProfiles[0].id;
  const defaultProfileIds: DefaultModelProfileIds = {
    quick: resolveDefaultId(normalizedProfiles, requestedDefaults.quick, fallbackId),
    longform: resolveDefaultId(normalizedProfiles, requestedDefaults.longform, fallbackId)
  };

  return {
    profiles: normalizedProfiles,
    defaultProfileIds,
    quick: toRuntimeSettings(resolveDefaultProfile(normalizedProfiles, defaultProfileIds, "quick")),
    longform: toRuntimeSettings(
      resolveDefaultProfile(normalizedProfiles, defaultProfileIds, "longform")
    )
  };
}

export function migrateLegacySettings(
  quick: ModelRuntimeSettings,
  longform: ModelRuntimeSettings
): StoredSettings {
  if (areRuntimeSettingsEqual(quick, longform)) {
    const profile = toProfile("migrated-current", "当前模型", quick);
    return createStoredSettings([profile], {
      quick: profile.id,
      longform: profile.id
    });
  }

  const quickProfile = toProfile("migrated-quick", "原短文模型", quick);
  const longformProfile = toProfile("migrated-longform", "原长文模型", longform);
  return createStoredSettings([quickProfile, longformProfile], {
    quick: quickProfile.id,
    longform: longformProfile.id
  });
}

export function resolveDefaultProfile(
  profiles: ModelProfile[],
  defaultProfileIds: DefaultModelProfileIds,
  mode: WorkspaceMode
): ModelProfile {
  return profiles.find((profile) => profile.id === defaultProfileIds[mode]) ?? profiles[0];
}

export function normalizeModelProfile(profile: ModelProfile, index = 0): ModelProfile {
  return {
    id: profile.id.trim() || `model-${index + 1}`,
    name: profile.name.trim() || `模型配置 ${index + 1}`,
    provider: profile.provider === "openai-compatible" ? "openai-compatible" : DEFAULT_PROVIDER,
    apiKey: profile.apiKey.trim(),
    model: profile.model.trim() || DEFAULT_MODEL,
    baseUrl:
      profile.provider === "openai"
        ? DEFAULT_BASE_URL
        : normalizeBaseUrl(profile.baseUrl) || DEFAULT_BASE_URL
  };
}

function normalizeProfiles(profiles: ModelProfile[]): ModelProfile[] {
  const source = profiles.length ? profiles : [createDefaultProfile()];
  const usedIds = new Set<string>();

  return source.map((profile, index) => {
    const normalized = normalizeModelProfile(profile, index);
    let id = normalized.id;

    while (usedIds.has(id)) {
      id = `${normalized.id}-${index + 1}`;
    }

    usedIds.add(id);
    return { ...normalized, id };
  });
}

function createDefaultProfile(): ModelProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: "默认模型",
    provider: DEFAULT_PROVIDER,
    apiKey: "",
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL
  };
}

function resolveDefaultId(
  profiles: ModelProfile[],
  requestedId: string | undefined,
  fallbackId: string
): string {
  return profiles.some((profile) => profile.id === requestedId) ? requestedId! : fallbackId;
}

function toRuntimeSettings(profile: ModelProfile): ModelRuntimeSettings {
  return {
    provider: profile.provider,
    apiKey: profile.apiKey,
    model: profile.model,
    baseUrl: profile.baseUrl
  };
}

function toProfile(
  id: string,
  name: string,
  settings: ModelRuntimeSettings
): ModelProfile {
  return {
    id,
    name,
    ...settings
  };
}

function areRuntimeSettingsEqual(
  first: ModelRuntimeSettings,
  second: ModelRuntimeSettings
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
