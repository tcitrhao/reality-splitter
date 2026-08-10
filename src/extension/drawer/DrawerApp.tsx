import { useSyncExternalStore } from "react";
import type { TabSessionStore } from "../../application/session/tabSession";
import { MESSAGE_TYPES, type AnalysisResponse, type RuntimeResponse } from "../../shared/messages";
import { PRODUCT_COPY } from "../../shared/productCopy";
import { ActionButtons } from "../../sidepanel/components/ActionButtons";
import {
  AnalysisPanel,
  ComprehensiveAnalysisPanel
} from "../../sidepanel/components/AnalysisPanel";
import {
  buildPipelineContext,
  runComprehensiveAnalysisPipeline
} from "../../skills/quick-analysis/pipeline";
import { ExternalAssistantPanel } from "./ExternalAssistantPanel";

interface DrawerAppProps {
  store: TabSessionStore;
  onClose: () => void;
  onOpenModelAdmin: () => Promise<void>;
}

export function DrawerApp({ store, onClose, onOpenModelAdmin }: DrawerAppProps) {
  const session = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const quick = session.quick;
  const longform = session.longform;
  const isLongform = session.workspaceMode === "longform";
  const response = isLongform ? longform.response : quick.response;
  const error = isLongform ? longform.error : quick.error;
  const loading = isLongform ? longform.loading : quick.loading;

  const runQuickAnalysis = async (mode: Parameters<typeof store.beginQuickRequest>[0]) => {
    const pending = store.beginQuickRequest(mode);
    if (!pending) {
      return;
    }

    try {
      await runComprehensiveAnalysisPipeline({
        onStepStart: (stepMode) => {
          store.setQuickRequestStep(pending.requestId, stepMode);
        },
        onStepComplete: (stepMode, response) => {
          store.resolveQuickRequestStep(pending.requestId, stepMode, response);
        },
        execute: async (stepMode, analysisContext) => {
          if (store.getSnapshot().quick.requestId !== pending.requestId) {
            throw new Error("ANALYSIS_CANCELLED");
          }

          const result = (await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.RUN_INLINE_ANALYSIS,
            payload: {
              mode: stepMode,
              input: pending.input,
              focusedSplit: stepMode === "split",
              analysisContext
            }
          })) as AnalysisResponse;

          if (!result.ok || !result.data) {
            throw new Error(result.error || "这一步分析失败了，可以稍后再试。");
          }

          return result.data;
        }
      });
      store.finishQuickRequest(pending.requestId);
    } catch (error) {
      if (store.getSnapshot().quick.requestId !== pending.requestId) {
        return;
      }

      store.finishQuickRequest(
        pending.requestId,
        error instanceof Error && error.message !== "ANALYSIS_CANCELLED"
          ? error.message
          : "扩展暂时没有响应，可以刷新页面后再试。"
      );
    }
  };

  const runQuickFollowUp = async (
    mode: Parameters<typeof store.beginQuickFollowUpRequest>[0]
  ) => {
    const pending = store.beginQuickFollowUpRequest(mode);
    if (!pending) {
      return;
    }

    try {
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RUN_INLINE_ANALYSIS,
        payload: {
          mode: pending.mode,
          input: pending.input,
          freshPerspective: true,
          focusedSplit: pending.mode === "split",
          analysisContext: buildPipelineContext(quick.comprehensiveResponses)
        }
      })) as AnalysisResponse;

      store.resolveQuickFollowUpRequest(
        pending.requestId,
        result.ok && result.data
          ? { response: result.data }
          : { error: result.error || "这次换视角失败了，可以稍后再试。" }
      );
    } catch {
      store.resolveQuickFollowUpRequest(pending.requestId, {
        error: "扩展暂时没有响应，可以刷新页面后再试。"
      });
    }
  };

  const runLongformCheck = async () => {
    const pending = store.beginLongformRequest();
    if (!pending) {
      return;
    }

    try {
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RUN_INLINE_LONGFORM_CHECK,
        payload: pending.input
      })) as AnalysisResponse;

      store.resolveLongformRequest(
        pending.requestId,
        result.ok && result.data
          ? { response: result.data }
          : { error: result.error || "长文核查这次失败了，可以稍后再试。" }
      );
    } catch {
      store.resolveLongformRequest(pending.requestId, {
        error: "扩展暂时没有响应，可以刷新页面后再试。"
      });
    }
  };

  return (
    <div className="drawer-shell" data-workspace={session.workspaceMode}>
      <header className="drawer-header">
        <div className="drawer-brand">
          <div className="drawer-logo" aria-hidden="true">
            R
          </div>
          <div>
            <h1>{PRODUCT_COPY.title}</h1>
            <p>
              {isLongform
                ? PRODUCT_COPY.modes.longform.description
                : PRODUCT_COPY.modes.quick.description}
            </p>
          </div>
        </div>
        <div className="drawer-header-actions">
          <button
            type="button"
            className="quiet-button"
            onClick={() => void onOpenModelAdmin()}
          >
            模型后台
          </button>
          <button
            type="button"
            className="close-button"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="workspace-tabs" role="tablist" aria-label="分析模式">
        <button
          type="button"
          role="tab"
          aria-selected={!isLongform}
          className={`workspace-tab ${!isLongform ? "is-active" : ""}`}
          onClick={() => store.setWorkspaceMode("quick")}
        >
          <span className="workspace-tab__title">{PRODUCT_COPY.modes.quick.title}</span>
          <span className="workspace-tab__meta">{PRODUCT_COPY.modes.quick.meta}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isLongform}
          className={`workspace-tab ${isLongform ? "is-active" : ""}`}
          onClick={() => store.setWorkspaceMode("longform")}
        >
          <span className="workspace-tab__title">{PRODUCT_COPY.modes.longform.title}</span>
          <span className="workspace-tab__meta">{PRODUCT_COPY.modes.longform.meta}</span>
        </button>
      </div>

      {isLongform ? (
        <section className="input-panel">
          <div className="panel-header">
            <h2>{PRODUCT_COPY.input.longformTitle}</h2>
            <span className="meta-chip">Lite</span>
          </div>
          <textarea
            className="workspace-textarea workspace-textarea--longform"
            value={longform.input.articleText}
            disabled={longform.loading}
            placeholder={PRODUCT_COPY.input.longformPlaceholder}
            onChange={(event) => store.updateLongformText(event.target.value)}
          />
          <button
            type="button"
            className="primary-button"
            disabled={longform.loading}
            onClick={() => void runLongformCheck()}
          >
            {longform.loading ? "核查中..." : "开始长文核查"}
          </button>
        </section>
      ) : (
        <section className="quick-workspace">
          <section className="input-panel">
            <div className="panel-header">
              <h2>{PRODUCT_COPY.input.quickTitle}</h2>
              {quick.input?.author ? <span className="meta-chip">{quick.input.author}</span> : null}
            </div>
            <textarea
              className="workspace-textarea"
              value={quick.input?.text || ""}
              disabled={quick.loading}
              placeholder={PRODUCT_COPY.input.quickPlaceholder}
              autoFocus={!quick.input?.text}
              onChange={(event) => store.updateQuickText(event.target.value)}
            />
            {quick.input?.url ? (
              <a className="source-link" href={quick.input.url} target="_blank" rel="noreferrer">
                打开来源
              </a>
            ) : null}
          </section>
          <ActionButtons
            activeMode={quick.activeMode}
            disabled={!quick.input?.text}
            loading={quick.loading}
            onRun={(mode) => void runQuickAnalysis(mode)}
          />
        </section>
      )}

      {loading ? (
        <section className="status-card" aria-live="polite">
          <h2>
            {isLongform
              ? PRODUCT_COPY.status.loadingTitle
              : PRODUCT_COPY.quickFlow.stepLabels[quick.activeMode ?? "split"]}
          </h2>
          <p>
            {isLongform
              ? PRODUCT_COPY.status.loadingBody
              : PRODUCT_COPY.quickFlow.progressBody}
          </p>
        </section>
      ) : null}

      {error ? (
        <section className="error-banner" role="alert">
          <strong>{PRODUCT_COPY.status.errorTitle}</strong>
          <p>{error}</p>
        </section>
      ) : null}

      {isLongform ? (
        <AnalysisPanel response={response} activeMode="longform" />
      ) : (
        <ComprehensiveAnalysisPanel
          responses={quick.comprehensiveResponses}
          activeMode={quick.activeMode}
          loading={quick.loading}
        />
      )}

      {!isLongform && quick.response && !quick.loading ? (
        <div className="follow-up-flow">
          <ActionButtons
            variant="follow-up"
            activeMode={quick.followUpMode}
            disabled={quick.loading}
            loading={quick.followUpLoading}
            onRun={(mode) => void runQuickFollowUp(mode)}
          />
          {quick.followUpLoading ? (
            <section className="status-card" aria-live="polite">
              <h2>正在换个视角</h2>
              <p>主结果会保留，新的补充结果稍后显示在这里。</p>
            </section>
          ) : null}
          {quick.followUpError ? (
            <section className="error-banner" role="alert">
              <strong>{PRODUCT_COPY.status.errorTitle}</strong>
              <p>{quick.followUpError}</p>
            </section>
          ) : null}
          {quick.followUpResponse ? (
            <section className="follow-up-result" aria-label="补充视角">
              <p className="follow-up-result__label">补充视角</p>
              <AnalysisPanel
                response={quick.followUpResponse}
                activeMode={quick.followUpMode}
              />
            </section>
          ) : null}
        </div>
      ) : null}

      <ExternalAssistantPanel
        workspaceMode={session.workspaceMode}
        text={isLongform ? longform.input.articleText : quick.input?.text || ""}
        sourceUrl={isLongform ? longform.sourceUrl : quick.input?.url}
      />
    </div>
  );
}

export async function requestModelAdmin(): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.OPEN_MODEL_ADMIN
  }) as Promise<RuntimeResponse>;
}
