import type { QuickAnalysisMode } from "../../shared/types";
import { PRODUCT_COPY } from "../../shared/productCopy";

interface ActionButtonsProps {
  disabled?: boolean;
  loading?: boolean;
  activeMode: QuickAnalysisMode | null;
  onRun: (mode: QuickAnalysisMode) => void;
}

export function ActionButtons({ disabled, loading, activeMode, onRun }: ActionButtonsProps) {
  return (
    <div className="action-grid">
      {PRODUCT_COPY.actions.map((action) => (
        <button
          key={action.mode}
          type="button"
          className={`action-button ${activeMode === action.mode ? "is-active" : ""}`}
          disabled={disabled || loading}
          onClick={() => onRun(action.mode)}
        >
          {loading && activeMode === action.mode ? "分析中..." : action.label}
        </button>
      ))}
    </div>
  );
}
