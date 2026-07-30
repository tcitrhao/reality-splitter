import type { QuickAnalysisMode } from "../../shared/types";

export const QUICK_ANALYSIS_SKILL = {
  id: "quick-analysis",
  version: 1,
  objective: "帮助用户识别文本中的主张、推断、刺激机制、不确定性和低成本下一步。",
  modes: ["split", "deescalate", "alternatives", "experiment"] as const satisfies readonly QuickAnalysisMode[],
  boundaries: [
    "只分析用户提供的文本",
    "不判断作者人格或用户心理状态",
    "不在没有外部证据时宣称事实核查",
    "不替用户做医疗、法律、投资或政治决定"
  ],
  successCriteria: [
    "忠于原文",
    "区分事实与推断",
    "明确证据限制",
    "语言克制",
    "给出低成本下一步"
  ]
} as const;
