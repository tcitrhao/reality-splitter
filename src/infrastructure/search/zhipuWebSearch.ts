import { UserVisibleError } from "../../application/errors/userVisibleError";
import type {
  WebSearchExecution,
  ZhipuSearchEngine
} from "../../shared/types";
import { isTimeoutError, timeoutSignal } from "../models/openAICompatible";
import { readErrorMessage, safeReadJson } from "../models/responseParsing";
import {
  ZHIPU_WEB_SEARCH_ENDPOINT,
  buildZhipuSearchRequest,
  deriveZhipuSearchQueries,
  formatZhipuSearchEvidence,
  normalizeZhipuSearchResults,
  type ZhipuSearchEvidence,
  type ZhipuSearchResult
} from "./zhipuSearchProtocol";

const MAX_SEARCH_CONTEXT_CHARS = 9000;

export interface ZhipuLongformEvidence {
  context: string;
  execution: WebSearchExecution;
}

export async function searchZhipuWeb(params: {
  apiKey: string;
  query: string;
  searchEngine: ZhipuSearchEngine;
}): Promise<ZhipuSearchResult[]> {
  const requestBody = buildZhipuSearchRequest(params.query, params.searchEngine);
  if (!requestBody.search_query) {
    return [];
  }

  const response = await fetch(ZHIPU_WEB_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: timeoutSignal(30000)
  }).catch((error: unknown) => {
    if (isTimeoutError(error)) {
      throw new UserVisibleError("智谱网页搜索等待太久了，可以稍后再试。");
    }

    if (error instanceof TypeError) {
      throw new UserVisibleError(
        "智谱网页搜索请求没有成功发出。请检查 API 域名权限和网络状态。"
      );
    }

    throw error;
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new UserVisibleError(message || "智谱网页搜索这次失败了，可以稍后再试。");
  }

  return normalizeZhipuSearchResults(await safeReadJson(response));
}

export async function fetchZhipuLongformEvidence(
  articleText: string,
  apiKey: string,
  searchEngine: ZhipuSearchEngine
): Promise<ZhipuLongformEvidence> {
  const queries = deriveZhipuSearchQueries(articleText);
  const evidence: ZhipuSearchEvidence[] = [];
  const seenLinks = new Set<string>();

  for (const query of queries) {
    const results = (
      await searchZhipuWeb({ apiKey, query, searchEngine })
    ).filter((result) => {
      if (!result.link || seenLinks.has(result.link)) {
        return false;
      }
      seenLinks.add(result.link);
      return true;
    });

    if (results.length > 0) {
      evidence.push({ query, results });
    }
  }

  if (evidence.length === 0) {
    throw new UserVisibleError(
      "智谱网页搜索没有返回可用来源。可以稍后再试，或手动补充参考摘录。"
    );
  }

  const context = formatZhipuSearchEvidence(evidence).slice(
    0,
    MAX_SEARCH_CONTEXT_CHARS
  );

  return {
    context,
    execution: {
      provider: "zhipu",
      engine: searchEngine,
      queryCount: queries.length,
      sourceCount: Array.from(context.matchAll(/^链接：https?:\/\/\S+$/gm)).length
    }
  };
}
