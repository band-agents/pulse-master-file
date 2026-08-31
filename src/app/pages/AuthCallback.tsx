/**
 * Auth Callback — Handles OAuth redirect from Supabase/Google
 *
 * Root cause of previous "timed out" bug:
 * 1. The timeout closure captured a stale `isAuthenticated` value
 * 2. PKCE flow sends ?code= which needs explicit exchangeCodeForSession()
 * 3. detectSessionInUrl only handles hash fragments (#access_token=)
 *
 * Fix: actively exchange the code, use refs for timeout checks,
 * and poll for session instead of relying on stale closures.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/app/context/AuthContext";
import { getSupabaseClient } from "@/platform/lib/supabase";
import { BRAND, storageKey } from "@/platform/lib/brand";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const { isAuthenticated, workspace, workspaceLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Signing you in…");
  const resolved = useRef(false);

  // ─── Step 1: Process the OAuth return ──────────────────
  useEffect(() => {
    if (resolved.current) return;

    const sb = getSupabaseClient();
    if (!sb) {
      setError("Supabase client not available.");
      return;
    }

    // Check for errors in URL
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);

    const errorParam = hashParams.get("error") || searchParams.get("error");
    const errorDesc = hashParams.get("error_description") || searchParams.get("error_description");

    if (errorParam) {
      setError(decodeURIComponent(errorDesc || errorParam));
      return;
    }

    // PKCE flow: if there's a ?code= param, exchange it for a session
    const code = searchParams.get("code");

    async function processCallback() {
      try {
        if (code) {
          setStatus("Exchanging auth code…");
          // exchangeCodeForSession handles the PKCE code→session swap
          const { error: exchangeErr } = await sb!.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.error(`${BRAND.logPrefix} Code exchange error:`, exchangeErr);
            setError(exchangeErr.message || "Failed to complete sign-in.");
            return;
          }
          // Session is now set — onAuthStateChange in AuthContext will fire
          setStatus("Loading your workspace…");
          return;
        }

        // Hash fragment flow (#access_token=...): Supabase client handles
        // this automatically via detectSessionInUrl.
        // We just need to wait for the session to appear.
        if (hash && hash.includes("access_token")) {
          setStatus("Loading your workspace…");
          // detectSessionInUrl should have already processed this.
          // Give it a moment, then check session.
          await new Promise(r => setTimeout(r, 500));

          const { data: { session } } = await sb!.auth.getSession();
          if (session) {
            setStatus("Loading your workspace…");
            return;
          }
        }

        // Neither code nor hash token — maybe session was already set
        // (e.g., the user navigated here directly, or there's a stored session)
        const { data: { session: existing } } = await sb!.auth.getSession();
        if (existing) {
          setStatus("Loading your workspace…");
          return;
        }

        // No code, no hash, no session — wait a bit for detectSessionInUrl
        setStatus("Waiting for authentication…");
        await new Promise(r => setTimeout(r, 2000));

        const { data: { session: delayed } } = await sb!.auth.getSession();
        if (delayed) {
          setStatus("Loading your workspace…");
          return;
        }

        // Still nothing after waiting
        setError("Could not complete sign-in. Please try again.");
      } catch (e) {
        console.error(`${BRAND.logPrefix} Auth callback error:`, e);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    }

    processCallback();
  }, []);

  // ─── Step 2: Redirect once authenticated ──────────────
  useEffect(() => {
    if (resolved.current) return;
    if (!isAuthenticated) return;
    if (workspaceLoading) {
      setStatus("Loading your workspace…");
      return;
    }

    // Authenticated and workspace loading is done
    resolved.current = true;

    // Clean the URL (remove code/token params)
    if (window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Navigate after a tiny delay so React state settles.
    // If the user started from an invite link, return them to it so
    // they can accept — instead of dropping them into workspace setup.
    const pendingInvite = localStorage.getItem(storageKey("pending_invite"));
    setTimeout(() => {
      navigate(pendingInvite ? `/invite/${pendingInvite}` : "/", { replace: true });
    }, 100);
  }, [isAuthenticated, workspaceLoading, workspace, navigate]);

  // ─── Error state ──────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg, #F7F6F3)" }}>
        <div className="w-full max-w-[380px] text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/30 mb-5">
            <AlertCircle size={22} className="text-destructive" />
          </div>
          <h2 className="text-title font-semibold text-foreground mb-2" style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.02em" }}>
            Sign-in Issue
          </h2>
          <p className="text-body text-muted-foreground mb-2 leading-relaxed">
            {error}
          </p>
          <p className="text-micro text-muted-foreground/50 mb-6">
            If this keeps happening, check your Supabase and Google OAuth settings.
          </p>
          <button
            onClick={() => {
              // Clear any partial auth state
              const sb = getSupabaseClient();
              if (sb) sb.auth.signOut();
              navigate("/", { replace: true });
            }}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={13} />
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg, #F7F6F3)" }}>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-foreground/5 border border-foreground/8 mb-5">
          <Loader2 size={20} className="animate-spin text-foreground/50" />
        </div>
        <p className="text-title font-semibold text-foreground mb-1" style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.02em" }}>
          {status}
        </p>
        <p className="text-caption text-muted-foreground/50 mt-1">
          Connecting to {BRAND.name}
        </p>
      </div>
    </div>
  );
}
