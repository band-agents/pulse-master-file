import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { X, Eye, EyeOff, Loader2, AlertCircle, Chrome } from "lucide-react";
import { signInWithGoogle, signInWithApple } from "@/platform/lib/auth";
import { Logo } from "../Logo";

type Mode = "login" | "signup" | "reset";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
}

export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await signIn(email, password);
        if (res.error) { setError(res.error); return; }
        onClose();
      } else if (mode === "signup") {
        const res = await signUp(email, password, fullName);
        if (res.error) { setError(res.error); return; }
        setSuccess("Check your email to confirm your account.");
      } else {
        const { resetPasswordForEmail } = await import("@/platform/lib/auth");
        const res = await resetPasswordForEmail(email);
        if (res.error) { setError(res.error.message); return; }
        setSuccess("Password reset link sent. Check your email.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <X size={14} />
        </button>

        <div className="px-8 py-8">
          {/* Logo */}
          <div className="mb-6">
            <Logo variant="full" size={18} />
            <p className="text-caption text-muted-foreground mt-1.5">
              {mode === "login" ? "Sign in to your workspace" : mode === "signup" ? "Create your account" : "Reset your password"}
            </p>
          </div>

          {/* OAuth buttons (login + signup only) */}
          {mode !== "reset" && (
            <div className="space-y-2.5 mb-5">
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/60 transition-colors"
              >
                <Chrome size={15} />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => signInWithApple()}
                className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/>
                </svg>
                Continue with Apple
              </button>
            </div>
          )}

          {/* Divider */}
          {mode !== "reset" && (
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
              <div className="relative flex justify-center text-micro text-muted-foreground/60 bg-background px-3"><span className="bg-background px-2">or</span></div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div>
                <label className="text-micro font-medium text-muted-foreground mb-1 block">Full Name</label>
                <input
                  type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                  className="w-full h-10 rounded-xl border border-border/60 bg-background px-3.5 text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/30 transition"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="text-micro font-medium text-muted-foreground mb-1 block">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full h-10 rounded-xl border border-border/60 bg-background px-3.5 text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/30 transition"
                placeholder="you@company.com"
              />
            </div>

            {mode !== "reset" && (
              <div>
                <label className="text-micro font-medium text-muted-foreground mb-1 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="w-full h-10 rounded-xl border border-border/60 bg-background px-3.5 pr-10 text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/30 transition"
                    placeholder="Min. 8 characters"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-caption text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3.5 py-2.5">
                <AlertCircle size={13} />
                {error}
              </div>
            )}
            {success && (
              <div className="text-caption text-success bg-success/10 border border-success/30 rounded-xl px-3.5 py-2.5">{success}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full h-10 rounded-xl bg-foreground text-background text-body font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-5 flex items-center justify-between text-micro text-muted-foreground/70">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("signup"); setError(null); setSuccess(null); }} className="hover:text-foreground transition-colors">
                  Create account
                </button>
                <button onClick={() => { setMode("reset"); setError(null); setSuccess(null); }} className="hover:text-foreground transition-colors">
                  Forgot password?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button onClick={() => { setMode("login"); setError(null); setSuccess(null); }} className="hover:text-foreground transition-colors">
                Already have an account? Sign in
              </button>
            )}
            {mode === "reset" && (
              <button onClick={() => { setMode("login"); setError(null); setSuccess(null); }} className="hover:text-foreground transition-colors">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
