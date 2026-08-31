/**
 * Landing — "The Joyful Operating System"
 *
 * A playful, tech-forward marketing page built on the real Al-Obour brand palette
 * (cream + mint canvas, teal & purple as a duo, ink text) with Forum display +
 * Darker Grotesque body. Heavy on motion: floating module cards, count-up
 * stats, a brand marquee, scroll reveals, magnetic CTAs and a breathing ibis.
 *
 * Hospital-first copy: Al-Obour speaks the language of wards, clinics and care teams.
 */

import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  animate,
  type Variants,
} from "framer-motion";
import {
  ArrowRight, Sparkles, Boxes, LineChart, Wallet, Truck,
  ShoppingBag, Gauge, Star, Check, Zap, Globe,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────

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

// ─── Real ibis mark, breathing ───────────────────────────

function Ibis({ size = 34 }: { size?: number }) {
  return (
    <motion.svg
      width={size} height={Math.round(size * (596 / 446))}
      viewBox="0 0 446 596" fill="none" aria-hidden
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="248.743" cy="134.661" r="134.661" fill="var(--teal)" />
      <circle cx="26.5073" cy="26.5073" r="26.5073" transform="matrix(1 0 0 -1 234.653 143.724)" fill="var(--cream)" />
      <path d="M240.099 83.1536C262 69.1197 294.863 68.573 319.811 73.9713C383.905 85.0048 428.393 139.848 440.115 201.554C443.542 219.581 442.808 238.935 442.808 257.232L442.796 319.168L442.804 442.224C442.804 451.577 442.856 461.062 442.889 470.558H231.183L231.187 407.828L231.153 361.935C231.146 353.947 231.072 345.877 231.168 337.936C231.546 306.552 239.354 277.957 255.951 251.213C267.156 233.159 293.22 193.894 284.172 172.114C282.114 167.032 278.078 163.003 272.992 160.955C266.767 158.483 260.073 158.977 253.546 158.95C226.284 158.836 203.748 164.994 178.778 175.67C109.836 205.149 50.5593 252.94 15.9083 320.322C10.4219 330.991 6.86052 339.561 2.36035 350.612C3.66508 332.726 12.3456 309.584 19.6071 293.366C52.324 220.299 118.836 168.408 189.043 133.675C194.523 130.964 200.086 128.383 205.083 124.839C212.411 119.782 214.603 112.284 218.877 104.943C224.122 96.0992 231.397 88.6303 240.099 83.1536Z" fill="var(--purple)" />
      <path d="M319.811 73.9714C383.905 85.0049 428.394 139.848 440.115 201.554C443.543 219.582 442.809 238.935 442.809 257.232L442.796 319.168L442.805 442.224C442.805 451.577 442.856 461.062 442.889 470.558H394.914C381.09 447.049 367.496 423.408 354.133 399.636C327.158 351.011 301.349 305.648 311.119 247.792C316.913 213.481 335.025 189.518 339.719 154.96C343.575 126.566 337.161 96.9714 319.811 73.9714Z" fill="var(--purple-deep)" />
    </motion.svg>
  );
}

// ─── Scroll reveal ───────────────────────────────────────

function Reveal({ children, delay = 0, y = 24, className = "" }: {
  children: React.ReactNode; delay?: number; y?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Count-up number ─────────────────────────────────────

function Counter({ to, suffix = "", duration = 1.6 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration, ease: EASE,
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  return <span ref={ref}>{Math.round(val).toLocaleString()}{suffix}</span>;
}

// ─── Magnetic button ─────────────────────────────────────

function Magnetic({ children, className = "", onClick, primary }: {
  children: React.ReactNode; className?: string; onClick?: () => void; primary?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 18 });
  const sy = useSpring(y, { stiffness: 250, damping: 18 });

  function move(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.32);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.32);
  }
  function leave() { x.set(0); y.set(0); }

  return (
    <motion.button
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      onClick={onClick}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.96 }}
      className={
        "group relative inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-title font-bold transition-shadow " +
        (primary
          ? "text-[var(--cream)] shadow-[0_10px_30px_-8px_rgba(58,125,122,0.6)] hover:shadow-[0_16px_40px_-8px_rgba(58,125,122,0.7)]"
          : "text-[var(--ink)]") +
        " " + className
      }
    >
      {children}
    </motion.button>
  );
}

