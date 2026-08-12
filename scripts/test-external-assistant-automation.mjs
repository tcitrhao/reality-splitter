import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runExternalAssistantPageAutomation } from "../src/infrastructure/externalAssistants/pageAutomation.ts";
import { EXTERNAL_ASSISTANT_TARGETS } from "../src/infrastructure/externalAssistants/targets.ts";

const chromeBinary =
  process.env.CHROME_BINARY ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profileDirectory = await mkdtemp(join(tmpdir(), "reality-splitter-assistant-"));
const server = createServer((request, response) => {
  const target = new URL(request.url || "/chatgpt", "http://127.0.0.1").pathname.slice(1);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(buildFixture(target));
});
let chromeProcess;

try {
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate assistant fixture port");
  }

  chromeProcess = spawn(
    chromeBinary,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${profileDirectory}`,
      "--remote-debugging-port=0",
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "ignore"] }
  );

  const debugPort = await waitForDevToolsPort(profileDirectory);
  const prompt = "# Reality Splitter\n请核查这段测试文本。";

  for (const target of Object.keys(EXTERNAL_ASSISTANT_TARGETS)) {
    const pageUrl = `http://127.0.0.1:${address.port}/${target}`;
    const pageTarget = await createPageTarget(debugPort, pageUrl);
    const client = await createCdpClient(pageTarget.webSocketDebuggerUrl);
    try {
      await client.send("Runtime.enable");
      const expression = `(${runExternalAssistantPageAutomation.toString()})(${JSON.stringify(
        target
      )}, ${JSON.stringify(prompt)}, true)`;
      const result = await evaluate(client, expression);
      const composerState = await evaluate(client, `(() => {
        const composer = document.querySelector('textarea, [contenteditable]');
        return 'value' in composer ? composer.value : composer.innerText;
      })()`);
      assert.equal(result.target, target);
      assert.equal(
        result.filled,
        true,
        `${target}: ${JSON.stringify({ result, composerState })}`
      );
      assert.equal(result.submitted, true, `${target}: ${JSON.stringify(result)}`);
      assert.equal(result.searchStatus, "enabled", `${target}: ${JSON.stringify(result)}`);

      const fixtureState = await evaluate(client, `({
        submitted: document.documentElement.dataset.submitted,
        search: document.querySelector('[data-search]')?.getAttribute('aria-pressed'),
        prompt: document.documentElement.dataset.prompt
      })`);
      assert.equal(fixtureState.submitted, "true");
      assert.equal(fixtureState.search, "true");
      assert.equal(fixtureState.prompt, prompt);
    } finally {
      client.close();
    }
  }

  console.log("All 16 one-click assistant target identifiers verified in Chrome");
} finally {
  if (chromeProcess && chromeProcess.exitCode === null) {
    chromeProcess.kill("SIGTERM");
    await new Promise((resolvePromise) => {
      const timeout = setTimeout(resolvePromise, 2_000);
      chromeProcess.once("exit", () => {
        clearTimeout(timeout);
        resolvePromise();
      });
    });
  }
  await new Promise((resolvePromise) => server.close(resolvePromise));
  await rm(profileDirectory, { recursive: true, force: true });
}

function buildFixture(target) {
  const composer =
    target === "chatgpt"
      ? '<div id="prompt-textarea" role="textbox" contenteditable="true"></div>'
      : '<textarea placeholder="给 DeepSeek 发送消息"></textarea>';
  const search =
    target === "chatgpt"
      ? '<button type="button" data-search data-testid="composer-button-search" aria-pressed="false">Search</button>'
      : '<button type="button" data-search aria-pressed="false">联网搜索</button>';
  const send =
    target === "chatgpt"
      ? '<button type="button" data-testid="send-button" disabled>Send</button>'
      : '<button type="button" aria-label="发送" disabled>发送</button>';

  return `<!doctype html><html><head><style>
    form { width: 640px; padding: 20px; }
    textarea, [contenteditable] { display: block; width: 600px; min-height: 120px; }
    button { width: 120px; height: 36px; }
  </style></head><body><form>${search}${composer}${send}</form><script>
    const composer = document.querySelector('textarea, [contenteditable]');
    const send = document.querySelector('[data-testid="send-button"], [aria-label="发送"]');
    const read = () => 'value' in composer ? composer.value : composer.innerText;
    composer.addEventListener('input', () => { send.disabled = !read().trim(); });
    document.querySelector('[data-search]').addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-pressed', 'true');
    });
    send.addEventListener('click', () => {
      document.documentElement.dataset.submitted = 'true';
      document.documentElement.dataset.prompt = read();
    });
  </script></body></html>`;
}

async function waitForDevToolsPort(directory) {
  const portFile = join(directory, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split("\n");
      if (port) return Number(port);
    } catch {
      // Chrome creates this file after the temporary profile is ready.
    }
    await delay(100);
  }
  throw new Error("Chrome did not publish a DevTools port");
}

async function createPageTarget(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" }
  );
  const target = await response.json();
  await delay(300);
  return target;
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.text || "Browser evaluation failed");
  }
  return response.result?.result?.value;
}

async function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let requestId = 0;
  const pending = new Map();
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message);
  });
  return {
    send(method, params = {}) {
      const id = ++requestId;
      return new Promise((resolvePromise, rejectPromise) => {
        pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
