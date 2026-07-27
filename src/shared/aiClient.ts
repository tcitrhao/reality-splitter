import { buildFallbackResult, detectInputProfile, enrichAnalysisResult } from "./analysisHeuristics";
import { ensureApiPermission } from "./apiPermissions";
import { buildLongformPrompt, buildPrompt } from "./prompts";
import { detectProviderProfile, validateProviderSettings, type ProviderProfile } from "./providerProfiles";
import { DEFAULT_BASE_URL, getSettings } from "./storage";
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
  ModelRuntimeSettings,
  QuickAnalysisMode,
  SplitAnalysisResult,
  TweetInput
} from "./types";

const MAX_INPUT_CHARS = 6000;
const MAX_LONGFORM_INPUT_CHARS = 12000;
const MAX_LINE_COUNT = 80;
const MAX_REFERENCE_NOTES_CHARS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;
const LONGFORM_REQUEST_TIMEOUT_MS = 90000;
const KIMI_LONGFORM_REQUEST_TIMEOUT_MS = 180000;
const MAX_KIMI_TOOL_ROUNDS = 4;
const QUICK_MAX_OUTPUT_TOKENS = 2048;
const DEEPSEEK_QUICK_MAX_OUTPUT_TOKENS = 4096;
const LONGFORM_MAX_OUTPUT_TOKENS = 4096;

type ToolCall = {
  id: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type ChatRequestMessage =
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

type BuildRequestOptions = {
  messages?: ChatRequestMessage[];
  enableKimiWebSearch?: boolean;
  kimiTools?: Array<Record<string, unknown>>;
  disableKimiThinking?: boolean;
  temperatureOverride?: number;
};

class UserVisibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserVisibleError";
  }
}

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
    providerProfile,
    attempt: 1
  });

  if (isResultTooThin("longform", result)) {
    return {
      mode: "longform",
      result: buildFallbackResult({
        mode: "longform",
        inputText: article.text,
        inputProfile: "generic",
        currentResult: result as AnalysisResultMap["longform"]
      })
    };
  }

  return {
    mode: "longform",
    result
  };
}

export function toUserMessage(error: unknown): string {
  if (error instanceof UserVisibleError) {
    return error.message;
  }

  if (isTimeoutError(error)) {
    return "这次请求被中断了。可能是网络超时、页面刷新或模型服务响应太慢，可以再试一次。";
  }

  if (error instanceof Error && error.message) {
    if (/aborted|abort/i.test(error.message)) {
      return "这次请求被中断了。可能是网络超时、页面刷新或模型服务响应太慢，可以再试一次。";
    }

    return error.message;
  }

  return "这次分析失败了，可以稍后再试。";
}

function buildChatCompletionsUrl(provider: AIProvider, configuredBaseUrl: string): string {
  const baseUrl = buildApiBaseUrl(provider, configuredBaseUrl);
  return `${baseUrl}/chat/completions`;
}

function buildRequestBody(
  mode: AnalysisMode,
  prompt: ReturnType<typeof buildPrompt>,
  provider: AIProvider,
  model: string,
  providerProfile: ProviderProfile,
  options: BuildRequestOptions = {}
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

function normalizeModelContent(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (item.type === "text" || !item.type ? item.text || "" : ""))
      .join("")
      .trim();
  }

  return "";
}

function normalizeInputText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function safeParseJson(rawContent: string): unknown | null {
  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractJsonObjectString(cleaned);
    if (!extracted) {
      return null;
    }

    try {
      return JSON.parse(extracted);
    } catch {
      const repaired = repairLooseJson(extracted);
      if (!repaired) {
        return null;
      }

      try {
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }
}

function extractJsonObjectString(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return input.slice(start, end + 1).trim();
}

function repairLooseJson(input: string): string | null {
  const normalizedQuotes = input
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");

  const withoutTrailingCommas = normalizedQuotes.replace(/,\s*([}\]])/g, "$1");
  return withoutTrailingCommas.trim() || null;
}

