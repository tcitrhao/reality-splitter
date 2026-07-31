import type {
  LongformCheckInput,
  ModelProfile,
  ModelRuntimeSettings,
  StoredSettings,
  TweetInput,
  WorkspaceMode
} from "./types";
import {
  createStoredSettings,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  migrateLegacySettings
} from "./modelSettings";

export {
  createDefaultSettings,
  createStoredSettings,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  resolveDefaultProfile
} from "./modelSettings";

export const STORAGE_KEYS = {
  modelProfiles: "modelProfiles",
  quickDefaultProfileId: "quickDefaultProfileId",
  longformDefaultProfileId: "longformDefaultProfileId",
  quickProvider: "quickProvider",
  quickApiKey: "quickApiKey",
  quickModel: "quickModel",
  quickBaseUrl: "quickBaseUrl",
  longformProvider: "longformProvider",
  longformApiKey: "longformApiKey",
  longformModel: "longformModel",
  longformBaseUrl: "longformBaseUrl",
  legacyProvider: "provider",
  legacyApiKey: "apiKey",
  legacyModel: "model",
  legacyBaseUrl: "baseUrl",
  currentInput: "currentInput",
  uiError: "uiError",
  workspaceMode: "workspaceMode",
  longformInput: "longformInput"
} as const;

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "quick";

export async function getSettings(): Promise<StoredSettings> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.modelProfiles,
    STORAGE_KEYS.quickDefaultProfileId,
    STORAGE_KEYS.longformDefaultProfileId,
    STORAGE_KEYS.quickProvider,
    STORAGE_KEYS.quickApiKey,
    STORAGE_KEYS.quickModel,
    STORAGE_KEYS.quickBaseUrl,
    STORAGE_KEYS.longformProvider,
    STORAGE_KEYS.longformApiKey,
    STORAGE_KEYS.longformModel,
    STORAGE_KEYS.longformBaseUrl,
    STORAGE_KEYS.legacyProvider,
    STORAGE_KEYS.legacyApiKey,
    STORAGE_KEYS.legacyModel,
    STORAGE_KEYS.legacyBaseUrl
  ]);

  const storedProfiles = readStoredProfiles(data[STORAGE_KEYS.modelProfiles]);
  if (storedProfiles.length > 0) {
    return createStoredSettings(storedProfiles, {
      quick: readString(data[STORAGE_KEYS.quickDefaultProfileId]),
      longform: readString(data[STORAGE_KEYS.longformDefaultProfileId])
    });
  }

  return migrateLegacySettings(
    readModeSettings(data, "quick"),
    readModeSettings(data, "longform")
  );
}

export async function saveSettings(settings: StoredSettings): Promise<StoredSettings> {
  const normalized = createStoredSettings(settings.profiles, settings.defaultProfileIds);
  await chrome.storage.local.set({
    [STORAGE_KEYS.modelProfiles]: normalized.profiles,
    [STORAGE_KEYS.quickDefaultProfileId]: normalized.defaultProfileIds.quick,
    [STORAGE_KEYS.longformDefaultProfileId]: normalized.defaultProfileIds.longform,
    [STORAGE_KEYS.quickProvider]: normalized.quick.provider,
    [STORAGE_KEYS.quickApiKey]: normalized.quick.apiKey,
    [STORAGE_KEYS.quickModel]: normalized.quick.model,
    [STORAGE_KEYS.quickBaseUrl]: normalized.quick.baseUrl,
    [STORAGE_KEYS.longformProvider]: normalized.longform.provider,
    [STORAGE_KEYS.longformApiKey]: normalized.longform.apiKey,
    [STORAGE_KEYS.longformModel]: normalized.longform.model,
    [STORAGE_KEYS.longformBaseUrl]: normalized.longform.baseUrl
  });
  return normalized;
}

export async function getCurrentInput(): Promise<TweetInput | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.currentInput);
  return (data[STORAGE_KEYS.currentInput] as TweetInput | null | undefined) ?? null;
}

export async function setCurrentInput(input: TweetInput | null): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.currentInput]: input
  });
}

export async function getUiError(): Promise<string | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.uiError);
  const value = data[STORAGE_KEYS.uiError];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function setUiError(message: string | null): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.uiError]: message && message.trim() ? message : null
  });
}

export async function getWorkspaceMode(): Promise<WorkspaceMode> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.workspaceMode);
  return data[STORAGE_KEYS.workspaceMode] === "longform" ? "longform" : DEFAULT_WORKSPACE_MODE;
}

export async function setWorkspaceMode(mode: WorkspaceMode): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.workspaceMode]: mode
  });
}

export async function getLongformInput(): Promise<LongformCheckInput> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.longformInput);
  const value = data[STORAGE_KEYS.longformInput] as Partial<LongformCheckInput> | undefined;

  return {
    articleText: typeof value?.articleText === "string" ? value.articleText : "",
    referenceLinks: [],
    referenceNotes: ""
  };
}

export async function setLongformInput(input: LongformCheckInput): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.longformInput]: {
      articleText: input.articleText,
      referenceLinks: [],
      referenceNotes: ""
    }
  });
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function readStoredProfiles(value: unknown): ModelProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isModelProfile);
}

function isModelProfile(value: unknown): value is ModelProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<ModelProfile>;
  return (
    typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    typeof profile.apiKey === "string" &&
    typeof profile.model === "string" &&
    typeof profile.baseUrl === "string" &&
    (profile.provider === "openai" || profile.provider === "openai-compatible")
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readModeSettings(
  data: Record<string, unknown>,
  mode: "quick" | "longform"
): ModelRuntimeSettings {
  const providerKey =
    mode === "quick" ? STORAGE_KEYS.quickProvider : STORAGE_KEYS.longformProvider;
  const apiKeyKey =
    mode === "quick" ? STORAGE_KEYS.quickApiKey : STORAGE_KEYS.longformApiKey;
  const modelKey =
    mode === "quick" ? STORAGE_KEYS.quickModel : STORAGE_KEYS.longformModel;
  const baseUrlKey =
    mode === "quick" ? STORAGE_KEYS.quickBaseUrl : STORAGE_KEYS.longformBaseUrl;

  const legacyProvider = data[STORAGE_KEYS.legacyProvider];
  const legacyApiKey = data[STORAGE_KEYS.legacyApiKey];
  const legacyModel = data[STORAGE_KEYS.legacyModel];
  const legacyBaseUrl = data[STORAGE_KEYS.legacyBaseUrl];

  return {
    provider:
      data[providerKey] === "openai-compatible"
        ? "openai-compatible"
        : legacyProvider === "openai-compatible"
          ? "openai-compatible"
          : DEFAULT_PROVIDER,
    apiKey:
      typeof data[apiKeyKey] === "string"
        ? data[apiKeyKey]
        : typeof legacyApiKey === "string"
          ? legacyApiKey
          : "",
    model:
      typeof data[modelKey] === "string" && data[modelKey].trim()
        ? data[modelKey]
        : typeof legacyModel === "string" && legacyModel.trim()
          ? legacyModel
          : DEFAULT_MODEL,
    baseUrl:
      typeof data[baseUrlKey] === "string" && data[baseUrlKey].trim()
        ? normalizeBaseUrl(data[baseUrlKey])
        : typeof legacyBaseUrl === "string" && legacyBaseUrl.trim()
          ? normalizeBaseUrl(legacyBaseUrl)
          : DEFAULT_BASE_URL
  };
}
