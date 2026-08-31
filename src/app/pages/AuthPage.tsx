/**
 * AuthPage — Sign in / Sign up
 *
 * Matches the joyful landing aesthetic: cream + mint canvas, teal & purple
 * duo, ink text, Forum display + Darker Grotesque body, breathing ibis and a
 * playful floating-module brand panel. Split layout on desktop, single column
 * on mobile. Auth contract unchanged (signIn / signUp / signInWithGoogle).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithGoogle, signIn, signUp } from "@/platform/lib/auth";
import { ArrowRight, Loader2, Check, Sparkles, ShoppingBag, Boxes, Wallet, LineChart } from "lucide-react";

type Mode = "signin" | "signup";

const VARS: React.CSSProperties = {
  ["--cream" as string]: "#F9F7F4",
  ["--mint" as string]: "#E2F4F0",
  ["--purple" as string]: "#78678C",
  ["--purple-deep" as string]: "#5E4F70",
  ["--teal" as string]: "#3A7D7A",
  ["--teal-deep" as string]: "#2C625F",
  ["--ink" as string]: "#2D3139",
  ["--ink-soft" as string]: "#6B6F78",
  ["--paper" as string]: "#FFFFFF",
};

const display: React.CSSProperties = { fontFamily: "'Forum', Georgia, serif" };
const body: React.CSSProperties = { fontFamily: "'Darker Grotesque', system-ui, sans-serif" };
const EASE = [0.16, 1, 0.3, 1] as const;

function Ibis({ size = 30 }: { size?: number }) {
  return (
    <motion.svg
      width={size} height={Math.round(size * (596 / 446))} viewBox="0 0 446 596" fill="none" aria-hidden
      animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="248.743" cy="134.661" r="134.661" fill="var(--teal)" />
      <circle cx="26.5073" cy="26.5073" r="26.5073" transform="matrix(1 0 0 -1 234.653 143.724)" fill="var(--cream)" />
      <path d="M240.099 83.1536C262 69.1197 294.863 68.573 319.811 73.9713C383.905 85.0048 428.393 139.848 440.115 201.554C443.542 219.581 442.808 238.935 442.808 257.232L442.796 319.168L442.804 442.224C442.804 451.577 442.856 461.062 442.889 470.558H231.183L231.187 407.828L231.153 361.935C231.146 353.947 231.072 345.877 231.168 337.936C231.546 306.552 239.354 277.957 255.951 251.213C267.156 233.159 293.22 193.894 284.172 172.114C282.114 167.032 278.078 163.003 272.992 160.955C266.767 158.483 260.073 158.977 253.546 158.95C226.284 158.836 203.748 164.994 178.778 175.67C109.836 205.149 50.5593 252.94 15.9083 320.322C10.4219 330.991 6.86052 339.561 2.36035 350.612C3.66508 332.726 12.3456 309.584 19.6071 293.366C52.324 220.299 118.836 168.408 189.043 133.675C194.523 130.964 200.086 128.383 205.083 124.839C212.411 119.782 214.603 112.284 218.877 104.943C224.122 96.0992 231.397 88.6303 240.099 83.1536Z" fill="var(--purple)" />
      <path d="M319.811 73.9714C383.905 85.0049 428.394 139.848 440.115 201.554C443.543 219.582 442.809 238.935 442.809 257.232L442.796 319.168L442.805 442.224C442.805 451.577 442.856 461.062 442.889 470.558H394.914C381.09 447.049 367.496 423.408 354.133 399.636C327.158 351.011 301.349 305.648 311.119 247.792C316.913 213.481 335.025 189.518 339.719 154.96C343.575 126.566 337.161 96.9714 319.811 73.9714Z" fill="var(--purple-deep)" />
    </motion.svg>
  );
}

const PANEL_CARDS = [
  { label: "Sales", icon: ShoppingBag, tint: "var(--teal)", x: "8%", y: "14%", rot: -6, d: 0 },
  { label: "Production", icon: Boxes, tint: "var(--purple)", x: "58%", y: "6%", rot: 5, d: 0.5 },
  { label: "Finance", icon: Wallet, tint: "var(--teal-deep)", x: "4%", y: "62%", rot: 6, d: 1 },
  { label: "Analytics", icon: LineChart, tint: "var(--purple-deep)", x: "56%", y: "68%", rot: -4, d: 1.5 },
];

export default function AuthPage() {
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
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
        setNotice("Check your email for a confirmation link, then sign in.");
        setMode("signin");
      } else {
        const res = await signIn(email, password);
        if (res.error) throw res.error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setEmailLoading(false);
    }
  }

  const inputCls = "w-full h-12 rounded-2xl border border-[var(--ink)]/12 bg-[var(--paper)] px-4 text-title font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)] transition placeholder:text-[var(--ink-soft)] placeholder:font-medium";

  return (
    <div style={{ ...VARS, ...body }} className="min-h-screen flex bg-[var(--cream)] text-[var(--ink)]">
      {/* ── Left brand panel (desktop) ─────────────────── */}
      <div className="hidden lg:flex flex-col justify-between flex-1 px-14 py-12 relative overflow-hidden" style={{ background: "linear-gradient(150deg,var(--teal) 0%,var(--purple) 100%)" }}>
        {/* dot texture */}
        <motion.div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(circle at 50% 50%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          animate={{ backgroundPosition: ["0px 0px", "28px 28px"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />

        <motion.a href="/" className="relative flex items-center gap-2.5 w-fit text-[var(--cream)]"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <Ibis size={26} />
          <span className="text-display tracking-[0.14em]" style={display}>Al-Obour</span>
        </motion.a>

        {/* floating cards */}
        <div className="relative h-[280px] my-4">
          {PANEL_CARDS.map((c) => (
            <motion.div key={c.label} className="absolute" style={{ left: c.x, top: c.y }}
              initial={{ opacity: 0, scale: 0.6, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.3 + c.d * 0.25 }}>
              <motion.div animate={{ y: [0, -9, 0], rotate: [c.rot, c.rot + 2, c.rot] }}
                transition={{ duration: 4 + c.d, repeat: Infinity, ease: "easeInOut", delay: c.d }}
                className="flex items-center gap-2.5 bg-[var(--paper)] rounded-2xl pl-2.5 pr-4 py-2.5"
                style={{ boxShadow: "0 16px 34px -14px rgba(45,49,57,0.4)" }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.tint }}>
                  <c.icon size={17} className="text-white" />
                </span>
                <span className="text-title font-bold text-[var(--ink)] leading-none">{c.label}</span>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div className="relative max-w-[420px]"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}>
          <h2 className="text-[clamp(2rem,3vw,2.8rem)] leading-[1.05] text-[var(--cream)] mb-4" style={display}>
            One system that speaks your trade.
          </h2>
          <p className="text-title leading-[1.3] text-[var(--cream)]/80 font-medium max-w-[42ch]">
            Sales, production, inventory, finance and people — bilingual, playful, and shaped around your business. Built in Egypt by the scribes of records.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {["27+ modules", "EN / AR", "1-day custom builds"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3.5 py-1.5 text-title font-semibold text-[var(--cream)]">
                <Check size={13} /> {t}
              </span>
            ))}
          </div>
        </motion.div>

        <p className="relative text-body-lg font-semibold text-[var(--cream)]/70">© 2026 Al-Obour · Cairo, Egypt</p>
      </div>

      {/* ── Right form panel ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <motion.a href="/" className="lg:hidden flex items-center gap-2.5 mb-10 text-[var(--ink)]"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <Ibis size={28} />
          <span className="text-display tracking-[0.14em]" style={display}>Al-Obour</span>
        </motion.a>

        <div className="w-full max-w-[400px]">
          {/* Mode toggle */}
          <motion.div className="flex p-1 rounded-full bg-[var(--mint)] mb-8"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); setNotice(null); }}
                className="relative flex-1 py-2.5 text-title font-bold rounded-full transition-colors">
                {mode === m && (
                  <motion.span layoutId="auth-pill" className="absolute inset-0 rounded-full bg-[var(--ink)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
                <span className={"relative z-10 " + (mode === m ? "text-[var(--cream)]" : "text-[var(--teal-deep)]")}>
                  {m === "signin" ? "Sign in" : "Sign up"}
                </span>
              </button>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}>
            <h1 className="text-display leading-[1.02] mb-1.5" style={display}>
              {mode === "signin" ? "Welcome back." : "Let's build yours."}
            </h1>
            <p className="text-title font-medium text-[var(--ink-soft)] mb-7">
              {mode === "signin" ? "Sign in to continue to Al-Obour." : "Free for one user, forever. No card needed."}
            </p>
          </motion.div>

          {/* Google */}
          <motion.button type="button" onClick={handleGoogle} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-2xl border border-[var(--ink)]/12 bg-[var(--paper)] text-title font-bold text-[var(--ink)] hover:bg-[var(--mint)]/40 transition-colors disabled:opacity-50"
            whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5, ease: EASE }}>
            {googleLoading ? <Loader2 size={17} className="animate-spin text-[var(--ink-soft)]" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </motion.button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[var(--ink)]/10" />
            <span className="text-body-lg font-semibold text-[var(--ink-soft)]">or with email</span>
            <div className="flex-1 h-px bg-[var(--ink)]/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence mode="popLayout">
              {mode === "signup" && (
                <motion.input key="name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name" className={inputCls}
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 48 }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }} />
              )}
            </AnimatePresence>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required className={inputCls} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={6} className={inputCls} />

            <motion.button type="submit" disabled={emailLoading || !email || !password}
              className="w-full h-12 rounded-2xl bg-[var(--teal)] text-[var(--cream)] text-title font-bold flex items-center justify-center gap-2 hover:bg-[var(--teal-deep)] transition-colors disabled:opacity-40 shadow-[0_10px_30px_-10px_rgba(58,125,122,0.6)]"
              whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}>
              {emailLoading && <Loader2 size={16} className="animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
              {!emailLoading && <ArrowRight size={17} />}
            </motion.button>
          </form>

          <AnimatePresence>
            {notice && (
              <motion.p className="mt-4 flex items-center gap-2 text-title font-semibold text-[var(--teal-deep)] bg-[var(--mint)] rounded-xl px-3.5 py-2.5"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Sparkles size={15} /> {notice}
              </motion.p>
            )}
            {error && (
              <motion.p className="mt-4 text-title font-semibold text-destructive bg-destructive/10 rounded-xl px-3.5 py-2.5"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="text-center text-title font-medium text-[var(--ink-soft)] mt-6">
            {mode === "signin" ? (
              <>New to Al-Obour?{" "}
                <button onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className="text-[var(--teal)] font-bold hover:underline underline-offset-2">Start free</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="text-[var(--teal)] font-bold hover:underline underline-offset-2">Sign in</button>
              </>
            )}
          </p>

          <a href="/" className="mt-8 flex items-center justify-center gap-1.5 text-body-lg font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
            <ArrowRight size={14} className="rotate-180" /> Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
