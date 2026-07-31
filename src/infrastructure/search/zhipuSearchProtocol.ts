import type {
  LongformCheckResult,
  ZhipuSearchEngine
} from "../../shared/types";
import { DEFAULT_ZHIPU_SEARCH_ENGINE } from "../../shared/zhipuSearch.ts";

export const ZHIPU_WEB_SEARCH_ENDPOINT =
  "https://open.bigmodel.cn/api/paas/v4/web_search";

const MAX_SEARCH_QUERY_CHARS = 70;
const MAX_SEARCH_QUERIES = 3;
const MAX_RESULTS_PER_QUERY = 5;
const MAX_RESULT_CONTENT_CHARS = 700;

export interface ZhipuSearchResult {
  title: string;
  content: string;
  link: string;
  media: string;
  publishDate: string;
}

export interface ZhipuSearchEvidence {
  query: string;
  results: ZhipuSearchResult[];
}

export function deriveZhipuSearchQueries(articleText: string): string[] {
  const normalized = articleText
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }

  const candidates = normalized
    .split(/(?<=[。！？!?；;])/)
    .map(normalizeSearchQuery)
    .filter((query) => query.length >= 8)
    .map((query, index) => ({ query, index, score: scoreSearchQuery(query) }))
    .sort((first, second) => second.score - first.score || first.index - second.index);
  const uniqueQueries: string[] = [];

  for (const candidate of candidates) {
    if (uniqueQueries.some((query) => isNearDuplicate(query, candidate.query))) {
      continue;
    }
    uniqueQueries.push(candidate.query);
    if (uniqueQueries.length >= MAX_SEARCH_QUERIES) {
      break;
    }
  }

  return uniqueQueries.length > 0
    ? uniqueQueries
    : [normalizeSearchQuery(normalized)];
}

export function buildZhipuSearchRequest(
  query: string,
  searchEngine: ZhipuSearchEngine = DEFAULT_ZHIPU_SEARCH_ENGINE
): Record<string, unknown> {
  return {
    search_query: normalizeSearchQuery(query),
    search_engine: searchEngine,
    search_intent: false,
    count: MAX_RESULTS_PER_QUERY,
    content_size: "medium"
  };
}

export function normalizeZhipuSearchResults(payload: unknown): ZhipuSearchResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const searchResults = (payload as { search_result?: unknown }).search_result;
  if (!Array.isArray(searchResults)) {
    return [];
  }

  return searchResults
    .map(normalizeSearchResult)
    .filter((result): result is ZhipuSearchResult => result !== null);
}

export function formatZhipuSearchEvidence(
  evidence: ZhipuSearchEvidence[]
): string {
  return evidence
    .flatMap((entry, queryIndex) => [
      `【检索 ${queryIndex + 1}】${entry.query}`,
      ...entry.results.flatMap((result, resultIndex) => [
        `来源 ${queryIndex + 1}.${resultIndex + 1}：${result.title || "未命名网页"}`,
        `链接：${result.link}`,
        result.media ? `媒体：${result.media}` : "",
        result.publishDate ? `发布时间：${result.publishDate}` : "",
        result.content ? `搜索摘要：${result.content}` : ""
      ])
    ])
    .filter(Boolean)
    .join("\n");
}

export function restrictZhipuSourceUrls(
  result: LongformCheckResult,
  webSearchContext: string
): LongformCheckResult {
  const allowedUrls = new Set(
    Array.from(webSearchContext.matchAll(/^链接：(https?:\/\/\S+)$/gm)).map(
      (match) => normalizeComparableUrl(match[1])
    )
  );
  const restrictItems = (items: LongformCheckResult["facts"]) =>
    items.map((item) => ({
      ...item,
      sourceUrl: allowedUrls.has(normalizeComparableUrl(item.sourceUrl))
        ? item.sourceUrl
        : ""
    }));

  return {
    facts: restrictItems(result.facts),
    opinions: restrictItems(result.opinions)
  };
}

function normalizeSearchQuery(value: string): string {
  return value
    .replace(/^[\s\-—–•·]+|[\s。！？!?；;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_QUERY_CHARS);
}

function scoreSearchQuery(query: string): number {
  let score = Math.min(query.length, 60) / 20;
  if (/\d|年|月|日|%|％/.test(query)) score += 3;
  if (/宣布|发布|表示|报道|数据显示|增长|下降|达到|超过|发生|确认|推出|完成|获得/.test(query)) {
    score += 3;
  }
  if (/认为|觉得|应该|可能|也许|或许|建议/.test(query)) score -= 1;
  return score;
}

function isNearDuplicate(first: string, second: string): boolean {
  const shorterLength = Math.min(first.length, second.length);
  if (shorterLength === 0) {
    return false;
  }
  const firstMismatch = Array.from({ length: shorterLength }).findIndex(
    (_, index) => first[index] !== second[index]
  );
  const matchingLength = firstMismatch === -1 ? shorterLength : firstMismatch;
  return matchingLength / shorterLength >= 0.7;
}

function normalizeSearchResult(value: unknown): ZhipuSearchResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = value as Record<string, unknown>;
  const link = readString(result.link);
  if (!link) {
    return null;
  }

  return {
    title: readString(result.title),
    content: readString(result.content).slice(0, MAX_RESULT_CONTENT_CHARS),
    link,
    media: readString(result.media),
    publishDate: readString(result.publish_date)
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
