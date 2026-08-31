/**
 * Clinical Decision Support — the rules that fire when an order is placed.
 *
 * Scope and honesty about it: this is a demonstration knowledge base, not a
 * licensed drug compendium. It carries a few dozen well-known interactions,
 * allergy cross-reactivity classes and dose ceilings so the CPOE workflow can
 * be exercised end to end. A production deployment replaces `DRUG_KB` with a
 * maintained source (First Databank, Multum, BNF, SFDA) behind the same
 * `evaluateOrder` signature — every call site is written against the interface,
 * not the data.
 *
 * The alert-fatigue rule this file follows: an alert that cannot change the
 * decision should not interrupt. Only `high` and `contraindicated` block; the
 * rest annotate.
 */

import type { Database } from "@/domain/types";

type Allergy = Database["public"]["Tables"]["allergies"]["Row"];
type Order = Database["public"]["Tables"]["clinical_orders"]["Row"];
type LabResult = Database["public"]["Tables"]["lab_results"]["Row"];

export type AlertSeverity = "info" | "low" | "moderate" | "high" | "contraindicated";

export interface RuleAlert {
  rule_id: string;
  alert_type: Database["public"]["Tables"]["cdss_alerts"]["Row"]["alert_type"];
  severity: AlertSeverity;
  title_en: string;
  title_ar: string;
  message_en: string;
  message_ar: string;
  recommendation_en: string;
  recommendation_ar: string;
  evidence: Record<string, unknown>;
  /** Whether the clinician must type a reason before the order can proceed. */
  requiresOverrideReason: boolean;
}

// ─── Knowledge base ───────────────────────────────────────

/**
 * Allergen classes. A penicillin allergy has to catch amoxicillin, and the
 * only reliable way to do that is to classify the ingredient, not match the
 * brand string.
 */
const DRUG_CLASSES: Record<string, string[]> = {
  penicillin: ["amoxicillin", "ampicillin", "benzylpenicillin", "flucloxacillin", "piperacillin", "co-amoxiclav", "augmentin"],
  cephalosporin: ["ceftriaxone", "cefazolin", "cefuroxime", "ceftazidime", "cefepime"],
  sulfonamide: ["sulfamethoxazole", "co-trimoxazole", "sulfasalazine"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "ketorolac", "aspirin", "celecoxib", "indomethacin"],
  opioid: ["morphine", "fentanyl", "pethidine", "tramadol", "oxycodone", "codeine"],
  macrolide: ["azithromycin", "clarithromycin", "erythromycin"],
  quinolone: ["ciprofloxacin", "levofloxacin", "moxifloxacin"],
  statin: ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"],
  ace_inhibitor: ["lisinopril", "ramipril", "enalapril", "perindopril", "captopril"],
  aminoglycoside: ["gentamicin", "amikacin", "tobramycin"],
};

/**
 * Penicillin↔cephalosporin cross-reactivity is real but far lower than the
 * old 10% teaching suggested (~1–3% for later generations). It is flagged as
 * `moderate`, not contraindicated, so a documented mild rash does not deny a
 * patient the right antibiotic.
 */
const CROSS_REACTIVITY: [string, string, AlertSeverity][] = [
  ["penicillin", "cephalosporin", "moderate"],
  ["cephalosporin", "penicillin", "moderate"],
  ["nsaid", "nsaid", "high"],
  ["sulfonamide", "sulfonamide", "high"],
];

interface Interaction {
  a: string;
  b: string;
  severity: AlertSeverity;
  effect_en: string;
  effect_ar: string;
  action_en: string;
  action_ar: string;
}

