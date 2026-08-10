import type { QuickAnalysisMode } from "../../shared/types";
import { PRODUCT_COPY } from "../../shared/productCopy";

interface ActionButtonsProps {
  disabled?: boolean;
  loading?: boolean;
  activeMode: QuickAnalysisMode | null;
  onRun: (mode: QuickAnalysisMode) => void;
  variant?: "primary" | "follow-up";
}

export function ActionButtons({
  disabled,
  loading,
  activeMode,
  onRun,
  variant = "primary"
}: ActionButtonsProps) {
  if (variant === "primary") {
    return (
      <button
        type="button"
        className="primary-button quick-primary-button"
        disabled={disabled || loading}
        onClick={() => onRun("split")}
      >
        {loading ? PRODUCT_COPY.quickFlow.primaryLoading : PRODUCT_COPY.quickFlow.primaryAction}
      </button>
    );
  }

  return (
    <section className="follow-up-panel" aria-labelledby="follow-up-title">
      <div className="follow-up-panel__header">
        <h2 id="follow-up-title">{PRODUCT_COPY.quickFlow.followUpTitle}</h2>
        <p>{PRODUCT_COPY.quickFlow.followUpDescription}</p>
      </div>
      <div className="action-grid action-grid--follow-up">
        {PRODUCT_COPY.quickFlow.followUpActions.map((action) => (
          <button
            key={action.mode}
            type="button"
            className={`action-button ${activeMode === action.mode ? "is-active" : ""}`}
            disabled={disabled || loading}
            onClick={() => onRun(action.mode)}
          >
            {loading && activeMode === action.mode ? "换个视角中..." : action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
