/**
 * Computerised Physician Order Entry — إدخال الأوامر الطبية
 *
 * Ordering with decision support in the loop. The composer runs the rules in
 * `clinical-rules.ts` on every keystroke, so the clinician sees a conflict
 * while they are still deciding rather than after they commit.
 *
 * The design rule the alert panel follows: only `high` and `contraindicated`
 * block signing, and blocking always demands a typed reason that is stored on
 * the order. An override with no recorded rationale is worse than no alert at
 * all, because it teaches everyone that alerts are noise.
 */

import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  ScrollText, Plus, AlertTriangle, ShieldAlert, Check, X, Pill as PillIcon,
  FlaskConical, Scan, Stethoscope, Utensils, Droplet, ClipboardCheck, Zap,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, Drawer, EmptyState, useCollection, matches, fmtDateTime, fmtAgo,
  btnPrimary, btnGhost, inputCls, labelCls, serif, TONE_PILL,
  type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import { evaluateOrder, requiresOverride, type RuleAlert, type AlertSeverity, KB_STATS } from "@/platform/clinical/rules";
import type { Database } from "@/domain/types";

type Order = Database["public"]["Tables"]["clinical_orders"]["Row"];

const ORDER_STATUS: StatusMap = {
  draft:             { en: "Draft",       ar: "مسودة",        tone: "neutral" },
  pending_signature: { en: "Unsigned",    ar: "دون توقيع",    tone: "warning" },
  active:            { en: "Active",      ar: "نشط",          tone: "success" },
  in_progress:       { en: "In progress", ar: "قيد التنفيذ",  tone: "info" },
  completed:         { en: "Completed",   ar: "مكتمل",        tone: "neutral" },
  held:              { en: "Held",        ar: "موقوف",        tone: "warning" },
  cancelled:         { en: "Cancelled",   ar: "ملغى",         tone: "neutral" },
  expired:           { en: "Expired",     ar: "منتهٍ",        tone: "neutral" },
};

const CATEGORIES: { value: Order["category"]; en: string; ar: string; icon: React.ElementType }[] = [
  { value: "medication", en: "Medication", ar: "دواء",       icon: PillIcon },
  { value: "lab",        en: "Laboratory", ar: "مختبر",      icon: FlaskConical },
  { value: "imaging",    en: "Imaging",    ar: "أشعة",       icon: Scan },
  { value: "procedure",  en: "Procedure",  ar: "إجراء",      icon: Stethoscope },
  { value: "nursing",    en: "Nursing",    ar: "تمريض",      icon: ClipboardCheck },
  { value: "diet",       en: "Diet",       ar: "تغذية",      icon: Utensils },
  { value: "consult",    en: "Consult",    ar: "استشارة",    icon: Stethoscope },
  { value: "blood",      en: "Blood",      ar: "دم",         icon: Droplet },
  { value: "therapy",    en: "Therapy",    ar: "علاج طبيعي", icon: Zap },
];

const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  contraindicated: "critical", high: "critical", moderate: "warning", low: "info", info: "neutral",
};

const SEVERITY_LABEL: Record<AlertSeverity, { en: string; ar: string }> = {
  contraindicated: { en: "Contraindicated", ar: "ممنوع" },
  high: { en: "High risk", ar: "خطورة عالية" },
  moderate: { en: "Moderate", ar: "متوسط" },
  low: { en: "Low", ar: "منخفض" },
  info: { en: "Information", ar: "معلومة" },
};

