import assert from "node:assert/strict";
import { createTabSessionStore } from "../src/application/session/tabSession.ts";

const store = createTabSessionStore(() => "https://example.com/current");
const input = {
  text: "这是一条需要拆解的内容。",
  url: "https://example.com/source"
};

store.open(input, "quick");
let snapshot = store.getSnapshot();
assert.equal(snapshot.open, true);
assert.equal(snapshot.workspaceMode, "quick");
assert.equal(snapshot.quick.input?.text, input.text);
assert.equal(snapshot.quick.loading, false, "opening a workspace must not run analysis");

const quickRequest = store.beginQuickRequest("split");
assert.ok(quickRequest);
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.loading, true);

store.setWorkspaceMode("longform");
const longformRequest = store.beginLongformRequest();
assert.ok(longformRequest);
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.loading, true);
assert.equal(snapshot.longform.loading, true, "quick and longform requests may run concurrently");

const quickResponse = {
  mode: "split",
  result: {
    attentionTriage: {
      recommendedAction: "verify",
      attentionCost: "medium",
      reason: "需要来源。",
      nextStep: "先核查。"
    }
  }
};
store.setQuickRequestStep(quickRequest.requestId, "split");
store.resolveQuickRequestStep(quickRequest.requestId, "split", quickResponse);
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, quickResponse);
assert.equal(snapshot.quick.comprehensiveResponses.split, quickResponse);
assert.equal(snapshot.longform.loading, true);

store.setQuickRequestStep(quickRequest.requestId, "alternatives");
assert.equal(store.getSnapshot().quick.activeMode, "alternatives");
store.finishQuickRequest(quickRequest.requestId);
assert.equal(store.getSnapshot().quick.loading, false);

const followUpRequest = store.beginQuickFollowUpRequest("alternatives");
assert.ok(followUpRequest);
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, quickResponse, "follow-up work must preserve the comprehensive result");
assert.equal(snapshot.quick.followUpLoading, true);

const followUpResponse = {
  mode: "alternatives",
  result: {
    alternatives: [{ explanation: "另一种可能", whyPossible: "原文信息有限。" }]
  }
};
store.resolveQuickFollowUpRequest(followUpRequest.requestId, { response: followUpResponse });
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, quickResponse);
assert.equal(snapshot.quick.followUpResponse, followUpResponse);

const longformResponse = {
  mode: "longform",
  result: {
    facts: [],
    opinions: []
  }
};
store.resolveLongformRequest(longformRequest.requestId, { response: longformResponse });
store.setWorkspaceMode("quick");
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, quickResponse, "tab switching must preserve quick results");
assert.equal(snapshot.longform.response, longformResponse, "tab switching must preserve longform results");

store.setWorkspaceMode("quick");
const staleRequest = store.beginQuickRequest("split");
assert.ok(staleRequest);
store.updateQuickText("用户已经修改了输入。");
store.resolveQuickRequestStep(staleRequest.requestId, "split", quickResponse);
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, null, "stale model responses must not overwrite edited input");
assert.deepEqual(snapshot.quick.comprehensiveResponses, {});
assert.equal(snapshot.quick.followUpResponse, null, "editing input must clear follow-up perspectives");

const otherTab = createTabSessionStore(() => "https://other.example.com");
assert.equal(otherTab.getSnapshot().quick.input, null, "each content script owns an isolated tab session");

const partialStore = createTabSessionStore(() => "https://partial.example.com");
partialStore.open(input, "quick");
const partialRequest = partialStore.beginQuickRequest("split");
assert.ok(partialRequest);
partialStore.resolveQuickRequestStep(partialRequest.requestId, "split", quickResponse);
partialStore.finishQuickRequest(partialRequest.requestId, "第二步失败");
const partialSnapshot = partialStore.getSnapshot();
assert.equal(partialSnapshot.quick.loading, false);
assert.equal(partialSnapshot.quick.error, "第二步失败");
assert.equal(
  partialSnapshot.quick.comprehensiveResponses.split,
  quickResponse,
  "completed pipeline steps must survive a later failure"
);

console.log("TabSession contract verified");
