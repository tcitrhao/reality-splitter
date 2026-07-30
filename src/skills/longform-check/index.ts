import { runLongformCheck } from "../../shared/aiClient";
import type { AIResponse, LongformCheckInput } from "../../shared/types";
import { assertLongformResponse } from "./validation";

export async function runLongformCheckSkill(
  input: LongformCheckInput
): Promise<AIResponse<"longform">> {
  const response = await runLongformCheck(input);
  assertLongformResponse(response);
  return response;
}
