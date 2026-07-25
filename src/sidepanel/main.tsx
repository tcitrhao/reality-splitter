import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

class SidepanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { errorMessage: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { errorMessage: null };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      errorMessage: error.message || "Side Panel 渲染失败了。"
    };
  }

  override componentDidCatch(error: Error) {
    console.error("Reality Splitter sidepanel crashed:", error);
  }

  override render() {
    if (this.state.errorMessage) {
      return (
        <main className="app-shell">
          <section className="input-panel">
            <div className="panel-header">
              <h2>页面加载失败</h2>
            </div>
            <div className="input-box">
              <p className="muted-text">{this.state.errorMessage}</p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

window.addEventListener("error", (event) => {
  console.error("Reality Splitter runtime error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Reality Splitter unhandled rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidepanelErrorBoundary>
      <App />
    </SidepanelErrorBoundary>
  </React.StrictMode>
);
