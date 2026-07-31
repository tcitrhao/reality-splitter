import { createRoot, type Root } from "react-dom/client";
import { createTabSessionStore, type TabSessionStore } from "../../application/session/tabSession";
import { PRODUCT_RELEASE } from "../../contracts/product";
import type { TweetInput, WorkspaceMode } from "../../shared/types";
import { DrawerApp, requestModelAdmin } from "./DrawerApp";
import drawerStyles from "./drawer.css?inline";

export const DRAWER_HOST_ID = "reality-splitter-inline-panel";
export const DRAWER_OPEN_CLASS = "reality-splitter-drawer-open";

export interface DrawerController {
  open: (input: TweetInput, workspaceMode: WorkspaceMode) => void;
  close: () => void;
  isOpen: () => boolean;
  updateCurrentSelection: (input: TweetInput) => boolean;
  destroy: () => void;
  store: TabSessionStore;
}

export function createDrawerController(showToast: (message: string) => void): DrawerController {
  const store = createTabSessionStore(() => window.location.href);
  let mounted: { host: HTMLElement; root: Root } | null = null;

  const ensureMounted = () => {
    if (mounted?.host.isConnected) {
      return mounted;
    }

    document.getElementById(DRAWER_HOST_ID)?.remove();

    const host = document.createElement("aside");
    host.id = DRAWER_HOST_ID;
    host.setAttribute("data-version", PRODUCT_RELEASE.version);
    host.setAttribute("data-reality-splitter-surface", "drawer");
    host.setAttribute("aria-label", "Reality Splitter");
    setCriticalHostStyles(host);

    const shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = drawerStyles;
    const rootElement = document.createElement("div");
    rootElement.id = "root";
    shadowRoot.append(style, rootElement);
    document.body.appendChild(host);

    const root = createRoot(rootElement);
    root.render(
      <DrawerApp
        store={store}
        onClose={() => close()}
        onOpenModelAdmin={async () => {
          try {
            const response = await requestModelAdmin();
            if (!response.ok) {
              showToast(response.error || "模型后台暂时无法打开，可以从扩展详情页进入设置。");
            }
          } catch {
            showToast("模型后台暂时无法打开，可以从扩展详情页进入设置。");
          }
        }}
      />
    );

    mounted = { host, root };
    return mounted;
  };

  const open = (input: TweetInput, workspaceMode: WorkspaceMode) => {
    const current = ensureMounted();
    store.open(input, workspaceMode);
    current.host.classList.add("is-open");
    current.host.style.setProperty("transform", "translate3d(0, 0, 0)", "important");
    document.documentElement.classList.add(DRAWER_OPEN_CLASS);
  };

  const close = () => {
    store.close();
    mounted?.host.classList.remove("is-open");
    mounted?.host.style.setProperty("transform", "translate3d(-104%, 0, 0)", "important");
    document.documentElement.classList.remove(DRAWER_OPEN_CLASS);
  };

  return {
    open,
    close,
    isOpen: () => store.getSnapshot().open,
    updateCurrentSelection: (input) => store.updateCurrentSelection(input),
    destroy() {
      document.documentElement.classList.remove(DRAWER_OPEN_CLASS);
      if (mounted) {
        mounted.root.unmount();
        mounted.host.remove();
        mounted = null;
      } else {
        document.getElementById(DRAWER_HOST_ID)?.remove();
      }
    },
    store
  };
}

function setCriticalHostStyles(host: HTMLElement) {
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "0 auto 0 0", "important");
  host.style.setProperty("z-index", "2147483646", "important");
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("width", "min(420px, calc(100vw - 28px))", "important");
  host.style.setProperty("height", "100dvh", "important");
  host.style.setProperty("max-width", "calc(100vw - 28px)", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("border", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("transform", "translate3d(-104%, 0, 0)", "important");
}
