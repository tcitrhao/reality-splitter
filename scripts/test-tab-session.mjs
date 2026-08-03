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
store.resolveQuickRequest(quickRequest.requestId, { response: quickResponse });
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, quickResponse);
assert.equal(snapshot.longform.loading, true);

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
store.resolveQuickRequest(staleRequest.requestId, { response: quickResponse });
snapshot = store.getSnapshot();
assert.equal(snapshot.quick.response, null, "stale model responses must not overwrite edited input");

const otherTab = createTabSessionStore(() => "https://other.example.com");
assert.equal(otherTab.getSnapshot().quick.input, null, "each content script owns an isolated tab session");

console.log("TabSession contract verified");
