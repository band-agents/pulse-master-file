import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home, ChevronDown } from "lucide-react";
import { reportError } from "@/platform/lib/sentry";

/**
 * Per-route error boundary.
 *
 * The app had exactly one boundary, at the root: a render error anywhere in
 * 107 pages tore down the whole tree, so a bad number on one report took the
 * navigation, the header and the user's place in the app with it.
 *
 * This one sits *inside* the shell. The rail, header and Echo keep working;
 * only the page area is replaced, and the user can retry it or walk away to
 * somewhere that works. Changing route remounts it via `resetKey`, so simply
 * navigating elsewhere clears the error without a reload.
 */

interface Props {
  children: ReactNode;
  /** Change this (route path) to clear the error automatically. */
  resetKey: string;
  ar?: boolean;
}
interface State { error: Error | null; showDetail: boolean }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // Navigating away is itself a recovery path.
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, showDetail: false });
    }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[Al-Madinah] Page error:", error, info.componentStack);
    reportError(error, { componentStack: info.componentStack, route: this.props.resetKey });
  }

  render() {
    const { error, showDetail } = this.state;
    const ar = this.props.ar;
    if (!error) return this.props.children;

    return (
      <div className="h-full w-full flex items-start justify-center p-8 overflow-auto">
        <div className="bb-card max-w-xl w-full mt-10 p-7">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={19} className="text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-title font-semibold mb-1" style={{ fontFamily: "var(--app-font-display)" }}>
                {ar ? "تعذّر عرض هذه الصفحة" : "This page didn't load"}
              </h2>
              <p className="text-body text-muted-foreground mb-5">
                {ar
                  ? "الخطأ محصور في هذه الصفحة فقط — بقية النظام تعمل. جرّب مرة أخرى أو انتقل إلى صفحة أخرى."
                  : "The problem is contained to this page — the rest of the system is still running. Try it again, or move somewhere else and come back."}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => this.setState({ error: null, showDetail: false })}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground
                             text-body font-semibold border border-primary-border hover-elevate"
                >
                  <RotateCcw size={14} strokeWidth={2.2} />
                  {ar ? "أعد المحاولة" : "Try again"}
                </button>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-secondary text-secondary-foreground
                             text-body font-medium border border-secondary-border hover-elevate"
                >
                  <Home size={14} strokeWidth={2} />
                  {ar ? "لوحة التحكم" : "Dashboard"}
                </a>
                <button
                  type="button"
                  onClick={() => this.setState({ showDetail: !showDetail })}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-body text-muted-foreground
                             hover:text-foreground hover:bg-accent transition-colors"
                  aria-expanded={showDetail}
                >
                  {ar ? "التفاصيل التقنية" : "Technical detail"}
                  <ChevronDown size={13} className={`transition-transform ${showDetail ? "rotate-180" : ""}`} />
                </button>
              </div>

              {showDetail && (
                <pre className="mt-4 p-3.5 rounded-xl bg-muted text-caption text-foreground/80 overflow-auto
                                max-h-56 whitespace-pre-wrap break-words">
                  {String(error.stack || error.message || error)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
