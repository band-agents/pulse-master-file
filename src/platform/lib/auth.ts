import { supabase, isDemoMode } from "./supabase";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { BRAND } from "./brand";

// ─── Demo user used when Supabase is not configured ───────

export const DEMO_USER: User = {
  id: "demo-user-id",
  email: "demo@pulse.app",
  app_metadata: { provider: "demo" },
  user_metadata: { full_name: "Demo User", avatar_url: null },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  role: "authenticated",
  updated_at: new Date().toISOString(),
} as unknown as User;

export const DEMO_SESSION: Session = {
  access_token: "demo-token",
  refresh_token: "demo-refresh-token",
  expires_in: 9999999,
  token_type: "bearer",
  user: DEMO_USER,
} as unknown as Session;

// ─── Auth result shape ─────────────────────────────────────

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

// ─── Auth functions ────────────────────────────────────────

export async function signUp(email: string, password: string, fullName?: string): Promise<AuthResult> {
  if (isDemoMode || !supabase) {
    console.warn(`${BRAND.logPrefix} Demo mode — sign up is a no-op`);
    return { user: DEMO_USER, session: DEMO_SESSION, error: null };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName ?? "" } },
  });
  return { user: data.user, session: data.session, error };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (isDemoMode || !supabase) {
    console.warn(`${BRAND.logPrefix} Demo mode — sign in is a no-op`);
    return { user: DEMO_USER, session: DEMO_SESSION, error: null };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data.user, session: data.session, error };
}

export async function signInWithGoogle(): Promise<{ error: AuthError | null }> {
  if (isDemoMode || !supabase) {
    console.warn(`${BRAND.logPrefix} Demo mode — OAuth is a no-op`);
    return { error: null };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { error };
}

export async function signInWithApple(): Promise<{ error: AuthError | null }> {
  if (isDemoMode || !supabase) {
    console.warn(`${BRAND.logPrefix} Demo mode — OAuth is a no-op`);
    return { error: null };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { error };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  if (isDemoMode || !supabase) {
    return { error: null };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser(): Promise<User | null> {
  if (isDemoMode || !supabase) return DEMO_USER;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession(): Promise<Session | null> {
  if (isDemoMode || !supabase) return DEMO_SESSION;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function resetPasswordForEmail(email: string): Promise<{ error: AuthError | null }> {
  if (isDemoMode || !supabase) return { error: null };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  if (isDemoMode || !supabase) return { error: null };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

export function onAuthStateChange(callback: (user: User | null, session: Session | null) => void) {
  if (isDemoMode || !supabase) {
    callback(DEMO_USER, DEMO_SESSION);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null, session);
  });
}
