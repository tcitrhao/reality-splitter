import { useState } from "react";
import { detectProviderProfile } from "../../shared/providerProfiles";
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "../../shared/storage";
import type { AIProvider, ModelProfile, WorkspaceMode } from "../../shared/types";
import {
  getProfileLabel,
  type ConnectionState
} from "../modelAdmin";

export function ModelProfileCard({
  index,
  profile,
  defaultModes,
  dirty,
  saving,
  connectionState,
  onChange,
  onDelete,
  onTest
}: {
  index: number;
  profile: ModelProfile;
  defaultModes: WorkspaceMode[];
  dirty: boolean;
  saving: boolean;
  connectionState: ConnectionState;
  onChange: (next: ModelProfile) => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const providerProfile = detectProviderProfile(profile);

  return (
    <article className="model-profile-card">
      <div className="model-profile-card__head">
        <div>
          <span className="model-profile-card__index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="model-profile-card__title">
            <strong>{profile.name.trim() || `模型配置 ${index + 1}`}</strong>
            <span className={`profile-badge is-${providerProfile}`}>
              {getProfileLabel(providerProfile)}
            </span>
            {defaultModes.map((mode) => (
              <span className="admin-chip" key={mode}>
                {mode === "quick" ? "短文默认" : "长文默认"}
              </span>
            ))}
            {dirty ? <span className="dirty-badge">未保存</span> : null}
          </div>
        </div>
        <button
          className="admin-button admin-button--danger"
          type="button"
          onClick={onDelete}
          disabled={saving}
        >
          删除
        </button>
      </div>

      <div className="field-grid">
        <label className="admin-field">
          <span>配置名称</span>
          <input
            type="text"
            value={profile.name}
            onChange={(event) => onChange({ ...profile, name: event.target.value })}
            placeholder={`模型配置 ${index + 1}`}
          />
        </label>

        <label className="admin-field">
          <span>接口类型</span>
          <select
            value={profile.provider}
            onChange={(event) => {
              const provider = event.target.value as AIProvider;
              onChange({
                ...profile,
                provider,
                baseUrl:
                  provider === "openai"
                    ? DEFAULT_BASE_URL
                    : profile.baseUrl === DEFAULT_BASE_URL
                      ? ""
                      : profile.baseUrl
              });
            }}
          >
            <option value="openai">OpenAI 官方接口</option>
            <option value="openai-compatible">OpenAI-Compatible 自定义接口</option>
          </select>
        </label>

        <label className="admin-field">
          <span>模型名称</span>
          <input
            type="text"
            value={profile.model}
            onChange={(event) => onChange({ ...profile, model: event.target.value })}
            placeholder={DEFAULT_MODEL}
            spellCheck={false}
          />
        </label>

        <label className="admin-field">
          <span>Base URL / 接口地址</span>
          <input
            type="url"
            value={profile.provider === "openai" ? DEFAULT_BASE_URL : profile.baseUrl}
            onChange={(event) => onChange({ ...profile, baseUrl: event.target.value })}
            placeholder="https://api.example.com/v1"
            disabled={profile.provider === "openai"}
            spellCheck={false}
          />
        </label>

        <div className="admin-field admin-field--wide">
          <label htmlFor={`${profile.id}-api-key`}>API Key</label>
          <div className="secret-field">
            <input
              id={`${profile.id}-api-key`}
              type={showApiKey ? "text" : "password"}
              autoComplete="off"
              value={profile.apiKey}
              onChange={(event) => onChange({ ...profile, apiKey: event.target.value })}
              placeholder="sk-..."
              spellCheck={false}
            />
            <button
              type="button"
              aria-label={`${showApiKey ? "隐藏" : "显示"}${profile.name} API Key`}
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
      </div>
    </article>
  );
}