async function safeReadJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildApiBaseUrl(provider: AIProvider, configuredBaseUrl: string): string {
  const baseUrl = normalizeBaseUrl(
    provider === "openai" ? DEFAULT_BASE_URL : configuredBaseUrl || DEFAULT_BASE_URL
  );

  return baseUrl.endsWith("/chat/completions")
    ? baseUrl.replace(/\/chat\/completions$/, "")
    : baseUrl;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
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
        sourceHint: toSafeString((candidate as { sourceHint?: unknown })?.sourceHint)
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

function prepareInputText(
  rawText: string,
  maxChars: number = MAX_INPUT_CHARS
): { text: string; wasCompressed: boolean } {
  const normalized = normalizeInputText(rawText);

  if (!normalized) {
    return {
      text: "",
      wasCompressed: false
    };
  }

  if (normalized.length <= maxChars) {
    return {
      text: normalized,
      wasCompressed: false
    };
  }

  const compressed = compressLongText(normalized, maxChars);
  return {
    text: compressed || normalized.slice(0, maxChars),
    wasCompressed: true
  };
}

function compressLongText(text: string, charLimit: number): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return text.slice(0, charLimit);
  }

  const scoredLines = lines.map((line, index) => ({
    line,
    index,
    score: scoreLine(line, index, lines.length)
  }));

  const selectedIndexes = new Set<number>();
  const candidateIndexes = scoredLines
    .slice()
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(MAX_LINE_COUNT, scoredLines.length))
    .map((item) => item.index);

  for (const index of candidateIndexes) {
    selectedIndexes.add(index);
  }

  for (let index = 0; index < Math.min(4, lines.length); index += 1) {
    selectedIndexes.add(index);
  }

  for (let index = Math.max(0, lines.length - 4); index < lines.length; index += 1) {
    selectedIndexes.add(index);
  }

  const selectedLines = Array.from(selectedIndexes)
    .sort((a, b) => a - b)
    .map((index) => lines[index]);

  const prefix = "以下内容较长，已保守截取标题、关键段落、数字和结论线索：";
  const assembled = [prefix, ...selectedLines]
    .join("\n")
    .trim();

  if (assembled.length <= charLimit) {
    return assembled;
  }

  return trimToCharLimit([prefix, ...selectedLines], charLimit);
}

function scoreLine(line: string, index: number, totalLines: number): number {
  let score = 0;
  const normalized = line.toLowerCase();

  if (index < 3) {
    score += 4;
  }

  if (index >= totalLines - 3) {
    score += 3;
  }

  if (/\d/.test(line)) {
    score += 3;
  }

  if (/[：:]/.test(line)) {
    score += 2;
  }

  if (line.length >= 18 && line.length <= 120) {
    score += 2;
  }

  if (/^(总结|结论|核心|重点|观点|风险|建议|数据|拆解|全文|摘要)/.test(line)) {
    score += 4;
  }

  if (/(因此|所以|意味着|说明|建议|可能|风险|结论|判断|验证)/.test(line)) {
    score += 3;
  }

  if (/(a股|美股|港股|指数|收盘|跌幅|涨幅|财报|估值|模型|产品|用户|收入)/.test(normalized)) {
    score += 2;
  }

  return score;
}

function trimToCharLimit(lines: string[], charLimit: number): string {
  const output: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    const nextLength = currentLength === 0 ? line.length : currentLength + 1 + line.length;

    if (nextLength <= charLimit) {
      output.push(line);
      currentLength = nextLength;
      continue;
    }

    const remaining = charLimit - currentLength - (currentLength === 0 ? 0 : 1);
    if (remaining > 24) {
      output.push(`${line.slice(0, remaining - 1)}…`);
    }
    break;
  }

  return output.join("\n").trim();
}

