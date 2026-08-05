import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const packageJson = await readJson("package.json");
const manifest = await readJson("dist/manifest.json");
const sources = await readSources({
  contentScript: "src/content/contentScript.ts",
  drawerApp: "src/extension/drawer/DrawerApp.tsx",
  drawerController: "src/extension/drawer/drawerController.tsx",
  externalAssistantPanel: "src/extension/drawer/ExternalAssistantPanel.tsx",
  tabSession: "src/application/session/tabSession.ts",
  productContract: "src/contracts/product.ts",
  xEntry: "src/extension/entries/xEntry.ts",
  openDrawer: "src/extension/entries/openDrawer.ts",
  serviceWorker: "src/background/serviceWorker.ts",
  aiClient: "src/shared/aiClient.ts",
  providerProfiles: "src/shared/providerProfiles.ts",
  modelProtocol: "src/infrastructure/models/openAICompatible.ts",
  responseParsing: "src/infrastructure/models/responseParsing.ts",
  externalAssistantTargets: "src/infrastructure/externalAssistants/targets.ts",
  externalAssistantSend: "src/infrastructure/externalAssistants/oneClickSend.ts",
  externalAssistantAutomation: "src/infrastructure/externalAssistants/pageAutomation.ts",
  zhipuSearch: "src/infrastructure/search/zhipuWebSearch.ts",
  zhipuSearchProtocol: "src/infrastructure/search/zhipuSearchProtocol.ts",
  sidePanel: "src/sidepanel/App.tsx",
  admin: "src/site/App.tsx",
  modelProfileCard: "src/site/components/ModelProfileCard.tsx",
  modelSettings: "src/shared/modelSettings.ts",
  zhipuSearchSettings: "src/shared/zhipuSearch.ts",
  storage: "src/shared/storage.ts",
  messages: "src/shared/messages.ts",
  portableAnalysis: "src/skills/portable-analysis/index.ts"
});
const contentBundle = await read("dist/contentScript.js");
const serviceWorkerBundle = await read("dist/serviceWorker.js");

