import { DRAWER_OPEN_CLASS } from "../extension/drawer/drawerController";
import {
  BUTTON_HOST_ATTR,
  LEGACY_WEIBO_FLOATING_HOST_ID,
  LEGACY_WEIBO_OVERLAY_ID,
  WEIBO_NO_BUTTONS_CLASS
} from "../extension/entries/xEntry";

const STYLE_ID = "reality-splitter-content-style";

export function injectPageStyles() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = `
    .reality-splitter-button-host {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      pointer-events: auto;
    }

    .reality-splitter-button {
      border: 1px solid rgba(79, 98, 86, 0.35);
      border-radius: 999px;
      background: rgba(239, 245, 242, 0.95);
      color: #1f4335;
      font: 600 12px/1.2 "Avenir Next", "Segoe UI", sans-serif;
      padding: 6px 10px;
      cursor: pointer;
      transition: background 120ms ease, transform 120ms ease;
    }

    .reality-splitter-button:hover {
      background: rgba(227, 238, 232, 0.98);
      transform: translateY(-1px);
    }

    html.${WEIBO_NO_BUTTONS_CLASS} [${BUTTON_HOST_ATTR}="true"],
    html.${WEIBO_NO_BUTTONS_CLASS} #${LEGACY_WEIBO_OVERLAY_ID},
    html.${WEIBO_NO_BUTTONS_CLASS} #${LEGACY_WEIBO_FLOATING_HOST_ID} {
      display: none !important;
    }

    html.${DRAWER_OPEN_CLASS} body {
      padding-left: min(420px, calc(100vw - 28px)) !important;
      transition: padding-left 180ms ease !important;
    }

    @media (max-width: 720px) {
      html.${DRAWER_OPEN_CLASS} body {
        padding-left: 0 !important;
      }
    }

    .reality-splitter-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      z-index: 2147483647;
      transform: translateX(-50%) translateY(8px);
      max-width: min(560px, calc(100vw - 32px));
      padding: 10px 14px;
      border-radius: 14px;
      background: rgba(28, 47, 40, 0.94);
      color: #f4f7f5;
      font: 500 13px/1.4 "Avenir Next", "Segoe UI", sans-serif;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .reality-splitter-toast.is-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
}
