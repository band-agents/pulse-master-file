/**
 * Al-Obour General Hospital — application root.
 *
 * There is no route table here. Every clinical and administrative route is
 * generated from `modules/registry`, so the router cannot disagree with the
 * navigation, and adding a department means adding a manifest and nothing
 * else.
 *
 * The shell is deliberately thin: a top bar, and whatever module currently
 * owns the viewport.
 */

import { lazy, Suspense, useMemo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";

import { Toaster } from "@/platform/ui/primitives/sonner";
import { TooltipProvider } from "@/platform/ui/primitives/tooltip";
import { LanguageProvider } from "@/app/context/LanguageContext";
import { AuthProvider, useAuth } from "@/app/context/AuthContext";
import { isDemoMode } from "@/platform/lib/supabase";
import { Logo } from "@/app/components/Logo";
import { RouteErrorBoundary } from "@/app/components/RouteErrorBoundary";

import { RoleProvider } from "./shell/RoleContext";
import { CommandPaletteProvider } from "./shell/CommandPalette";
import { TopBar } from "./shell/TopBar";
import { ModuleFrame } from "./shell/ModuleFrame";
import { ROUTED_VIEWS } from "@/modules/registry";
import { useSnapshot } from "@/platform/data/snapshot";

import AuthPage from "./pages/AuthPage";
import AuthCallback from "./pages/AuthCallback";
import WorkspaceSetup from "./pages/WorkspaceSetup";
import InviteAccept from "./pages/InviteAccept";
import NotFound from "./pages/not-found";

const Hub = lazy(() => import("./shell/Hub"));
const ActivityFeed = lazy(() => import("./pages/ActivityFeed"));

/**
 * Dev bypass. With VITE_SKIP_AUTH=true the app opens straight on the Hub —
 * no landing page, no sign-in. Set in .env.development.local; delete that
 * file to restore the normal flow.
 */
const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lists stay fresh for 30s — returning to a screen re-renders from
      // cache instead of refetching every table on every visit.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function BootScreen() {
  return (
    <div className="min-h-screen bg-background grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Logo variant="full" size={18} bilingual />
        <Loader2 size={16} className="animate-spin text-muted-foreground/50" />
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────

function Shell() {
  const [location] = useLocation();
  // One snapshot at the shell level feeds the alert badge; module screens
  // load their own collections, so this stays a single cheap read.
  const { snapshot } = useSnapshot();
  const alertCount = useMemo(
    () => snapshot.alerts.filter((a) => a.status === "active").length,
    [snapshot.alerts],
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <TopBar alertCount={alertCount} />
      <main className="flex-1 min-h-0 overflow-hidden">
        <RouteErrorBoundary resetKey={location}>
          <ModuleFrame>
            <Suspense fallback={<BootScreen />}>
              <Switch>
                <Route path="/" component={Hub} />
                <Route path="/activity" component={ActivityFeed} />

                {/* Every module view, generated from the registry. */}
                {ROUTED_VIEWS.map(({ path, view }) => (
                  <Route key={path} path={path} component={view.Component} />
                ))}

                {/* Paths from the system this was branched from. */}
                <Route path="/chart/:id">{(p) => <Redirect to={`/patients/${p.id}`} />}</Route>
                <Route path="/beds">{() => <Redirect to="/wards" />}</Route>
                <Route path="/ed">{() => <Redirect to="/emergency" />}</Route>
                <Route path="/lab">{() => <Redirect to="/laboratory" />}</Route>
                <Route path="/radiology">{() => <Redirect to="/imaging" />}</Route>
                <Route path="/claims">{() => <Redirect to="/revenue/claims" />}</Route>
                <Route path="/settings">{() => <Redirect to="/admin/settings" />}</Route>

                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </ModuleFrame>
        </RouteErrorBoundary>
      </main>
    </div>
  );
}

function AppShell() {
  return (
    <RoleProvider>
      <CommandPaletteProvider>
        <Shell />
      </CommandPaletteProvider>
    </RoleProvider>
  );
}

// ─── Entry guards ─────────────────────────────────────────

/**
 * Entry guard.
 *
 * There is no landing page. Al-Obour is internal hospital software, not a
 * product with a public front door — anyone reaching it is staff who want the
 * system, and putting a brochure in front of a nurse on a night shift is a
 * cost with no benefit. `/` is either the Hub or the sign-in screen, never
 * marketing.
 */
function Router() {
  const { isAuthenticated, loading, workspace, workspaceLoading } = useAuth();
  // Subscribe to wouter's location: reading window.location here would not
  // re-render on a client-side navigate.
  const [path] = useLocation();

  // Invitation links are public, ahead of every auth guard.
  if (path.startsWith("/invite/")) return <InviteAccept />;

  // Demo deployments have no Supabase credentials and the dev bypass skips
  // auth outright. Both open straight on the Hub.
  if (SKIP_AUTH || isDemoMode) {
    if (path === "/auth" || path.startsWith("/auth/")) return <Redirect to="/" />;
    return <AppShell />;
  }

  // The OAuth callback must render before the guards, or they intercept the
  // redirect before Supabase can read the code out of the URL.
  if (path.startsWith("/auth/callback")) return <AuthCallback />;

  if (loading) return <BootScreen />;
  if (!isAuthenticated) return <AuthPage />;
  if (workspaceLoading) return <BootScreen />;
  if (!workspace) return <WorkspaceSetup />;

  return <AppShell />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <AuthProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
                <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
