import { useEffect, useRef, useState } from "react";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ActionButtons } from "./components/ActionButtons";
import { LongformWorkspace } from "./components/LongformWorkspace";
import { SettingsPanel } from "./components/SettingsPanel";
import { MESSAGE_TYPES, type AnalysisResponse } from "../shared/messages";
import {
  DEFAULT_WORKSPACE_MODE,
  createDefaultSettings,
  getCurrentInput,
  getLongformInput,
  getSettings,
  getUiError,
  getWorkspaceMode,
  setLongformInput as persistLongformInput,
  setWorkspaceMode as persistWorkspaceMode,
  STORAGE_KEYS
} from "../shared/storage";
import type {
  AIResponse,
  LongformCheckInput,
  QuickAnalysisMode,
  StoredSettings,
  TweetInput
} from "../shared/types";
import type { WorkspaceMode } from "../shared/types";
import { PRODUCT_COPY } from "../shared/productCopy";

export default function App() {
  const [settings, setSettings] = useState<StoredSettings>(createDefaultSettings);
  const [currentInput, setCurrentInputState] = useState<TweetInput | null>(null);
  const [uiError, setUiErrorState] = useState<string | null>(null);
  const [quickResponse, setQuickResponse] = useState<AIResponse | null>(null);
  const [longformResponse, setLongformResponse] = useState<AIResponse | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [longformLoading, setLongformLoading] = useState(false);
  const [quickActiveMode, setQuickActiveMode] = useState<QuickAnalysisMode | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(DEFAULT_WORKSPACE_MODE);
  const [quickError, setQuickError] = useState("");
  const [longformError, setLongformError] = useState("");
  const [longformInput, setLongformInput] = useState<LongformCheckInput>({
    articleText: "",
    referenceLinks: [],
    referenceNotes: ""
  });
  const resultAnchorRef = useRef<HTMLElement | null>(null);
  const response = workspaceMode === "longform" ? longformResponse : quickResponse;
  const loading = workspaceMode === "longform" ? longformLoading : quickLoading;
  const visibleError =
    (workspaceMode === "longform" ? longformError : quickError) || uiError;

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") {
        return;
      }

      if (changes[STORAGE_KEYS.currentInput]) {
        setCurrentInputState((changes[STORAGE_KEYS.currentInput].newValue as TweetInput | null) ?? null);
        setQuickResponse(null);
        setQuickError("");
        setQuickActiveMode(null);
      }

      if (changes[STORAGE_KEYS.workspaceMode]) {
        setWorkspaceMode(changes[STORAGE_KEYS.workspaceMode].newValue === "longform" ? "longform" : "quick");
      }

      if (changes[STORAGE_KEYS.longformInput]) {
        void getLongformInput().then((nextInput) => {
          setLongformInput(nextInput);
          setLongformResponse(null);
          setLongformError("");
        });
      }

      if (changes[STORAGE_KEYS.uiError]) {
        setUiErrorState((changes[STORAGE_KEYS.uiError].newValue as string | null) ?? null);
      }

      if (
        changes[STORAGE_KEYS.modelProfiles] ||
        changes[STORAGE_KEYS.quickDefaultProfileId] ||
        changes[STORAGE_KEYS.longformDefaultProfileId] ||
        changes[STORAGE_KEYS.quickProvider] ||
        changes[STORAGE_KEYS.quickApiKey] ||
        changes[STORAGE_KEYS.quickModel] ||
        changes[STORAGE_KEYS.quickBaseUrl] ||
        changes[STORAGE_KEYS.longformProvider] ||
        changes[STORAGE_KEYS.longformApiKey] ||
        changes[STORAGE_KEYS.longformModel] ||
        changes[STORAGE_KEYS.longformBaseUrl]
      ) {
        void getSettings().then(setSettings);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    if ((!response && !visibleError) || loading) {
      return;
    }

    resultAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, [response, visibleError, loading]);

  const handleWorkspaceChange = (nextMode: WorkspaceMode) => {
    setWorkspaceMode(nextMode);
    void persistWorkspaceMode(nextMode);
  };

  const handleLongformChange = (nextInput: LongformCheckInput) => {
    const liteInput = {
      articleText: nextInput.articleText,
      referenceLinks: [],
      referenceNotes: ""
    };
    setLongformInput(liteInput);
    setLongformResponse(null);
    setLongformError("");
    void persistLongformInput(liteInput);
  };

  const handleRun = async (mode: QuickAnalysisMode) => {
    if (!currentInput?.text) {
      setQuickError("还没有可分析的文本，请粘贴内容，或通过右键菜单发送选中文字。");
      return;
    }

    setQuickLoading(true);
    setQuickActiveMode(mode);
    setQuickError("");

    try {
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RUN_ANALYSIS,
        payload: { mode }
      })) as AnalysisResponse;

      if (!result.ok || !result.data) {
        setQuickError(result.error || "这次分析失败了，可以稍后再试。");
        return;
      }

      setQuickResponse(result.data);
      setUiErrorState(null);
    } catch {
      setQuickError("这次分析失败了，可以稍后再试。");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleRunLongform = async () => {
    if (!longformInput.articleText.trim()) {
      setLongformError("先贴一段想拆解的长文内容，再开始核查。");
      return;
    }

    setLongformLoading(true);
    setLongformError("");

    try {
      const liteInput = {
        articleText: longformInput.articleText,
        referenceLinks: [],
        referenceNotes: ""
      };
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RUN_LONGFORM_CHECK,
        payload: liteInput
      })) as AnalysisResponse;

      if (!result.ok || !result.data) {
        setLongformError(result.error || "长文核查这次失败了，可以稍后再试。");
        return;
      }

      setLongformResponse(result.data);
      setUiErrorState(null);
    } catch {
      setLongformError("长文核查这次失败了，可以稍后再试。");
    } finally {
      setLongformLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">{PRODUCT_COPY.brand}</p>
        <h1>{PRODUCT_COPY.title}</h1>
        <p className="hero-copy">
          {workspaceMode === "quick"
            ? PRODUCT_COPY.modes.quick.description
            : PRODUCT_COPY.modes.longform.description}
        </p>
      </header>

      <div className="workspace-tabs" role="tablist" aria-label="分析模式">
        <button
          type="button"
          role="tab"
          aria-selected={workspaceMode === "quick"}
          className={`workspace-tab ${workspaceMode === "quick" ? "is-active" : ""}`}
          onClick={() => handleWorkspaceChange("quick")}
        >
          <span className="workspace-tab__title">{PRODUCT_COPY.modes.quick.title}</span>
          <span className="workspace-tab__meta">{PRODUCT_COPY.modes.quick.meta}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceMode === "longform"}
          className={`workspace-tab ${workspaceMode === "longform" ? "is-active" : ""}`}
          onClick={() => handleWorkspaceChange("longform")}
        >
          <span className="workspace-tab__title">{PRODUCT_COPY.modes.longform.title}</span>
          <span className="workspace-tab__meta">{PRODUCT_COPY.modes.longform.meta}</span>
        </button>
      </div>

      {workspaceMode === "quick" ? (
        <section className="mode-panel">
          <section className="input-panel">
            <div className="panel-header">
              <h2>{PRODUCT_COPY.input.quickTitle}</h2>
              {currentInput?.author ? <span className="meta-chip">{currentInput.author}</span> : null}
            </div>
            <div className="input-box">
              {currentInput?.text ? (
                <p>{currentInput.text}</p>
              ) : (
                <p className="muted-text">
                  {PRODUCT_COPY.input.quickEmpty}
                </p>
              )}
            </div>
            {currentInput?.url ? (
              <a className="input-link" href={currentInput.url} target="_blank" rel="noreferrer">
                打开来源
              </a>
            ) : null}
          </section>

          <ActionButtons
            activeMode={quickActiveMode}
            disabled={!currentInput?.text}
            loading={quickLoading}
            onRun={handleRun}
          />
        </section>
      ) : (
        <LongformWorkspace
          active={workspaceMode === "longform"}
          value={longformInput}
          loading={longformLoading}
          onChange={handleLongformChange}
          onRun={handleRunLongform}
        />
      )}

      {visibleError ? <div className="error-banner">{visibleError}</div> : null}

      <section ref={resultAnchorRef}>
        <AnalysisPanel
          response={response}
          activeMode={workspaceMode === "longform" ? "longform" : quickActiveMode}
        />
      </section>

      <SettingsPanel settings={settings} />
    </main>
  );

  async function loadInitialState() {
    const [storedSettings, storedInput, storedError] = await Promise.all([
      getSettings(),
      getCurrentInput(),
      getUiError()
    ]);
    const [storedWorkspaceMode, storedLongformInput] = await Promise.all([
      getWorkspaceMode(),
      getLongformInput()
    ]);

    setSettings(storedSettings);
    setCurrentInputState(storedInput);
    setUiErrorState(storedError);
    setWorkspaceMode(storedWorkspaceMode);
    setLongformInput(storedLongformInput);
  }
}
