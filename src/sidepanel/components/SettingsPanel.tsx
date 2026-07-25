import type { StoredSettings } from "../../shared/types";

interface SettingsPanelProps {
  settings: StoredSettings;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  const handleOpenAdmin = async () => {
    const adminUrl = chrome.runtime.getURL("options.html");

    try {
      await chrome.tabs.create({ url: adminUrl });
    } catch {
      window.open(adminUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <details className="settings-panel">
      <summary>设置</summary>
      <div className="settings-summary">
        <SummaryBlock
          title="短文模式"
          value={formatModeSummary(settings.quick.provider, settings.quick.model)}
        />
        <SummaryBlock
          title="长文模式"
          value={formatModeSummary(settings.longform.provider, settings.longform.model)}
        />

        <p className="field-hint">
          详细配置已经移到独立后台页。这样你可以在更宽的页面里直接管理两套模型，不用再挤在插件界面里改。
        </p>

        <button className="secondary-button" type="button" onClick={handleOpenAdmin}>
          打开后台配置
        </button>
      </div>
    </details>
  );
}

function SummaryBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="settings-summary-card">
      <strong>{title}</strong>
      <span className="field-hint">{value}</span>
    </section>
  );
}

function formatModeSummary(provider: string, model: string): string {
  const providerLabel = provider === "openai-compatible" ? "自定义接口" : "OpenAI";
  return `${providerLabel} / ${model || "未设置模型"}`;
}
