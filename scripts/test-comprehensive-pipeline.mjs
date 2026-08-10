import assert from "node:assert/strict";
import { buildPrompt } from "../src/shared/prompts.ts";
import {
  COMPREHENSIVE_ANALYSIS_STEPS,
  runComprehensiveAnalysisPipeline
} from "../src/skills/quick-analysis/pipeline.ts";

const starts = [];
const completions = [];
const contexts = [];

const responses = await runComprehensiveAnalysisPipeline({
  onStepStart: (mode) => starts.push(mode),
  onStepComplete: (mode) => completions.push(mode),
  execute: async (mode, analysisContext) => {
    contexts.push(analysisContext);
    return { mode, result: { marker: mode } };
  }
});

assert.deepEqual(starts, COMPREHENSIVE_ANALYSIS_STEPS);
assert.deepEqual(completions, COMPREHENSIVE_ANALYSIS_STEPS);
assert.equal(contexts[0], "", "the first step must not receive invented history");
assert.match(contexts[1], /split/, "later steps must receive the previous structured result");
assert.match(contexts[3], /deescalate/, "the experiment must receive all completed steps");
assert.equal(responses.experiment?.mode, "experiment");

const focusedSplit = buildPrompt("split", "测试文本", { focusedSplit: true });
assert.equal(
  focusedSplit.user.includes("不要在这一步生成替代解释、中性改写或小实验"),
  true
);
assert.equal(
  JSON.stringify(focusedSplit.jsonSchema).includes("alternativeExplanations"),
  false,
  "the focused split schema must not spend output budget on later stages"
);

const alternatives = buildPrompt("alternatives", "测试文本", {
  analysisContext: contexts[1]
});
assert.match(alternatives.user, /前序步骤的结构化结果/);

console.log("Comprehensive four-step pipeline verified");
