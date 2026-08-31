/**
 * Al-Madinah Hospital — application root.
 *
 * Three applications live here, over one record:
 *
 *   /         the hospital system — every department, for staff
 *   /clinic   the clinician workspace — patients ranked by acuity
 *   /portal   the patient portal — four things, in large type
 *
 * They are separate because the three jobs are separate, and they are
 * connected because they read and write the same store. A booking made in the
 * portal is not copied to the hospital system; it is the row the hospital
 * system reads.
 *
 * Within the hospital system there is no route table. Every clinical and
 * administrative route is generated from `modules/registry`, so the router
 * cannot disagree with the navigation, and adding a department means adding a
 * manifest and nothing else.
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
import { PersonaProvider } from "@/app/context/PersonaContext";
import { isDemoMode } from "@/platform/lib/supabase";
import { Logo } from "@/app/components/Logo";
import { RouteErrorBoundary } from "@/app/components/RouteErrorBoundary";

import { RoleProvider } from "./shell/RoleContext";
import { CommandPaletteProvider } from "./shell/CommandPalette";
import { NewEntryProvider } from "./shell/NewEntry";
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
const ClinicianApp = lazy(() => import("@/apps/clinician/ClinicianApp"));
const PortalApp = lazy(() => import("@/apps/portal/PortalApp"));

/**
 * Dev bypass. With VITE_SKIP_AUTH=true the app opens straight on the Hub —
 * no sign-in. Set in .env.development.local; delete that file to restore the
 * normal flow.
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

// ─── Hospital system shell ────────────────────────────────

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

/**
 * Which of the three applications is on screen.
 *
 * The providers wrap all three rather than sitting inside each, so switching
 * persona keeps the language, the theme and the open New panel — and so the
 * New button behaves identically whichever application you are in.
 */
function Applications() {
  const [path] = useLocation();

  return (
    <RoleProvider>
      <CommandPaletteProvider>
        <NewEntryProvider>
          <Suspense fallback={<BootScreen />}>
            {path.startsWith("/portal") ? <PortalApp />
              : path.startsWith("/clinic") ? <ClinicianApp />
              : <Shell />}
          </Suspense>
        </NewEntryProvider>
      </CommandPaletteProvider>
    </RoleProvider>
  );
}

// ─── Entry guards ─────────────────────────────────────────

/**
 * Entry guard.
 *
 * There is no landing page. Al-Madinah is internal hospital software, not a
 * product with a public front door — anyone reaching it is staff or a patient
 * who wants the system, and putting a brochure in front of a nurse on a night
 * shift is a cost with no benefit.
 */
function Router() {
  const { isAuthenticated, loading, workspace, workspaceLoading } = useAuth();
  // Subscribe to wouter's location: reading window.location here would not
  // re-render on a client-side navigate.
  const [path] = useLocation();

  // Invitation links are public, ahead of every auth guard.
  if (path.startsWith("/invite/")) return <InviteAccept />;

  // Demo deployments have no Supabase credentials and the dev bypass skips
  // auth outright. Both open straight on the application.
  if (SKIP_AUTH || isDemoMode) {
    if (path === "/auth" || path.startsWith("/auth/")) return <Redirect to="/" />;
    return <Applications />;
  }

  // The OAuth callback must render before the guards, or they intercept the
  // redirect before Supabase can read the code out of the URL.
  if (path.startsWith("/auth/callback")) return <AuthCallback />;

  if (loading) return <BootScreen />;
  if (!isAuthenticated) return <AuthPage />;
  if (workspaceLoading) return <BootScreen />;
  if (!workspace) return <WorkspaceSetup />;

  return <Applications />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <AuthProvider>
              <PersonaProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </PersonaProvider>
            </AuthProvider>
          </LanguageProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
