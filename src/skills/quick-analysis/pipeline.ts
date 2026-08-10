import type { AIResponse, QuickAnalysisMode } from "../../shared/types";

export const COMPREHENSIVE_ANALYSIS_STEPS = [
  "split",
  "alternatives",
  "deescalate",
  "experiment"
] as const satisfies readonly QuickAnalysisMode[];

export type ComprehensiveAnalysisResponses = Partial<
  Record<QuickAnalysisMode, AIResponse>
>;

interface PipelineCallbacks {
  execute: (
    mode: QuickAnalysisMode,
    analysisContext: string
  ) => Promise<AIResponse>;
  onStepStart?: (mode: QuickAnalysisMode) => void;
  onStepComplete?: (mode: QuickAnalysisMode, response: AIResponse) => void;
}

export async function runComprehensiveAnalysisPipeline({
  execute,
  onStepStart,
  onStepComplete
}: PipelineCallbacks): Promise<ComprehensiveAnalysisResponses> {
  const responses: ComprehensiveAnalysisResponses = {};

  for (const mode of COMPREHENSIVE_ANALYSIS_STEPS) {
    onStepStart?.(mode);
    const response = await execute(mode, buildPipelineContext(responses));
    responses[mode] = response;
    onStepComplete?.(mode, response);
  }

  return responses;
}

export function buildPipelineContext(
  responses: ComprehensiveAnalysisResponses
): string {
  const completed = COMPREHENSIVE_ANALYSIS_STEPS.flatMap((mode) => {
    const response = responses[mode];
    return response ? [{ mode, result: response.result }] : [];
  });

  if (completed.length === 0) {
    return "";
  }

  return JSON.stringify(completed).slice(0, 9000);
}
