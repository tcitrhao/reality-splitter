import {
  UserVisibleError,
  toUserMessage
} from "../application/errors/userVisibleError";
import { prepareInputText, normalizeInputText } from "../infrastructure/models/inputPreparation";
import {
  type ChatRequestMessage,
  type ToolCall,
  buildChatCompletionsUrl,
  buildRequestInit,
  isRetryableStatus,
  isTimeoutError,
  parseRequiredTemperature,
  resolveRequestTimeout,
  resolveTemperature,
  timeoutSignal
} from "../infrastructure/models/openAICompatible";
import {
  normalizeModelContent,
  readErrorMessage,
  safeParseJson,
  safeReadJson
} from "../infrastructure/models/responseParsing";
import {
  callKimiFormulaTool,
  fetchKimiWebSearchTools
} from "../infrastructure/search/kimiWebSearch";
import {
  fetchZhipuLongformEvidence,
  searchZhipuWeb
} from "../infrastructure/search/zhipuWebSearch";
import { restrictZhipuSourceUrls } from "../infrastructure/search/zhipuSearchProtocol";
import { buildFallbackResult, detectInputProfile, enrichAnalysisResult } from "./analysisHeuristics";
import {
  ensureApiPermission,
  ensureZhipuWebSearchPermission
} from "./apiPermissions";
import { buildLongformPrompt, buildPrompt } from "./prompts";
import { detectProviderProfile, validateProviderSettings, type ProviderProfile } from "./providerProfiles";
import { getSettings } from "./storage";
import { normalizeZhipuSearchEngine } from "./zhipuSearch.ts";
import type {
  AIProvider,
  AIResponse,
  AnalysisMode,
  AnalysisResultMap,
  AttentionTriage,
  AlternativesResult,
  DeescalateResult,
  ExperimentResult,
  LongformCheckInput,
  LongformCheckResult,
  ModelConnectionTestResult,
  ModelRuntimeSettings,
  QuickAnalysisMode,
  SplitAnalysisResult,
  TweetInput,
  WorkspaceMode,
  ZhipuSearchEngine
} from "./types";

const MAX_LONGFORM_INPUT_CHARS = 12000;
const MAX_REFERENCE_NOTES_CHARS = 5000;
const MAX_KIMI_TOOL_ROUNDS = 4;

export async function runAnalysis<M extends QuickAnalysisMode>(
  mode: M,
  input: TweetInput
): Promise<AIResponse<M>> {
  const preparedInput = prepareInputText(input.text);
  const normalizedText = preparedInput.text;

  if (!normalizedText) {
    throw new UserVisibleError("还没有可分析的文本，请先选中一段内容。");
  }

  const allSettings = await getSettings();
  const settings = allSettings.quick;

  if (!settings.apiKey) {
    throw new UserVisibleError("需要先在设置中填写 API Key。");
  }

  const providerValidationError = validateProviderSettings(settings);
  if (providerValidationError) {
    throw new UserVisibleError(providerValidationError);
  }

  if (settings.provider === "openai-compatible" && !settings.baseUrl.trim()) {
    throw new UserVisibleError("需要先在设置中填写自定义 API 接口地址。");
  }

  try {
    await ensureApiPermission(settings);
  } catch (error) {
    throw new UserVisibleError(toUserMessage(error));
  }

  const providerProfile = detectProviderProfile(settings);
  const inputProfile = detectInputProfile(normalizedText);
  const normalizedResult = await runModelAttempt({
    mode,
    normalizedText,
    inputWasCompressed: preparedInput.wasCompressed,
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    providerProfile,
    inputProfile,
    attempt: 1
  });
  const enrichedResult = enrichAnalysisResult({
    mode,
    inputText: normalizedText,
    inputProfile,
    currentResult: normalizedResult
  });

  if (isResultTooThin(mode, enrichedResult)) {
    return {
      mode,
      result: buildFallbackResult({
        mode,
        inputText: normalizedText,
        inputProfile,
        currentResult: enrichedResult as AnalysisResultMap[M]
      })
    };
  }

  return {
    mode,
    result: enrichedResult
  };
}

