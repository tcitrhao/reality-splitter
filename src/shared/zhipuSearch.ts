import type { ZhipuSearchEngine } from "./types";

export const DEFAULT_ZHIPU_SEARCH_ENGINE: ZhipuSearchEngine = "search_pro";

export const ZHIPU_SEARCH_ENGINE_OPTIONS: Array<{
  value: ZhipuSearchEngine;
  label: string;
  description: string;
}> = [
  {
    value: "search_std",
    label: "基础版",
    description: "日常查询，参考 0.01 元/次"
  },
  {
    value: "search_pro",
    label: "高级版",
    description: "多引擎协作，参考 0.03 元/次"
  },
  {
    value: "search_pro_sogou",
    label: "搜狗增强版",
    description: "腾讯生态、知乎等，参考 0.05 元/次"
  },
  {
    value: "search_pro_quark",
    label: "夸克增强版",
    description: "侧重垂直内容，参考 0.05 元/次"
  }
];

export function normalizeZhipuSearchEngine(
  value: unknown
): ZhipuSearchEngine {
  return ZHIPU_SEARCH_ENGINE_OPTIONS.some((option) => option.value === value)
    ? (value as ZhipuSearchEngine)
    : DEFAULT_ZHIPU_SEARCH_ENGINE;
}

export function getZhipuSearchEngineLabel(
  value: unknown
): string {
  const normalized = normalizeZhipuSearchEngine(value);
  return (
    ZHIPU_SEARCH_ENGINE_OPTIONS.find((option) => option.value === normalized)
      ?.label ?? "高级版"
  );
}
