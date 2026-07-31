import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  MESSAGE_TYPES,
  type ModelConnectionTestResponse
} from "../shared/messages";
import { requestApiPermission } from "../shared/apiPermissions";
import { detectProviderProfile } from "../shared/providerProfiles";
import {
  createDefaultSettings,
  createStoredSettings,
  getSettings,
  saveSettings
} from "../shared/storage";
import type {
  ModelProfile,
  StoredSettings,
  WorkspaceMode
} from "../shared/types";
import { ModelProfileCard } from "./components/ModelProfileCard";
import {
  areAdminSettingsEqual,
  createBlankProfile,
  createPresetProfile,
  DEFAULT_CONNECTION_MESSAGE,
  getDraftDefault,
  getProfileLabel,
  isDefaultDirty,
  MODEL_PRESETS,
  normalizeProfileDraft,
  validateProfileDraft,
  type ConnectionState,
  type ModelPreset
} from "./modelAdmin";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

export default function App() {
  const extensionRuntimeAvailable =
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.id === "string" &&
    chrome.runtime.id.length > 0;
  const [settings, setSettings] = useState<StoredSettings>(createDefaultSettings);
  const [savedSettings, setSavedSettings] =
    useState<StoredSettings>(createDefaultSettings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [connectionStates, setConnectionStates] = useState<
    Record<string, ConnectionState>
  >({});

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

  const hasUnsavedChanges = useMemo(
    () => !areAdminSettingsEqual(settings, savedSettings),
    [savedSettings, settings]
  );
  const quickDefault = getDraftDefault(savedSettings, "quick");
  const longformDefault = getDraftDefault(savedSettings, "longform");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await persistSettings();
  };

  const updateProfile = (profileId: string, next: ModelProfile) => {
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === profileId ? next : profile
      )
    }));
    setConnectionState(profileId, "idle", "配置已修改，请重新测试连接。");
    setNotice(null);
  };

  const addBlankProfile = () => {
    const profile = createBlankProfile(settings.profiles.length);
    setSettings((current) => ({
      ...current,
      profiles: [...current.profiles, profile]
    }));
    setNotice({
      tone: "info",
      message: "已新增一项空白 API 配置，填写后记得保存全部修改。"
    });
  };

  const addPresetProfile = (preset: ModelPreset) => {
    const profile = createPresetProfile(preset, settings.profiles);
    setSettings((current) => ({
      ...current,
      profiles: [...current.profiles, profile]
    }));
    setNotice({
      tone: "info",
      message: `已新增 ${preset.label}，补充 API Key 后即可测试和保存。`
    });
  };

  const removeProfile = (profileId: string) => {
    if (settings.profiles.length === 1) {
      setNotice({
        tone: "error",
        message: "至少需要保留一个模型配置。"
      });
      return;
    }

    const target = settings.profiles.find((profile) => profile.id === profileId);
    if (!window.confirm(`确认删除“${target?.name || "这项模型配置"}”吗？`)) {
      return;
    }

    setSettings((current) => {
      const profiles = current.profiles.filter((profile) => profile.id !== profileId);
      const fallbackId = profiles[0].id;
      return {
        ...current,
        profiles,
        defaultProfileIds: {
          quick:
            current.defaultProfileIds.quick === profileId
              ? fallbackId
              : current.defaultProfileIds.quick,
          longform:
            current.defaultProfileIds.longform === profileId
              ? fallbackId
              : current.defaultProfileIds.longform
        }
      };
    });
    setConnectionStates((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    setNotice(null);
  };

  const setDefaultProfile = (mode: WorkspaceMode, profileId: string) => {
    setSettings((current) => ({
      ...current,
      defaultProfileIds: {
        ...current.defaultProfileIds,
        [mode]: profileId
      }
    }));
    setNotice(null);
  };

  const persistSettings = async () => {
    if (!extensionRuntimeAvailable) {
      setNotice({
        tone: "error",
        message: "请从 Chrome 扩展的“模型后台”入口打开此页面，当前预览页不能保存配置。"
      });
      return;
    }

    const duplicateName = findDuplicateName(settings.profiles);
    if (duplicateName) {
      setNotice({
        tone: "error",
        message: `配置名称“${duplicateName}”重复，请使用不同名称。`
      });
      return;
    }

    for (const profile of settings.profiles) {
      const validationError = validateProfileDraft(profile, true);
      if (validationError) {
        setNotice({
          tone: "error",
          message: `${profile.name || "未命名配置"}：${validationError}`
        });
        return;
      }
    }

    const normalized = createStoredSettings(
      settings.profiles.map(normalizeProfileDraft),
      settings.defaultProfileIds
    );
    setSaving(true);
    setNotice(null);

    try {
      for (const profile of normalized.profiles) {
        await requestApiPermission(profile);
      }

      const saved = await saveSettings(normalized);
      setSavedSettings(saved);
      setSettings(saved);
      setNotice({
        tone: "success",
        message: "模型配置库与两种模式的默认模型已保存，并从下一次分析开始生效。"
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "保存失败，可以再试一次。"
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (profile: ModelProfile) => {
    if (!extensionRuntimeAvailable) {
      setConnectionState(profile.id, "error", "本地预览页无法连接扩展运行时。");
      return;
    }

    const validationError = validateProfileDraft(profile, true);
    if (validationError) {
      setConnectionState(profile.id, "error", validationError);
      return;
    }

    const normalized = normalizeProfileDraft(profile);
    const mode: WorkspaceMode =
      settings.defaultProfileIds.longform === profile.id ? "longform" : "quick";
    setConnectionState(profile.id, "testing", "正在验证接口、密钥和模型响应...");

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
        setConnectionState(profile.id, "error", response.error || "连接测试失败。");
        return;
      }

      setConnectionState(
        profile.id,
        "success",
        `${getProfileLabel(response.data.providerProfile)} / ${response.data.model} 已连接，响应 ${response.data.latencyMs}ms。`
      );
    } catch (error) {
      setConnectionState(
        profile.id,
        "error",
        error instanceof Error ? error.message : "连接测试失败。"
      );
    }
  };

  const setConnectionState = (
    profileId: string,
    status: ConnectionState["status"],
    message: string
  ) => {
    setConnectionStates((current) => ({
      ...current,
      [profileId]: { status, message }
    }));
  };

  return (
    <div className="admin-shell">
      <header className="admin-hero">
        <div className="admin-hero__copy">
          <p className="admin-eyebrow">Reality Splitter / Model Control</p>
          <h1>模型管理后台</h1>
          <p className="admin-copy">
            保存多个模型 API，再分别指定短文和长文的默认调用模型。切换默认项后，下一次分析立即生效。
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
            profile={quickDefault}
            dirty={isDefaultDirty("quick", settings, savedSettings)}
          />
          <SummaryCard
            title="长文当前生效"
            profile={longformDefault}
            dirty={isDefaultDirty("longform", settings, savedSettings)}
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
          <DefaultAssignments
            settings={settings}
            onChange={setDefaultProfile}
          />

          <section className="model-library">
            <div className="mode-config__head">
              <div className="mode-config__index">02</div>
              <div className="mode-config__intro model-library__intro">
                <div className="mode-config__title-row">
                  <h2>API 配置库</h2>
                  <span className="admin-chip">{settings.profiles.length} 个配置</span>
                </div>
                <p>每项配置包含接口、模型名称与本机 API Key，可供短文和长文复用。</p>
              </div>
              <button
                className="admin-button admin-button--primary model-library__add"
                type="button"
                onClick={addBlankProfile}
                disabled={saving}
              >
                新增 API 配置
              </button>
            </div>

            <div className="preset-row" aria-label="快速新增模型预设">
              {MODEL_PRESETS.map((preset) => (
                <button
                  className="preset-button"
                  type="button"
                  key={preset.label}
                  onClick={() => addPresetProfile(preset)}
                  disabled={saving}
                >
                  <strong>+ {preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>

            <div className="model-profile-list">
              {settings.profiles.map((profile, index) => {
                const defaultModes: WorkspaceMode[] = (["quick", "longform"] as const).filter(
                  (mode) => settings.defaultProfileIds[mode] === profile.id
                );
                const savedProfile = savedSettings.profiles.find(
                  (item) => item.id === profile.id
                );
                return (
                  <ModelProfileCard
                    key={profile.id}
                    index={index}
                    profile={profile}
                    defaultModes={defaultModes}
                    dirty={!savedProfile || JSON.stringify(profile) !== JSON.stringify(savedProfile)}
                    saving={saving}
                    connectionState={connectionStates[profile.id] ?? {
                      status: "idle",
                      message: DEFAULT_CONNECTION_MESSAGE
                    }}
                    onChange={(next) => updateProfile(profile.id, next)}
                    onDelete={() => removeProfile(profile.id)}
                    onTest={() => void testConnection(profile)}
                  />
                );
              })}
            </div>
          </section>

          <section className="admin-save-bar">
            <div>
              <strong>{hasUnsavedChanges ? "配置尚未保存" : "当前配置已同步"}</strong>
              <span>API Key 仅保存在本机 `chrome.storage.local`，不会写入项目代码。</span>
            </div>
            <button
              className="admin-button admin-button--primary"
              type="submit"
              disabled={!hasUnsavedChanges || saving}
            >
              {saving ? "保存中..." : "保存全部修改"}
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
              <li>短文和长文可以共享同一个配置，也可以使用不同模型。</li>
              <li>切换默认模型后，下一次拆解立即生效，无需重新构建插件。</li>
              <li>进行中的请求不会中途换模型，避免结果混杂。</li>
            </ul>
          </article>

          <article className="admin-card">
            <div className="admin-card__head">
              <h2>数据边界</h2>
              <span className="admin-chip">仅保存在本机</span>
            </div>
            <ul className="admin-list">
              <li>不同用户拥有各自的模型配置库，发布者无法读取或远程修改。</li>
              <li>测试会真实请求一次模型，因此可能产生极少量 Token 费用。</li>
              <li>连接成功只代表接口可响应，不代表所有分析输入都能稳定通过。</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

function DefaultAssignments({
  settings,
  onChange
}: {
  settings: StoredSettings;
  onChange: (mode: WorkspaceMode, profileId: string) => void;
}) {
  return (
    <section className="default-config">
      <div className="mode-config__head">
        <div className="mode-config__index">01</div>
        <div className="mode-config__intro">
          <div className="mode-config__title-row">
            <h2>默认调用模型</h2>
          </div>
          <p>为两种工作区选择默认配置；同一项 API 可以同时被两种模式使用。</p>
        </div>
      </div>

      <div className="default-assignment-grid">
        <DefaultAssignment
          mode="quick"
          title="短文模式"
          description="拆解、降刺激、替代解释与小实验"
          settings={settings}
          onChange={onChange}
        />
        <DefaultAssignment
          mode="longform"
          title="长文模式"
          description="长文核查、来源搜索与证据整理"
          settings={settings}
          onChange={onChange}
        />
      </div>
    </section>
  );
}

function DefaultAssignment({
  mode,
  title,
  description,
  settings,
  onChange
}: {
  mode: WorkspaceMode;
  title: string;
  description: string;
  settings: StoredSettings;
  onChange: (mode: WorkspaceMode, profileId: string) => void;
}) {
  const selected = getDraftDefault(settings, mode);
  return (
    <label className={`default-assignment is-${mode}`}>
      <span className="default-assignment__label">{title}</span>
      <strong>{selected.name}</strong>
      <small>{description}</small>
      <select
        value={settings.defaultProfileIds[mode]}
        onChange={(event) => onChange(mode, event.target.value)}
      >
        {settings.profiles.map((profile) => (
          <option value={profile.id} key={profile.id}>
            {profile.name || "未命名配置"} / {profile.model || "未填写模型"}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({
  title,
  profile,
  dirty
}: {
  title: string;
  profile: ModelProfile;
  dirty: boolean;
}) {
  const providerProfile = detectProviderProfile(profile);
  return (
    <article className="summary-card">
      <div className="summary-card__topline">
        <span>{title}</span>
        <span className={`summary-card__status ${dirty ? "is-dirty" : ""}`}>
          {dirty ? "编辑中" : "生效中"}
        </span>
      </div>
      <strong>{profile.name}</strong>
      <small>
        {profile.model} / {getProfileLabel(providerProfile)}
      </small>
    </article>
  );
}

function findDuplicateName(profiles: ModelProfile[]): string | null {
  const names = new Set<string>();
  for (const profile of profiles) {
    const normalizedName = profile.name.trim().toLocaleLowerCase();
    if (names.has(normalizedName)) {
      return profile.name.trim();
    }
    names.add(normalizedName);
  }
  return null;
}
