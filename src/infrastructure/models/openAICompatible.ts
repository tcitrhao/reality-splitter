import type { PromptDefinition } from "../../shared/prompts";
import type { AIProvider, AnalysisMode } from "../../shared/types";
import type { ProviderProfile } from "../../shared/providerProfiles";
import { DEFAULT_BASE_URL } from "../../shared/storage";
import { isTimeoutError } from "../../application/errors/userVisibleError";

const DEFAULT_REQUEST_TIMEOUT_MS = 45000;
const LONGFORM_REQUEST_TIMEOUT_MS = 90000;
const KIMI_LONGFORM_REQUEST_TIMEOUT_MS = 180000;
const QUICK_MAX_OUTPUT_TOKENS = 2048;
const DEEPSEEK_QUICK_MAX_OUTPUT_TOKENS = 4096;
const LONGFORM_MAX_OUTPUT_TOKENS = 4096;

export interface ToolCall {
  id: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export type ChatRequestMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
      tool_calls?: ToolCall[];
      reasoning_content?: string;
    }
  | {
      role: "tool";
      tool_call_id: string;
      name: string;
      content: string;
    };

export interface BuildRequestOptions {
  messages?: ChatRequestMessage[];
  kimiTools?: Array<Record<string, unknown>>;
  disableKimiThinking?: boolean;
  temperatureOverride?: number;
}

export function buildChatCompletionsUrl(
  provider: AIProvider,
  configuredBaseUrl: string
): string {
  return `${buildApiBaseUrl(provider, configuredBaseUrl)}/chat/completions`;
}

export function buildApiBaseUrl(provider: AIProvider, configuredBaseUrl: string): string {
  const baseUrl = normalizeBaseUrl(
    provider === "openai" ? DEFAULT_BASE_URL : configuredBaseUrl || DEFAULT_BASE_URL
  );

  return baseUrl.endsWith("/chat/completions")
    ? baseUrl.replace(/\/chat\/completions$/, "")
    : baseUrl;
}

export function buildRequestInit(
  mode: AnalysisMode,
  prompt: PromptDefinition,
  provider: AIProvider,
  model: string,
  apiKey: string,
  providerProfile: ProviderProfile,
  options: BuildRequestOptions = {}
): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(
      buildRequestBody(mode, prompt, provider, model, providerProfile, options)
    )
  };
}

export function resolveTemperature(
  provider: AIProvider,
  providerProfile: ProviderProfile
): number {
  if (providerProfile === "kimi") {
    return 0.6;
  }

  if (provider === "openai-compatible") {
    return 0.1;
  }

  return 0.2;
}

export function parseRequiredTemperature(message: string | null): number | null {
  if (!message) {
    return null;
  }

  const match = message.match(/only\s+([0-9]+(?:\.[0-9]+)?)\s+is allowed/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveRequestTimeout(
  mode: "quick" | "longform",
  providerProfile: ProviderProfile
): number {
  if (mode === "longform" && providerProfile === "kimi") {
    return KIMI_LONGFORM_REQUEST_TIMEOUT_MS;
  }

  return mode === "longform" ? LONGFORM_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
}

export function isRetryableStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

export function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

export { isTimeoutError };

function buildRequestBody(
  mode: AnalysisMode,
  prompt: PromptDefinition,
  provider: AIProvider,
  model: string,
  providerProfile: ProviderProfile,
  options: BuildRequestOptions
) {
  const messages =
    options.messages ??
    [
      {
        role: "system",
        content: prompt.system
      },
      {
        role: "user",
        content: prompt.user
      }
    ];
  const requestBody: Record<string, unknown> = {
    model,
    temperature: options.temperatureOverride ?? resolveTemperature(provider, providerProfile),
    max_tokens: resolveMaxOutputTokens(mode, providerProfile),
    messages
  };

  if (provider === "openai") {
    requestBody.response_format = {
      type: "json_schema",
      json_schema: {
        name: `reality_splitter_${mode}`,
        strict: true,
        schema: prompt.jsonSchema
      }
    };
  } else if (providerProfile === "kimi") {
    requestBody.response_format = {
      type: "json_object"
    };

    if (options.kimiTools?.length) {
      requestBody.tools = options.kimiTools;
    }

    if (options.disableKimiThinking) {
      requestBody.thinking = {
        type: "disabled"
      };
    }
  } else {
    requestBody.messages = [
      {
        role: "system",
        content: prompt.system
      },
      {
        role: "user",
        content: [
          prompt.user,
          "请只返回严格 JSON，不要添加 markdown、解释、标题或代码块。"
        ].join("\n\n")
      }
    ];
  }

  return requestBody;
}

function resolveMaxOutputTokens(
  mode: AnalysisMode,
  providerProfile: ProviderProfile
): number {
  if (mode === "longform") {
    return LONGFORM_MAX_OUTPUT_TOKENS;
  }

  return providerProfile === "deepseek"
    ? DEEPSEEK_QUICK_MAX_OUTPUT_TOKENS
    : QUICK_MAX_OUTPUT_TOKENS;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
