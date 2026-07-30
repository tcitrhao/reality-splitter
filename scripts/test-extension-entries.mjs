import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const listeners = {
  action: null,
  contextMenu: null,
  installed: null,
  startup: null,
  runtimeMessage: null
};
const sentDrawerMessages = [];
const createdMenus = [];
const storage = {};
let sidePanelOpenCount = 0;

globalThis.chrome = {
  action: {
    onClicked: {
      addListener(listener) {
        listeners.action = listener;
      }
    }
  },
  contextMenus: {
    async removeAll() {
      createdMenus.splice(0);
    },
    create(options) {
      createdMenus.push(options);
    },
    onClicked: {
      addListener(listener) {
        listeners.contextMenu = listener;
      }
    }
  },
  runtime: {
    onInstalled: {
      addListener(listener) {
        listeners.installed = listener;
      }
    },
    onStartup: {
      addListener(listener) {
        listeners.startup = listener;
      }
    },
    onMessage: {
      addListener(listener) {
        listeners.runtimeMessage = listener;
      }
    },
    async openOptionsPage() {}
  },
  scripting: {
    async executeScript() {
      return [
        {
          result: {
            text: "工具栏捕获文本",
            url: "https://example.com/toolbar"
          }
        }
      ];
    }
  },
  sidePanel: {
    async setPanelBehavior() {},
    async setOptions() {},
    async open() {
      sidePanelOpenCount += 1;
    }
  },
  storage: {
    local: {
      async get(keys) {
        const requested = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(
          requested
            .filter((key) => Object.hasOwn(storage, key))
            .map((key) => [key, storage[key]])
        );
      },
      async set(values) {
        Object.assign(storage, values);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete storage[key];
        }
      }
    }
  },
  tabs: {
    async sendMessage(tabId, message) {
      sentDrawerMessages.push({ tabId, message });
      return {
        ok: true,
        version: packageJson.version
      };
    }
  }
};

await import(`${pathToFileURL(resolve("dist/serviceWorker.js")).href}?test=${Date.now()}`);
await nextTurn();

assert.equal(typeof listeners.action, "function", "toolbar entry listener must be registered");
assert.equal(typeof listeners.contextMenu, "function", "context-menu entry listener must be registered");
assert.equal(createdMenus.length, 3, "selection menu must contain root, quick and longform items");

listeners.action({
  id: 42,
  windowId: 7,
  url: "https://example.com/page"
});
await nextTurn();

listeners.contextMenu(
  {
    menuItemId: "reality-splitter-quick",
    selectionText: "右键短文",
    pageUrl: "https://example.com/quick"
  },
  {
    id: 42,
    windowId: 7,
    url: "https://example.com/quick"
  }
);
await nextTurn();

listeners.contextMenu(
  {
    menuItemId: "reality-splitter-longform",
    selectionText: "右键长文",
    pageUrl: "https://example.com/longform"
  },
  {
    id: 42,
    windowId: 7,
    url: "https://example.com/longform"
  }
);
await nextTurn();

assert.equal(sentDrawerMessages.length, 3);
assert.deepEqual(
  sentDrawerMessages.map(({ message }) => ({
    type: message.type,
    workspaceMode: message.payload.workspaceMode,
    text: message.payload.input.text
  })),
  [
    {
      type: "REALITY_SPLITTER_SHOW_INLINE_V10",
      workspaceMode: "quick",
      text: "工具栏捕获文本"
    },
    {
      type: "REALITY_SPLITTER_SHOW_INLINE_V10",
      workspaceMode: "quick",
      text: "右键短文"
    },
    {
      type: "REALITY_SPLITTER_SHOW_INLINE_V10",
      workspaceMode: "longform",
      text: "右键长文"
    }
  ]
);
assert.equal(sidePanelOpenCount, 0, "healthy entry delivery must not open the Side Panel fallback");

console.log("Packaged toolbar and context-menu entries verified");

function nextTurn() {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
}
