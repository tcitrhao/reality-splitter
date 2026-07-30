import { runAnalysis } from "../../shared/aiClient";
import type { AIResponse, QuickAnalysisMode, TweetInput } from "../../shared/types";
import { assertQuickAnalysisResponse } from "./validation";

export async function runQuickAnalysisSkill<M extends QuickAnalysisMode>(
  mode: M,
  input: TweetInput
): Promise<AIResponse<M>> {
  const response = await runAnalysis(mode, input);
  assertQuickAnalysisResponse(response, mode);
  return response;
}
