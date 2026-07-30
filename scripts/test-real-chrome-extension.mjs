import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGE_VERSION = JSON.parse(
  await readFile(join(ROOT, "package.json"), "utf8")
).version;
const CHROME_BINARY = process.env.CHROME_BINARY;
const TIMEOUT_MS = 15_000;

if (!CHROME_BINARY) {
  throw new Error(
    "Set CHROME_BINARY to Chrome for Testing or Chromium. " +
      "Official branded Chrome no longer supports --load-extension."
  );
}

const tempRoot = await mkdtemp(join(tmpdir(), "reality-splitter-chrome-"));
const extensionDir = join(tempRoot, "extension");
const profileDir = join(tempRoot, "profile");
let chromeProcess;
let server;
let debugPort;
let chromeStderr = "";
const runtimeEvents = [];

try {
  await cp(join(ROOT, "dist"), extensionDir, { recursive: true });
  await mkdir(profileDir, { recursive: true });
  await prepareProbeExtension(extensionDir);

  server = createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(`<!doctype html>
      <html lang="zh-CN">
        <head><meta charset="UTF-8"><title>Reality Splitter Chrome Probe</title></head>
        <body><main><p>真实 Chrome 扩展环境测试页。</p></main></body>
      </html>`);
  });

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate the Chrome probe server port");
  }

  const pageUrl = `http://127.0.0.1:${address.port}/`;
  chromeProcess = spawn(
    CHROME_BINARY,
    [
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-position=-10000,-10000",
      `--user-data-dir=${profileDir}`,
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "--remote-debugging-port=0",
      "about:blank"
    ],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  chromeProcess.stderr.on("data", (chunk) => {
    chromeStderr += chunk.toString();
  });

  debugPort = await waitForDevToolsPort(profileDir);
  const pageTarget = await waitForTarget(
    debugPort,
    (target) => target.type === "page"
  );
  const client = await createCdpClient(pageTarget.webSocketDebuggerUrl, (event) => {
    if (
      event.method === "Runtime.exceptionThrown" ||
      event.method === "Runtime.consoleAPICalled"
    ) {
      runtimeEvents.push(event);
    }
  });

  try {
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    const serviceWorkerTarget = await waitForTarget(
      debugPort,
      (target) =>
        target.type === "service_worker" &&
        target.url.startsWith("chrome-extension://") &&
        target.url.endsWith("/serviceWorker.js")
    );
    await client.send("Page.navigate", { url: pageUrl });
    await delay(500);

    const serviceWorkerClient = await createCdpClient(serviceWorkerTarget.webSocketDebuggerUrl);
    try {
      await serviceWorkerClient.send("Runtime.enable");
      const injection = await evaluateValue(
        serviceWorkerClient,
        `(async () => {
          const tabs = await chrome.tabs.query({});
          const tab =
            tabs.find((candidate) => candidate.url === ${JSON.stringify(pageUrl)}) ||
            tabs.find((candidate) => candidate.active);
          if (!tab?.id) {
            return {
              ok: false,
              error: "Probe tab was not visible to the extension",
              tabs,
              manifest: chrome.runtime.getManifest()
            };
          }

          try {
            const result = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["contentScript.js", "realChromeProbe.js"]
            });
            return {
              ok: true,
              tabId: tab.id,
              resultCount: result.length,
              manifest: chrome.runtime.getManifest()
            };
          } catch (error) {
            return {
              ok: false,
              tabId: tab.id,
              error: error instanceof Error ? error.message : String(error),
              manifest: chrome.runtime.getManifest()
            };
          }
        })()`
      );
      console.log("Chrome injection diagnostic");
      console.log(JSON.stringify(injection, null, 2));
    } finally {
      serviceWorkerClient.close();
    }

    const probe = await waitForProbe(client);
    if (!probe.ok) {
      throw new Error(`Chrome extension probe failed: ${JSON.stringify(probe)}`);
    }

    console.log("Real Chrome extension smoke test passed");
    console.log(JSON.stringify(probe, null, 2));
  } finally {
    client.close();
  }
} catch (error) {
  console.error(await collectDiagnostics());
  if (chromeProcess) {
    chromeProcess.kill("SIGTERM");
  }
  throw error;
} finally {
  if (chromeProcess && !chromeProcess.killed) {
    chromeProcess.kill("SIGTERM");
  }
  await new Promise((resolvePromise) => server?.close(resolvePromise));
  await rm(tempRoot, { recursive: true, force: true });
}

