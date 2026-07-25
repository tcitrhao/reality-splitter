import { useEffect, useMemo, useState, type FormEvent } from "react";
import { requestApiPermission } from "../shared/apiPermissions";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  getSettings,
  saveSettings
} from "../shared/storage";
import type { AIProvider, ModelRuntimeSettings, StoredSettings } from "../shared/types";

export default function App() {
  const extensionRuntimeAvailable =
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.id === "string" &&
    chrome.runtime.id.length > 0;
  const [settings, setSettings] = useState<StoredSettings>({
    quick: createDefaultModeSettings(),
    longform: createDefaultModeSettings()
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!extensionRuntimeAvailable) {
      return;
    }

    void getSettings().then(setSettings);
  }, [extensionRuntimeAvailable]);

  const quickSummary = useMemo(() => buildSummary(settings.quick), [settings.quick]);
  const longformSummary = useMemo(() => buildSummary(settings.longform), [settings.longform]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("");

    const normalizedSettings: StoredSettings = {
      quick: normalizeModeSettings(settings.quick),
      longform: normalizeModeSettings(settings.longform)
    };

    try {
      if (!extensionRuntimeAvailable) {
        throw new Error("当前打开的是本地 file:// 页面，不是 Chrome 扩展运行页。请从插件里打开后台配置。");
      }

      await requestApiPermission(normalizedSettings.quick);
      await requestApiPermission(normalizedSettings.longform);
      await saveSettings(normalizedSettings);
      setSettings(normalizedSettings);
      setStatusMessage("后台配置已保存，插件抽屉和备用侧边栏会自动读取新设置。");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "保存失败了，可以再试一次。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <header className="admin-hero">
        <div>
          <p className="admin-eyebrow">Reality Splitter Admin</p>
          <h1>插件配置后台</h1>
          <p className="admin-copy">
            这里专门管理短文模式和长文模式的模型配置。保存后，页面抽屉、右键菜单和备用侧边栏都会直接使用这里的设置。
          </p>
        </div>
        <div className="admin-summary-grid">
          <SummaryCard title="短文模式" summary={quickSummary} />
          <SummaryCard title="长文模式" summary={longformSummary} />
        </div>
      </header>

      <main className="admin-main">
        {!extensionRuntimeAvailable ? (
          <section className="admin-card admin-card--warning">
            <div className="admin-card__head">
              <h2>当前不是扩展运行环境</h2>
            </div>
            <p className="admin-help">
              你现在打开的是本地 `file://` 页面，这里不会接入真正的 Chrome 扩展能力，所以很多操作看起来能点，但不会作用到插件本身。
            </p>
            <ol className="admin-list admin-list--numbered">
              <li>先去 `chrome://extensions/` 里加载并 `Reload` 这个插件。</li>
              <li>再从插件界面的“设置 - 打开后台配置”进入后台页。</li>
              <li>那时地址会是 `chrome-extension://.../options.html`，配置才会真正生效。</li>
            </ol>
          </section>
        ) : null}

        <section className="admin-card">
          <div className="admin-card__head">
            <h2>配置中心</h2>
            <span className="admin-chip">本地后台</span>
          </div>

          <form className="admin-form" onSubmit={handleSubmit}>
            <ModeConfigSection
              title="短文模式"
              hint="适合快拆、传播标签、降刺激和替代解释。"
              value={settings.quick}
              onChange={(next) => setSettings((current) => ({ ...current, quick: next }))}
            />

            <ModeConfigSection
              title="长文模式"
              hint="适合长文核查、资料梳理和联网搜索。"
              value={settings.longform}
              onChange={(next) => setSettings((current) => ({ ...current, longform: next }))}
            />

            <div className="admin-actions">
              <button className="admin-button admin-button--primary" type="submit" disabled={saving}>
                {saving ? "保存中..." : "保存后台配置"}
              </button>
            </div>

            <p className="admin-help">
              提示：如果使用 `OpenAI-Compatible`，请填写兼容 `Chat Completions` 的 `Base URL`，例如
              `https://api.moonshot.cn/v1`、`https://api.deepseek.com/v1`。
            </p>
            {statusMessage ? <p className="admin-help admin-help--status">{statusMessage}</p> : null}
          </form>
        </section>

        <section className="admin-grid">
          <article className="admin-card">
            <div className="admin-card__head">
              <h2>推荐搭配</h2>
            </div>
            <ul className="admin-list">
              <li>`短文模式`：优先追求快、稳、结构化，适合 DeepSeek 一类模型。</li>
              <li>`长文模式`：优先追求联网和资料核查，适合 Kimi 一类支持搜索的模型。</li>
              <li>如果某个模型对 `temperature` 有严格要求，插件会尽量自动适配，但不同网关仍可能有差异。</li>
            </ul>
          </article>

          <article className="admin-card">
            <div className="admin-card__head">
              <h2>使用说明</h2>
            </div>
            <ol className="admin-list admin-list--numbered">
              <li>在这里保存配置。</li>
              <li>回到 `chrome://extensions/` 点一次插件 `Reload`。</li>
              <li>刷新 X / 微博 / 当前网页。</li>
              <li>在 X 可用页面按钮；在微博使用选中文字、右键菜单、工具栏或粘贴开始分析。</li>
            </ol>
          </article>
        </section>
      </main>
    </div>
  );
}

