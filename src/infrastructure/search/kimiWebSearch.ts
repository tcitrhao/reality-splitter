import { UserVisibleError } from "../../application/errors/userVisibleError";
import type { AIProvider } from "../../shared/types";
import {
  buildApiBaseUrl,
  isTimeoutError,
  timeoutSignal
} from "../models/openAICompatible";
import { readErrorMessage } from "../models/responseParsing";

export async function fetchKimiWebSearchTools(
  provider: AIProvider,
  baseUrl: string,
  apiKey: string
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(
    `${buildApiBaseUrl(provider, baseUrl)}/formulas/moonshot/web-search:latest/tools`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: timeoutSignal(30000)
    }
  ).catch((error: unknown) => {
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

export async function callKimiFormulaTool(params: {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  name: string;
  argumentsJson: string;
}): Promise<string> {
  const response = await fetch(
    `${buildApiBaseUrl(params.provider, params.baseUrl)}/formulas/moonshot/web-search:latest/fibers`,
    {
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
    }
  ).catch((error: unknown) => {
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