// ─── Floating module card (hero visual) ──────────────────

interface FloatCard {
  label: string; icon: React.ElementType; tint: string;
  x: string; y: string; rot: number; delay: number; scale?: number;
}

const FLOAT_CARDS: FloatCard[] = [
  { label: "Sales", icon: ShoppingBag, tint: "var(--teal)", x: "2%", y: "8%", rot: -6, delay: 0 },
  { label: "Production", icon: Boxes, tint: "var(--purple)", x: "62%", y: "2%", rot: 5, delay: 0.4 },
  { label: "Inventory", icon: Truck, tint: "var(--teal-deep)", x: "70%", y: "44%", rot: -4, delay: 0.8 },
  { label: "Finance", icon: Wallet, tint: "var(--purple-deep)", x: "0%", y: "52%", rot: 7, delay: 1.2 },
  { label: "Analytics", icon: LineChart, tint: "var(--teal)", x: "30%", y: "70%", rot: -3, delay: 0.6, scale: 0.92 },
];

function HeroStage() {
  return (
    <div className="relative w-full h-[400px] sm:h-[460px]">
      {/* central pulsing core */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-[34px] flex flex-col items-center justify-center text-center"
        style={{ background: "var(--ink)", boxShadow: "0 30px 60px -20px rgba(45,49,57,0.55)" }}
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
      >
        <motion.div animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <Ibis size={48} />
        </motion.div>
        <span className="mt-2 text-[var(--cream)] text-body-lg tracking-[0.32em]" style={display}>Al-Obour</span>
        <span className="text-[var(--ink-soft)] text-caption tracking-[0.2em] mt-0.5" style={body}>YOUR OS</span>
      </motion.div>

      {/* orbit ring */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[330px] h-[330px] rounded-full border border-dashed border-[var(--teal)]/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />

      {FLOAT_CARDS.map((c) => (
        <motion.div
          key={c.label}
          className="absolute"
          style={{ left: c.x, top: c.y }}
          initial={{ opacity: 0, scale: 0.5, y: 30 }}
          animate={{ opacity: 1, scale: c.scale ?? 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.5 + c.delay * 0.3 }}
        >
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [c.rot, c.rot + 2, c.rot] }}
            transition={{ duration: 4 + c.delay, repeat: Infinity, ease: "easeInOut", delay: c.delay }}
            whileHover={{ scale: 1.08, rotate: 0, transition: { duration: 0.25 } }}
            className="flex items-center gap-2.5 bg-[var(--paper)] rounded-2xl pl-2.5 pr-4 py-2.5 cursor-default"
            style={{ boxShadow: "0 16px 34px -14px rgba(45,49,57,0.32)" }}
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.tint }}>
              <c.icon size={17} className="text-white" />
            </span>
            <span className="text-title font-bold text-[var(--ink)] leading-none" style={body}>{c.label}</span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Background floating orbs ─────────────────────────────

function Orbs() {
  const blobs = [
    { c: "var(--mint)", s: 480, x: "-12%", y: "-10%", d: 0 },
    { c: "rgba(120,103,140,0.18)", s: 420, x: "72%", y: "6%", d: 2 },
    { c: "rgba(58,125,122,0.14)", s: 520, x: "50%", y: "60%", d: 4 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[80px]"
          style={{ width: b.s, height: b.s, left: b.x, top: b.y, background: b.c }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 18 + i * 4, repeat: Infinity, ease: "easeInOut", delay: b.d }}
        />
      ))}
    </div>
  );
}

// ─── Marquee ─────────────────────────────────────────────

const MARQUEE = [
  "Sales", "Quotations", "Production", "Inventory", "Assets", "Finance",
  "HR", "Loyalty", "POS", "Analytics", "Purchasing", "Delivery", "CRM", "Shopify",
];

