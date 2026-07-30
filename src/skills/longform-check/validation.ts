import { UserVisibleError } from "../../application/errors/userVisibleError";
import type { AIResponse } from "../../shared/types";

export function assertLongformResponse(
  response: AIResponse
): asserts response is AIResponse<"longform"> {
  if (!response?.result || response.mode !== "longform") {
    throw new UserVisibleError("模型返回结果没有通过长文 Skill 的结构检查，可以再试一次。");
  }
}
