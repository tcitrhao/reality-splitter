import { UserVisibleError } from "../../application/errors/userVisibleError";
import type { AIResponse, QuickAnalysisMode } from "../../shared/types";

export function assertQuickAnalysisResponse<M extends QuickAnalysisMode>(
  response: AIResponse,
  expectedMode: M
): asserts response is AIResponse<M> {
  if (!response?.result || response.mode !== expectedMode) {
    throw new UserVisibleError("模型返回结果没有通过短文 Skill 的结构检查，可以再试一次。");
  }
}