const INTERACTIONS: Interaction[] = [
  {
    a: "warfarin", b: "aspirin", severity: "high",
    effect_en: "Markedly increased bleeding risk — additive anticoagulant and antiplatelet effect.",
    effect_ar: "زيادة كبيرة في خطر النزيف نتيجة التأثير المشترك المضاد للتخثر والصفيحات.",
    action_en: "Avoid unless a specific indication exists. If combined, monitor INR closely and add gastroprotection.",
    action_ar: "يُتجنب إلا لدواعٍ محددة. عند الجمع، راقب INR عن قرب مع إضافة واقٍ للمعدة.",
  },
  {
    a: "warfarin", b: "ciprofloxacin", severity: "high",
    effect_en: "Ciprofloxacin inhibits warfarin metabolism — INR can rise sharply within days.",
    effect_ar: "يثبط سيبروفلوكساسين استقلاب الوارفارين مما يرفع INR بسرعة خلال أيام.",
    action_en: "Check INR within 3 days of starting and again after stopping.",
    action_ar: "افحص INR خلال ٣ أيام من البدء ومرة أخرى بعد الإيقاف.",
  },
  {
    a: "simvastatin", b: "clarithromycin", severity: "contraindicated",
    effect_en: "Strong CYP3A4 inhibition raises simvastatin exposure — serious rhabdomyolysis risk.",
    effect_ar: "تثبيط قوي لإنزيم CYP3A4 يرفع تركيز سيمفاستاتين مع خطر انحلال الربيدات.",
    action_en: "Suspend the statin for the antibiotic course, or choose azithromycin instead.",
    action_ar: "أوقف الستاتين خلال فترة المضاد الحيوي أو اختر أزيثرومايسين بدلاً منه.",
  },
  {
    a: "lisinopril", b: "spironolactone", severity: "moderate",
    effect_en: "Additive potassium retention — risk of hyperkalaemia.",
    effect_ar: "احتباس إضافي للبوتاسيوم مع خطر ارتفاع بوتاسيوم الدم.",
    action_en: "Check potassium and creatinine within one week, then periodically.",
    action_ar: "افحص البوتاسيوم والكرياتينين خلال أسبوع ثم بشكل دوري.",
  },
  {
    a: "metformin", b: "contrast", severity: "high",
    effect_en: "Iodinated contrast with renal impairment raises lactic acidosis risk.",
    effect_ar: "الصبغة اليودية مع القصور الكلوي ترفع خطر الحماض اللبني.",
    action_en: "Withhold metformin from the time of contrast and restart after 48 h with an acceptable eGFR.",
    action_ar: "أوقف الميتفورمين وقت الصبغة واستأنفه بعد ٤٨ ساعة مع معدل ترشيح مقبول.",
  },
  {
    a: "tramadol", b: "sertraline", severity: "high",
    effect_en: "Serotonergic combination — serotonin syndrome and lowered seizure threshold.",
    effect_ar: "تركيبة سيروتونينية قد تسبب متلازمة السيروتونين وخفض عتبة التشنج.",
    action_en: "Prefer a non-serotonergic analgesic; if unavoidable, counsel and monitor for agitation, clonus, hyperthermia.",
    action_ar: "يُفضل مسكن غير سيروتونيني؛ وعند الضرورة راقب التهيج والرمع وارتفاع الحرارة.",
  },
  {
    a: "gentamicin", b: "furosemide", severity: "moderate",
    effect_en: "Additive ototoxicity and nephrotoxicity.",
    effect_ar: "سمية إضافية على السمع والكلى.",
    action_en: "Monitor gentamicin levels and renal function; avoid concurrent bolus dosing.",
    action_ar: "راقب مستويات الجنتاميسين ووظائف الكلى وتجنب الجرعات المتزامنة.",
  },
  {
    a: "digoxin", b: "amiodarone", severity: "high",
    effect_en: "Amiodarone roughly doubles digoxin levels.",
    effect_ar: "يضاعف الأميودارون تقريباً مستوى الديجوكسين.",
    action_en: "Halve the digoxin dose and check a level after one week.",
    action_ar: "خفّض جرعة الديجوكسين للنصف وافحص المستوى بعد أسبوع.",
  },
  {
    a: "methotrexate", b: "co-trimoxazole", severity: "contraindicated",
    effect_en: "Both are antifolates — severe myelosuppression.",
    effect_ar: "كلاهما مضاد للفولات مما يسبب تثبيطاً شديداً للنخاع.",
    action_en: "Do not co-prescribe. Select an alternative antibiotic.",
    action_ar: "لا يوصفان معاً. اختر مضاداً حيوياً بديلاً.",
  },
  {
    a: "clopidogrel", b: "omeprazole", severity: "moderate",
    effect_en: "Omeprazole inhibits CYP2C19, reducing clopidogrel activation.",
    effect_ar: "يثبط أوميبرازول إنزيم CYP2C19 فيقلل تفعيل كلوبيدوجريل.",
    action_en: "Switch to pantoprazole, which has minimal CYP2C19 effect.",
    action_ar: "استبدله ببانتوبرازول لتأثيره الضئيل على CYP2C19.",
  },
];

