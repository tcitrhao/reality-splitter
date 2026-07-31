import { DEFAULT_BASE_URL } from "./storage";
import type { ModelRuntimeSettings } from "./types";

const ZHIPU_WEB_SEARCH_ORIGIN_PATTERN = "https://open.bigmodel.cn/*";

export async function requestApiPermission(settings: ModelRuntimeSettings): Promise<void> {
  const originPattern = getApiOriginPattern(settings);
  const alreadyGranted = await chrome.permissions.contains({
    origins: [originPattern]
  });

  if (alreadyGranted) {
    return;
  }

  const granted = await chrome.permissions.request({
    origins: [originPattern]
  });

  if (!granted) {
    throw new Error("需要先允许访问这个 API 域名，插件才能发起分析请求。");
  }
}

export async function ensureApiPermission(settings: ModelRuntimeSettings): Promise<void> {
  const originPattern = getApiOriginPattern(settings);
  const granted = await chrome.permissions.contains({
    origins: [originPattern]
  });

  if (!granted) {
    throw new Error(`还没有获得 ${originPattern} 的访问权限。请回到设置里重新保存一次。`);
  }
}

export async function requestZhipuWebSearchPermission(): Promise<void> {
  const alreadyGranted = await chrome.permissions.contains({
    origins: [ZHIPU_WEB_SEARCH_ORIGIN_PATTERN]
  });
  if (alreadyGranted) {
    return;
  }

  const granted = await chrome.permissions.request({
    origins: [ZHIPU_WEB_SEARCH_ORIGIN_PATTERN]
  });
  if (!granted) {
    throw new Error("需要允许访问智谱搜索域名，长文模式才能使用网页搜索。");
  }
}

export async function ensureZhipuWebSearchPermission(): Promise<void> {
  const granted = await chrome.permissions.contains({
    origins: [ZHIPU_WEB_SEARCH_ORIGIN_PATTERN]
  });
  if (!granted) {
    throw new Error("还没有获得智谱网页搜索权限。请回到模型后台重新保存长文默认模型。");
  }
}

function getApiOriginPattern(settings: ModelRuntimeSettings): string {
  const rawUrl = settings.provider === "openai" ? DEFAULT_BASE_URL : settings.baseUrl || DEFAULT_BASE_URL;

  try {
    const url = new URL(rawUrl);
    return `${url.origin}/*`;
  } catch {
    throw new Error("API 接口地址格式不对，请检查 Base URL。");
  }
}