function Marquee() {
  return (
    <div className="relative overflow-hidden py-5 bg-[var(--ink)] -rotate-1 scale-105">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {[...MARQUEE, ...MARQUEE].map((m, i) => (
          <span key={i} className="inline-flex items-center gap-8 text-display text-[var(--cream)]/80" style={display}>
            {m}
            <Sparkles size={15} className="text-[var(--teal)]" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Powers (the myth, joyfully) ─────────────────────────

const POWERS = [
  { k: "Writing", sub: "Records", icon: Boxes, tint: "var(--teal)", copy: "Every quote, order and product — captured the moment it happens. Name them your way." },
  { k: "Counting", sub: "Accounts", icon: Wallet, tint: "var(--purple)", copy: "Money in, money out, stock and assets. The numbers add up while you sleep." },
  { k: "Judgement", sub: "Analytics", icon: Gauge, tint: "var(--ink)", copy: "Live dashboards that tell you what to do next — not just what already happened." },
];

// ─── Pricing ─────────────────────────────────────────────

const PLANS = [
  { name: "Free", price: "0", unit: "forever", tint: "var(--ink)", feats: ["1 user", "Core modules", "Demo data"], cta: "Start free" },
  { name: "Scribe", price: "900", unit: "EGP / mo", tint: "var(--teal)", feats: ["Unlimited modules", "Custom code formats", "Email support"], cta: "Choose Scribe", pop: true },
  { name: "Temple", price: "4,999", unit: "EGP / mo", tint: "var(--purple)", feats: ["Everything in Scribe", "Priority support", "1-day custom builds"], cta: "Choose Temple" },
];

// ─── Capability mini-mockups (playful product "snapshots") ──

/** Animated bar chart that grows when scrolled into view. */
function MiniChart() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const bars = [42, 68, 55, 88, 73, 96];
  return (
    <div ref={ref}>
      <div className="flex items-end justify-between gap-1.5 h-[78px]">
        {bars.map((h, i) => (
          <motion.div key={i} className="flex-1 rounded-t-md"
            style={{ background: i === 3 ? "var(--teal)" : "var(--mint)" }}
            initial={{ height: 0 }} animate={inView ? { height: `${h}%` } : {}}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.08 }} />
        ))}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-display leading-none text-[var(--teal-deep)]" style={display}>
          {inView && <Counter to={284} duration={1.4} />}<span className="text-title">K</span>
        </span>
        <span className="text-body-lg font-bold text-success">▲ 18%</span>
      </div>
    </div>
  );
}

/** Quotation card with line items + a discount badge. */
function MiniQuote() {
  return (
    <div className="text-body-lg">
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-body px-2 py-0.5 rounded-md bg-[var(--mint)] text-[var(--teal-deep)]">QT-00042</span>
        <motion.span
          initial={{ scale: 0, rotate: -12 }} whileInView={{ scale: 1, rotate: -8 }} viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
          className="text-body font-bold px-2 py-0.5 rounded-md bg-[var(--purple)] text-white">−15% off</motion.span>
      </div>
      {[["3× Oak chair", "1,200"], ["1× Walnut table", "4,800"]].map(([a, b]) => (
        <div key={a} className="flex items-center justify-between py-1.5 border-b border-[var(--ink)]/6">
          <span className="font-semibold text-[var(--ink-soft)]">{a}</span>
          <span className="font-bold">{b}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2.5">
        <span className="font-bold">Total</span>
        <span className="text-title font-bold text-[var(--teal-deep)]">EGP 5,100</span>
      </div>
    </div>
  );
}

/** Production kanban with chips that wobble. */
function MiniKanban() {
  const cols = [
    { t: "Cutting", c: ["#A", "#B"], tint: "var(--teal)" },
    { t: "Sewing", c: ["#C"], tint: "var(--purple)" },
    { t: "Done", c: ["#D", "#E"], tint: "var(--ink)" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map((col, ci) => (
        <div key={col.t}>
          <p className="text-caption font-bold text-[var(--ink-soft)] mb-1.5">{col.t}</p>
          <div className="space-y-1.5">
            {col.c.map((chip, i) => (
              <motion.div key={chip}
                animate={{ y: [0, -3, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: ci * 0.3 + i * 0.4, ease: "easeInOut" }}
                className="h-7 rounded-lg flex items-center px-2 text-caption font-bold text-white" style={{ background: col.tint }}>
                {chip}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inventory stock bars. */
function MiniStock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const items = [["Cotton", 82, "var(--teal)"], ["Denim", 34, "var(--purple)"], ["Linen", 61, "var(--teal-deep)"]] as const;
  return (
    <div className="space-y-3" ref={ref}>
      {items.map(([name, pct, tint], i) => (
        <div key={name}>
          <div className="flex items-center justify-between text-body font-bold mb-1">
            <span>{name}</span><span className="text-[var(--ink-soft)]">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--ink)]/8 overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: tint as string }}
              initial={{ width: 0 }} animate={inView ? { width: `${pct}%` } : {}}
              transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const CAPS: { label: string; icon: React.ElementType; tint: string; copy: string; mock: React.ReactNode; span?: string }[] = [
  { label: "Sales that sing", icon: ShoppingBag, tint: "var(--teal)", copy: "Watch revenue climb in real time — quotes, orders and POS, all feeding one live picture.", mock: <MiniChart />, span: "md:col-span-2" },
  { label: "Quotes with flair", icon: Wallet, tint: "var(--purple)", copy: "Build branded quotes, drop a discount, send a PDF — convert to an order in one tap.", mock: <MiniQuote /> },
  { label: "Production, visible", icon: Boxes, tint: "var(--ink)", copy: "Every job on a board you can read at a glance. Drag it from cutting to done.", mock: <MiniKanban /> },
  { label: "Stock you can trust", icon: Truck, tint: "var(--teal-deep)", copy: "Live levels, reorder alerts, fabrics & assets — never run out, never over-buy.", mock: <MiniStock />, span: "md:col-span-2" },
];

function Capabilities() {
  return (
    <section id="capabilities" className="py-24 sm:py-32 bg-[var(--cream)]">
      <div className="max-w-[1200px] mx-auto px-5">
        <Reveal>
          <p className="text-title font-bold text-[var(--purple)] mb-3">A PEEK INSIDE</p>
          <h2 className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] max-w-[20ch]" style={display}>
            Real tools, doing real work — and looking good doing it.
          </h2>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {CAPS.map((c, i) => (
            <Reveal key={c.label} delay={i * 0.1} className={c.span ?? ""}>
              <motion.div
                whileHover={{ y: -8, rotate: -0.5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-full rounded-[28px] bg-[var(--paper)] p-6 border border-[var(--ink)]/6 shadow-[0_14px_40px_-22px_rgba(45,49,57,0.3)]"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: c.tint }}>
                    <c.icon size={19} className="text-white" />
                  </span>
                  <h3 className="text-display leading-none" style={display}>{c.label}</h3>
                </div>
                <div className="rounded-2xl bg-[var(--cream)] border border-[var(--ink)]/6 p-4 mb-4">{c.mock}</div>
                <p className="text-title leading-[1.25] text-[var(--ink-soft)] font-medium">{c.copy}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", icon: Sparkles, tint: "var(--teal)", t: "Answer 6 questions", c: "Tell Al-Obour about your hospital and team. It pre-picks the right modules and names them your way." },
  { n: "2", icon: Boxes, tint: "var(--purple)", t: "Pour in your data", c: "Import from a spreadsheet or start from sample data. Your codes, your formats — instantly." },
  { n: "3", icon: Gauge, tint: "var(--ink)", t: "Run the whole show", c: "Sell, make, stock, pay, analyse — every corner of the business in one joyful place." },
];

function HowItWorks() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-[1100px] mx-auto px-5">
        <Reveal className="text-center mb-14">
          <p className="text-title font-bold text-[var(--teal)] mb-3">LIVE IN MINUTES</p>
          <h2 className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02]" style={display}>Three steps. No IT degree.</h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5 relative">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <motion.div whileHover={{ y: -6 }} className="h-full rounded-[28px] bg-[var(--paper)] border border-[var(--ink)]/6 p-7 text-center shadow-[0_14px_40px_-24px_rgba(45,49,57,0.3)]">
                <motion.div
                  animate={{ rotate: [0, 6, -6, 0] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-3xl mx-auto mb-5 flex items-center justify-center relative" style={{ background: s.tint }}>
                  <s.icon size={26} className="text-white" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--cream)] border-2 border-[var(--ink)]/10 flex items-center justify-center text-body-lg font-bold" style={display}>{s.n}</span>
                </motion.div>
                <h3 className="text-display leading-tight mb-2" style={display}>{s.t}</h3>
                <p className="text-title leading-[1.25] text-[var(--ink-soft)] font-medium">{s.c}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════

export default function Landing() {
  const [, navigate] = useLocation();
  const goAuth = () => navigate("/auth");
  const { scrollYProgress } = useScroll();
  const barScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const heroStagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const heroItem: Variants = {
    hidden: { opacity: 0, y: 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
  };

  return (
    <div style={{ ...VARS, ...body }} className="min-h-screen bg-[var(--cream)] text-[var(--ink)] overflow-x-hidden">
      {/* scroll progress */}
      <motion.div className="fixed top-0 left-0 right-0 h-[3px] origin-left z-50" style={{ scaleX: barScale, background: "linear-gradient(90deg,var(--teal),var(--purple))" }} />

      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40">
        <div className="max-w-[1200px] mx-auto px-5 mt-4">
          <motion.nav
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex items-center justify-between rounded-full bg-[var(--paper)]/80 backdrop-blur-xl border border-[var(--ink)]/8 pl-5 pr-2 py-2 shadow-[0_8px_30px_-12px_rgba(45,49,57,0.18)]"
          >
            <a href="/" className="flex items-center gap-2">
              <Ibis size={24} />
              <span className="text-heading tracking-[0.14em] leading-none" style={display}>Al-Obour</span>
            </a>
            <div className="hidden md:flex items-center gap-7 text-title font-semibold text-[var(--ink-soft)]">
              {[["Powers", "powers"], ["Inside", "capabilities"], ["Product", "product"], ["Pricing", "pricing"]].map(([l, id]) => (
                <a key={id} href={`#${id}`} className="hover:text-[var(--ink)] transition-colors">{l}</a>
              ))}
            </div>
            <button onClick={goAuth} className="rounded-full bg-[var(--ink)] text-[var(--cream)] text-title font-bold px-5 py-2.5 hover:bg-[var(--teal)] transition-colors">
              Sign in
            </button>
          </motion.nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative pt-[150px] pb-20">
        <Orbs />
        <div className="relative max-w-[1200px] mx-auto px-5 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div variants={heroStagger} initial="hidden" animate="show">
            <motion.div variants={heroItem} className="inline-flex items-center gap-2 rounded-full bg-[var(--mint)] text-[var(--teal-deep)] px-4 py-1.5 text-title font-bold mb-6">
              <Zap size={14} /> One system for the whole business
            </motion.div>
            <motion.h1 variants={heroItem} className="text-[clamp(3rem,7vw,5.6rem)] leading-[0.95] tracking-[-0.01em]" style={display}>
              Run anything.<br />
              <span className="relative inline-block">
                <span className="relative z-10 text-[var(--teal)]">Joyfully.</span>
                <motion.span
                  className="absolute -bottom-1 left-0 h-[14px] rounded-full -z-0"
                  style={{ background: "var(--mint)" }}
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, ease: EASE, delay: 1 }}
                />
              </span>
            </motion.h1>
            <motion.p variants={heroItem} className="mt-6 text-heading leading-[1.25] text-[var(--ink-soft)] max-w-[40ch] font-medium">
              Al-Obour is the hospital information system built around how <em className="text-[var(--purple)] not-italic font-bold">your</em> hospital runs — your words, your codes, your workflow. Admissions to discharge to billing, in one place that keeps up with you.
            </motion.p>
            <motion.div variants={heroItem} className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic primary onClick={goAuth} className="bg-[var(--teal)]">
                Start free <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Magnetic>
              <Magnetic onClick={() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })} className="bg-[var(--paper)] border border-[var(--ink)]/10">
                See it move
              </Magnetic>
            </motion.div>
            <motion.div variants={heroItem} className="mt-8 flex items-center gap-2 text-title font-semibold text-[var(--ink-soft)]">
              <div className="flex -space-x-1.5">
                {["var(--teal)", "var(--purple)", "var(--ink)"].map((c) => (
                  <span key={c} className="w-6 h-6 rounded-full border-2 border-[var(--cream)]" style={{ background: c }} />
                ))}
              </div>
              Bilingual EN / AR · built in Egypt
            </motion.div>
          </motion.div>

          <HeroStage />
        </div>
      </section>

      <Marquee />

      {/* ── Powers ──────────────────────────────────────── */}
      <section id="powers" className="py-24 sm:py-32">
        <div className="max-w-[1200px] mx-auto px-5">
          <Reveal>
            <p className="text-title font-bold text-[var(--teal)] mb-3">THE THREE POWERS OF Al-Obour</p>
            <h2 className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] max-w-[18ch]" style={display}>
              The scribe-god's job, rebuilt for your business.
            </h2>
          </Reveal>
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {POWERS.map((p, i) => (
              <Reveal key={p.k} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="h-full rounded-[28px] bg-[var(--paper)] p-7 border border-[var(--ink)]/6 shadow-[0_14px_40px_-22px_rgba(45,49,57,0.3)]"
                >
                  <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: p.tint }}>
                    <p.icon size={24} className="text-white" />
                  </span>
                  <div className="flex items-baseline gap-2.5">
                    <h3 className="text-display leading-none" style={display}>{p.k}</h3>
                    <span className="text-title font-bold text-[var(--ink-soft)] uppercase tracking-wide">{p.sub}</span>
                  </div>
                  <p className="mt-3 text-title leading-[1.25] text-[var(--ink-soft)] font-medium">{p.copy}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Capabilities />

      {/* ── Make it yours (genericization story) ─────────── */}
      <section id="product" className="py-24 sm:py-28 bg-[var(--ink)] text-[var(--cream)] relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-5 grid lg:grid-cols-2 gap-14 items-center relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)]/20 text-[var(--mint)] px-4 py-1.5 text-title font-bold mb-6">
              <Globe size={14} /> Built to fit any hospital
            </div>
            <h2 className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02]" style={display}>
              It learns to speak your hospital's language.
            </h2>
            <p className="mt-5 text-heading leading-[1.3] text-[var(--cream)]/70 font-medium max-w-[44ch]">
              Community clinic, specialty center, teaching hospital or a single private practice — onboarding tailors the modules, the vocabulary and the code formats to you. Call them wards or clinics; Al-Obour adapts.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-[440px]">
              {[
                "Your module names", "Your code formats",
                "Your care pathways", "Your starter data",
              ].map((f, i) => (
                <Reveal key={f} delay={i * 0.08}>
                  <div className="flex items-center gap-2.5 text-title font-semibold">
                    <span className="w-6 h-6 rounded-full bg-[var(--teal)] flex items-center justify-center shrink-0"><Check size={13} /></span>
                    {f}
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* Code-format playground mock */}
          <Reveal delay={0.15}>
            <div className="rounded-[28px] border border-white/10 p-6 shadow-2xl" style={{ background: "#23262d" }}>
              <p className="text-body-lg font-bold text-[var(--cream)]/50 mb-4 tracking-wide">YOUR CODE SYSTEM, LIVE</p>
              {[
                { label: "Quotation", code: "QA-12345", tint: "var(--teal)" },
                { label: "Product", code: "FASH23400", tint: "var(--purple)" },
                { label: "Asset", code: "AST-0001", tint: "var(--mint)", dark: true },
              ].map((r, i) => (
                <motion.div
                  key={r.label}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: EASE }}
                  className="flex items-center justify-between py-3.5 border-b border-white/8 last:border-0"
                >
                  <span className="text-title font-semibold text-[var(--cream)]/80">{r.label}</span>
                  <span className="font-mono text-title px-3 py-1 rounded-lg" style={{ background: r.tint, color: r.dark ? "var(--ink)" : "white" }}>{r.code}</span>
                </motion.div>
              ))}
              <p className="mt-4 text-body-lg text-[var(--cream)]/40 font-medium">Prefix · separator · digits · year · start — all yours.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <HowItWorks />

      {/* ── Stats band ──────────────────────────────────── */}
      <section className="py-20 bg-[var(--mint)]">
        <div className="max-w-[1100px] mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: 27, s: "+", l: "modules, one login" },
            { n: 2, s: "", l: "languages, first-class" },
            { n: 1, s: " day", l: "custom builds" },
            { n: 100, s: "%", l: "yours to rename" },
          ].map((st, i) => (
            <Reveal key={st.l} delay={i * 0.1}>
              <div className="text-[clamp(2.6rem,5vw,4rem)] leading-none text-[var(--teal-deep)]" style={display}>
                <Counter to={st.n} suffix={st.s} />
              </div>
              <p className="mt-2 text-title font-semibold text-[var(--ink-soft)]">{st.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section id="pricing" className="py-24 sm:py-32">
        <div className="max-w-[1100px] mx-auto px-5">
          <Reveal className="text-center">
            <h2 className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02]" style={display}>Pricing that grows with you.</h2>
            <p className="mt-3 text-heading font-medium text-[var(--ink-soft)]">Start free. Upgrade when the workshop hums.</p>
          </Reveal>
          <div className="mt-14 grid md:grid-cols-3 gap-5 items-start">
            {PLANS.map((pl, i) => (
              <Reveal key={pl.name} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={"relative rounded-[28px] p-7 border " + (pl.pop ? "bg-[var(--ink)] text-[var(--cream)] border-transparent shadow-[0_24px_60px_-24px_rgba(45,49,57,0.6)]" : "bg-[var(--paper)] border-[var(--ink)]/8")}
                >
                  {pl.pop && (
                    <span className="absolute -top-3 left-7 rounded-full bg-[var(--teal)] text-white text-body-lg font-bold px-3 py-1 flex items-center gap-1">
                      <Star size={12} /> Most loved
                    </span>
                  )}
                  <h3 className="text-display" style={display}>{pl.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-display leading-none" style={display}>{pl.price}</span>
                    <span className={"text-title font-semibold " + (pl.pop ? "text-[var(--cream)]/60" : "text-[var(--ink-soft)]")}>{pl.unit}</span>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {pl.feats.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-title font-semibold">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: pl.tint }}><Check size={12} className="text-white" /></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={goAuth} className={"mt-7 w-full rounded-full py-3 text-title font-bold transition-colors " + (pl.pop ? "bg-[var(--teal)] text-white hover:bg-[var(--teal-deep)]" : "bg-[var(--ink)] text-[var(--cream)] hover:bg-[var(--teal)]")}>
                    {pl.cta}
                  </button>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="pb-28">
        <div className="max-w-[1100px] mx-auto px-5">
          <Reveal>
            <div className="relative overflow-hidden rounded-[40px] px-8 py-20 text-center" style={{ background: "linear-gradient(135deg,var(--teal) 0%,var(--purple) 100%)" }}>
              <motion.div
                className="absolute inset-0 opacity-30"
                style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "26px 26px" }}
                animate={{ backgroundPosition: ["0px 0px", "26px 26px"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative">
                <h2 className="text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[0.98] text-[var(--cream)]" style={display}>
                  Your business, finally<br />in one joyful place.
                </h2>
                <div className="mt-8 flex justify-center">
                  <Magnetic onClick={goAuth} className="bg-[var(--cream)] text-[var(--ink)] text-heading">
                    Start free today <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                  </Magnetic>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-[var(--ink)]/8 py-10">
        <div className="max-w-[1200px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Ibis size={22} />
            <span className="text-heading tracking-[0.14em]" style={display}>Al-Obour</span>
          </div>
          <p className="text-title font-semibold text-[var(--ink-soft)]">© 2026 Al-Obour · Cairo, Egypt · The god of records would approve.</p>
        </div>
      </footer>
    </div>
  );
}