export async function runLongformCheck(
  input: LongformCheckInput
): Promise<AIResponse<"longform">> {
  const article = prepareInputText(input.articleText, MAX_LONGFORM_INPUT_CHARS);
  const referenceNotes = normalizeInputText(input.referenceNotes).slice(0, MAX_REFERENCE_NOTES_CHARS);
  const referenceLinks = input.referenceLinks.map((item) => item.trim()).filter(Boolean);

  if (!article.text) {
    throw new UserVisibleError("先贴一段想拆解的长文内容，再开始核查。");
  }

  const allSettings = await getSettings();
  const settings = allSettings.longform;

  if (!settings.apiKey) {
    throw new UserVisibleError("需要先在设置中填写 API Key。");
  }

  const providerValidationError = validateProviderSettings(settings);
  if (providerValidationError) {
    throw new UserVisibleError(providerValidationError);
  }

  if (settings.provider === "openai-compatible" && !settings.baseUrl.trim()) {
    throw new UserVisibleError("需要先在设置中填写自定义 API 接口地址。");
  }

  try {
    await ensureApiPermission(settings);
  } catch (error) {
    throw new UserVisibleError(toUserMessage(error));
  }

  const providerProfile = detectProviderProfile(settings);
  if (providerProfile === "zhipu" && !referenceNotes) {
    try {
      await ensureZhipuWebSearchPermission();
    } catch (error) {
      throw new UserVisibleError(toUserMessage(error));
    }
  }
  const result = await runLongformAttempt({
    input: {
      articleText: article.text,
      referenceLinks,
      referenceNotes
    },
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    zhipuSearchEngine: normalizeZhipuSearchEngine(settings.zhipuSearchEngine),
    providerProfile,
    attempt: 1
  });

  if (isResultTooThin("longform", result)) {
    const fallbackResult = buildFallbackResult({
      mode: "longform",
      inputText: article.text,
      inputProfile: "generic",
      currentResult: result as AnalysisResultMap["longform"]
    });
    return {
      mode: "longform",
      result: fallbackResult
    };
  }

  return {
    mode: "longform",
    result
  };
}