interface DoseRule {
  drug: string;
  /** Single-dose ceiling and 24-hour ceiling, in the drug's usual unit. */
  maxSingle: number;
  maxDaily: number;
  unit: string;
  /** eGFR below which the dose must be adjusted; null when renally irrelevant. */
  renalThreshold: number | null;
  renalNote_en?: string;
  renalNote_ar?: string;
}

const DOSE_RULES: DoseRule[] = [
  { drug: "paracetamol", maxSingle: 1000, maxDaily: 4000, unit: "mg", renalThreshold: null },
  { drug: "ibuprofen", maxSingle: 800, maxDaily: 2400, unit: "mg", renalThreshold: 30,
    renalNote_en: "Avoid NSAIDs at eGFR below 30.", renalNote_ar: "تجنب مضادات الالتهاب غير الستيرويدية عند معدل ترشيح أقل من ٣٠." },
  { drug: "morphine", maxSingle: 20, maxDaily: 120, unit: "mg", renalThreshold: 30,
    renalNote_en: "Active metabolites accumulate — reduce dose and extend the interval.", renalNote_ar: "تتراكم النواتج الفعالة — قلل الجرعة وباعد بين الجرعات." },
  { drug: "enoxaparin", maxSingle: 100, maxDaily: 200, unit: "mg", renalThreshold: 30,
    renalNote_en: "Reduce to 1 mg/kg once daily at eGFR below 30.", renalNote_ar: "خفّض إلى ١ ملغ/كغ مرة يومياً عند معدل ترشيح أقل من ٣٠." },
  { drug: "gentamicin", maxSingle: 500, maxDaily: 500, unit: "mg", renalThreshold: 60,
    renalNote_en: "Extend the interval and dose to levels.", renalNote_ar: "باعد بين الجرعات واضبطها حسب المستويات." },
  { drug: "metformin", maxSingle: 1000, maxDaily: 3000, unit: "mg", renalThreshold: 30,
    renalNote_en: "Contraindicated below eGFR 30.", renalNote_ar: "ممنوع عند معدل ترشيح أقل من ٣٠." },
  { drug: "vancomycin", maxSingle: 2000, maxDaily: 4000, unit: "mg", renalThreshold: 50,
    renalNote_en: "Dose to trough levels; extend the interval.", renalNote_ar: "اضبط الجرعة حسب المستوى الأدنى وباعد بينها." },
];

/** Drugs that should not be given in pregnancy. */
const PREGNANCY_UNSAFE: Record<string, { severity: AlertSeverity; reason_en: string; reason_ar: string }> = {
  warfarin: { severity: "contraindicated", reason_en: "Teratogenic — embryopathy in the first trimester.", reason_ar: "مشوه للأجنة ويسبب اعتلالاً جنينياً في الثلث الأول." },
  lisinopril: { severity: "contraindicated", reason_en: "ACE inhibitors cause fetal renal failure and oligohydramnios.", reason_ar: "مثبطات الإنزيم المحول تسبب فشلاً كلوياً جنينياً ونقص السائل الأمنيوسي." },
  ramipril: { severity: "contraindicated", reason_en: "ACE inhibitors cause fetal renal failure and oligohydramnios.", reason_ar: "مثبطات الإنزيم المحول تسبب فشلاً كلوياً جنينياً ونقص السائل الأمنيوسي." },
  methotrexate: { severity: "contraindicated", reason_en: "Abortifacient and teratogenic.", reason_ar: "مجهض ومشوه للأجنة." },
  ibuprofen: { severity: "high", reason_en: "Avoid after 20 weeks — premature ductal closure and oligohydramnios.", reason_ar: "يُتجنب بعد الأسبوع ٢٠ لخطر انغلاق القناة الشريانية مبكراً." },
  ciprofloxacin: { severity: "moderate", reason_en: "Quinolones affect developing cartilage in animal studies.", reason_ar: "تؤثر الكينولونات على الغضاريف النامية في الدراسات الحيوانية." },
  doxycycline: { severity: "high", reason_en: "Tetracyclines stain developing teeth and affect bone growth.", reason_ar: "تصبغ التتراسيكلينات الأسنان النامية وتؤثر على نمو العظام." },
};