async function runLongformAttempt(params: {
  input: LongformCheckInput;
  provider: AIProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  providerProfile: ProviderProfile;
  attempt: 1 | 2;
  temperatureOverride?: number;
}): Promise<LongformCheckResult> {
  const prompt = buildLongformPrompt({
    articleText: params.input.articleText,
    referenceLinks: params.input.referenceLinks,
    referenceNotes: params.input.referenceNotes,
    providerProfile: params.providerProfile,
    attempt: params.attempt
  });

  const shouldUseKimiWebSearch =
    params.providerProfile === "kimi" &&
    !params.input.referenceNotes.trim();

  if (shouldUseKimiWebSearch) {
    return runKimiLongformAttemptWithWebSearch(params, prompt);
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
          enableKimiWebSearch: false,
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

  return normalizeAnalysisResult("longform", parsed);
}

async function runKimiLongformAttemptWithWebSearch(
  params: {
    input: LongformCheckInput;
    provider: AIProvider;
    model: string;
    baseUrl: string;
    apiKey: string;
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

async function fetchKimiWebSearchTools(
  provider: AIProvider,
  baseUrl: string,
  apiKey: string
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${buildApiBaseUrl(provider, baseUrl)}/formulas/moonshot/web-search:latest/tools`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal: timeoutSignal(30000)
  }).catch((error: unknown) => {
    if (isTimeoutError(error)) {
      throw new UserVisibleError("获取 Kimi 联网工具定义超时了，可以稍后再试。");
    }

    if (error instanceof TypeError) {
      throw new UserVisibleError("还没有成功连上 Kimi 的工具服务。请检查 Base URL、域名权限和 API 服务状态。");
    }

    throw error;
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new UserVisibleError(message || "获取 Kimi 联网工具定义失败了。");
  }

  const payload = (await response.json()) as {
    tools?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(payload.tools) || payload.tools.length === 0) {
    throw new UserVisibleError("Kimi 没有返回可用的联网工具定义。");
  }

  return payload.tools;
}

async function callKimiFormulaTool(params: {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  name: string;
  argumentsJson: string;
}): Promise<string> {
  const response = await fetch(`${buildApiBaseUrl(params.provider, params.baseUrl)}/formulas/moonshot/web-search:latest/fibers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      name: params.name,
      arguments: params.argumentsJson
    }),
    signal: timeoutSignal(60000)
  }).catch((error: unknown) => {
    if (isTimeoutError(error)) {
      throw new UserVisibleError("Kimi 联网搜索执行超时了，可以稍后再试。");
    }

    if (error instanceof TypeError) {
      throw new UserVisibleError("Kimi 联网搜索请求没有成功发出。请检查 Base URL、域名权限和 API 服务状态。");
    }

    throw error;
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new UserVisibleError(message || "Kimi 联网搜索执行失败了。");
  }

  const payload = (await response.json()) as {
    status?: string;
    error?: string;
    context?: {
      output?: string;
      encrypted_output?: string;
      error?: string;
    };
  };

  if (payload.status !== "succeeded") {
    throw new UserVisibleError(
      payload.context?.error || payload.error || "Kimi 联网搜索没有成功完成。"
    );
  }

  const output = payload.context?.encrypted_output || payload.context?.output;

  if (!output) {
    throw new UserVisibleError("Kimi 联网搜索没有返回可用内容。");
  }

  return output;
}

function buildRequestInit(
  mode: AnalysisMode,
  prompt: ReturnType<typeof buildPrompt>,
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
    body: JSON.stringify(buildRequestBody(mode, prompt, provider, model, providerProfile, options))
  };
}

function resolveTemperature(provider: AIProvider, providerProfile: ProviderProfile): number {
  if (providerProfile === "kimi") {
    return 0.6;
  }

  if (provider === "openai-compatible") {
    return 0.1;
  }

  return 0.2;
}

function parseRequiredTemperature(message: string | null): number | null {
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

function resolveRequestTimeout(
  mode: "quick" | "longform",
  providerProfile: ProviderProfile
): number {
  if (mode === "longform" && providerProfile === "kimi") {
    return KIMI_LONGFORM_REQUEST_TIMEOUT_MS;
  }

  return mode === "longform" ? LONGFORM_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
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

function isRetryableStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function readErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await safeReadJson(response)) as
      | { error?: { message?: string } | string; message?: string }
      | null;

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }

    if (typeof payload?.error === "object" && typeof payload.error?.message === "string") {
      return payload.error.message.trim();
    }

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  }

  const rawText = await response.text().catch(() => "");
  const normalizedText = rawText.replace(/\s+/g, " ").trim();

  if (normalizedText) {
    return `${response.status} ${response.statusText}`.trim()
      ? `${response.status} ${response.statusText}：${normalizedText.slice(0, 280)}`
      : normalizedText.slice(0, 280);
  }

  return response.status ? `${response.status} ${response.statusText}`.trim() : null;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