export async function testModelConnection(
  mode: WorkspaceMode,
  settings: ModelRuntimeSettings
): Promise<ModelConnectionTestResult> {
  if (!settings.apiKey.trim()) {
    throw new UserVisibleError("需要先填写 API Key，才能测试连接。");
  }

  const providerValidationError = validateProviderSettings(settings);
  if (providerValidationError) {
    throw new UserVisibleError(providerValidationError);
  }

  if (settings.provider === "openai-compatible" && !settings.baseUrl.trim()) {
    throw new UserVisibleError("需要先填写自定义 API 接口地址。");
  }

  await ensureApiPermission(settings);

  const providerProfile = detectProviderProfile(settings);
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(buildChatCompletionsUrl(settings.provider, settings.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey.trim()}`
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: resolveTemperature(settings.provider, providerProfile),
        max_tokens: 64,
        messages: [
          {
            role: "user",
            content: "Reply with OK only."
          }
        ],
        ...(providerProfile === "kimi"
          ? {
              thinking: {
                type: "disabled"
              }
            }
          : {})
      }),
      signal: timeoutSignal(30000)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new UserVisibleError("连接测试超过 30 秒，接口可能较慢或暂时不可用。");
    }

    throw new UserVisibleError("无法连接到这个模型接口，请检查地址、网络和域名权限。");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new UserVisibleError(
      message || `连接测试失败（HTTP ${response.status}），请检查模型名和 API Key。`
    );
  }

  const payload = (await safeReadJson(response)) as
    | {
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      }
    | null;
  const content = normalizeModelContent(payload?.choices?.[0]?.message?.content);

  if (!content) {
    throw new UserVisibleError("接口已经响应，但没有返回可用内容，请检查模型名是否正确。");
  }

  const webSearch =
    providerProfile === "zhipu"
      ? await testZhipuWebSearch(settings)
      : undefined;

  return {
    mode,
    model: settings.model.trim(),
    providerProfile,
    latencyMs: Date.now() - startedAt,
    ...(webSearch ? { webSearch } : {})
  };
}

async function testZhipuWebSearch(
  settings: ModelRuntimeSettings
): Promise<NonNullable<ModelConnectionTestResult["webSearch"]>> {
  await ensureZhipuWebSearchPermission();
  const engine = normalizeZhipuSearchEngine(settings.zhipuSearchEngine);
  const results = await searchZhipuWeb({
    apiKey: settings.apiKey.trim(),
    query: "人工智能",
    searchEngine: engine
  });

  return {
    provider: "zhipu",
    engine,
    queryCount: 1,
    sourceCount: results.length
  };
}

async function runModelAttempt<M extends QuickAnalysisMode>(params: {
  mode: M;
  normalizedText: string;
  inputWasCompressed: boolean;
  provider: AIProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  providerProfile: ProviderProfile;
  inputProfile: "generic" | "market" | "rumor" | "wealth";
  attempt: 1 | 2;
  temperatureOverride?: number;
}): Promise<AnalysisResultMap[M]> {
  const prompt = buildPrompt(params.mode, params.normalizedText, {
    attempt: params.attempt,
    providerProfile: params.providerProfile,
    inputProfile: params.inputProfile,
    inputWasCompressed: params.inputWasCompressed
  });

  let response: Response;
  try {
    response = await fetch(buildChatCompletionsUrl(params.provider, params.baseUrl), {
      ...buildRequestInit(
        params.mode,
        prompt,
        params.provider,
        params.model,
        params.apiKey,
        params.providerProfile,
        {
          temperatureOverride: params.temperatureOverride
        }
      ),
      signal: timeoutSignal(resolveRequestTimeout("quick", params.providerProfile))
    });
  } catch (error) {
    if (params.attempt === 1) {
      return runModelAttempt({
        ...params,
        attempt: 2
      });
    }

    if (isTimeoutError(error)) {
      throw new UserVisibleError("这次分析超时了，可以稍后再试，或缩短文本。");
    }

    if (error instanceof TypeError) {
      throw new UserVisibleError("接口请求没有成功发出。请确认 Base URL、域名权限和 API 服务状态。");
    }

    throw new UserVisibleError("网络似乎不太稳定，这次分析失败了，可以稍后再试。");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    const requiredTemperature = parseRequiredTemperature(message);

    if (
      requiredTemperature !== null &&
      params.temperatureOverride !== requiredTemperature
    ) {
      return runModelAttempt({
        ...params,
        temperatureOverride: requiredTemperature,
        providerProfile: requiredTemperature === 0.6 ? "kimi" : params.providerProfile
      });
    }

    if (params.attempt === 1 && isRetryableStatus(response.status)) {
      return runModelAttempt({
        ...params,
        attempt: 2
      });
    }

    if (message?.toLowerCase().includes("api key")) {
      throw new UserVisibleError("API Key 看起来不可用，可以检查后再试。");
    }

    if (
      message?.toLowerCase().includes("response_format") ||
      message?.toLowerCase().includes("json_schema")
    ) {
      throw new UserVisibleError("当前接口不支持结构化输出格式，建议切换到 OpenAI-Compatible 并重试。");
    }

    throw new UserVisibleError(message || "这次分析失败了，可以稍后再试，或缩短文本。");
  }

  const payload = (await safeReadJson(response)) as
    | {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      }
    | null;

  if (!payload && params.attempt === 1) {
    return runModelAttempt({
      ...params,
      attempt: 2
    });
  }

  const rawContent = normalizeModelContent(payload?.choices?.[0]?.message?.content);

  if (!rawContent) {
    if (params.attempt === 1) {
      return runModelAttempt({
        ...params,
        attempt: 2
      });
    }

    throw new UserVisibleError("模型这次没有返回可用结果，可以稍后再试。");
  }

  const parsed = safeParseJson(rawContent) as AnalysisResultMap[M] | null;

  if (!parsed) {
    if (params.attempt === 1) {
      return runModelAttempt({
        ...params,
        attempt: 2
      });
    }

    throw new UserVisibleError("模型返回的内容不是可解析的 JSON，可以稍后再试。");
  }

  return normalizeAnalysisResult(params.mode, parsed);
}

function normalizeAnalysisResult<M extends AnalysisMode>(
  mode: M,
  result: AnalysisResultMap[M]
): AnalysisResultMap[M] {
  switch (mode) {
    case "split": {
      const splitResult = result as SplitAnalysisResult;
      return {
        attentionTriage: toAttentionTriage(splitResult?.attentionTriage),
        observableFacts: toStringArray(splitResult?.observableFacts),
        opinions: toStringArray(splitResult?.opinions),
        inferences: toStringArray(splitResult?.inferences),
        predictions: toStringArray(splitResult?.predictions),
        emotionalTriggers: toEmotionalTriggers(splitResult?.emotionalTriggers),
        propagationLabels: toPropagationLabels(splitResult?.propagationLabels),
        anxietyThemes: toStringArray(splitResult?.anxietyThemes),
        viralityHooks: toStringArray(splitResult?.viralityHooks),
        manipulationSignals: toStringArray(splitResult?.manipulationSignals),
        sourceReliabilityIssues: toStringArray(splitResult?.sourceReliabilityIssues),
        callsToAction: toStringArray(splitResult?.callsToAction),
        evidenceStrength: toEvidenceStrength(splitResult?.evidenceStrength),
        alternativeExplanations: toStringArray(splitResult?.alternativeExplanations),
        cognitiveRiskNote: toSafeString(splitResult?.cognitiveRiskNote),
        neutralRewrite: toSafeString(splitResult?.neutralRewrite),
        lowCostVerification: toStringArray(splitResult?.lowCostVerification)
      } as AnalysisResultMap[M];
    }
    case "deescalate": {
      const deescalateResult = result as DeescalateResult;
      return {
        neutralRewrite: toSafeString(deescalateResult?.neutralRewrite),
        removedStimulusPatterns: toStringArray(deescalateResult?.removedStimulusPatterns),
        uncertaintyNotes: toStringArray(deescalateResult?.uncertaintyNotes)
      } as AnalysisResultMap[M];
    }
    case "alternatives": {
      const alternativesResult = result as AlternativesResult;
      return {
        alternatives: Array.isArray(alternativesResult?.alternatives)
          ? alternativesResult.alternatives.map((item) => ({
              explanation: toSafeString(item?.explanation),
              whyPossible: toSafeString(item?.whyPossible)
            }))
          : []
      } as AnalysisResultMap[M];
    }
    case "experiment": {
      const experimentResult = result as ExperimentResult;
      return {
        suggestedExperiment: toSafeString(experimentResult?.suggestedExperiment),
        steps: toStringArray(experimentResult?.steps),
        timeLimit: toSafeString(experimentResult?.timeLimit),
        allInReplacement: toSafeString(experimentResult?.allInReplacement)
      } as AnalysisResultMap[M];
    }
    case "longform": {
      const longformResult = result as LongformCheckResult;
      return {
        facts: toLongformEvidenceItems(longformResult?.facts),
        opinions: toLongformEvidenceItems(longformResult?.opinions)
      } as AnalysisResultMap[M];
    }
    default:
      return result;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeHttpUrl(value: unknown): string {
  const rawUrl = toSafeString(value);
  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function toEvidenceStrength(value: unknown): "strong" | "medium" | "weak" | "unclear" {
  return value === "strong" || value === "medium" || value === "weak" ? value : "unclear";
}

function toAttentionTriage(value: unknown): AttentionTriage {
  const candidate = value as Partial<Record<keyof AttentionTriage, unknown>> | undefined;
  const recommendedAction =
    candidate?.recommendedAction === "skip" ||
    candidate?.recommendedAction === "skim" ||
    candidate?.recommendedAction === "verify" ||
    candidate?.recommendedAction === "save" ||
    candidate?.recommendedAction === "delay"
      ? candidate.recommendedAction
      : "skim";
  const attentionCost =
    candidate?.attentionCost === "medium" || candidate?.attentionCost === "high"
      ? candidate.attentionCost
      : "low";

  return {
    recommendedAction,
    attentionCost,
    reason: toSafeString(candidate?.reason),
    nextStep: toSafeString(candidate?.nextStep)
  };
}

function toEmotionalTriggers(
  value: unknown
): Array<{ type: string; text: string; intensity: "low" | "medium" | "high" }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const candidate = item as {
        type?: unknown;
        text?: unknown;
        intensity?: unknown;
      };

      const intensity: "low" | "medium" | "high" =
        candidate?.intensity === "medium" || candidate?.intensity === "high"
          ? candidate.intensity
          : "low";

      return {
        type: toSafeString(candidate?.type),
        text: toSafeString(candidate?.text),
        intensity
      };
    })
    .filter((item) => item.type || item.text);
}

function toLongformEvidenceItems(value: unknown): LongformCheckResult["facts"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): LongformCheckResult["facts"][number] => {
      const candidate = item as { claim?: unknown; verdict?: unknown };
      return {
        claim: toSafeString(candidate?.claim),
        verdict: candidate?.verdict === "supported" ? "supported" : "unsupported",
        evidenceNote: toSafeString((candidate as { evidenceNote?: unknown })?.evidenceNote),
        sourceHint: toSafeString((candidate as { sourceHint?: unknown })?.sourceHint),
        sourceUrl: toSafeHttpUrl((candidate as { sourceUrl?: unknown })?.sourceUrl)
      };
    })
    .filter((item) => Boolean(item.claim));
}

function toPropagationLabels(value: unknown): string[] {
  const allowed = new Set(["职业恐慌", "财富 FOMO", "身份攀比", "模糊权威", "精确数字诱导", "时间压迫"]);
  return toStringArray(value).filter((item) => allowed.has(item));
}

function isResultTooThin<M extends AnalysisMode>(mode: M, result: AnalysisResultMap[M]): boolean {
  switch (mode) {
    case "split": {
      const splitResult = result as SplitAnalysisResult;
      const filledSections = [
        splitResult.observableFacts.length > 0,
        splitResult.opinions.length > 0,
        splitResult.inferences.length > 0,
        splitResult.predictions.length > 0,
        splitResult.propagationLabels.length > 0,
        splitResult.anxietyThemes.length > 0,
        splitResult.viralityHooks.length > 0,
        splitResult.alternativeExplanations.length > 0,
        splitResult.lowCostVerification.length > 0,
        Boolean(splitResult.neutralRewrite),
        Boolean(splitResult.cognitiveRiskNote)
      ].filter(Boolean).length;

      return filledSections < 3;
    }
    case "deescalate": {
      const deescalateResult = result as DeescalateResult;
      return (
        !deescalateResult.neutralRewrite &&
        deescalateResult.removedStimulusPatterns.length === 0 &&
        deescalateResult.uncertaintyNotes.length === 0
      );
    }
    case "alternatives": {
      const alternativesResult = result as AlternativesResult;
      return alternativesResult.alternatives.length < 2;
    }
    case "experiment": {
      const experimentResult = result as ExperimentResult;
      const hasCoreContent =
        Boolean(experimentResult.suggestedExperiment) &&
        experimentResult.steps.length >= 2 &&
        Boolean(experimentResult.timeLimit);
      return !hasCoreContent;
    }
    case "longform": {
      const longformResult = result as LongformCheckResult;
      return longformResult.facts.length + longformResult.opinions.length < 2;
    }
    default:
      return false;
  }
}

async function runLongformAttempt(params: {
  input: LongformCheckInput;
  provider: AIProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  zhipuSearchEngine: ZhipuSearchEngine;
  providerProfile: ProviderProfile;
  attempt: 1 | 2;
  temperatureOverride?: number;
}): Promise<LongformCheckResult> {
  const prompt = buildLongformPrompt({
    articleText: params.input.articleText,
    referenceLinks: params.input.referenceLinks,
    referenceNotes: params.input.referenceNotes,
    webSearchContext: params.input.webSearchContext,
    providerProfile: params.providerProfile,
    attempt: params.attempt
  });

  const shouldUseKimiWebSearch =
    params.providerProfile === "kimi" &&
    !params.input.referenceNotes.trim();
  const shouldUseZhipuWebSearch =
    params.providerProfile === "zhipu" &&
    !params.input.referenceNotes.trim() &&
    !params.input.webSearchContext?.trim();

  if (shouldUseKimiWebSearch) {
    return runKimiLongformAttemptWithWebSearch(params, prompt);
  }

  if (shouldUseZhipuWebSearch) {
    let webSearchEvidence;
    try {
      webSearchEvidence = await fetchZhipuLongformEvidence(
        params.input.articleText,
        params.apiKey,
        params.zhipuSearchEngine
      );
    } catch (error) {
      if (params.attempt === 1) {
        return runLongformAttempt({ ...params, attempt: 2 });
      }
      throw error;
    }

    const result = await runLongformAttempt({
      ...params,
      input: { ...params.input, webSearchContext: webSearchEvidence.context }
    });
    return {
      ...result,
      webSearch: webSearchEvidence.execution
    };
  }

  let response: Response;
  try {
    response = await fetch(buildChatCompletionsUrl(params.provider, params.baseUrl), {
      ...buildRequestInit(
        "longform",
        prompt,
        params.provider,
        params.model,
        params.apiKey,
        params.providerProfile,
        {
          temperatureOverride: params.temperatureOverride
        }
      ),
      signal: timeoutSignal(resolveRequestTimeout("longform", params.providerProfile))
    });
  } catch (error) {
    if (params.attempt === 1) {
      return runLongformAttempt({
        ...params,
        attempt: 2
      });
    }

    if (isTimeoutError(error)) {
      throw new UserVisibleError("长文核查等待太久了。若使用联网模型，可以稍后再试；也可以先补参考摘录提高稳定性。");
    }

    if (error instanceof TypeError) {
      throw new UserVisibleError("接口请求没有成功发出。请确认 Base URL、域名权限和 API 服务状态。");
    }

    throw new UserVisibleError("长文核查这次没有成功，可以稍后再试。");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    const requiredTemperature = parseRequiredTemperature(message);

    if (
      requiredTemperature !== null &&
      params.temperatureOverride !== requiredTemperature
    ) {
      return runLongformAttempt({
        ...params,
        temperatureOverride: requiredTemperature,
        providerProfile: requiredTemperature === 0.6 ? "kimi" : params.providerProfile
      });
    }

    if (params.attempt === 1 && isRetryableStatus(response.status)) {
      return runLongformAttempt({
        ...params,
        attempt: 2
      });
    }

    throw new UserVisibleError(message || "长文核查这次失败了，可以稍后再试。");
  }

  const payload = (await safeReadJson(response)) as
    | {
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      }
    | null;

  if (!payload && params.attempt === 1) {
    return runLongformAttempt({
      ...params,
      attempt: 2
    });
  }

  const rawContent = normalizeModelContent(payload?.choices?.[0]?.message?.content);
  if (!rawContent) {
    if (params.attempt === 1) {
      return runLongformAttempt({
        ...params,
        attempt: 2
      });
    }

    throw new UserVisibleError("模型这次没有返回可用的长文核查结果。");
  }

  const parsed = safeParseJson(rawContent) as LongformCheckResult | null;
  if (!parsed) {
    if (params.attempt === 1) {
      return runLongformAttempt({
        ...params,
        attempt: 2
      });
    }

    throw new UserVisibleError("模型返回的长文核查内容不是可解析的 JSON。");
  }

  const normalizedResult = normalizeAnalysisResult("longform", parsed);
  return params.input.webSearchContext
    ? restrictZhipuSourceUrls(normalizedResult, params.input.webSearchContext)
    : normalizedResult;
}

async function runKimiLongformAttemptWithWebSearch(
  params: {
    input: LongformCheckInput;
    provider: AIProvider;
    model: string;
    baseUrl: string;
    apiKey: string;
    zhipuSearchEngine: ZhipuSearchEngine;
    providerProfile: ProviderProfile;
    attempt: 1 | 2;
    temperatureOverride?: number;
  },
  prompt: ReturnType<typeof buildPrompt>
): Promise<LongformCheckResult> {
  let kimiTools: Array<Record<string, unknown>>;
  try {
    kimiTools = await fetchKimiWebSearchTools(params.provider, params.baseUrl, params.apiKey);
  } catch (error) {
    if (params.attempt === 1) {
      return runLongformAttempt({
        ...params,
        attempt: 2
      });
    }

    throw error;
  }
  const messages: ChatRequestMessage[] = [
    {
      role: "system",
      content: prompt.system
    },
    {
      role: "user",
      content: prompt.user
    }
  ];

  for (let round = 0; round < MAX_KIMI_TOOL_ROUNDS; round += 1) {
    let response: Response;
    try {
      response = await fetch(buildChatCompletionsUrl(params.provider, params.baseUrl), {
        ...buildRequestInit(
          "longform",
          prompt,
          params.provider,
          params.model,
          params.apiKey,
          params.providerProfile,
          {
            messages,
            kimiTools,
            disableKimiThinking: true,
            temperatureOverride: params.temperatureOverride
          }
        ),
        signal: timeoutSignal(resolveRequestTimeout("longform", params.providerProfile))
      });
    } catch (error) {
      if (params.attempt === 1) {
        return runLongformAttempt({
          ...params,
          attempt: 2
        });
      }

      if (isTimeoutError(error)) {
        throw new UserVisibleError("长文核查等待太久了。Kimi 联网搜索通常更慢，可以稍后再试；也可以先补参考摘录提高稳定性。");
      }

      if (error instanceof TypeError) {
        throw new UserVisibleError("Kimi 联网请求没有成功发出。请确认 Base URL、域名权限和 API 服务状态。");
      }

      throw new UserVisibleError("Kimi 联网长文核查这次没有成功，可以稍后再试。");
    }

    if (!response.ok) {
      const message = await readErrorMessage(response);
      const requiredTemperature = parseRequiredTemperature(message);

      if (
        requiredTemperature !== null &&
        params.temperatureOverride !== requiredTemperature
      ) {
        return runKimiLongformAttemptWithWebSearch(
          {
            ...params,
            temperatureOverride: requiredTemperature,
            providerProfile: "kimi"
          },
          prompt
        );
      }

      if (params.attempt === 1 && isRetryableStatus(response.status)) {
        return runLongformAttempt({
          ...params,
          attempt: 2
        });
      }

      throw new UserVisibleError(message || "Kimi 联网长文核查这次失败了，可以稍后再试。");
    }

    const payload = (await safeReadJson(response)) as
      | {
          choices?: Array<{
            finish_reason?: string;
            message?: {
              content?: string | Array<{ type?: string; text?: string }>;
              tool_calls?: ToolCall[];
              reasoning_content?: string;
            };
          }>;
        }
      | null;

    if (!payload && params.attempt === 1) {
      return runLongformAttempt({
        ...params,
        attempt: 2
      });
    }

    const choice = payload?.choices?.[0];
    const toolCalls = Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : [];

    if (choice?.finish_reason === "tool_calls" && toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: normalizeModelContent(choice.message?.content) || "",
        tool_calls: toolCalls,
        reasoning_content:
          typeof choice.message?.reasoning_content === "string"
            ? choice.message.reasoning_content
            : undefined
      });

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name;
        const toolCallId = toolCall.id;
        const toolArguments = toolCall.function?.arguments;

        if (!toolName || !toolCallId || !toolArguments) {
          continue;
        }

        let toolOutput: string;
        try {
          toolOutput = await callKimiFormulaTool({
            provider: params.provider,
            baseUrl: params.baseUrl,
            apiKey: params.apiKey,
            name: toolName,
            argumentsJson: toolArguments
          });
        } catch (error) {
          if (params.attempt === 1) {
            return runLongformAttempt({
              ...params,
              attempt: 2
            });
          }

          throw error;
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCallId,
          name: toolName,
          content: toolOutput
        });
      }

      continue;
    }

    const rawContent = normalizeModelContent(choice?.message?.content);

    if (!rawContent) {
      if (params.attempt === 1) {
        return runLongformAttempt({
          ...params,
          attempt: 2
        });
      }

      throw new UserVisibleError("Kimi 联网后没有返回可用的长文核查结果。");
    }

    const parsed = safeParseJson(rawContent) as LongformCheckResult | null;
    if (!parsed) {
      if (params.attempt === 1) {
        return runLongformAttempt({
          ...params,
          attempt: 2
        });
      }

      throw new UserVisibleError("Kimi 返回的长文核查内容不是可解析的 JSON。");
    }

    return normalizeAnalysisResult("longform", parsed);
  }

  if (params.attempt === 1) {
    return runLongformAttempt({
      ...params,
      attempt: 2
    });
  }

  throw new UserVisibleError("Kimi 联网搜索轮次超出了预期。建议先补参考摘录，或稍后再试。");
}
