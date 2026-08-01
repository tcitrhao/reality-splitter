import assert from "node:assert/strict";
import {
  authenticateGitHub,
  decodeUtf8Base64,
  encodeUtf8Base64,
  loadGitHubContent,
  publishGitHubContent
} from "../src/studio/githubContent.ts";

const sampleContent = {
  site: { brand: "Reality Splitter" },
  iterations: [{ title: "中文 **Markdown**" }],
  meditations: [{ title: "AI 沉思录" }]
};
const encodedContent = encodeUtf8Base64(`${JSON.stringify(sampleContent)}\n`);
const requests = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), init });

  if (String(url).endsWith("/user")) {
    return Response.json({
      login: "tcitrhao",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
      html_url: "https://github.com/tcitrhao"
    });
  }

  if (init.method === "PUT") {
    return Response.json({
      content: { sha: "sha-next" },
      commit: { html_url: "https://github.com/tcitrhao/reality-splitter/commit/test" }
    });
  }

  return Response.json({
    type: "file",
    encoding: "base64",
    content: encodedContent,
    sha: "sha-current"
  });
};

try {
  const utf8 = "中文 Markdown：**事实与观点**";
  assert.equal(decodeUtf8Base64(encodeUtf8Base64(utf8)), utf8);

  const identity = await authenticateGitHub("test-token");
  assert.equal(identity.login, "tcitrhao");

  const snapshot = await loadGitHubContent("test-token");
  assert.equal(snapshot.sha, "sha-current");
  assert.equal(snapshot.content.iterations[0].title, "中文 **Markdown**");

  const published = await publishGitHubContent({
    content: snapshot.content,
    sha: snapshot.sha,
    token: "test-token"
  });
  assert.equal(published.sha, "sha-next");

  const putRequest = requests.find((request) => request.init.method === "PUT");
  assert.ok(putRequest);
  const body = JSON.parse(String(putRequest.init.body));
  assert.equal(body.branch, "main");
  assert.equal(body.sha, "sha-current");
  assert.equal(
    JSON.parse(decodeUtf8Base64(body.content)).meditations[0].title,
    "AI 沉思录"
  );
  assert.match(String(putRequest.init.headers.Authorization), /^Bearer test-token$/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Online content studio GitHub protocol verified");
