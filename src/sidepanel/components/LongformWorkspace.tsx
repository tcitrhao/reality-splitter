import type { LongformCheckInput } from "../../shared/types";
import { PRODUCT_COPY } from "../../shared/productCopy";

interface LongformWorkspaceProps {
  value: LongformCheckInput;
  loading: boolean;
  active: boolean;
  onChange: (next: LongformCheckInput) => void;
  onRun: () => void;
}

export function LongformWorkspace({
  value,
  loading,
  active,
  onChange,
  onRun
}: LongformWorkspaceProps) {
  return (
    <section className={`longform-panel ${active ? "" : "is-hidden"}`}>
      <div className="panel-header">
        <h2>长文核查</h2>
        <span className="meta-chip">Lite</span>
      </div>
      <p className="muted-text">
        当前版本先专注把长文正文拆成事实和观点，并默认尝试检索权威来源核查。
        参考链接和参考摘录会放到后续专业版里单独处理，避免影响 Lite 版本稳定性。
      </p>
      <div className="longform-grid">
        <label className="field-block">
          <span className="field-label">{PRODUCT_COPY.input.longformTitle}</span>
          <textarea
            className="longform-textarea longform-textarea--article"
            value={value.articleText}
            onChange={(event) => onChange({ ...value, articleText: event.target.value })}
            placeholder={PRODUCT_COPY.input.longformPlaceholder}
          />
        </label>
      </div>

      <div className="longform-actions">
        <button type="button" className="action-button action-button--wide" onClick={onRun} disabled={loading}>
          {loading ? "核查中..." : "开始长文核查"}
        </button>
      </div>
    </section>
  );
}