/** Analytes whose values page a clinician rather than sitting in a queue. */
const CRITICAL_ANALYTES: Record<string, { low: number; high: number; unit: string; action_en: string; action_ar: string }> = {
  potassium:  { low: 2.8, high: 6.2, unit: "mmol/L", action_en: "Repeat urgently, ECG, and treat before the repeat returns.", action_ar: "أعد الفحص عاجلاً مع تخطيط القلب وابدأ العلاج قبل النتيجة." },
  sodium:     { low: 120, high: 158, unit: "mmol/L", action_en: "Correct no faster than 8–10 mmol/L in 24 h.", action_ar: "لا تصحح بأسرع من ٨–١٠ مليمول/لتر خلال ٢٤ ساعة." },
  glucose:    { low: 2.8, high: 25,  unit: "mmol/L", action_en: "Treat hypoglycaemia immediately; check ketones if high.", action_ar: "عالج نقص السكر فوراً وافحص الكيتونات عند الارتفاع." },
  haemoglobin:{ low: 6.5, high: 20,  unit: "g/dL",   action_en: "Group and save; consider transfusion against symptoms.", action_ar: "احجز فصيلة الدم وادرس الحاجة لنقل الدم حسب الأعراض." },
  platelets:  { low: 20,  high: 1000,unit: "10⁹/L",  action_en: "Bleeding precautions; haematology advice.", action_ar: "احتياطات النزيف مع استشارة أمراض الدم." },
  troponin:   { low: -1,  high: 100, unit: "ng/L",   action_en: "Serial troponin and 12-lead ECG; assess for ACS.", action_ar: "تروبونين متسلسل وتخطيط قلب مع تقييم المتلازمة التاجية." },
  inr:        { low: -1,  high: 5,   unit: "",       action_en: "Withhold warfarin; vitamin K if bleeding.", action_ar: "أوقف الوارفارين وأعطِ فيتامين ك عند النزيف." },
};

// ─── Matching helpers ─────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().trim();
}

/** Whether a free-text drug name mentions an ingredient. */
function mentions(text: string, ingredient: string): boolean {
  return normalise(text).includes(normalise(ingredient));
}

/** Every class an ingredient string belongs to. */
export function classesFor(drugName: string): string[] {
  const n = normalise(drugName);
  return Object.entries(DRUG_CLASSES)
    .filter(([, members]) => members.some((m) => n.includes(m)))
    .map(([cls]) => cls);
}

// ─── Individual rules ─────────────────────────────────────

