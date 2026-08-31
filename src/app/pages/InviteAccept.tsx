/**
 * Invite Accept — /invite/:token
 *
 * The page an invited person lands on. Public (rendered before auth guards):
 *   1. Loads the invitation preview via get_invitation_by_token (anon RPC —
 *      the token is the secret, so no login is needed to see who invited you).
 *   2. Logged out → inline sign in / sign up (email prefilled + locked to the
 *      invited address) or Google. The token is stashed in localStorage so
 *      the OAuth callback can return here.
 *   3. Logged in → one button: accept_invitation RPC → refreshWorkspace →
 *      straight into the workspace.
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { isDemoMode, getSupabaseClient } from "@/platform/lib/supabase";
import { signInWithGoogle } from "@/platform/lib/auth";
import { BRAND, storageKey } from "@/platform/lib/brand";
import { Loader2, AlertCircle, CheckCircle2, Mail, ArrowRight, LogOut } from "lucide-react";

export const PENDING_INVITE_KEY = storageKey("pending_invite");

interface InvitePreview {
  ok: boolean;
  error_code?: string;
  email?: string;
  role?: string;
  workspace_name?: string;
  inviter_name?: string;
  invited_email?: string;
}

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  owner: { en: "Owner", ar: "مالك" },
  admin: { en: "Admin", ar: "مسؤول" },
  manager: { en: "Manager", ar: "مدير" },
  member: { en: "Employee", ar: "موظف" },
  viewer: { en: "Viewer", ar: "مشاهد" },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-6">
          <span className="text-title font-semibold tracking-[0.12em] text-foreground" style={{ fontFamily: "var(--app-font-display)" }}>
            {BRAND.name}
          </span>
        </div>
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-7">{children}</div>
      </div>
    </div>
  );
}

export default function InviteAccept() {
  const [location, navigate] = useLocation();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { isAuthenticated, user, refreshWorkspace, signIn, signUp, signOut } = useAuth();

  const token = location.split("/invite/")[1]?.split(/[?#]/)[0] ?? "";

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);

  // ── Load the invitation preview ──────────────────────────
  useEffect(() => {
    if (isDemoMode || !token) { setLoading(false); return; }
    const sb = getSupabaseClient();
    if (!sb) { setLoading(false); return; }
    (sb.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
      "get_invitation_by_token", { invite_token: token },
    ).then(({ data, error: e }) => {
      if (e) setPreview({ ok: false, error_code: "load_failed" });
      else setPreview(data as InvitePreview);
      setLoading(false);
    });
  }, [token]);

  // ── Accept (when signed in) ──────────────────────────────
  const accept = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) return;
    setBusy(true); setError(null);
    const { data, error: e } = await (sb.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
      "accept_invitation", { invite_token: token },
    );
    setBusy(false);
    if (e) { setError(e.message); return; }
    const res = data as InvitePreview & { workspace_name?: string };
    if (!res.ok) {
      if (res.error_code === "email_mismatch") {
        setError(ar
          ? `الدعوة دي مبعوتة لـ ${res.invited_email} — سجّل دخول بنفس البريد.`
          : `This invitation was sent to ${res.invited_email} — sign in with that email.`);
      } else if (res.error_code === "expired") {
        setError(ar ? "الدعوة انتهت صلاحيتها. اطلب دعوة جديدة." : "This invitation has expired. Ask for a new one.");
      } else if (res.error_code === "already_accepted") {
        setError(ar ? "الدعوة اتقبلت قبل كده." : "This invitation was already accepted.");
      } else {
        setError(ar ? "الدعوة مش صالحة." : "This invitation is not valid.");
      }
      return;
    }
    localStorage.removeItem(PENDING_INVITE_KEY);
    setJoined(res.workspace_name ?? "");
    await refreshWorkspace();
    setTimeout(() => navigate("/", { replace: true }), 900);
  }, [token, ar, refreshWorkspace, navigate]);

  // ── Email auth from within the page ──────────────────────
  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!preview?.email || !password) return;
    setBusy(true); setError(null);
    if (mode === "signup") {
      const { error: err } = await signUp(preview.email, password, fullName || undefined);
      setBusy(false);
      if (err) { setError(err); return; }
      // If confirmations are on there's no session yet — tell them to
      // confirm and come back through the same link.
      const sb = getSupabaseClient();
      const { data } = await sb!.auth.getSession();
      if (!data.session) setConfirmNote(true);
    } else {
      const { error: err } = await signIn(preview.email, password);
      setBusy(false);
      if (err) { setError(err); return; }
    }
  }

  function handleGoogle() {
    localStorage.setItem(PENDING_INVITE_KEY, token);
    signInWithGoogle();
  }

  // ── Render states ────────────────────────────────────────

  if (isDemoMode) {
    return (
      <Card>
        <div className="text-center space-y-3">
          <AlertCircle size={22} className="mx-auto text-muted-foreground" />
          <p className="text-body-lg font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
            {ar ? "الدعوات شغالة في النسخة الحقيقية بس" : "Invitations work in live mode only"}
          </p>
          <p className="text-caption text-muted-foreground">
            {ar ? "النسخة التجريبية من غير حسابات." : "The demo runs without accounts."}
          </p>
          <button onClick={() => navigate("/")} className="h-10 px-5 rounded-xl bg-foreground text-background text-body font-medium">
            {ar ? "ارجع للرئيسية" : "Back to home"}
          </button>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-body">{ar ? "بنحمّل الدعوة…" : "Loading invitation…"}</span>
        </div>
      </Card>
    );
  }

  if (!preview?.ok) {
    const code = preview?.error_code;
    const msg =
      code === "expired" ? (ar ? "الدعوة انتهت صلاحيتها. اطلب من المدير دعوة جديدة." : "This invitation has expired. Ask your admin for a new one.")
      : code === "already_accepted" ? (ar ? "الدعوة دي اتستخدمت قبل كده. جرّب تسجل دخول عادي." : "This invitation was already used. Try signing in normally.")
      : (ar ? "اللينك ده مش صالح. اتأكد إنك نسخت اللينك كامل." : "This link isn't valid. Make sure you copied the full link.");
    return (
      <Card>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 mx-auto flex items-center justify-center">
            <AlertCircle size={22} className="text-destructive" />
          </div>
          <p className="text-body-lg font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
            {ar ? "الدعوة مش متاحة" : "Invitation unavailable"}
          </p>
          <p className="text-caption text-muted-foreground leading-relaxed">{msg}</p>
          <button onClick={() => navigate("/auth")} className="h-10 px-5 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">
            {ar ? "تسجيل الدخول" : "Go to sign in"}
          </button>
        </div>
      </Card>
    );
  }

  if (joined !== null) {
    return (
      <Card>
        <div className="text-center space-y-3 py-2">
          <div className="w-12 h-12 rounded-2xl bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 size={24} className="text-success" />
          </div>
          <p className="text-body-lg font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
            {ar ? `أهلاً بيك في ${joined}` : `Welcome to ${joined}`}
          </p>
          <p className="text-caption text-muted-foreground flex items-center justify-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            {ar ? "بنجهّز مساحة العمل…" : "Opening your workspace…"}
          </p>
        </div>
      </Card>
    );
  }

  const roleLabel = ROLE_LABELS[preview.role ?? "member"] ?? ROLE_LABELS.member;

  return (
    <Card>
      {/* Invitation summary */}
      <div className="text-center mb-6">
        <p className="text-caption text-muted-foreground">
          {preview.inviter_name} {ar ? "بيدعوك تنضم لـ" : "invited you to join"}
        </p>
        <p className="text-title font-semibold mt-1" style={{ fontFamily: "var(--app-font-display)" }}>
          {preview.workspace_name}
        </p>
        <span className="inline-block mt-2 text-micro px-2.5 py-1 rounded-full bg-primary/10 text-brand-ink font-medium">
          {ar ? `الصلاحية: ${roleLabel.ar}` : `Role: ${roleLabel.en}`}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-caption text-destructive">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-caption text-muted-foreground text-center">
            {ar ? "مسجل دخول كـ" : "Signed in as"} <b className="text-foreground">{user?.email}</b>
          </p>
          <button
            onClick={accept}
            disabled={busy}
            className="w-full h-11 rounded-xl bg-foreground text-background text-body font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} className={ar ? "rotate-180" : ""} />}
            {ar ? `انضم لـ ${preview.workspace_name}` : `Join ${preview.workspace_name}`}
          </button>
          <button
            onClick={() => signOut()}
            className="w-full h-9 rounded-xl text-caption text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut size={12} />
            {ar ? "مش أنت؟ سجل خروج" : "Not you? Sign out"}
          </button>
        </div>
      ) : confirmNote ? (
        <div className="text-center space-y-3 py-2">
          <Mail size={22} className="mx-auto text-brand-ink" />
          <p className="text-body font-medium">{ar ? "اتأكد من بريدك الإلكتروني" : "Check your email"}</p>
          <p className="text-caption text-muted-foreground leading-relaxed">
            {ar
              ? `بعتنا لينك تأكيد لـ ${preview.email}. أكّد بريدك وبعدين افتح لينك الدعوة ده تاني.`
              : `We sent a confirmation link to ${preview.email}. Confirm your email, then open this invite link again.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full h-11 rounded-xl border border-border/70 bg-background text-body font-medium flex items-center justify-center gap-2.5 hover:bg-muted/40 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            {ar ? "كمّل بجوجل" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-micro text-muted-foreground/70">{ar ? "أو بالبريد" : "or with email"}</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Email + password */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input
              type="email"
              value={preview.email ?? ""}
              disabled
              className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-muted/40 text-body text-muted-foreground"
            />
            {mode === "signup" && (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={ar ? "الاسم الكامل" : "Full name"}
                className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-body outline-none focus:border-primary/50"
              />
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? (ar ? "كلمة سر جديدة (٦+ حروف)" : "Create a password (6+ chars)") : (ar ? "كلمة السر" : "Password")}
              required
              minLength={6}
              className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-body outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={busy || !password}
              className="w-full h-11 rounded-xl bg-foreground text-background text-body font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === "signup" ? (ar ? "أنشئ حساب وانضم" : "Create account & join") : (ar ? "سجل دخول وانضم" : "Sign in & join")}
            </button>
          </form>

          <p className="text-micro text-muted-foreground text-center">
            {mode === "signup" ? (
              <>{ar ? "عندك حساب؟" : "Already have an account?"}{" "}
                <button onClick={() => { setMode("signin"); setError(null); }} className="text-brand-ink font-medium hover:underline">
                  {ar ? "سجل دخول" : "Sign in"}
                </button></>
            ) : (
              <>{ar ? "معندكش حساب؟" : "New here?"}{" "}
                <button onClick={() => { setMode("signup"); setError(null); }} className="text-brand-ink font-medium hover:underline">
                  {ar ? "أنشئ حساب" : "Create account"}
                </button></>
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
