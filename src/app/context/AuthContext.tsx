import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import {
  DEMO_USER, DEMO_SESSION,
  signIn, signUp, signOut as authSignOut,
  onAuthStateChange,
} from "@/platform/lib/auth";
import { isDemoMode, getSupabaseClient } from "@/platform/lib/supabase";
import { BRAND, storageKey } from "@/platform/lib/brand";

// ─── Workspace shape ───────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: "owner" | "admin" | "member" | "viewer";
  settings?: Record<string, unknown>;
}

const DEMO_WORKSPACE: Workspace = {
  id: "demo-workspace-id",
  name: "Demo Workspace",
  slug: "demo",
  plan: "pro",
  role: "owner",
  settings: { currency: "SAR", enabled_modules: ["production", "inventory", "purchasing", "finance", "analytics", "hr", "delivery", "quality"] },
};

// ─── Context shape ─────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  workspace: Workspace | null;
  loading: boolean;
  workspaceLoading: boolean;
  isDemo: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(isDemoMode ? DEMO_USER : null);
  const [session, setSession] = useState<Session | null>(isDemoMode ? DEMO_SESSION : null);
  const [workspace, setWorkspace] = useState<Workspace | null>(isDemoMode ? DEMO_WORKSPACE : null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const fetchWorkspace = useCallback(async (userId: string) => {
    if (isDemoMode) return;
    const sb = getSupabaseClient();
    if (!sb) return;
    setWorkspaceLoading(true);
    try {
      const { data, error } = await sb
        .from("workspace_members")
        .select("role, workspaces(*)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle() as unknown as { data: { role: string; workspaces: Record<string, unknown> } | null; error: unknown };

      if (!error && data && data.workspaces) {
        const ws = data.workspaces;
        setWorkspace({
          id: ws.id as string,
          name: ws.name as string,
          slug: ws.slug as string,
          plan: ws.plan as string,
          role: data.role as Workspace["role"],
          settings: (ws.settings as Record<string, unknown>) ?? {},
        });
      } else {
        if (error) console.error(`${BRAND.logPrefix} Workspace fetch failed:`, error);
        setWorkspace(null);
      }
    } catch (e) {
      console.error(`${BRAND.logPrefix} Workspace fetch threw:`, e);
      setWorkspace(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  // Which user we already loaded a workspace for. Supabase re-emits auth
  // events on every token refresh (e.g. each time the tab regains focus);
  // without this guard the app flashed its loading screen on every switch.
  const workspaceLoadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (isDemoMode) return;

    const sb = getSupabaseClient();

    const { data } = onAuthStateChange((authUser, authSession) => {
      setUser(authUser);
      setSession(authSession);
      setLoading(false);

      if (authUser && sb) {
        if (workspaceLoadedFor.current === authUser.id) return; // token refresh — workspace already loaded
        workspaceLoadedFor.current = authUser.id;
        setWorkspaceLoading(true);
        // Supabase calls must run OUTSIDE this callback: the client holds an
        // internal auth lock while emitting events, so awaiting auth.getUser()
        // here deadlocks on page load when a stored session is restored.
        setTimeout(async () => {
          // Verify the session is still valid against the Supabase auth server.
          // A stale JWT in localStorage (e.g. after a project wipe) would cause
          // "User from sub claim in JWT does not exist" (403) on every request.
          const { error: verifyErr } = await sb.auth.getUser();
          if (verifyErr) {
            console.warn(`${BRAND.logPrefix} Stale session detected — signing out automatically.`, verifyErr.message);
            await sb.auth.signOut();
            workspaceLoadedFor.current = null;
            setUser(null);
            setSession(null);
            setWorkspace(null);
            setWorkspaceLoading(false);
            return;
          }
          await fetchWorkspace(authUser.id);
        }, 0);
      } else {
        workspaceLoadedFor.current = null;
        setWorkspace(null);
        setWorkspaceLoading(false);
      }
    });

    return () => {
      if (data?.subscription?.unsubscribe) {
        data.subscription.unsubscribe();
      }
    };
  }, [fetchWorkspace]);

  const refreshWorkspace = useCallback(async () => {
    if (user) await fetchWorkspace(user.id);
  }, [user, fetchWorkspace]);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.error) return { error: result.error.message };
    setUser(result.user);
    setSession(result.session);
    if (result.user) await fetchWorkspace(result.user.id);
    return { error: null };
  }, [fetchWorkspace]);

  const handleSignUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const result = await signUp(email, password, fullName);
    if (result.error) return { error: result.error.message };
    return { error: null };
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    if (isDemoMode) {
      // Demo has no real session — clear the onboarding gate so the app resets,
      // then return to the public landing page.
      localStorage.removeItem(storageKey("onboarding"));
    } else {
      setUser(null);
      setSession(null);
      setWorkspace(null);
    }
    window.location.href = "/welcome";
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      workspace: workspace ?? (isDemoMode ? DEMO_WORKSPACE : null),
      loading,
      workspaceLoading,
      isDemo: isDemoMode,
      isAuthenticated: !!user,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
      refreshWorkspace,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
