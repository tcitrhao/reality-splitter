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
import {
  DEFAULT_ZHIPU_SEARCH_ENGINE,
  ZHIPU_SEARCH_ENGINE_OPTIONS,
  normalizeZhipuSearchEngine
} from "../src/shared/zhipuSearch.ts";
import {
  fetchZhipuLongformEvidence,
  searchZhipuWeb
} from "../src/infrastructure/search/zhipuWebSearch.ts";
import {
  runLongformCheck,
  testModelConnection
} from "../src/shared/aiClient.ts";

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
assert.equal(requestBody.search_engine, "search_pro");
assert.equal(requestBody.search_intent, false);
assert.equal(requestBody.count, 10);
assert.equal(requestBody.content_size, "high");
assert.ok(requestBody.search_query.length <= 70);

for (const option of ZHIPU_SEARCH_ENGINE_OPTIONS) {
  assert.equal(
    buildZhipuSearchRequest(queries[0], option.value).search_engine,
    option.value,
    `${option.value} should be passed to Zhipu without remapping`
  );
}
assert.equal(normalizeZhipuSearchEngine(undefined), DEFAULT_ZHIPU_SEARCH_ENGINE);
assert.equal(normalizeZhipuSearchEngine("unknown"), "search_pro");

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

const originalFetch = globalThis.fetch;
const originalChrome = globalThis.chrome;
const searchRequestBodies = [];
let searchSequence = 0;

globalThis.chrome = {
  storage: {
    local: {
      get: async () => ({
        modelProfiles: [
          {
            id: "zhipu-longform",
            name: "智谱长文",
            provider: "openai-compatible",
            apiKey: "test-api-key",
            model: "glm-test",
            baseUrl: "https://open.bigmodel.cn/api/paas/v4",
            zhipuSearchEngine: "search_pro_quark"
          }
        ],
        quickDefaultProfileId: "zhipu-longform",
        longformDefaultProfileId: "zhipu-longform"
      })
    }
  },
  permissions: {
    contains: async () => true
  }
};

globalThis.fetch = async (url, init = {}) => {
  if (String(url).endsWith("/web_search")) {
    const body = JSON.parse(String(init.body));
    searchRequestBodies.push(body);
    searchSequence += 1;
    return Response.json({
      search_result: [
        {
          title: `测试来源 ${searchSequence}`,
          content: "这是用于验证搜索配置传递的模拟摘要。",
          link: `https://source.example.com/${searchSequence}`,
          media: "测试来源",
          publish_date: "2026-07-31"
        }
      ]
    });
  }

  if (String(url).endsWith("/chat/completions")) {
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              facts: [
                {
                  claim: "可核查事实",
                  verdict: "supported",
                  evidenceNote: "模拟来源支持该主张。",
                  sourceHint: "测试来源",
                  sourceUrl: "https://source.example.com/1"
                }
              ],
              opinions: [
                {
                  claim: "作者观点",
                  verdict: "unsupported",
                  evidenceNote: "这是观点，不是外部事实。",
                  sourceHint: "原文",
                  sourceUrl: ""
                }
              ]
            })
          }
        }
      ]
    });
  }

  throw new Error(`Unexpected test URL: ${url}`);
};

try {
  const directResults = await searchZhipuWeb({
    apiKey: "test-api-key",
    query: "直接测试",
    searchEngine: "search_pro_sogou"
  });
  assert.equal(directResults.length, 1);
  assert.equal(searchRequestBodies.at(-1).search_engine, "search_pro_sogou");

  const evidence = await fetchZhipuLongformEvidence(
    "某公司在2026年7月宣布发布新产品，销售额同比增长20%。",
    "test-api-key",
    "search_std"
  );
  assert.equal(evidence.execution.engine, "search_std");
  assert.equal(evidence.execution.queryCount, evidence.execution.sourceCount);
  assert.match(evidence.context, /测试来源/);

  const connection = await testModelConnection("longform", {
    provider: "openai-compatible",
    apiKey: "test-api-key",
    model: "glm-test",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    zhipuSearchEngine: "search_pro"
  });
  assert.equal(connection.webSearch?.engine, "search_pro");
  assert.equal(connection.webSearch?.sourceCount, 1);
  assert.equal(searchRequestBodies.at(-1).search_engine, "search_pro");

  const longformResponse = await runLongformCheck({
    articleText:
      "某公司在2026年7月宣布发布新产品，销售额同比增长20%。作者认为它一定会成为行业第一。",
    referenceLinks: [],
    referenceNotes: ""
  });
  assert.equal(longformResponse.result.webSearch?.engine, "search_pro_quark");
  assert.ok((longformResponse.result.webSearch?.sourceCount ?? 0) > 0);
  assert.ok(
    searchRequestBodies
      .slice(-(longformResponse.result.webSearch?.queryCount ?? 0))
      .every((body) => body.search_engine === "search_pro_quark"),
    "the saved longform profile should control every Zhipu search request"
  );
} finally {
  globalThis.fetch = originalFetch;
  globalThis.chrome = originalChrome;
}

console.log("Zhipu web search protocol verified");