export default function OrderEntry() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { rows: orders, loading } = useCollection("clinical_orders");
  const { rows: patients } = useCollection("patients");
  const { rows: allergies } = useCollection("allergies");
  const { rows: encounters } = useCollection("encounters");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const filtered = useMemo(
    () => orders.filter((o) =>
      (!status || o.status === status) &&
      (!category || o.category === category) &&
      matches(search, o.item_en, o.item_ar, o.patient_name, o.order_number, o.ordered_by_name)),
    [orders, search, status, category],
  );

  const unsigned = orders.filter((o) => o.status === "draft" || o.status === "pending_signature");
  const stat = orders.filter((o) => o.priority === "stat" && (o.status === "active" || o.status === "in_progress"));
  const overridden = orders.filter((o) => o.override_reason);

  const columns: Column<Order>[] = [
    {
      key: "item", header: "Order", headerAr: "الأمر",
      sortValue: (o) => o.item_en,
      cell: (o) => {
        const cat = CATEGORIES.find((c) => c.value === o.category);
        return (
          <div className="flex items-start gap-2.5 min-w-0">
            {cat && (
              <span className="w-6 h-6 rounded-lg bg-muted grid place-items-center shrink-0 mt-0.5 text-muted-foreground">
                <cat.icon size={12} />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-body font-medium text-foreground">{ar ? (o.item_ar ?? o.item_en) : o.item_en}</span>
                {o.priority === "stat" && <Pill tone="critical">STAT</Pill>}
                {o.prn && <Pill tone="info">PRN</Pill>}
                {o.override_reason && <Pill tone="warning" icon={ShieldAlert}>{ar ? "تجاوز" : "Override"}</Pill>}
              </div>
              {(o.dose || o.frequency) && (
                <div className="text-micro text-muted-foreground">
                  {[o.dose && `${o.dose} ${o.dose_unit ?? ""}`.trim(), o.route?.toUpperCase(), o.frequency].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (o) => o.patient_name,
      cell: (o) => (
        <Link href={`/chart/${o.patient_id}`} className="text-body text-foreground hover:text-brand-ink transition-colors">
          {o.patient_name}
        </Link>
      ),
    },
    {
      key: "orderedBy", header: "Ordered by", headerAr: "الطالب", hideBelow: "lg",
      cell: (o) => <span className="text-body text-muted-foreground">{o.ordered_by_name}</span>,
    },
    {
      key: "when", header: "Ordered", headerAr: "وقت الطلب", hideBelow: "md",
      sortValue: (o) => o.ordered_at,
      cell: (o) => (
        <div>
          <div className="text-body text-foreground">{fmtAgo(o.ordered_at, ar)}</div>
          <div className="text-micro text-muted-foreground">{fmtDateTime(o.ordered_at, ar)}</div>
        </div>
      ),
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (o) => <StatusPill map={ORDER_STATUS} value={o.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Order Entry"
        titleAr="إدخال الأوامر"
        subtitle="Every order placed across the hospital, with decision support applied at the point of writing."
        subtitleAr="كل الأوامر في المستشفى مع تطبيق دعم القرار أثناء الكتابة."
        actions={
          <button type="button" onClick={() => setComposerOpen(true)} className={btnPrimary}>
            <Plus size={14} /> {ar ? "أمر جديد" : "New order"}
          </button>
        }
      />

      <StatGrid cols={4}>
        <StatTile label="Active orders" labelAr="أوامر نشطة" value={orders.filter((o) => o.status === "active" || o.status === "in_progress").length} icon={ScrollText} tone="brand" />
        <StatTile label="STAT outstanding" labelAr="أوامر عاجلة قائمة" value={stat.length} sub="Immediate action" subAr="تنفيذ فوري" icon={Zap} tone={stat.length > 0 ? "critical" : "success"} />
        <StatTile label="Awaiting signature" labelAr="بانتظار التوقيع" value={unsigned.length} icon={AlertTriangle} tone={unsigned.length > 0 ? "warning" : "success"} />
        <StatTile label="Alerts overridden" labelAr="تنبيهات متجاوزة" value={overridden.length} sub="Each with a recorded reason" subAr="كلٌّ بسبب موثق" icon={ShieldAlert} tone="neutral" href="/cdss" />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Order, patient or clinician"
          searchPlaceholderAr="الأمر أو المريض أو الطبيب"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(ORDER_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "category", value: category, onChange: setCategory,
              allLabel: "All categories", allLabelAr: "كل الفئات",
              options: CATEGORIES.map((c) => ({ value: c.value, en: c.en, ar: c.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "أمر" : filtered.length === 1 ? "order" : "orders"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "when", ascending: false }} />
      </Section>

      <OrderComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        patients={patients}
        allergies={allergies}
        encounters={encounters}
        activeOrders={orders}
      />
    </Page>
  );
}

// ─── Composer ─────────────────────────────────────────────

function OrderComposer({
  open, onClose, patients, allergies, encounters, activeOrders,
}: {
  open: boolean;
  onClose: () => void;
  patients: Database["public"]["Tables"]["patients"]["Row"][];
  allergies: Database["public"]["Tables"]["allergies"]["Row"][];
  encounters: Database["public"]["Tables"]["encounters"]["Row"][];
  activeOrders: Order[];
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [patientId, setPatientId] = useState("");
  const [category, setCategory] = useState<Order["category"]>("medication");
  const [item, setItem] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [route, setRoute] = useState("oral");
  const [frequency, setFrequency] = useState("BD");
  const [priority, setPriority] = useState<Order["priority"]>("routine");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Reset when the drawer reopens, so a previous draft never leaks into a
  // new patient's order — the single most dangerous kind of stale state here.
  useEffect(() => {
    if (open) {
      setPatientId(""); setItem(""); setDose(""); setFrequency("BD");
      setPriority("routine"); setOverrideReason(""); setSubmitted(null);
    }
  }, [open]);

  const patient = patients.find((p) => p.id === patientId);
  const patientAllergies = allergies.filter((a) => a.patient_id === patientId);
  const patientOrders = activeOrders.filter((o) => o.patient_id === patientId);
  const meta = (patient?.metadata ?? {}) as Record<string, unknown>;

  const alerts: RuleAlert[] = useMemo(() => {
    if (!patientId || !item.trim()) return [];
    return evaluateOrder(
      { item_en: item, category, dose: dose || null, frequency },
      {
        allergies: patientAllergies,
        activeOrders: patientOrders,
        egfr: typeof meta.egfr === "number" ? meta.egfr : null,
        isPregnant: meta.pregnant === true,
      },
    );
  }, [patientId, item, category, dose, frequency, patientAllergies, patientOrders, meta]);

  const blocking = alerts.filter((a) => a.requiresOverrideReason);
  const needsReason = requiresOverride(alerts);
  const canSign = Boolean(patientId && item.trim()) && (!needsReason || overrideReason.trim().length >= 15);

  function sign() {
    // Demo build: orders are not persisted. The composer's job here is to prove
    // the decision-support path, which runs entirely client-side.
    setSubmitted(item);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New order"
      titleAr="أمر جديد"
      subtitle={patient ? `${patient.name_en} · ${patient.mrn}` : (ar ? "اختر مريضاً للبدء" : "Select a patient to begin")}
      width={620}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost}>{ar ? "إلغاء" : "Cancel"}</button>
          <button type="button" onClick={sign} disabled={!canSign} className={btnPrimary}>
            <Check size={14} />
            {blocking.length > 0 ? (ar ? "توقيع مع التجاوز" : "Sign with override") : (ar ? "توقيع الأمر" : "Sign order")}
          </button>
        </>
      }
    >
      {submitted ? (
        <div className="rounded-xl bg-success/10 px-4 py-3.5">
          <div className="flex items-center gap-2 text-success">
            <Check size={15} />
            <span className="text-body font-medium">{ar ? "تم توقيع الأمر" : "Order signed"}</span>
          </div>
          <p className="text-caption text-foreground/80 mt-1.5">
            {ar
              ? `تم توقيع «${submitted}». في وضع العرض التجريبي لا تُحفظ الأوامر — الغرض هنا إثبات مسار دعم القرار.`
              : `“${submitted}” signed. Orders are not persisted in demo mode — the purpose here is to exercise the decision-support path.`}
          </p>
          {blocking.length > 0 && (
            <p className="text-caption text-warning mt-2">
              {ar ? "سبب التجاوز المسجل: " : "Override reason recorded: "}{overrideReason}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Patient */}
          <div>
            <label className={labelCls}>{ar ? "المريض" : "Patient"}</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputCls}>
              <option value="">{ar ? "اختر مريضاً…" : "Select a patient…"}</option>
              {patients.filter((p) => p.status === "active").map((p) => {
                const enc = encounters.find((e) => e.patient_id === p.id && (e.status === "in_progress" || e.status === "arrived"));
                return (
                  <option key={p.id} value={p.id}>
                    {ar ? (p.name_ar ?? p.name_en) : p.name_en} · {p.mrn}{enc?.bed_label ? ` · ${enc.bed_label}` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Safety context, shown as soon as a patient is chosen */}
          {patient && (
            <div className="rounded-xl bg-muted/40 px-3.5 py-3 space-y-2">
              <div className="text-micro font-semibold text-muted-foreground uppercase tracking-wide">
                {ar ? "سياق السلامة" : "Safety context"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {patientAllergies.filter((a) => a.status === "active").length === 0 ? (
                  <Pill tone="neutral">{ar ? "لا حساسية معروفة" : "No known allergies"}</Pill>
                ) : (
                  patientAllergies.filter((a) => a.status === "active").map((a) => (
                    <Pill key={a.id} tone={a.severity === "severe" || a.severity === "fatal" ? "critical" : "warning"} icon={AlertTriangle}>
                      {ar ? (a.substance_ar ?? a.substance_en) : a.substance_en}
                    </Pill>
                  ))
                )}
                {typeof meta.egfr === "number" && (
                  <Pill tone={meta.egfr < 30 ? "critical" : meta.egfr < 60 ? "warning" : "neutral"}>
                    eGFR {meta.egfr}
                  </Pill>
                )}
                {meta.pregnant === true && <Pill tone="warning">{ar ? "حامل" : "Pregnant"}</Pill>}
              </div>
              <div className="text-micro text-muted-foreground">
                {patientOrders.filter((o) => o.category === "medication" && (o.status === "active" || o.status === "in_progress")).length}{" "}
                {ar ? "دواء نشط على السجل" : "active medications on the chart"}
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className={labelCls}>{ar ? "الفئة" : "Category"}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value} type="button" onClick={() => setCategory(c.value)}
                    className={`inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-caption font-medium transition-colors
                      ${active ? TONE_PILL.brand : "border border-border/60 text-muted-foreground hover:bg-muted/50"}`}
                  >
                    <c.icon size={13} /> {ar ? c.ar : c.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item */}
          <div>
            <label className={labelCls}>
              {category === "medication" ? (ar ? "الدواء" : "Drug") : (ar ? "البند" : "Item")}
            </label>
            <input
              value={item} onChange={(e) => setItem(e.target.value)} className={inputCls}
              placeholder={category === "medication"
                ? (ar ? "مثال: أموكسيسيلين، وارفارين، ميتفورمين" : "e.g. Amoxicillin, Warfarin, Metformin")
                : (ar ? "مثال: صورة دم كاملة" : "e.g. Full blood count")}
            />
            {category === "medication" && (
              <p className="text-micro text-muted-foreground mt-1">
                {ar
                  ? `تُفحص القاعدة المعرفية أثناء الكتابة: ${KB_STATS.interactions} تداخل و${KB_STATS.doseRules} قاعدة جرعة و${KB_STATS.drugClasses} فئة دوائية.`
                  : `Checked as you type against ${KB_STATS.interactions} interactions, ${KB_STATS.doseRules} dose rules and ${KB_STATS.drugClasses} drug classes.`}
              </p>
            )}
          </div>

          {category === "medication" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{ar ? "الجرعة" : "Dose"}</label>
                <div className="flex gap-1.5">
                  <input value={dose} onChange={(e) => setDose(e.target.value)} className={inputCls} placeholder="500" inputMode="decimal" />
                  <select value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} className={`${inputCls} w-24`}>
                    {["mg", "g", "mL", "mcg", "units"].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{ar ? "الطريق" : "Route"}</label>
                <select value={route} onChange={(e) => setRoute(e.target.value)} className={inputCls}>
                  {["oral", "iv", "im", "sc", "topical", "inhaled", "rectal", "sublingual"].map((r) => (
                    <option key={r} value={r}>{r.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{ar ? "التكرار" : "Frequency"}</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
                  {["OD", "BD", "TDS", "QDS", "q6h", "q4h", "hourly", "PRN"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{ar ? "الأولوية" : "Priority"}</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Order["priority"])} className={inputCls}>
                  <option value="routine">{ar ? "روتيني" : "Routine"}</option>
                  <option value="urgent">{ar ? "عاجل" : "Urgent"}</option>
                  <option value="asap">ASAP</option>
                  <option value="stat">STAT</option>
                </select>
              </div>
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-brand-ink" />
                <span className="text-body font-semibold text-foreground" style={serif}>
                  {ar ? "دعم القرار السريري" : "Clinical decision support"}
                </span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {alerts.length} {ar ? "تنبيه" : alerts.length === 1 ? "alert" : "alerts"}
                </span>
              </div>
              {alerts.map((a) => (
                <div
                  key={a.rule_id}
                  className={`rounded-xl px-3.5 py-3 ${
                    a.severity === "contraindicated" || a.severity === "high"
                      ? "bg-destructive/10 border border-destructive/25"
                      : a.severity === "moderate" ? "bg-warning/10" : "bg-muted/50"}`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className={a.severity === "contraindicated" || a.severity === "high" ? "text-destructive mt-0.5 shrink-0" : "text-warning mt-0.5 shrink-0"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body font-semibold text-foreground">{ar ? a.title_ar : a.title_en}</span>
                        <Pill tone={SEVERITY_TONE[a.severity]}>{ar ? SEVERITY_LABEL[a.severity].ar : SEVERITY_LABEL[a.severity].en}</Pill>
                      </div>
                      <p className="text-caption text-foreground/85 mt-1">{ar ? a.message_ar : a.message_en}</p>
                      <p className="text-caption text-foreground/70 mt-1.5">
                        <span className="font-medium">{ar ? "التوصية: " : "Recommended: "}</span>
                        {ar ? a.recommendation_ar : a.recommendation_en}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {needsReason && (
                <div>
                  <label className={labelCls}>
                    {ar ? "سبب التجاوز — مطلوب" : "Override reason — required"}
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={3}
                    className={`${inputCls} h-auto py-2 resize-none`}
                    placeholder={ar
                      ? "لماذا يفوق النفع الخطر في هذه الحالة؟ يُحفظ هذا النص على الأمر."
                      : "Why does the benefit outweigh the risk here? This text is stored on the order."}
                  />
                  <p className={`text-micro mt-1 ${overrideReason.trim().length >= 15 ? "text-muted-foreground" : "text-warning"}`}>
                    {overrideReason.trim().length >= 15
                      ? (ar ? "سيُحفظ مع الأمر ويظهر في السجل." : "Stored with the order and shown on the chart.")
                      : (ar ? "اكتب ١٥ حرفاً على الأقل." : "At least 15 characters.")}
                  </p>
                </div>
              )}
            </div>
          )}

          {patientId && item.trim() && alerts.length === 0 && (
            <div className="rounded-xl bg-success/10 px-3.5 py-3 flex items-center gap-2">
              <Check size={14} className="text-success" />
              <span className="text-caption text-foreground/85">
                {ar ? "لم تُطلق أي قاعدة على هذا الأمر." : "No decision-support rule fired on this order."}
              </span>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
