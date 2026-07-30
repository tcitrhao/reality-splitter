import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "dist/manifest.json"), "utf8"));
const contentScript = await readFile(resolve(root, "dist/contentScript.js"), "utf8");
const serviceWorker = await readFile(resolve(root, "dist/serviceWorker.js"), "utf8");
const contentScriptSource = await readFile(
  resolve(root, "src/content/contentScript.ts"),
  "utf8"
);
const platformExtractorSource = await readFile(
  resolve(root, "src/content/platformExtractor.ts"),
  "utf8"
);
const sidePanelSource = await readFile(resolve(root, "src/sidepanel/App.tsx"), "utf8");
const aiClientSource = await readFile(resolve(root, "src/shared/aiClient.ts"), "utf8");
const adminSource = await readFile(resolve(root, "src/site/App.tsx"), "utf8");
const messagesSource = await readFile(resolve(root, "src/shared/messages.ts"), "utf8");

const checks = [
  {
    pass: manifest.version === packageJson.version,
    message: `dist manifest version ${manifest.version} does not match package version ${packageJson.version}`
  },
  {
    pass: !/^\s*(?:import|export)\s/m.test(contentScript),
    message: "contentScript.js contains ES module syntax that Chrome content scripts cannot execute"
  },
  {
    pass: contentScript.includes("REALITY_SPLITTER_SHOW_INLINE_V9"),
    message: "contentScript.js is missing the versioned drawer message handler"
  },
  {
    pass: contentScript.includes(packageJson.version) && serviceWorker.includes(packageJson.version),
    message: "drawer handshake version does not match the package version"
  },
  {
    pass: contentScript.includes("当前短文文本") && contentScript.includes("现实分层器"),
    message: "contentScript.js does not match the shared product-copy contract"
  },
  {
    pass: contentScript.includes("注意力分诊"),
    message: "contentScript.js is missing the attention-triage result"
  },
  {
    pass: serviceWorker.includes("openPanelOnActionClick:!1"),
    message: "serviceWorker.js does not disable automatic Chrome Side Panel opening"
  },
  {
    pass:
      !contentScript.includes("ensureWeiboFloatingHost") &&
      !contentScript.includes("reality-splitter-button--weibo-floating") &&
      !contentScriptSource.includes("setupWeiboFloatingButton") &&
      !contentScriptSource.includes("button--weibo-floating"),
    message: "contentScript.js contains a Weibo button creation path"
  },
  {
    pass:
      /if \(platform === "weibo"\) \{\s*enforceWeiboButtonRemoval\(\);\s*return;\s*\}/.test(
        contentScriptSource
      ) && contentScriptSource.includes('if (platform !== "twitter")'),
    message: "the Weibo bootstrap path must only remove legacy buttons and return"
  },
  {
    pass:
      contentScriptSource.indexOf("bindRuntimeMessages();") <
        contentScriptSource.indexOf(
          "if (window.__realitySplitterBooted !== CONTENT_SCRIPT_VERSION)"
        ) &&
      contentScriptSource.includes("__realitySplitterRuntimeMessageListener") &&
      contentScriptSource.includes("chrome.runtime.onMessage.removeListener"),
    message: "drawer message listeners are not rebuilt after extension reload"
  },
  {
    pass:
      platformExtractorSource.includes('return platform === "twitter";') &&
      platformExtractorSource.includes(
        'return platform === "twitter" ? node.closest<HTMLElement>("article") : null;'
      ) &&
      /if \(platform === "twitter"\) \{\s*return Array\.from\(scope\.querySelectorAll<HTMLElement>\("article"\)\);\s*\}\s*return \[\];/.test(
        platformExtractorSource
      ),
    message: "unknown websites can still receive X-only post buttons"
  },
  {
    pass:
      contentScriptSource.includes('from "../shared/productCopy"') &&
      sidePanelSource.includes('from "../shared/productCopy"'),
    message: "drawer and Side Panel are not using the shared product-copy contract"
  },
  {
    pass: /showInlinePanel\(\{\s*input,\s*workspaceMode: "quick"\s*\}\);\s*void sendCaptureMessage\(input, false, "tweet_button"\)/.test(
      contentScriptSource
    ),
    message: "the X button must open the local drawer before syncing input to the background"
  },
  {
    pass:
      contentScriptSource.includes('data-reality-splitter-surface", "drawer"') &&
      contentScriptSource.includes('panel.removeAttribute("aria-modal")'),
    message: "the drawer does not replace legacy modal attributes"
  },
  {
    pass:
      !contentScriptSource.includes("autoRunMode") &&
      !contentScriptSource.includes("autoRunLongform") &&
      !serviceWorker.includes("autoRunMode") &&
      !serviceWorker.includes("autoRunLongform"),
    message: "sending selected text to a workspace must never trigger analysis automatically"
  },
  {
    pass:
      contentScriptSource.includes("inlineQuickResponse") &&
      contentScriptSource.includes("inlineLongformResponse") &&
      contentScriptSource.includes("inlineQuickLoading") &&
      contentScriptSource.includes("inlineLongformLoading") &&
      sidePanelSource.includes("quickResponse") &&
      sidePanelSource.includes("longformResponse") &&
      sidePanelSource.includes("quickLoading") &&
      sidePanelSource.includes("longformLoading"),
    message: "short-text and longform workspaces must own independent result and loading state"
  },
  {
    pass:
      aiClientSource.includes("isRetryableStatus") &&
      aiClientSource.includes("DEEPSEEK_QUICK_MAX_OUTPUT_TOKENS") &&
      aiClientSource.includes("attempt: 2"),
    message: "model reliability retry and DeepSeek output budget are missing"
  },
  {
    pass:
      contentScriptSource.includes("OPEN_MODEL_ADMIN") &&
      serviceWorker.includes("OPEN_MODEL_ADMIN") &&
      messagesSource.includes("TEST_MODEL_CONNECTION"),
    message: "model admin entry or runtime message contract is missing"
  },
  {
    pass:
      adminSource.includes("模型管理后台") &&
      adminSource.includes("测试连接") &&
      adminSource.includes('onSave={() => void persistSettings("quick")}') &&
      adminSource.includes('onSave={() => void persistSettings("longform")}') &&
      adminSource.includes('onTest={() => void testConnection("quick")}') &&
      adminSource.includes('onTest={() => void testConnection("longform")}') &&
      aiClientSource.includes("testModelConnection"),
    message: "independent model admin controls or connection test are missing"
  },
  {
    pass: manifest.options_page === "options.html",
    message: "extension model admin page is not registered as the options page"
  },
  {
    pass: !serviceWorker.includes("chrome.windows.create"),
    message: "serviceWorker.js still contains the legacy popup fallback"
  }
];

const failures = checks.filter((check) => !check.pass);
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`Build verification failed: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log(`Extension build verified: ${packageJson.version}`);
}