async function collectDiagnostics() {
  let targets = [];
  if (debugPort) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      targets = await response.json();
    } catch {
      // The Chrome process may already be stopping after a startup failure.
    }
  }

  return JSON.stringify(
    {
      targets: targets.map((target) => ({
        type: target.type,
        url: target.url,
        title: target.title
      })),
      runtimeEvents,
      chromeStderr: chromeStderr.trim().split("\n").slice(-40)
    },
    null,
    2
  );
}

async function prepareProbeExtension(directory) {
  const manifestPath = join(directory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = [
    ...new Set([...(manifest.host_permissions || []), "http://127.0.0.1/*"])
  ];
  manifest.content_scripts = [
    {
      matches: ["http://127.0.0.1/*"],
      js: ["realChromeProbe.js", "contentScript.js"],
      run_at: "document_idle"
    }
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await writeFile(
    join(directory, "realChromeProbe.js"),
    `setTimeout(async () => {
      const result = {
        booted: window.__realitySplitterBooted || null,
        runtimeResponse: null,
        runtimeError: null
      };

      try {
        result.runtimeResponse = await chrome.runtime.sendMessage({
          type: "CAPTURE_INPUT",
          payload: {
            input: {
              text: "真实 Chrome 扩展环境中的测试内容。",
              url: window.location.href
            },
            openPanel: true,
            source: "selection"
          }
        });
      } catch (error) {
        result.runtimeError = error instanceof Error ? error.message : String(error);
      }

      setTimeout(() => {
        const host = document.getElementById("reality-splitter-inline-panel");
        result.drawer = {
          exists: Boolean(host),
          open: host?.classList.contains("is-open") || false,
          version: host?.getAttribute("data-version") || null,
          hasShadowRoot: Boolean(host?.shadowRoot),
          text: host?.shadowRoot?.textContent?.trim().slice(0, 120) || ""
        };
        result.ok =
          result.booted === ${JSON.stringify(PACKAGE_VERSION)} &&
          result.runtimeResponse?.ok === true &&
          result.drawer.exists &&
          result.drawer.open &&
          result.drawer.hasShadowRoot;
        document.documentElement.setAttribute(
          "data-reality-splitter-chrome-probe",
          JSON.stringify(result)
        );
      }, 800);
    }, 500);
    `
  );
}

async function waitForDevToolsPort(directory) {
  const portFile = join(directory, "DevToolsActivePort");
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split("\n");
      if (port) {
        return Number(port);
      }
    } catch {
      // Chrome creates the port file after its profile has initialized.
    }
    await delay(100);
  }

  throw new Error("Chrome did not publish a DevTools port");
}

async function waitForTarget(port, predicate) {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await response.json();
    const target = targets.find(predicate);
    if (target) {
      return target;
    }
    await delay(100);
  }

  throw new Error("Chrome probe page target was not created");
}

async function waitForProbe(client) {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const evaluation = await client.send("Runtime.evaluate", {
      expression:
        "document.documentElement.getAttribute('data-reality-splitter-chrome-probe')",
      returnByValue: true
    });
    const value = evaluation.result?.result?.value;
    if (value) {
      return JSON.parse(value);
    }
    await delay(100);
  }

  throw new Error("Real Chrome content-script probe did not finish");
}

async function evaluateValue(client, expression) {
  const evaluation = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (evaluation.result?.exceptionDetails) {
    throw new Error(evaluation.result.exceptionDetails.text || "Chrome evaluation failed");
  }
  return evaluation.result?.result?.value;
}

async function createCdpClient(webSocketUrl, onEvent) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();

  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      onEvent?.(message);
      return;
    }

    const request = pending.get(message.id);
    if (!request) {
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      request.reject(new Error(message.error.message));
    } else {
      request.resolve(message);
    }
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolvePromise, rejectPromise) => {
        pending.set(id, {
          resolve: resolvePromise,
          reject: rejectPromise
        });
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
