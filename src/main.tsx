import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { reportError } from "@/platform/lib/sentry";
import { installGlobalErrorSurface } from "@/platform/lib/errors";
import { BRAND, migrateLegacyStorage } from "@/platform/lib/brand";
import App from "@/app/App";
import "./index.css";

// Carry pre-rename localStorage forward before anything reads it.
migrateLegacyStorage();
installGlobalErrorSurface();

/**
 * Root error boundary — a crash anywhere in the tree used to render a
 * silent white page. Now it shows the actual error so users can report
 * it (and we can fix it) without opening DevTools.
 * Inline styles on purpose: must render even if CSS failed to load.
 */
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`${BRAND.logPrefix} Uncaught render error:`, error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f7", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <p style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>{BRAND.name} hit an unexpected error</p>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
            Please screenshot this box and send it to support — it shows exactly what went wrong.
          </p>
          <pre style={{ background: "#1a1a1a", color: "#f87171", padding: 16, borderRadius: 12, fontSize: 12, overflow: "auto", whiteSpace: "pre-wrap", marginBottom: 16 }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/"; }}
            style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", marginRight: 8 }}>
            Reset & reload
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", color: "#1a1a1a", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Just reload
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
