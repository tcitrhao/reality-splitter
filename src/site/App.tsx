import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  MESSAGE_TYPES,
  type ModelConnectionTestResponse
} from "../shared/messages";
import { requestApiPermission } from "../shared/apiPermissions";
import {
  detectProviderProfile,
  validateProviderSettings,
  type ProviderProfile
} from "../shared/providerProfiles";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  getSettings,
  saveSettings
} from "../shared/storage";
import type {
  AIProvider,
  ModelRuntimeSettings,
  StoredSettings,
  WorkspaceMode
} from "../shared/types";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type ConnectionState = {
  status: "idle" | "testing" | "success" | "error";
  message: string;
};

type ModelPreset = {
  label: string;
  description: string;
  settings: Omit<ModelRuntimeSettings, "apiKey">;
};

const MODEL_PRESETS: Record<WorkspaceMode, ModelPreset[]> = {
  quick: [
    {
      label: "DeepSeek V4 Flash",
      description: "更快，适合高频短文拆解",
      settings: {
        provider: "openai-compatible",
        model: "deepseek-v4-flash",
        baseUrl: "https://api.deepseek.com/v1"
      }
    },
    {
      label: "DeepSeek V4 Pro",
      description: "更完整，适合复杂短文",
      settings: {
        provider: "openai-compatible",
        model: "deepseek-v4-pro",
        baseUrl: "https://api.deepseek.com/v1"
      }
    }
  ],
  longform: [
    {
      label: "Kimi K2.6",
      description: "适合长文和联网核查",
      settings: {
        provider: "openai-compatible",
        model: "kimi-k2.6",
        baseUrl: "https://api.moonshot.cn/v1"
      }
    }
  ]
};

const EMPTY_CONNECTION_STATE: Record<WorkspaceMode, ConnectionState> = {
  quick: {
    status: "idle",
    message: "保存前可先测试 API Key、模型名和接口地址。"
  },
  longform: {
    status: "idle",
    message: "连接测试只验证模型接口，正式联网核查仍会使用完整工具链。"
  }
};

