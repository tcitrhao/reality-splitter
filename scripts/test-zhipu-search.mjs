import assert from "node:assert/strict";
import { detectProviderProfile } from "../src/shared/providerProfiles.ts";
import { buildLongformPrompt } from "../src/shared/prompts.ts";
import {
  ZHIPU_WEB_SEARCH_ENDPOINT,
  buildZhipuSearchRequest,
  deriveZhipuSearchQueries,
  formatZhipuSearchEvidence,
  normalizeZhipuSearchResults,
  restrictZhipuSourceUrls
} from "../src/infrastructure/search/zhipuSearchProtocol.ts";

const queries = deriveZhipuSearchQueries(
  "某公司在2026年7月宣布完成新一轮融资，金额达到10亿元。作者认为这家公司未来一定会成为行业第一。另一份报告显示该行业收入同比增长20%。"
);
assert.ok(queries.length >= 1 && queries.length <= 3);
assert.ok(queries.every((query) => query.length <= 70));
assert.match(queries[0], /2026|10亿元|同比增长20%/);
assert.equal(
  detectProviderProfile({
    provider: "openai-compatible",
    apiKey: "",
    model: "glm-4.7",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4"
  }),
  "zhipu"
);

assert.equal(ZHIPU_WEB_SEARCH_ENDPOINT, "https://open.bigmodel.cn/api/paas/v4/web_search");
const requestBody = buildZhipuSearchRequest(queries[0]);
assert.equal(requestBody.search_engine, "search_std");
assert.equal(requestBody.search_intent, false);
assert.equal(requestBody.count, 5);
assert.ok(requestBody.search_query.length <= 70);

const results = normalizeZhipuSearchResults({
  search_result: [
    {
      title: "权威机构公告",
      content: "公告确认了相关事实。",
      link: "https://authority.example.com/report",
      media: "权威机构",
      publish_date: "2026-07-31"
    },
    { title: "缺少链接的无效结果" }
  ]
});
assert.deepEqual(results, [
    {
      title: "权威机构公告",
      content: "公告确认了相关事实。",
      link: "https://authority.example.com/report",
      media: "权威机构",
      publishDate: "2026-07-31"
    }
]);

const context = formatZhipuSearchEvidence([
  { query: queries[0], results }
]);
assert.match(context, /权威机构公告/);
assert.match(context, /https:\/\/authority\.example\.com\/report/);
assert.match(context, /2026-07-31/);

const prompt = buildLongformPrompt({
  articleText: "待核查内容",
  referenceLinks: [],
  referenceNotes: "",
  webSearchContext: context,
  providerProfile: "zhipu"
});
assert.match(prompt.system, /外部不可信证据/);
assert.match(prompt.system, /不要声称已经打开或阅读全文/);
assert.match(prompt.user, /sourceUrl/);
assert.match(prompt.user, /权威机构公告/);

const restricted = restrictZhipuSourceUrls(
  {
    facts: [
      {
        claim: "可验证主张",
        verdict: "supported",
        evidenceNote: "已有直接来源。",
        sourceHint: "权威机构公告",
        sourceUrl: "https://authority.example.com/report"
      },
      {
        claim: "模型虚构链接",
        verdict: "unsupported",
        evidenceNote: "缺少来源。",
        sourceHint: "未知",
        sourceUrl: "https://hallucinated.example.com/source"
      }
    ],
    opinions: []
  },
  context
);
assert.equal(restricted.facts[0].sourceUrl, "https://authority.example.com/report");
assert.equal(restricted.facts[1].sourceUrl, "");

console.log("Zhipu web search protocol verified");