function checkAllergies(drugName: string, allergies: Allergy[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const orderClasses = classesFor(drugName);

  for (const a of allergies) {
    if (a.status !== "active") continue;

    const direct = mentions(drugName, a.substance_en);
    const allergyClasses = classesFor(a.substance_en);
    const sameClass = allergyClasses.some((c) => orderClasses.includes(c));
    const cross = CROSS_REACTIVITY.find(
      ([from, to]) => allergyClasses.includes(from) && orderClasses.includes(to) && from !== to,
    );

    if (!direct && !sameClass && !cross) continue;

    // A recorded intolerance is not an allergy; a fatal reaction is absolute.
    const severity: AlertSeverity =
      a.kind === "intolerance" ? "low"
      : a.severity === "fatal" || a.severity === "severe" ? "contraindicated"
      : cross && !direct && !sameClass ? (cross[2])
      : "high";

    const how_en = direct ? "the exact substance recorded"
      : sameClass ? `the same class as ${a.substance_en}`
      : `cross-reactive with ${a.substance_en}`;
    const how_ar = direct ? "نفس المادة المسجلة"
      : sameClass ? `نفس فئة ${a.substance_ar || a.substance_en}`
      : `تفاعل متصالب مع ${a.substance_ar || a.substance_en}`;

    alerts.push({
      rule_id: `allergy:${a.id}`,
      alert_type: "allergy",
      severity,
      title_en: a.kind === "intolerance" ? "Documented intolerance" : "Documented allergy",
      title_ar: a.kind === "intolerance" ? "عدم تحمل موثق" : "حساسية موثقة",
      message_en: `${drugName} is ${how_en}. Reaction on record: ${a.reaction_en || "not specified"} (${a.severity}).`,
      message_ar: `${drugName} ${how_ar}. رد الفعل المسجل: ${a.reaction_ar || a.reaction_en || "غير محدد"} (${a.severity}).`,
      recommendation_en: severity === "contraindicated"
        ? "Select an agent from an unrelated class. Do not proceed without allergy-team advice."
        : "Confirm the reaction history with the patient before proceeding.",
      recommendation_ar: severity === "contraindicated"
        ? "اختر دواءً من فئة غير مرتبطة ولا تكمل دون استشارة فريق الحساسية."
        : "أكد تاريخ رد الفعل مع المريض قبل المتابعة.",
      evidence: { allergy_id: a.id, substance: a.substance_en, severity: a.severity, kind: a.kind, match: direct ? "exact" : sameClass ? "class" : "cross_reactive" },
      requiresOverrideReason: severity === "contraindicated" || severity === "high",
    });
  }
  return alerts;
}

function checkInteractions(drugName: string, activeOrders: Order[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];

  for (const ix of INTERACTIONS) {
    // The pair can match in either direction: new drug is A and an active
    // order is B, or the reverse.
    const newIsA = mentions(drugName, ix.a);
    const newIsB = mentions(drugName, ix.b);
    if (!newIsA && !newIsB) continue;

    const partner = newIsA ? ix.b : ix.a;
    const conflicting = activeOrders.find(
      (o) => o.category === "medication"
        && (o.status === "active" || o.status === "in_progress")
        && mentions(o.item_en, partner),
    );
    if (!conflicting) continue;

    alerts.push({
      rule_id: `interaction:${ix.a}+${ix.b}`,
      alert_type: "drug_interaction",
      severity: ix.severity,
      title_en: `Interaction: ${drugName} + ${conflicting.item_en}`,
      title_ar: `تداخل دوائي: ${drugName} + ${conflicting.item_ar || conflicting.item_en}`,
      message_en: ix.effect_en,
      message_ar: ix.effect_ar,
      recommendation_en: ix.action_en,
      recommendation_ar: ix.action_ar,
      evidence: { with_order_id: conflicting.id, with_drug: conflicting.item_en, pair: [ix.a, ix.b] },
      requiresOverrideReason: ix.severity === "contraindicated" || ix.severity === "high",
    });
  }
  return alerts;
}

function checkDuplicate(drugName: string, activeOrders: Order[]): RuleAlert[] {
  const orderClasses = classesFor(drugName);
  if (orderClasses.length === 0) return [];

  const dup = activeOrders.find((o) => {
    if (o.category !== "medication") return false;
    if (o.status !== "active" && o.status !== "in_progress") return false;
    // Same ingredient, or a different member of the same class.
    if (mentions(o.item_en, drugName) || mentions(drugName, o.item_en)) return true;
    return classesFor(o.item_en).some((c) => orderClasses.includes(c));
  });
  if (!dup) return [];

  const exact = mentions(dup.item_en, drugName);
  return [{
    rule_id: `duplicate:${dup.id}`,
    alert_type: "duplicate_therapy",
    severity: exact ? "high" : "moderate",
    title_en: exact ? "Duplicate order" : "Duplicate therapeutic class",
    title_ar: exact ? "أمر مكرر" : "تكرار في الفئة العلاجية",
    message_en: `${dup.item_en} is already active (${dup.dose ?? "dose not set"} ${dup.frequency ?? ""}), ordered ${new Date(dup.ordered_at).toLocaleDateString()}.`,
    message_ar: `${dup.item_ar || dup.item_en} نشط بالفعل (${dup.dose ?? "الجرعة غير محددة"} ${dup.frequency ?? ""}) منذ ${new Date(dup.ordered_at).toLocaleDateString()}.`,
    recommendation_en: "Stop the existing order first, or confirm that both are intended.",
    recommendation_ar: "أوقف الأمر القائم أولاً أو أكد أن كليهما مقصود.",
    evidence: { existing_order_id: dup.id, existing_item: dup.item_en, match: exact ? "same_ingredient" : "same_class" },
    requiresOverrideReason: exact,
  }];
}

function checkDose(drugName: string, dose: number | null, frequencyPerDay: number, egfr: number | null): RuleAlert[] {
  const rule = DOSE_RULES.find((r) => mentions(drugName, r.drug));
  if (!rule) return [];
  const alerts: RuleAlert[] = [];

  if (dose !== null) {
    const daily = dose * frequencyPerDay;
    if (dose > rule.maxSingle || daily > rule.maxDaily) {
      const overSingle = dose > rule.maxSingle;
      alerts.push({
        rule_id: `dose:${rule.drug}`,
        alert_type: "dose_range",
        severity: daily > rule.maxDaily * 1.5 ? "contraindicated" : "high",
        title_en: overSingle ? "Single dose above maximum" : "Daily dose above maximum",
        title_ar: overSingle ? "الجرعة المفردة تتجاوز الحد" : "الجرعة اليومية تتجاوز الحد",
        message_en: overSingle
          ? `${dose} ${rule.unit} exceeds the ${rule.maxSingle} ${rule.unit} single-dose ceiling for ${rule.drug}.`
          : `${daily} ${rule.unit}/day (${dose} × ${frequencyPerDay}) exceeds the ${rule.maxDaily} ${rule.unit} daily ceiling for ${rule.drug}.`,
        message_ar: overSingle
          ? `الجرعة ${dose} ${rule.unit} تتجاوز الحد الأقصى ${rule.maxSingle} ${rule.unit} لـ ${rule.drug}.`
          : `الجرعة اليومية ${daily} ${rule.unit} تتجاوز الحد ${rule.maxDaily} ${rule.unit} لـ ${rule.drug}.`,
        recommendation_en: `Reduce to within ${rule.maxSingle} ${rule.unit} per dose and ${rule.maxDaily} ${rule.unit} per day.`,
        recommendation_ar: `خفّض إلى ${rule.maxSingle} ${rule.unit} للجرعة و${rule.maxDaily} ${rule.unit} يومياً.`,
        evidence: { drug: rule.drug, ordered_dose: dose, daily_total: daily, max_single: rule.maxSingle, max_daily: rule.maxDaily },
        requiresOverrideReason: true,
      });
    }
  }

  if (rule.renalThreshold !== null && egfr !== null && egfr < rule.renalThreshold) {
    alerts.push({
      rule_id: `renal:${rule.drug}`,
      alert_type: "renal_dosing",
      severity: egfr < rule.renalThreshold / 2 ? "high" : "moderate",
      title_en: "Renal dose adjustment needed",
      title_ar: "يلزم تعديل الجرعة كلوياً",
      message_en: `eGFR is ${egfr} mL/min/1.73m², below the ${rule.renalThreshold} threshold for ${rule.drug}. ${rule.renalNote_en ?? ""}`.trim(),
      message_ar: `معدل الترشيح ${egfr} أقل من الحد ${rule.renalThreshold} لـ ${rule.drug}. ${rule.renalNote_ar ?? ""}`.trim(),
      recommendation_en: rule.renalNote_en ?? "Adjust the dose or interval for renal function.",
      recommendation_ar: rule.renalNote_ar ?? "عدّل الجرعة أو الفترة حسب وظائف الكلى.",
      evidence: { drug: rule.drug, egfr, threshold: rule.renalThreshold },
      requiresOverrideReason: false,
    });
  }
  return alerts;
}

function checkPregnancy(drugName: string, isPregnant: boolean): RuleAlert[] {
  if (!isPregnant) return [];
  const hit = Object.entries(PREGNANCY_UNSAFE).find(([drug]) => mentions(drugName, drug));
  if (!hit) return [];
  const [drug, info] = hit;

  return [{
    rule_id: `pregnancy:${drug}`,
    alert_type: "pregnancy",
    severity: info.severity,
    title_en: "Unsafe in pregnancy",
    title_ar: "غير آمن أثناء الحمل",
    message_en: info.reason_en,
    message_ar: info.reason_ar,
    recommendation_en: "Choose an agent with an established pregnancy safety profile.",
    recommendation_ar: "اختر دواءً بملف أمان معروف أثناء الحمل.",
    evidence: { drug, pregnancy_flag: true },
    requiresOverrideReason: true,
  }];
}

// ─── Public API ───────────────────────────────────────────

export interface OrderContext {
  allergies: Allergy[];
  activeOrders: Order[];
  /** Latest eGFR, when known. Null means "not measured", never "normal". */
  egfr?: number | null;
  isPregnant?: boolean;
  ageYears?: number | null;
  weightKg?: number | null;
}

export interface DraftOrder {
  item_en: string;
  category: Order["category"];
  dose?: string | null;
  frequency?: string | null;
}

/** Doses arrive as free text ("500 mg"); pull the leading number out. */
export function parseDoseAmount(dose: string | null | undefined): number | null {
  if (!dose) return null;
  const m = dose.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/** Map the common frequency shorthands onto doses per 24 hours. */
export function dosesPerDay(frequency: string | null | undefined): number {
  if (!frequency) return 1;
  const f = normalise(frequency);
  const table: [RegExp, number][] = [
    [/\b(od|daily|q24h|once)\b/, 1],
    [/\b(bd|bid|twice|q12h)\b/, 2],
    [/\b(tds|tid|thrice|q8h)\b/, 3],
    [/\b(qds|qid|q6h)\b/, 4],
    [/\bq4h\b/, 6],
    [/\bq3h\b/, 8],
    [/\bq2h\b/, 12],
    [/\bhourly\b/, 24],
  ];
  for (const [re, n] of table) if (re.test(f)) return n;
  return 1;
}

/**
 * Run every rule against a draft order and return the alerts, most severe
 * first. Non-medication orders skip the drug rules entirely — ordering a
 * chest X-ray must not be slowed down by a pharmacology check.
 */
export function evaluateOrder(draft: DraftOrder, ctx: OrderContext): RuleAlert[] {
  if (draft.category !== "medication") return [];

  const drug = draft.item_en;
  const alerts: RuleAlert[] = [
    ...checkAllergies(drug, ctx.allergies),
    ...checkInteractions(drug, ctx.activeOrders),
    ...checkDuplicate(drug, ctx.activeOrders),
    ...checkDose(drug, parseDoseAmount(draft.dose), dosesPerDay(draft.frequency), ctx.egfr ?? null),
    ...checkPregnancy(drug, ctx.isPregnant ?? false),
  ];

  const rank: Record<AlertSeverity, number> = { contraindicated: 0, high: 1, moderate: 2, low: 3, info: 4 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** True when the alert set contains something the clinician must justify. */
export function requiresOverride(alerts: RuleAlert[]): boolean {
  return alerts.some((a) => a.requiresOverrideReason);
}

/**
 * Flag a lab result that needs someone told, now. Returns null for results
 * that merely sit outside the reference interval — those are already flagged
 * on the report and do not warrant a phone call.
 */
export function checkCriticalResult(result: Pick<LabResult, "analyte_en" | "value_numeric" | "unit">): RuleAlert | null {
  const key = Object.keys(CRITICAL_ANALYTES).find((k) => mentions(result.analyte_en, k));
  if (!key || result.value_numeric === null) return null;

  const limits = CRITICAL_ANALYTES[key];
  const v = result.value_numeric;
  const isLow = limits.low > 0 && v <= limits.low;
  const isHigh = v >= limits.high;
  if (!isLow && !isHigh) return null;

  return {
    rule_id: `critical_lab:${key}`,
    alert_type: "critical_lab",
    severity: "high",
    title_en: `Critical ${result.analyte_en}`,
    title_ar: `نتيجة حرجة: ${result.analyte_en}`,
    message_en: `${result.analyte_en} is ${v} ${result.unit ?? limits.unit} — ${isLow ? "below" : "above"} the critical threshold of ${isLow ? limits.low : limits.high}.`,
    message_ar: `${result.analyte_en} يساوي ${v} ${result.unit ?? limits.unit} وهو ${isLow ? "أقل من" : "أعلى من"} الحد الحرج ${isLow ? limits.low : limits.high}.`,
    recommendation_en: limits.action_en,
    recommendation_ar: limits.action_ar,
    evidence: { analyte: result.analyte_en, value: v, critical_low: limits.low, critical_high: limits.high },
    requiresOverrideReason: false,
  };
}

/** Exposed so the settings screen can show what the knowledge base covers. */
export const KB_STATS = {
  interactions: INTERACTIONS.length,
  doseRules: DOSE_RULES.length,
  drugClasses: Object.keys(DRUG_CLASSES).length,
  pregnancyRules: Object.keys(PREGNANCY_UNSAFE).length,
  criticalAnalytes: Object.keys(CRITICAL_ANALYTES).length,
};