function ModeConfigSection({
  title,
  hint,
  value,
  onChange
}: {
  title: string;
  hint: string;
  value: ModelRuntimeSettings;
  onChange: (next: ModelRuntimeSettings) => void;
}) {
  return (
    <section className="mode-config">
      <div className="mode-config__head">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>

      <label className="admin-field">
        <span>接口类型</span>
        <select
          value={value.provider}
          onChange={(event) =>
            onChange({
              ...value,
              provider: event.target.value as AIProvider
            })
          }
        >
          <option value="openai">OpenAI 官方接口</option>
          <option value="openai-compatible">OpenAI-Compatible 自定义接口</option>
        </select>
      </label>

      <label className="admin-field">
        <span>API Key</span>
        <input
          type="password"
          autoComplete="off"
          value={value.apiKey}
          onChange={(event) =>
            onChange({
              ...value,
              apiKey: event.target.value
            })
          }
          placeholder="sk-..."
        />
      </label>

      <label className="admin-field">
        <span>模型名称</span>
        <input
          type="text"
          value={value.model}
          onChange={(event) =>
            onChange({
              ...value,
              model: event.target.value
            })
          }
          placeholder={DEFAULT_MODEL}
        />
      </label>

      {value.provider === "openai-compatible" ? (
        <label className="admin-field">
          <span>Base URL / 接口地址</span>
          <input
            type="text"
            value={value.baseUrl}
            onChange={(event) =>
              onChange({
                ...value,
                baseUrl: event.target.value
              })
            }
            placeholder="https://api.moonshot.cn/v1"
          />
        </label>
      ) : null}
    </section>
  );
}

function SummaryCard({ title, summary }: { title: string; summary: string }) {
  return (
    <article className="summary-card">
      <span className="summary-card__label">{title}</span>
      <strong>{summary}</strong>
    </article>
  );
}

function buildSummary(settings: ModelRuntimeSettings): string {
  const providerLabel =
    settings.provider === "openai-compatible" ? "自定义接口" : "OpenAI";
  const modelLabel = settings.model.trim() || DEFAULT_MODEL;
  return `${providerLabel} / ${modelLabel}`;
}

function createDefaultModeSettings(): ModelRuntimeSettings {
  return {
    provider: DEFAULT_PROVIDER,
    apiKey: "",
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL
  };
}

function normalizeModeSettings(settings: ModelRuntimeSettings): ModelRuntimeSettings {
  return {
    provider: settings.provider || DEFAULT_PROVIDER,
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || DEFAULT_MODEL,
    baseUrl:
      settings.provider === "openai" ? DEFAULT_BASE_URL : settings.baseUrl.trim() || DEFAULT_BASE_URL
  };
}
