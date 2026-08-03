import assert from "node:assert/strict";
import { safeParseJson } from "../src/infrastructure/models/responseParsing.ts";

const result = {
  facts: [
    {
      claim: "这是一条事实主张。",
      verdict: "supported",
      evidenceNote: "来源直接支持。",
      sourceHint: "测试来源",
      sourceUrl: "https://example.com/source"
    }
  ],
  opinions: []
};

assert.deepEqual(safeParseJson(JSON.stringify(result)), result);
assert.deepEqual(
  safeParseJson(`下面是结果：\n\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``),
  result,
  "JSON fenced in explanatory text should still parse"
);
assert.deepEqual(
  safeParseJson(`<think>先分析，但不要把思考过程当成结果。</think>\n${JSON.stringify(result)}`),
  result,
  "thinking wrappers should be ignored"
);
assert.deepEqual(
  safeParseJson(JSON.stringify(JSON.stringify(result))),
  result,
  "double-encoded JSON should be unwrapped"
);

const looseJson = `{
  “facts”：[
    {
      “claim”：“第一行
第二行”，
      “verdict”：“supported”，
      “evidenceNote”：“来源支持”，
      “sourceHint”：“测试来源”，
      “sourceUrl”：“”，
    }，
  ]，
  “opinions”：[]，
}`;
const repaired = safeParseJson(looseJson);
assert.equal(repaired.facts[0].claim, "第一行\n第二行");
assert.deepEqual(repaired.opinions, []);

assert.equal(
  safeParseJson('{"facts":[{"claim":"被截断"}'),
  null,
  "truncated JSON must not be guessed into a valid result"
);

console.log("Model JSON response parsing verified");