export default function App() {
  const extensionRuntimeAvailable =
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.id === "string" &&
    chrome.runtime.id.length > 0;
  const [settings, setSettings] = useState<StoredSettings>(createDefaultSettings);
  const [savedSettings, setSavedSettings] = useState<StoredSettings>(createDefaultSettings);
  const [savingMode, setSavingMode] = useState<WorkspaceMode | "all" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [connectionStates, setConnectionStates] =
    useState<Record<WorkspaceMode, ConnectionState>>(EMPTY_CONNECTION_STATE);

  useEffect(() => {
    if (!extensionRuntimeAvailable) {
      return;
    }

    void getSettings()
      .then((storedSettings) => {
        setSettings(storedSettings);
        setSavedSettings(storedSettings);
      })
      .catch(() => {
        setNotice({
          tone: "error",
          message: "读取当前模型配置失败，请重新打开后台。"
        });
      });
  }, [extensionRuntimeAvailable]);

  const dirtyModes = useMemo(
    () => ({
      quick: !areModeSettingsEqual(settings.quick, savedSettings.quick),
      longform: !areModeSettingsEqual(settings.longform, savedSettings.longform)
    }),
    [savedSettings, settings]
  );
  const hasUnsavedChanges = dirtyModes.quick || dirtyModes.longform;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await persistSettings("all");
  };

  const updateMode = (mode: WorkspaceMode, next: ModelRuntimeSettings) => {
    setSettings((current) => ({
      ...current,
      [mode]: next
    }));
    setConnectionStates((current) => ({
      ...current,
      [mode]: {
        status: "idle",
        message: "配置已修改，请重新测试连接。"
      }
    }));
    setNotice(null);
  };

  const applyPreset = (mode: WorkspaceMode, preset: ModelPreset) => {
    updateMode(mode, {
      ...preset.settings,
      apiKey: settings[mode].apiKey
    });
  };

  const persistSettings = async (target: WorkspaceMode | "all") => {
    if (!extensionRuntimeAvailable) {
      setNotice({
        tone: "error",
        message: "请从 Chrome 扩展的“模型后台”入口打开此页面，当前预览页不能保存配置。"
      });
      return;
    }

    const modes: WorkspaceMode[] = target === "all" ? ["quick", "longform"] : [target];
    const nextSettings: StoredSettings = {
      ...savedSettings
    };

    for (const mode of modes) {
      const normalized = normalizeModeSettings(settings[mode]);
      const validationError = validateModeDraft(normalized);

      if (validationError) {
        setNotice({
          tone: "error",
          message: `${mode === "quick" ? "短文" : "长文"}模型：${validationError}`
        });
        return;
      }

      nextSettings[mode] = normalized;
    }

    setSavingMode(target);
    setNotice(null);

    try {
      for (const mode of modes) {
        await requestApiPermission(nextSettings[mode]);
      }

      await saveSettings(nextSettings);
      setSavedSettings(nextSettings);
      setSettings((current) =>
        target === "all"
          ? nextSettings
          : {
              ...current,
              [target]: nextSettings[target]
            }
      );
      setNotice({
        tone: "success",
        message:
          target === "all"
            ? "两套模型配置已保存并立即生效。"
            : `${target === "quick" ? "短文" : "长文"}模型配置已保存并立即生效。`
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "保存失败，可以再试一次。"
      });
    } finally {
      setSavingMode(null);
    }
  };

  const testConnection = async (mode: WorkspaceMode) => {
    if (!extensionRuntimeAvailable) {
      setConnectionState(mode, "error", "本地预览页无法连接扩展运行时。");
      return;
    }

    const normalized = normalizeModeSettings(settings[mode]);
    const validationError = validateModeDraft(normalized, true);

    if (validationError) {
      setConnectionState(mode, "error", validationError);
      return;
    }

    setConnectionState(mode, "testing", "正在验证接口、密钥和模型响应...");

    try {
      await requestApiPermission(normalized);
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.TEST_MODEL_CONNECTION,
        payload: {
          mode,
          settings: normalized
        }
      })) as ModelConnectionTestResponse;

      if (!response.ok || !response.data) {
        setConnectionState(mode, "error", response.error || "连接测试失败。");
        return;
      }

      const profileLabel = getProfileLabel(response.data.providerProfile);
      setConnectionState(
        mode,
        "success",
        `${profileLabel} / ${response.data.model} 已连接，响应 ${response.data.latencyMs}ms。`
      );
    } catch (error) {
      setConnectionState(
        mode,
        "error",
        error instanceof Error ? error.message : "连接测试失败。"
      );
    }
  };

  const setConnectionState = (
    mode: WorkspaceMode,
    status: ConnectionState["status"],
    message: string
  ) => {
    setConnectionStates((current) => ({
      ...current,
      [mode]: {
        status,
        message
      }
    }));
  };

  return (
    <div className="admin-shell">
      <header className="admin-hero">
        <div className="admin-hero__copy">
          <p className="admin-eyebrow">Reality Splitter / Model Control</p>
          <h1>模型管理后台</h1>
          <p className="admin-copy">
            短文和长文使用两套独立配置。这里保存的是插件当前真正生效的模型，不是演示参数。
          </p>
          <div className="admin-status-row">
            <span className={`admin-live-dot ${extensionRuntimeAvailable ? "is-live" : ""}`} />
            <span>{extensionRuntimeAvailable ? "已连接扩展运行时" : "当前为静态预览"}</span>
            {hasUnsavedChanges ? <span className="admin-unsaved">有未保存修改</span> : null}
          </div>
        </div>

        <div className="admin-summary-grid">
          <SummaryCard
            title="短文当前生效"
            settings={savedSettings.quick}
            dirty={dirtyModes.quick}
          />
          <SummaryCard
            title="长文当前生效"
            settings={savedSettings.longform}
            dirty={dirtyModes.longform}
          />
        </div>
      </header>

      <main className="admin-main">
        {!extensionRuntimeAvailable ? (
          <section className="admin-card admin-card--warning">
            <div className="admin-card__head">
              <h2>当前页面只能预览</h2>
              <span className="admin-chip admin-chip--warning">未连接插件</span>
            </div>
            <p className="admin-help">
              请在插件抽屉点击“模型后台”，或在 `chrome://extensions/` 的扩展详情中打开“扩展程序选项”。
            </p>
          </section>
        ) : null}

        <form className="admin-form" onSubmit={handleSubmit}>
          <ModeConfigSection
            mode="quick"
            title="短文模型"
            index="01"
            hint="负责拆解、降刺激、替代解释和小实验。推荐使用响应快、结构化输出稳定的模型。"
            value={settings.quick}
            dirty={dirtyModes.quick}
            saving={savingMode === "quick" || savingMode === "all"}
            connectionState={connectionStates.quick}
            presets={MODEL_PRESETS.quick}
            onChange={(next) => updateMode("quick", next)}
            onPreset={(preset) => applyPreset("quick", preset)}
            onSave={() => void persistSettings("quick")}
            onTest={() => void testConnection("quick")}
          />

          <ModeConfigSection
            mode="longform"
            title="长文模型"
            index="02"
            hint="负责长文核查与来源搜索。Kimi 配置会自动启用现有的联网工具链。"
            value={settings.longform}
            dirty={dirtyModes.longform}
            saving={savingMode === "longform" || savingMode === "all"}
            connectionState={connectionStates.longform}
            presets={MODEL_PRESETS.longform}
            onChange={(next) => updateMode("longform", next)}
            onPreset={(preset) => applyPreset("longform", preset)}
            onSave={() => void persistSettings("longform")}
            onTest={() => void testConnection("longform")}
          />

          <section className="admin-save-bar">
            <div>
              <strong>{hasUnsavedChanges ? "配置尚未全部保存" : "当前配置已同步"}</strong>
              <span>API Key 仅保存在本机 `chrome.storage.local`，不会写入项目代码。</span>
            </div>
            <button
              className="admin-button admin-button--primary"
              type="submit"
              disabled={!hasUnsavedChanges || savingMode !== null}
            >
              {savingMode === "all" ? "保存中..." : "保存全部修改"}
            </button>
          </section>
        </form>

        {notice ? (
          <div className={`admin-notice is-${notice.tone}`} role="status">
            {notice.message}
          </div>
        ) : null}

        <section className="admin-grid">
          <article className="admin-card">
            <div className="admin-card__head">
              <h2>生效规则</h2>
              <span className="admin-chip">即时读取</span>
            </div>
            <ul className="admin-list">
              <li>短文与长文分别读取自己的模型配置，可以并行运行。</li>
              <li>保存后下一次拆解立即使用新模型，无需重新构建插件。</li>
              <li>已经进行中的请求不会中途切换模型，避免结果混杂。</li>
            </ul>
          </article>

          <article className="admin-card">
            <div className="admin-card__head">
              <h2>连接测试边界</h2>
              <span className="admin-chip">30 秒超时</span>
            </div>
            <ul className="admin-list">
              <li>测试会真实请求一次模型，因此可能产生极少量 Token 费用。</li>
              <li>测试通过代表地址、密钥和模型可响应，不代表正式拆解永不失败。</li>
              <li>Kimi 正式长文核查还会继续验证搜索工具和多轮调用。</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

function ModeConfigSection({
  mode,
  title,
  index,
  hint,
  value,
  dirty,
  saving,
  connectionState,
  presets,
  onChange,
  onPreset,
  onSave,
  onTest
}: {
  mode: WorkspaceMode;
  title: string;
  index: string;
  hint: string;
  value: ModelRuntimeSettings;
  dirty: boolean;
  saving: boolean;
  connectionState: ConnectionState;
  presets: ModelPreset[];
  onChange: (next: ModelRuntimeSettings) => void;
  onPreset: (preset: ModelPreset) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const profile = detectProviderProfile(value);

  return (
    <section className={`mode-config mode-config--${mode}`}>
      <div className="mode-config__head">
        <div className="mode-config__index">{index}</div>
        <div className="mode-config__intro">
          <div className="mode-config__title-row">
            <h2>{title}</h2>
            <span className={`profile-badge is-${profile}`}>{getProfileLabel(profile)}</span>
            {dirty ? <span className="dirty-badge">未保存</span> : null}
          </div>
          <p>{hint}</p>
        </div>
      </div>

      <div className="preset-row" aria-label={`${title}快速预设`}>
        {presets.map((preset) => (
          <button
            className="preset-button"
            type="button"
            key={preset.label}
            onClick={() => onPreset(preset)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>

      <div className="field-grid">
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
            spellCheck={false}
          />
        </label>

        <label className="admin-field admin-field--wide">
          <span>Base URL / 接口地址</span>
          <input
            type="url"
            value={value.provider === "openai" ? DEFAULT_BASE_URL : value.baseUrl}
            onChange={(event) =>
              onChange({
                ...value,
                baseUrl: event.target.value
              })
            }
            placeholder="https://api.example.com/v1"
            disabled={value.provider === "openai"}
            spellCheck={false}
          />
        </label>

        <div className="admin-field admin-field--wide">
          <label htmlFor={`${mode}-api-key`}>API Key</label>
          <div className="secret-field">
            <input
              id={`${mode}-api-key`}
              type={showApiKey ? "text" : "password"}
              autoComplete="off"
              value={value.apiKey}
              onChange={(event) =>
                onChange({
                  ...value,
                  apiKey: event.target.value
                })
              }
              placeholder="sk-..."
              spellCheck={false}
            />
            <button
              type="button"
              aria-label={`${showApiKey ? "隐藏" : "显示"}${title} API Key`}
              onClick={() => setShowApiKey((current) => !current)}
            >
              {showApiKey ? "隐藏" : "显示"}
            </button>
          </div>
        </div>
      </div>

      <div className={`connection-state is-${connectionState.status}`}>
        <span className="connection-state__dot" />
        <span>{connectionState.message}</span>
      </div>

      <div className="mode-config__actions">
        <button
          className="admin-button"
          type="button"
          onClick={onTest}
          disabled={saving || connectionState.status === "testing"}
        >
          {connectionState.status === "testing" ? "测试中..." : "测试连接"}
        </button>
        <button
          className="admin-button admin-button--primary"
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? "保存中..." : `保存${title}`}
        </button>
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  settings,
  dirty
}: {
  title: string;
  settings: ModelRuntimeSettings;
  dirty: boolean;
}) {
  const profile = detectProviderProfile(settings);

  return (
    <article className="summary-card">
      <div className="summary-card__topline">
        <span>{title}</span>
        <span className={`summary-card__status ${dirty ? "is-dirty" : ""}`}>
          {dirty ? "编辑中" : "生效中"}
        </span>
      </div>
      <strong>{settings.model.trim() || DEFAULT_MODEL}</strong>
      <small>{getProfileLabel(profile)}</small>
    </article>
  );
}

function getProfileLabel(profile: ProviderProfile): string {
  switch (profile) {
    case "deepseek":
      return "DeepSeek";
    case "kimi":
      return "Kimi";
    default:
      return "通用模型";
  }
}

function createDefaultModeSettings(): ModelRuntimeSettings {
  return {
    provider: DEFAULT_PROVIDER,
    apiKey: "",
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL
  };
}

function createDefaultSettings(): StoredSettings {
  return {
    quick: createDefaultModeSettings(),
    longform: createDefaultModeSettings()
  };
}

function normalizeModeSettings(settings: ModelRuntimeSettings): ModelRuntimeSettings {
  return {
    provider: settings.provider || DEFAULT_PROVIDER,
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || DEFAULT_MODEL,
    baseUrl:
      settings.provider === "openai"
        ? DEFAULT_BASE_URL
        : settings.baseUrl.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL
  };
}

function validateModeDraft(
  settings: ModelRuntimeSettings,
  requireApiKey = false
): string | null {
  if (requireApiKey && !settings.apiKey) {
    return "需要先填写 API Key。";
  }

  if (settings.provider === "openai-compatible") {
    try {
      const url = new URL(settings.baseUrl);
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
        return "接口地址必须使用 HTTPS；本地开发地址除外。";
      }
    } catch {
      return "Base URL 格式不正确。";
    }
  }

  return validateProviderSettings(settings);
}

function areModeSettingsEqual(
  first: ModelRuntimeSettings,
  second: ModelRuntimeSettings
): boolean {
  return JSON.stringify(normalizeModeSettings(first)) === JSON.stringify(normalizeModeSettings(second));
}
