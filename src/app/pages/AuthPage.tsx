/**
 * Sign in — تسجيل الدخول
 *
 * The only screen an unauthenticated visitor can reach. It is a door, not a
 * shop window: no marketing, no feature tour, no pricing. Staff arriving here
 * already know what the system is and are usually in a hurry.
 *
 * Built entirely on the theme tokens, so it follows light/dark and the brand
 * palette like every other screen. The auth contract is unchanged
 * (signIn / signUp / signInWithGoogle).
 */

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, Languages } from "lucide-react";
import { signInWithGoogle, signIn, signUp } from "@/platform/lib/auth";
import { useLanguage } from "@/app/context/LanguageContext";
import { Logo } from "@/app/components/Logo";
import { BRAND } from "@/platform/lib/brand";
import { serif, inputCls, btnPrimary, btnGhost, labelCls } from "@/platform/ui";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const { lang, setLang } = useLanguage();
  const ar = lang === "ar";

  const [mode, setMode] = useState<Mode>("signin");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  async function handleGoogle() {
    setGoogleLoading(true); setError(null); setNotice(null);
    try {
      const res = await signInWithGoogle();
      if (res.error) { setError(res.error.message); setGoogleLoading(false); }
    } catch (e) {
      setError(e instanceof Error ? e.message : ar ? "حدث خطأ ما." : "Something went wrong.");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true); setError(null); setNotice(null);
    try {
      if (mode === "signup") {
        const res = await signUp(email, password, fullName);
        if (res.error) throw res.error;
        setNotice(ar
          ? "تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول."
          : "Check your email for a confirmation link, then sign in.");
        setMode("signin");
      } else {
        const res = await signIn(email, password);
        if (res.error) throw res.error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : ar ? "فشل تسجيل الدخول." : "Sign-in failed.");
    } finally {
      setEmailLoading(false);
    }
  }

  const busy = emailLoading || googleLoading;

  return (
    <div className="min-h-screen flex bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
      {/* ── Identity panel, desktop only ── */}
      <aside
        className="hidden lg:flex flex-col justify-between flex-1 px-14 py-12 relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, hsl(var(--primary)) 0%, hsl(202 45% 20%) 100%)" }}
      >
        {/* A single soft bloom rather than decorative shapes — this panel is
            identity, and anything busier competes with the form beside it. */}
        <div
          aria-hidden
          className="absolute -top-24 -end-24 w-[440px] h-[440px] rounded-full opacity-25 blur-3xl"
          style={{ background: "hsl(var(--chart-1))" }}
        />

        <Logo variant="full" size={19} theme="dark" bilingual />

        <div className="relative max-w-[36ch]">
          <h1 className="text-display font-semibold text-white leading-tight" style={serif}>
            {ar
              ? "كل مريض، كل أمر، كل سرير — في سجل واحد."
              : "Every patient, every order, every bed — in one record."}
          </h1>
          <p className="text-body-lg text-white/70 mt-3 leading-relaxed">
            {ar
              ? "نظام معلومات المستشفى الموحّد: السجل السريري والأوامر والمختبر والأشعة والصيدلية وغرف العمليات والطوارئ والدورة الإيرادية."
              : "The unified hospital information system: clinical records, orders, laboratory, imaging, pharmacy, theatres, emergency and the revenue cycle."}
          </p>
        </div>

        <p className="relative text-caption text-white/55">
          © {new Date().getFullYear()} {ar ? BRAND.nameAr : BRAND.name} · {ar ? "القاهرة، مصر" : "Cairo, Egypt"}
        </p>
      </aside>

      {/* ── Form ── */}
      <main className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-10 max-w-[560px] w-full mx-auto lg:mx-0">
        <div className="flex items-center justify-between mb-8 lg:hidden">
          <Logo variant="full" size={16} />
          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            className="grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            title={ar ? "English" : "العربية"}
          >
            <Languages size={15} />
          </button>
        </div>

        <div className="hidden lg:flex justify-end mb-6">
          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-caption text-muted-foreground hover:bg-muted transition-colors"
          >
            <Languages size={14} /> {ar ? "English" : "العربية"}
          </button>
        </div>

        <h2 className="text-heading font-semibold text-foreground" style={serif}>
          {mode === "signin"
            ? (ar ? "تسجيل الدخول" : "Sign in")
            : (ar ? "إنشاء حساب" : "Create an account")}
        </h2>
        <p className="text-body text-muted-foreground mt-1.5">
          {mode === "signin"
            ? (ar ? `للمتابعة إلى ${BRAND.nameAr}.` : `To continue to ${BRAND.name}.`)
            : (ar ? "سيتولى مسؤول النظام تفعيل صلاحياتك بعد التسجيل." : "A system administrator activates your access once you have registered.")}
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-xl bg-destructive/10 px-3.5 py-3 flex items-start gap-2.5">
            <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-caption text-foreground/85">{error}</p>
          </div>
        )}
        {notice && (
          <div role="status" className="mt-5 rounded-xl bg-success/10 px-3.5 py-3 flex items-start gap-2.5">
            <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
            <p className="text-caption text-foreground/85">{notice}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className={`${btnGhost} w-full h-11 mt-6`}
        >
          {googleLoading
            ? <Loader2 size={15} className="animate-spin" />
            : <GoogleMark />}
          {ar ? "المتابعة عبر Google" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 my-5" aria-hidden>
          <span className="flex-1 h-px bg-border" />
          <span className="text-micro text-muted-foreground">{ar ? "أو" : "or"}</span>
          <span className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label htmlFor="fullName" className={labelCls}>{ar ? "الاسم الكامل" : "Full name"}</label>
              <input
                id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
                required autoComplete="name" className={`${inputCls} h-11`}
                placeholder={ar ? "د. هالة الرشيد" : "Dr. Hala Al-Rasheed"}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className={labelCls}>{ar ? "البريد الإلكتروني" : "Work email"}</label>
            <input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email" dir="ltr" className={`${inputCls} h-11`}
              placeholder="name@alobour.sa"
            />
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>{ar ? "كلمة المرور" : "Password"}</label>
            <input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} dir="ltr"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={`${inputCls} h-11`}
              placeholder="••••••••"
            />
            {mode === "signup" && (
              <p className="text-micro text-muted-foreground mt-1">
                {ar ? "٨ أحرف على الأقل." : "At least 8 characters."}
              </p>
            )}
          </div>

          <button type="submit" disabled={busy} className={`${btnPrimary} w-full h-11`}>
            {emailLoading && <Loader2 size={15} className="animate-spin" />}
            {mode === "signin"
              ? (ar ? "تسجيل الدخول" : "Sign in")
              : (ar ? "إنشاء الحساب" : "Create account")}
          </button>
        </form>

        <p className="text-caption text-muted-foreground mt-5">
          {mode === "signin" ? (
            <>
              {ar ? "ليس لديك حساب؟ " : "No account yet? "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setNotice(null); }}
                className="text-brand-ink font-medium hover:underline"
              >
                {ar ? "أنشئ حساباً" : "Create one"}
              </button>
            </>
          ) : (
            <>
              {ar ? "لديك حساب بالفعل؟ " : "Already have an account? "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
                className="text-brand-ink font-medium hover:underline"
              >
                {ar ? "سجّل الدخول" : "Sign in"}
              </button>
            </>
          )}
        </p>

        <p className="text-micro text-muted-foreground mt-8 flex items-start gap-1.5 max-w-[52ch]">
          <ShieldCheck size={12} className="shrink-0 mt-0.5" />
          {ar
            ? "هذا نظام سريري. الوصول مسجّل ومدقّق، ولا يجوز مشاركة بيانات الدخول."
            : "This is a clinical system. Access is logged and audited, and credentials must not be shared."}
        </p>
      </main>
    </div>
  );
}

/** Google's mark, inline so the sign-in button needs no external asset. */
function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.6-4.5 6.4l6.9 5.4c4.1-3.8 6.6-9.4 6.6-15z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 9.9l7.1-5.5z" />
      <path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.1-6C34.9 4.500 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14.1l7.1 5.5C13.3 14.3 18.2 10.5 24 10.5z" />
    </svg>
  );
}