const checks = [
  check(
    manifest.version === packageJson.version,
    `dist manifest version ${manifest.version} does not match package version ${packageJson.version}`
  ),
  check(
    !/^\s*(?:import|export)\s/m.test(contentBundle),
    "contentScript.js contains ES module syntax that Chrome content scripts cannot execute"
  ),
  check(
    !/\bprocess(?:\.env|\.)/.test(contentBundle),
    "contentScript.js contains a Node process reference that will crash in Chrome"
  ),
  check(
    !manifest.permissions?.includes("permissions"),
    'manifest declares the unknown Chrome permission "permissions"'
  ),
  check(
    contentBundle.includes("REALITY_SPLITTER_SHOW_INLINE_V10") &&
      serviceWorkerBundle.includes("REALITY_SPLITTER_SHOW_INLINE_V10"),
    "content and background bundles do not share the V10 drawer protocol"
  ),
  check(
    contentBundle.includes(packageJson.version) && serviceWorkerBundle.includes(packageJson.version),
    "drawer handshake version does not match package.json"
  ),
  check(
    sources.productContract.includes('analysisTrigger: "manual-only"') &&
      sources.productContract.includes('sessionScope: "current-tab"') &&
      sources.productContract.includes("independentWorkspaceState: true"),
    "the executable product contract no longer guarantees manual, current-tab, independent workspaces"
  ),
  check(
    lineCount(sources.contentScript) <= 260 &&
      lineCount(sources.serviceWorker) <= 280 &&
      lineCount(sources.aiClient) <= 1100,
    "an orchestration boundary has grown back into a monolith"
  ),
  check(
    sources.contentScript.includes("cleanupPreviousRuntime();") &&
      sources.contentScript.includes("__realitySplitterCleanup") &&
      sources.contentScript.includes("chrome.runtime.onMessage.removeListener"),
    "same-version extension reload cleanup is missing"
  ),
  check(
    sources.contentScript.includes('if (platform === "weibo")') &&
      sources.contentScript.includes("enforceWeiboButtonRemoval();") &&
      sources.contentScript.includes('if (platform !== "twitter")') &&
      sources.productContract.includes("injectPostButton: false"),
    "platform capability boundaries allow non-X button injection"
  ),
  check(
    sources.xEntry.indexOf("dependencies.openQuickDrawer(input)") <
      sources.xEntry.indexOf("dependencies.persistInput(input)"),
    "the X entry no longer opens the local drawer before background persistence"
  ),
  check(
    sources.drawerApp.includes('from "../../sidepanel/components/AnalysisPanel"') &&
      sources.drawerApp.includes('from "../../sidepanel/components/ActionButtons"'),
    "the current-page drawer duplicated shared React result or action components"
  ),
  check(
    sources.drawerApp.includes("ExternalAssistantPanel") &&
      sources.externalAssistantPanel.includes("buildPortableAnalysisPrompt") &&
      sources.externalAssistantPanel.includes("navigator.clipboard.writeText") &&
      sources.externalAssistantPanel.includes("requireWebSearch: workspaceMode === \"longform\"") &&
      sources.messages.includes("OPEN_EXTERNAL_ASSISTANT") &&
      sources.serviceWorker.includes("sendToExternalAssistant") &&
      sources.externalAssistantSend.includes("chrome.scripting.executeScript") &&
      sources.externalAssistantSend.includes("runExternalAssistantPageAutomation") &&
      sources.externalAssistantAutomation.includes("findComposer") &&
      sources.externalAssistantAutomation.includes("enableWebSearch") &&
      sources.externalAssistantAutomation.includes("sendControl.click()") &&
      sources.externalAssistantPanel.includes('mode: "comprehensive"') &&
      sources.portableAnalysis.includes("模块四：转成小实验") &&
      sources.externalAssistantTargets.includes("https://chatgpt.com/") &&
      sources.externalAssistantTargets.includes("https://chat.deepseek.com/") &&
      sources.portableAnalysis.includes("不要输出 JSON"),
    "portable Skill export or external assistant target boundaries are missing"
  ),
  check(
    manifest.host_permissions?.includes("https://chatgpt.com/*") &&
      manifest.host_permissions?.includes("https://chat.deepseek.com/*"),
    "offline one-click assistant hosts are missing from the extension permissions"
  ),
  check(
    sources.drawerController.includes("createTabSessionStore") &&
      sources.drawerController.includes("attachShadow") &&
      sources.drawerController.includes('data-reality-splitter-surface", "drawer"'),
    "the isolated React drawer or TabSession boundary is missing"
  ),
  check(
    sources.tabSession.includes("QuickWorkspaceSession") &&
      sources.tabSession.includes("LongformWorkspaceSession") &&
      sources.tabSession.includes("resolveQuickRequest") &&
      sources.tabSession.includes("resolveLongformRequest"),
    "short-text and longform workspaces no longer own independent async state"
  ),
  check(
    !sources.contentScript.includes("autoRunMode") &&
      !sources.contentScript.includes("autoRunLongform") &&
      !sources.serviceWorker.includes("autoRunMode") &&
      !sources.serviceWorker.includes("autoRunLongform"),
    "sending text to a workspace must never trigger model analysis automatically"
  ),
  check(
    !sources.contentScript.includes("bindSelectionListeners") &&
      !sources.contentScript.includes('addEventListener("mouseup"') &&
      !sources.contentScript.includes('addEventListener("keyup"') &&
      !sources.tabSession.includes("updateCurrentSelection"),
    "passive text selection must not overwrite a workspace; only explicit entry actions may send text"
  ),
  check(
    sources.serviceWorker.includes('from "../skills/quick-analysis"') &&
      sources.serviceWorker.includes('from "../skills/longform-check"'),
    "background orchestration bypasses the two product Skill boundaries"
  ),
  check(
    sources.aiClient.includes('from "../infrastructure/models/inputPreparation"') &&
      sources.aiClient.includes('from "../infrastructure/models/responseParsing"') &&
      sources.aiClient.includes('from "../infrastructure/models/openAICompatible"') &&
      sources.aiClient.includes('from "../infrastructure/search/kimiWebSearch"') &&
      sources.aiClient.includes('from "../infrastructure/search/zhipuWebSearch"'),
    "model infrastructure has been folded back into aiClient.ts"
  ),
  check(
    sources.providerProfiles.includes('return "zhipu"') &&
      sources.zhipuSearchProtocol.includes("/paas/v4/web_search") &&
      sources.zhipuSearchProtocol.includes("search_engine: searchEngine") &&
      sources.zhipuSearchProtocol.includes("DEFAULT_ZHIPU_SEARCH_ENGINE") &&
      sources.zhipuSearchSettings.includes('value: "search_std"') &&
      sources.zhipuSearchSettings.includes('value: "search_pro"') &&
      sources.zhipuSearchSettings.includes('value: "search_pro_sogou"') &&
      sources.zhipuSearchSettings.includes('value: "search_pro_quark"') &&
      sources.modelProfileCard.includes("长文网页搜索引擎") &&
      sources.aiClient.includes('params.providerProfile === "zhipu"') &&
      sources.aiClient.includes("fetchZhipuLongformEvidence"),
    "Zhipu web search is missing or no longer restricted to the longform workflow"
  ),
  check(
    sources.modelProtocol.includes("isRetryableStatus") &&
      sources.modelProtocol.includes("DEEPSEEK_QUICK_MAX_OUTPUT_TOKENS") &&
      sources.modelProtocol.includes("ZHIPU_LONGFORM_MAX_OUTPUT_TOKENS") &&
      sources.modelProtocol.includes('providerProfile === "zhipu"') &&
      sources.responseParsing.includes("extractBalancedJson") &&
      sources.aiClient.includes("attempt: 2"),
    "model retry, structured output budget, or resilient JSON parsing support is missing"
  ),
  check(
    sources.drawerApp.includes("OPEN_MODEL_ADMIN") &&
      sources.serviceWorker.includes("OPEN_MODEL_ADMIN") &&
      sources.messages.includes("TEST_MODEL_CONNECTION"),
    "model administration entry or runtime contract is missing"
  ),
  check(
    sources.admin.includes("模型管理后台") &&
      sources.admin.includes("测试连接") &&
      sources.admin.includes("新增 API 配置") &&
      sources.admin.includes("默认调用模型") &&
      sources.storage.includes("modelProfiles") &&
      sources.modelSettings.includes("migrateLegacySettings"),
    "model profile library, workspace defaults, or legacy migration is missing"
  ),
  check(
    manifest.options_page === "options.html" &&
      !serviceWorkerBundle.includes("chrome.windows.create") &&
      sources.openDrawer.includes("openFallbackAnalysisSurface"),
    "model admin or Side Panel-only fallback boundaries are invalid"
  ),
  check(
    contentBundle.includes("当前短文文本") &&
      contentBundle.includes("现实分层器") &&
      contentBundle.includes("注意力分诊"),
    "the bundled drawer no longer includes the shared product language and core result"
  )
];

const failures = checks.filter((item) => !item.pass);
if (failures.length > 0) {
  failures.forEach((failure) => {
    console.error(`Build verification failed: ${failure.message}`);
  });
  process.exitCode = 1;
} else {
  console.log(
    `Extension architecture verified: ${packageJson.version} ` +
      `(content ${lineCount(sources.contentScript)} lines, ` +
      `background ${lineCount(sources.serviceWorker)} lines, ` +
      `AI client ${lineCount(sources.aiClient)} lines)`
  );
}

function check(pass, message) {
  return { pass, message };
}

function lineCount(value) {
  return value.trimEnd().split("\n").length;
}

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

async function readSources(entries) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(entries).map(async ([key, relativePath]) => [
        key,
        await read(relativePath)
      ])
    )
  );
}
