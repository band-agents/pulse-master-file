/**
 * WorkspaceSetup — Onboarding questionnaire
 *
 * A clear, joyful setup flow in the Al-Obour brand system
 * (cream + mint, teal & purple duo, Forum + Darker Grotesque). Six tight
 * steps shape the workspace to the user's trade, then launch.
 *
 * Completion contract preserved:
 *  · demo  → write `pulse_onboarding` to localStorage + reload
 *  · live  → insert workspace + member, then refreshWorkspace()
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { getSupabaseClient, isDemoMode } from "@/platform/lib/supabase";
import { BRAND, storageKey } from "@/platform/lib/brand";
import {
  Shirt, Armchair, Factory, ShoppingBag, Wrench, UtensilsCrossed, Boxes, Sparkles,
  User, Users, Building2, Landmark, Crown,
  ShoppingCart, Wallet, BarChart3, Truck, Gift, CreditCard, Shield, PenTool, Receipt, Archive,
  ArrowRight, ArrowLeft, Check, Loader2, Rocket, Globe,
} from "lucide-react";

// ─── Brand ───────────────────────────────────────────────

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

// ─── Question data (industry-agnostic) ───────────────────

const INDUSTRIES = [
  { id: "fashion", en: "Fashion & Apparel", ar: "أزياء وملابس", icon: Shirt, tint: "var(--purple)" },
  { id: "furniture", en: "Furniture & Woodwork", ar: "أثاث ونجارة", icon: Armchair, tint: "var(--teal)" },
  { id: "manufacturing", en: "Manufacturing", ar: "تصنيع", icon: Factory, tint: "var(--purple-deep)" },
  { id: "retail", en: "Retail & E-commerce", ar: "تجزئة وتجارة", icon: ShoppingBag, tint: "var(--teal-deep)" },
  { id: "services", en: "Services & Studio", ar: "خدمات واستوديو", icon: Wrench, tint: "var(--purple)" },
  { id: "food", en: "Food & Beverage", ar: "أطعمة ومشروبات", icon: UtensilsCrossed, tint: "var(--teal)" },
  { id: "trading", en: "Trading & Distribution", ar: "تجارة وتوزيع", icon: Boxes, tint: "var(--purple-deep)" },
  { id: "other", en: "Something else", ar: "حاجة تانية", icon: Sparkles, tint: "var(--ink)" },
];

const SIZES = [
  { id: "solo", en: "Just me", ar: "أنا بس", sub: "Solo founder", subAr: "مؤسس واحد", icon: User },
  { id: "small", en: "2–10", ar: "٢–١٠", sub: "Small team", subAr: "فريق صغير", icon: Users },
  { id: "medium", en: "11–50", ar: "١١–٥٠", sub: "Growing", subAr: "بيكبر", icon: Building2 },
  { id: "large", en: "51–200", ar: "٥١–٢٠٠", sub: "Established", subAr: "مستقر", icon: Landmark },
  { id: "enterprise", en: "200+", ar: "٢٠٠+", sub: "Enterprise", subAr: "مؤسسة", icon: Crown },
];

const GOALS = [
  { id: "sales", en: "Sales & Quotations", ar: "المبيعات والعروض", icon: Receipt, tint: "var(--teal)" },
  { id: "production", en: "Production", ar: "الإنتاج", icon: Factory, tint: "var(--purple)" },
  { id: "inventory", en: "Inventory & Assets", ar: "المخزون والأصول", icon: Archive, tint: "var(--teal-deep)" },
  { id: "purchasing", en: "Purchasing", ar: "المشتريات", icon: ShoppingCart, tint: "var(--purple-deep)" },
  { id: "finance", en: "Finance", ar: "الحسابات", icon: Wallet, tint: "var(--teal)" },
  { id: "hr", en: "HR & Team", ar: "الموارد البشرية", icon: Users, tint: "var(--purple)" },
  { id: "pos", en: "Point of Sale", ar: "نقطة البيع", icon: CreditCard, tint: "var(--teal-deep)" },
  { id: "delivery", en: "Delivery", ar: "التوصيل", icon: Truck, tint: "var(--purple-deep)" },
  { id: "quality", en: "Quality Control", ar: "مراقبة الجودة", icon: Shield, tint: "var(--teal)" },
  { id: "design", en: "Design Studio", ar: "ستوديو التصميم", icon: PenTool, tint: "var(--purple)" },
  { id: "loyalty", en: "Loyalty", ar: "الولاء", icon: Gift, tint: "var(--teal-deep)" },
  { id: "analytics", en: "Analytics", ar: "التحليلات", icon: BarChart3, tint: "var(--purple-deep)" },
];

const CORE_MODULES = ["sales", "inventory", "finance", "analytics"];
const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];

// Clean categories for the module step (clear filters, not one flat grid)
const GOAL_GROUPS: { id: string; en: string; ar: string; goals: string[] }[] = [
  { id: "sell",    en: "Sell",    ar: "البيع",     goals: ["sales", "pos", "loyalty"] },
  { id: "make",    en: "Make",    ar: "التصنيع",   goals: ["production", "quality", "design"] },
  { id: "stock",   en: "Stock",   ar: "المخزون",   goals: ["inventory", "purchasing"] },
  { id: "deliver", en: "Deliver", ar: "التسليم",   goals: ["delivery"] },
  { id: "manage",  en: "Manage",  ar: "الإدارة",   goals: ["finance", "hr", "analytics"] },
];

// Smart per-industry recommended module sets (pre-selected on industry pick)
const RECOMMENDED: Record<string, string[]> = {
  fashion:       ["sales", "production", "inventory", "design", "quality", "finance", "analytics"],
  furniture:     ["sales", "production", "inventory", "delivery", "finance", "analytics"],
  manufacturing: ["production", "inventory", "purchasing", "quality", "finance", "analytics"],
  retail:        ["sales", "pos", "inventory", "loyalty", "finance", "analytics"],
  services:      ["sales", "delivery", "finance", "hr", "analytics"],
  food:          ["sales", "pos", "inventory", "purchasing", "finance", "analytics"],
  trading:       ["sales", "inventory", "purchasing", "delivery", "finance", "analytics"],
  other:         ["sales", "inventory", "finance", "analytics"],
};

const TOTAL = 6;

// ─── State ───────────────────────────────────────────────

interface State {
  industry: string;
  size: string;
  goals: string[];
  companyName: string;
  currency: string;
  language: "en" | "ar";
}
const INITIAL: State = { industry: "", size: "", goals: [], companyName: "", currency: "EGP", language: "en" };

// ─── Shared UI ───────────────────────────────────────────

function SelectCard({ active, tint, icon: Icon, title, sub, onClick, compact }: {
  active: boolean; tint: string; icon: React.ElementType; title: string; sub?: string; onClick: () => void; compact?: boolean;
}) {
  return (
    <motion.button
      type="button" onClick={onClick}
      whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={"relative text-left rounded-3xl border-2 bg-[var(--paper)] transition-colors " +
        (compact ? "p-4" : "p-5") + " " +
        (active ? "border-[var(--teal)] shadow-[0_16px_40px_-20px_rgba(58,125,122,0.5)]" : "border-[var(--ink)]/8 hover:border-[var(--ink)]/20")}
    >
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: tint }}>
        <Icon size={20} className="text-white" />
      </span>
      <p className="text-heading font-bold leading-tight text-[var(--ink)]">{title}</p>
      {sub && <p className="text-title font-medium text-[var(--ink-soft)] leading-tight">{sub}</p>}
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-[var(--teal)] flex items-center justify-center">
            <Check size={14} className="text-white" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function StepHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-title font-bold text-[var(--teal)] mb-2">{eyebrow}</p>
      <h1 className="text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.02] [text-wrap:balance]" style={display}>{title}</h1>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export default function WorkspaceSetup() {
  const { user, refreshWorkspace } = useAuth();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [state, setState] = useState<State>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<State>) => setState((p) => ({ ...p, ...patch }));
  const toggleGoal = (id: string) =>
    setState((p) => ({ ...p, goals: p.goals.includes(id) ? p.goals.filter((g) => g !== id) : [...p.goals, id] }));

  // Picking an industry pre-selects its smart recommended modules (user can edit)
  const selectIndustry = (id: string) =>
    setState((p) => ({ ...p, industry: id, goals: RECOMMENDED[id] ?? CORE_MODULES }));
  const resetRecommended = () =>
    setState((p) => ({ ...p, goals: RECOMMENDED[p.industry] ?? CORE_MODULES }));

  function go(d: number) { setDir(d); setStep((s) => Math.min(Math.max(s + d, 0), TOTAL - 1)); }

  const canNext = useMemo(() => {
    switch (step) {
      case 1: return !!state.industry;
      case 2: return !!state.size;
      case 3: return state.goals.length > 0;
      case 4: return state.companyName.trim().length > 0;
      default: return true;
    }
  }, [step, state]);

  async function launch() {
    setSaving(true); setError(null);
    const enabledModules = Array.from(new Set([...CORE_MODULES, ...state.goals]));

    if (isDemoMode) {
      localStorage.setItem(storageKey("onboarding"), JSON.stringify({
        completed: true,
        businessType: state.industry,
        companySize: state.size,
        painPoints: state.goals,
        enabled_modules: enabledModules,
        currency: state.currency,
        defaultLanguage: state.language,
        companyName: state.companyName,
        language: state.language,
      }));
      window.location.reload();
      return;
    }

    try {
      const sb = getSupabaseClient();
      if (!sb || !user) throw new Error("No connection");
      const name = state.companyName || "My Workspace";
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}-${Date.now().toString(36)}`;
      const { data: ws, error: wsErr } = await sb.from("workspaces").insert({
        name, slug, owner_id: user.id,
        plan: state.size === "enterprise" ? "enterprise" : state.size === "large" ? "pro" : "starter",
        settings: {
          enabled_modules: enabledModules, business_type: state.industry,
          company_size: state.size, currency: state.currency, company_name: state.companyName,
        },
      } as any).select().single();
      if (wsErr) throw wsErr;
      const wsData = ws as { id: string };
      const { error: memErr } = await sb.from("workspace_members").insert({
        workspace_id: wsData.id, user_id: user.id, role: "owner", status: "active",
      } as any);
      if (memErr) throw memErr;
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const slide: Variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -40 }),
  };

  const industry = INDUSTRIES.find((i) => i.id === state.industry);

  return (
    <div style={{ ...VARS, ...body }} dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[var(--cream)] text-[var(--ink)] flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-[var(--cream)]/85 backdrop-blur-xl border-b border-[var(--ink)]/6">
        <div className="max-w-[920px] mx-auto px-5 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-heading tracking-[0.14em]" style={display}>{BRAND.name}</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-[var(--ink)]/8 overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,var(--teal),var(--purple))" }}
              animate={{ width: `${((step + 1) / TOTAL) * 100}%` }} transition={{ ease: EASE, duration: 0.5 }} />
          </div>
          <span className="text-title font-bold text-[var(--ink-soft)] tabular-nums">{step + 1}/{TOTAL}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center">
        <div className="max-w-[920px] w-full mx-auto px-5 py-10">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.4, ease: EASE }}>

              {/* 0 — Welcome */}
              {step === 0 && (
                <div className="text-center py-6">
                  <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: EASE }}
                    className="w-20 h-20 rounded-[28px] mx-auto mb-7 flex items-center justify-center" style={{ background: "linear-gradient(140deg,var(--teal),var(--purple))" }}>
                    <Sparkles size={32} className="text-white" />
                  </motion.div>
                  <h1 className="text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.0] [text-wrap:balance]" style={display}>
                    Welcome. Let's shape<br />your Al-Obour.
                  </h1>
                  <p className="mt-5 text-heading font-medium text-[var(--ink-soft)] max-w-[46ch] mx-auto">
                    Six quick questions. We'll tailor the modules, vocabulary and code formats to how <em className="not-italic font-bold text-[var(--purple)]">you</em> work. Two minutes, tops.
                  </p>
                </div>
              )}

              {/* 1 — Industry */}
              {step === 1 && (
                <div>
                  <StepHead eyebrow="YOUR TRADE" title="What kind of business is this?" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    {INDUSTRIES.map((i) => (
                      <SelectCard key={i.id} compact active={state.industry === i.id} tint={i.tint} icon={i.icon}
                        title={ar ? i.ar : i.en} onClick={() => selectIndustry(i.id)} />
                    ))}
                  </div>
                  <p className="mt-5 text-title font-medium text-[var(--ink-soft)]">
                    {ar ? "هنرشّحلك الوحدات المناسبة تلقائيًا — وتقدر تعدّلها بعدين." : "We'll pre-pick the right modules for you — tweak them next."}
                  </p>
                </div>
              )}

              {/* 2 — Size */}
              {step === 2 && (
                <div>
                  <StepHead eyebrow="YOUR TEAM" title="How many people are on board?" />
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                    {SIZES.map((s) => (
                      <SelectCard key={s.id} compact active={state.size === s.id} tint="var(--ink)" icon={s.icon}
                        title={ar ? s.ar : s.en} sub={ar ? s.subAr : s.sub} onClick={() => set({ size: s.id })} />
                    ))}
                  </div>
                </div>
              )}

              {/* 3 — Goals / modules (grouped + smart-recommended) */}
              {step === 3 && (
                <div>
                  <StepHead eyebrow="YOUR FOCUS" title="What should Al-Obour handle?" />
                  <div className="-mt-5 mb-6 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mint)] text-[var(--teal-deep)] px-3.5 py-1.5 text-body-lg font-bold">
                      <Check size={13} /> {state.goals.length} {ar ? "وحدة مختارة" : "selected"}
                    </span>
                    {industry && (
                      <button onClick={resetRecommended} className="text-body-lg font-bold text-[var(--teal)] hover:underline underline-offset-2">
                        {ar ? "↺ ارجع للمقترح" : "↺ Reset to recommended"}
                      </button>
                    )}
                    <span className="text-body-lg font-medium text-[var(--ink-soft)]">{ar ? "بس اللي تختاره هيظهر في القائمة." : "Only what you pick shows in the sidebar."}</span>
                  </div>
                  <div className="space-y-6">
                    {GOAL_GROUPS.map((grp) => {
                      const items = grp.goals.map((gid) => GOALS.find((g) => g.id === gid)!).filter(Boolean);
                      const allOn = items.every((g) => state.goals.includes(g.id));
                      return (
                        <div key={grp.id}>
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-title font-bold text-[var(--ink-soft)] uppercase tracking-wide">{ar ? grp.ar : grp.en}</p>
                            <button onClick={() => setState((p) => ({
                              ...p,
                              goals: allOn ? p.goals.filter((g) => !grp.goals.includes(g)) : Array.from(new Set([...p.goals, ...grp.goals])),
                            }))} className="text-body-lg font-bold text-[var(--teal)] hover:underline underline-offset-2">
                              {allOn ? (ar ? "إلغاء الكل" : "Clear all") : (ar ? "اختر الكل" : "Select all")}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {items.map((g) => (
                              <SelectCard key={g.id} compact active={state.goals.includes(g.id)} tint={g.tint} icon={g.icon}
                                title={ar ? g.ar : g.en} onClick={() => toggleGoal(g.id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4 — Details */}
              {step === 4 && (
                <div className="max-w-[560px] mx-auto">
                  <StepHead eyebrow="YOUR WORKSPACE" title="Last bit — name your workspace." />
                  <div className="space-y-5">
                    <div>
                      <label className="text-title font-bold text-[var(--ink-soft)] mb-1.5 block">Business name</label>
                      <input value={state.companyName} onChange={(e) => set({ companyName: e.target.value })} autoFocus
                        placeholder={ar ? "اسم نشاطك" : "e.g. Nile Atelier"}
                        className="w-full h-13 rounded-2xl border-2 border-[var(--ink)]/12 bg-[var(--paper)] px-4 py-3 text-heading font-semibold focus:outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/25 transition placeholder:text-[var(--ink-soft)]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-title font-bold text-[var(--ink-soft)] mb-1.5 block">Currency</label>
                        <select value={state.currency} onChange={(e) => set({ currency: e.target.value })}
                          className="w-full h-13 rounded-2xl border-2 border-[var(--ink)]/12 bg-[var(--paper)] px-4 text-title font-semibold focus:outline-none focus:border-[var(--teal)] cursor-pointer">
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-title font-bold text-[var(--ink-soft)] mb-1.5 block">Language</label>
                        <div className="flex h-13 p-1 rounded-2xl bg-[var(--mint)]">
                          {(["en", "ar"] as const).map((l) => (
                            <button key={l} type="button" onClick={() => set({ language: l })}
                              className={"flex-1 rounded-xl text-title font-bold transition-colors " + (state.language === l ? "bg-[var(--ink)] text-[var(--cream)]" : "text-[var(--teal-deep)]")}>
                              {l === "en" ? "English" : "عربي"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5 — Launch */}
              {step === 5 && (
                <div className="text-center py-2">
                  <p className="text-title font-bold text-[var(--teal)] mb-2">ALL SET</p>
                  <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02]" style={display}>
                    {state.companyName || "Your workspace"} is ready.
                  </h1>
                  <div className="mt-8 max-w-[560px] mx-auto rounded-3xl bg-[var(--paper)] border border-[var(--ink)]/8 p-6 text-left shadow-[0_20px_50px_-28px_rgba(45,49,57,0.4)]">
                    <Row label={ar ? "النشاط" : "Trade"} value={industry ? (ar ? industry.ar : industry.en) : "—"} icon={industry?.icon ?? Globe} tint={industry?.tint ?? "var(--ink)"} />
                    <Row label={ar ? "الفريق" : "Team"} value={(SIZES.find((s) => s.id === state.size)?.[ar ? "ar" : "en"]) ?? "—"} icon={Users} tint="var(--purple)" />
                    <Row label={ar ? "الوحدات" : "Modules"} value={`${state.goals.length + CORE_MODULES.filter(c=>!state.goals.includes(c)).length} ${ar ? "مُفعّلة" : "enabled"}`} icon={Boxes} tint="var(--teal)" />
                    <Row label={ar ? "العملة واللغة" : "Currency & language"} value={`${state.currency} · ${state.language === "en" ? "English" : "عربي"}`} icon={Wallet} tint="var(--purple-deep)" last />
                  </div>
                  {error && <p className="mt-5 text-title font-semibold text-destructive bg-destructive/10 rounded-xl px-4 py-2.5 inline-block">{error}</p>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer nav */}
      <div className="sticky bottom-0 bg-[var(--cream)]/85 backdrop-blur-xl border-t border-[var(--ink)]/6">
        <div className="max-w-[920px] mx-auto px-5 py-4 flex items-center justify-between">
          <button onClick={() => go(-1)} disabled={step === 0}
            className="inline-flex items-center gap-1.5 text-title font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-0 transition">
            <ArrowLeft size={18} /> {ar ? "رجوع" : "Back"}
          </button>

          {step < TOTAL - 1 ? (
            <motion.button onClick={() => go(1)} disabled={!canNext} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)] text-[var(--cream)] text-title font-bold px-7 py-3 hover:bg-[var(--teal-deep)] transition-colors disabled:opacity-40 shadow-[0_10px_30px_-10px_rgba(58,125,122,0.6)]">
              {step === 0 ? (ar ? "يلا نبدأ" : "Let's go") : (ar ? "التالي" : "Continue")}
              <ArrowRight size={18} />
            </motion.button>
          ) : (
            <motion.button onClick={launch} disabled={saving} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full text-title font-bold px-8 py-3 text-[var(--cream)] transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,var(--teal),var(--purple))" }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
              {ar ? "ابدأ Al-Obour" : "Launch Al-Obour"}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon, tint, last }: { label: string; value: string; icon: React.ElementType; tint: string; last?: boolean }) {
  return (
    <div className={"flex items-center gap-3.5 py-3.5 " + (last ? "" : "border-b border-[var(--ink)]/6")}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint }}>
        <Icon size={17} className="text-white" />
      </span>
      <div className="flex-1">
        <p className="text-body-lg font-semibold text-[var(--ink-soft)] leading-none mb-1">{label}</p>
        <p className="text-title font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}
