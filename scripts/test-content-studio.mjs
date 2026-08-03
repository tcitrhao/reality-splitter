import assert from "node:assert/strict";
import {
  authenticateGitHub,
  decodeUtf8Base64,
  encodeUtf8Base64,
  loadGitHubContent,
  mergeWebsiteContent,
  publishGitHubContentSafely,
  verifyGitHubWriteAccess
} from "../src/studio/githubContent.ts";
import {
  clearStudioDraft,
  readStudioDraft,
  saveStudioDraft
} from "../src/studio/draftStorage.ts";

const baseContent = {
  site: { brand: "Reality Splitter", tagline: "base" },
  iterationsPage: { title: "迭代" },
  iterations: [
    { version: "v1.0.0", title: "初始迭代", body: "base", learning: "base", state: "起点" }
  ],
  meditationsPage: { title: "沉思" },
  meditations: [
    { index: "01", title: "初始沉思", excerpt: "base", body: "", status: "写作中" }
  ]
};
const localContent = structuredClone(baseContent);
localContent.iterations[0].body = "本地修改";
localContent.iterations.unshift({
  version: "v2.0.0",
  title: "本地新增",
  body: "local",
  learning: "local",
  state: "今天"
});
const remoteContent = structuredClone(baseContent);
remoteContent.site.tagline = "远程修改";
remoteContent.meditations[0].title = "远程更新的沉思";
remoteContent.iterations.unshift({
  version: "v3.0.0",
  title: "Codex 新增",
  body: "remote",
  learning: "remote",
  state: "远程"
});

const requests = [];
const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;
let repositoryContent = structuredClone(baseContent);
let repositorySha = "sha-base";
let canWrite = true;
let rejectNextPutWithConflict = false;

const localValues = new Map();
globalThis.localStorage = {
  getItem: (key) => localValues.get(key) ?? null,
  setItem: (key, value) => localValues.set(key, String(value)),
  removeItem: (key) => localValues.delete(key)
};

globalThis.fetch = async (url, init = {}) => {
  const requestUrl = String(url);
  requests.push({ url: requestUrl, init });

  if (requestUrl.endsWith("/user")) {
    return Response.json({
      login: "tcitrhao",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
      html_url: "https://github.com/tcitrhao"
    });
  }

  if (requestUrl.endsWith("/repos/tcitrhao/reality-splitter")) {
    return Response.json({ permissions: { push: canWrite } });
  }

  if (init.method === "PUT") {
    if (rejectNextPutWithConflict) {
      rejectNextPutWithConflict = false;
      repositoryContent.iterations.unshift({
        version: "v4.0.0",
        title: "竞态新增",
        body: "race",
        learning: "race",
        state: "稍后"
      });
      repositorySha = "sha-race";
      return Response.json({ message: "sha does not match" }, { status: 409 });
    }
    const body = JSON.parse(String(init.body));
    assert.equal(body.sha, repositorySha, "publish must use the latest remote SHA");
    repositoryContent = JSON.parse(decodeUtf8Base64(body.content));
    repositorySha = "sha-next";
    return Response.json({
      content: { sha: repositorySha },
      commit: { html_url: "https://github.com/tcitrhao/reality-splitter/commit/test" }
    });
  }

  return Response.json({
    type: "file",
    encoding: "base64",
    content: encodeUtf8Base64(`${JSON.stringify(repositoryContent)}\n`),
    sha: repositorySha
  });
};

try {
  const utf8 = "中文 Markdown：**事实与观点**";
  assert.equal(decodeUtf8Base64(encodeUtf8Base64(utf8)), utf8);

  const identity = await authenticateGitHub("test-token");
  assert.equal(identity.login, "tcitrhao");
  await verifyGitHubWriteAccess("test-token");
  canWrite = false;
  await assert.rejects(
    () => verifyGitHubWriteAccess("read-only-token"),
    /不能发布/
  );
  canWrite = true;

  const snapshot = await loadGitHubContent("test-token");
  assert.equal(snapshot.sha, "sha-base");

  const merged = mergeWebsiteContent(baseContent, localContent, remoteContent);
  assert.deepEqual(
    merged.iterations.map((item) => item.version),
    ["v2.0.0", "v3.0.0", "v1.0.0"]
  );
  assert.equal(merged.iterations[2].body, "本地修改");
  assert.equal(merged.site.tagline, "远程修改");
  assert.equal(merged.meditations[0].title, "远程更新的沉思");
  const recovered = mergeWebsiteContent(
    baseContent,
    localContent,
    { ...remoteContent, iterations: remoteContent.iterations.slice(0, 1) }
  );
  assert.ok(recovered.iterations.some((item) => item.version === "v1.0.0"));

  repositoryContent = structuredClone(remoteContent);
  repositorySha = "sha-remote";
  rejectNextPutWithConflict = true;
  const published = await publishGitHubContentSafely({
    baseContent,
    content: localContent,
    sha: snapshot.sha,
    token: "test-token"
  });
  assert.equal(published.sha, "sha-next");
  assert.deepEqual(
    published.content.iterations.map((item) => item.version),
    ["v2.0.0", "v4.0.0", "v3.0.0", "v1.0.0"]
  );
  assert.equal(repositoryContent.iterations[3].body, "本地修改");
  assert.equal(repositoryContent.site.tagline, "远程修改");

  const putRequest = requests.find((request) => request.init.method === "PUT");
  assert.ok(putRequest);
  assert.match(String(putRequest.init.headers.Authorization), /^Bearer test-token$/);

  const savedDraft = saveStudioDraft({
    baseContent,
    baseSha: "sha-base",
    content: localContent,
    draftEntries: [
      { section: "iterations", key: "v2.0.0" },
      { section: "meditations", key: "02" }
    ]
  });
  assert.ok(savedDraft.savedAt);
  assert.equal(readStudioDraft()?.content.iterations[0].version, "v2.0.0");
  assert.deepEqual(readStudioDraft()?.draftEntries, [
    { section: "iterations", key: "v2.0.0" },
    { section: "meditations", key: "02" }
  ]);
  clearStudioDraft();
  assert.equal(readStudioDraft(), undefined);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalLocalStorage;
}

console.log("Online content studio save, merge and GitHub publish verified");
