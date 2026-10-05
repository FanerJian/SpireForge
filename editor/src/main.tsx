import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 兜底错误边界：任何渲染崩溃都落在错误面板上，而不是整窗黑屏
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8">
          <h1 className="text-lg font-semibold text-slate-100">界面渲染出错</h1>
          <pre className="max-w-2xl overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.03] p-3 font-mono text-xs text-slate-400">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button
            onClick={() => location.reload()}
            className="rounded-lg border border-sky-400/40 px-4 py-1.5 text-sm text-sky-300 hover:bg-sky-400/10"
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
