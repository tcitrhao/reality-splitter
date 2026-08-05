import { useEffect, useState } from "react";
import { EXTERNAL_ASSISTANT_TARGETS } from "../../infrastructure/externalAssistants/targets";
import {
  buildPortableAnalysisPrompt,
  type PortableQuickMode
} from "../../skills/portable-analysis";
import {
  MESSAGE_TYPES,
  type ExternalAssistantResponse,
  type OpenExternalAssistantMessage,
} from "../../shared/messages";
import { PRODUCT_COPY } from "../../shared/productCopy";
import type {
  ExternalAssistantTarget,
  QuickAnalysisMode,
  WorkspaceMode
} from "../../shared/types";

interface ExternalAssistantPanelProps {
  workspaceMode: WorkspaceMode;
  text: string;
  sourceUrl?: string;
  preferredQuickMode?: QuickAnalysisMode;
}

type ExportAction = ExternalAssistantTarget | "copy";

const EXTERNAL_QUICK_METHODS: Array<{ mode: PortableQuickMode; label: string }> = [
  ...PRODUCT_COPY.actions,
  { mode: "comprehensive", label: "综合拆解" }
];

interface Feedback {
  tone: "success" | "error";
  message: string;
}

export function ExternalAssistantPanel({
  workspaceMode,
  text,
  sourceUrl,
  preferredQuickMode
}: ExternalAssistantPanelProps) {
  const [quickMode, setQuickMode] = useState<PortableQuickMode>(
    preferredQuickMode ?? "split"
  );
  const [busyAction, setBusyAction] = useState<ExportAction | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const hasText = Boolean(text.trim());

  useEffect(() => {
    if (preferredQuickMode) {
      setQuickMode(preferredQuickMode);
    }
  }, [preferredQuickMode]);

  useEffect(() => {
    setFeedback(null);
  }, [workspaceMode, text, quickMode]);

  const exportTo = async (action: ExportAction) => {
    if (!hasText || busyAction) {
      return;
    }

    setBusyAction(action);
    setFeedback(null);

    try {
      const prompt = buildPortableAnalysisPrompt({
        workspaceMode,
        quickMode,
        text,
        sourceUrl
      });
      const copied = await copyTextToClipboard(prompt);
      if (!copied) {
        setFeedback({
          tone: "error",
          message: PRODUCT_COPY.externalAssistants.copyFailed
        });
        return;
      }

      if (action === "copy") {
        setFeedback({
          tone: "success",
          message: PRODUCT_COPY.externalAssistants.copied
        });
        return;
      }

      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.OPEN_EXTERNAL_ASSISTANT,
        payload: {
          target: action,
          prompt,
          requireWebSearch: workspaceMode === "longform"
        }
      } satisfies OpenExternalAssistantMessage)) as ExternalAssistantResponse;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: `拆解指令已经复制，但${response.error || "目标网站暂时无法打开"}`
        });
        return;
      }

      if (!response.data?.submitted) {
        const reason = response.data?.filled
          ? "拆解指令已经自动填入，但没有找到发送按钮，请手动发送。"
          : "页面已经打开，但没有找到可用输入框，请登录后粘贴已复制的指令。";
        setFeedback({
          tone: "error",
          message: reason
        });
        return;
      }

      const searchNote =
        workspaceMode !== "longform"
          ? ""
          : response.data.searchStatus === "enabled"
            ? "，并已尝试开启联网搜索"
            : response.data.searchStatus === "automatic"
              ? "；ChatGPT 会按指令自动判断并调用网页搜索"
              : "；未找到联网开关，请在对话中确认是否已联网";
      setFeedback({
        tone: "success",
        message: `已发送到 ${EXTERNAL_ASSISTANT_TARGETS[action].label}${searchNote}。`
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "拆解指令暂时无法导出，请刷新页面后再试。"
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="external-assistant-panel" aria-labelledby="external-assistant-title">
      <div className="external-assistant-header">
        <div>
          <h2 id="external-assistant-title">{PRODUCT_COPY.externalAssistants.title}</h2>
          <p>{PRODUCT_COPY.externalAssistants.description}</p>
        </div>
        <span className="external-assistant-badge">
          {PRODUCT_COPY.externalAssistants.badge}
        </span>
      </div>

      {workspaceMode === "quick" ? (
        <label className="external-assistant-method">
          <span>{PRODUCT_COPY.externalAssistants.methodLabel}</span>
          <select
            value={quickMode}
            disabled={Boolean(busyAction)}
            onChange={(event) => setQuickMode(event.target.value as PortableQuickMode)}
          >
            {EXTERNAL_QUICK_METHODS.map((action) => (
              <option key={action.mode} value={action.mode}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="external-assistant-actions">
        <button
          type="button"
          className="external-assistant-button"
          disabled={!hasText || Boolean(busyAction)}
          onClick={() => void exportTo("chatgpt")}
        >
          {busyAction === "chatgpt" ? "正在发送..." : "一键发送 ChatGPT"}
        </button>
        <button
          type="button"
          className="external-assistant-button"
          disabled={!hasText || Boolean(busyAction)}
          onClick={() => void exportTo("deepseek")}
        >
          {busyAction === "deepseek" ? "正在发送..." : "一键发送 DeepSeek"}
        </button>
        <button
          type="button"
          className="external-assistant-button external-assistant-button--quiet"
          disabled={!hasText || Boolean(busyAction)}
          onClick={() => void exportTo("copy")}
        >
          {busyAction === "copy" ? "复制中..." : PRODUCT_COPY.externalAssistants.copy}
        </button>
      </div>

      <p className="external-assistant-privacy">
        {PRODUCT_COPY.externalAssistants.privacy}
      </p>
      {feedback ? (
        <p
          className={`external-assistant-feedback is-${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.documentElement.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }
}
