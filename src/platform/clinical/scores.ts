/**
 * Clinical scoring — the arithmetic the whole deterioration layer stands on.
 *
 * These are published, fixed algorithms. They are implemented here rather than
 * pulled from a package because a silent dependency bump must never be able to
 * change what the system considers a deteriorating patient. Every threshold in
 * this file is traceable to its source, and the tests pin the boundaries.
 *
 * Sources:
 *   NEWS2  — Royal College of Physicians, National Early Warning Score 2 (2017)
 *   GCS    — Teasdale & Jennett, Glasgow Coma Scale
 *   qSOFA  — Sepsis-3 (JAMA 2016)
 *   ESI    — Emergency Severity Index v4
 */

// ─── NEWS2 ────────────────────────────────────────────────

export interface VitalsInput {
  respiratory_rate?: number | null;
  spo2?: number | null;
  on_oxygen?: boolean;
  temperature_c?: number | null;
  systolic_bp?: number | null;
  heart_rate?: number | null;
  consciousness?: "alert" | "voice" | "pain" | "unresponsive" | "confused" | null;
}

export type News2Band = "low" | "low_medium" | "medium" | "high";

export interface News2Result {
  score: number;
  band: News2Band;
  /** Per-parameter breakdown, so the chart can show WHY the score is what it is. */
  parts: { key: string; label_en: string; label_ar: string; value: string; points: number }[];
  /** True when any single parameter scored 3 — that alone escalates the response. */
  hasRedScore: boolean;
  /** Number of parameters that could not be scored because the value was missing. */
  missing: number;
}

/** Step function helper: first band whose test passes wins. */
function band(value: number, bands: [test: (v: number) => boolean, points: number][]): number {
  for (const [test, points] of bands) if (test(value)) return points;
  return 0;
}

function scoreRespiratoryRate(rr: number): number {
  return band(rr, [
    [(v) => v <= 8, 3],
    [(v) => v <= 11, 1],
    [(v) => v <= 20, 0],
    [(v) => v <= 24, 2],
    [() => true, 3],
  ]);
}

/**
 * SpO2 Scale 1 — the standard scale. Scale 2 (for patients with hypercapnic
 * respiratory failure and a target of 88–92%) is deliberately NOT applied
 * automatically: it must be prescribed per patient, and guessing it wrong
 * under-scores exactly the people most at risk.
 */
function scoreSpo2(spo2: number): number {
  return band(spo2, [
    [(v) => v <= 91, 3],
    [(v) => v <= 93, 2],
    [(v) => v <= 95, 1],
    [() => true, 0],
  ]);
}

function scoreTemperature(t: number): number {
  return band(t, [
    [(v) => v <= 35.0, 3],
    [(v) => v <= 36.0, 1],
    [(v) => v <= 38.0, 0],
    [(v) => v <= 39.0, 1],
    [() => true, 2],
  ]);
}

function scoreSystolic(sbp: number): number {
  return band(sbp, [
    [(v) => v <= 90, 3],
    [(v) => v <= 100, 2],
    [(v) => v <= 110, 1],
    [(v) => v <= 219, 0],
    [() => true, 3],
  ]);
}

function scoreHeartRate(hr: number): number {
  return band(hr, [
    [(v) => v <= 40, 3],
    [(v) => v <= 50, 1],
    [(v) => v <= 90, 0],
    [(v) => v <= 110, 1],
    [(v) => v <= 130, 2],
    [() => true, 3],
  ]);
}

/** ACVPU: anything other than Alert scores 3. New confusion counts as not-alert. */
function scoreConsciousness(level: NonNullable<VitalsInput["consciousness"]>): number {
  return level === "alert" ? 0 : 3;
}

export function news2Band(score: number, hasRedScore: boolean): News2Band {
  if (score >= 7) return "high";
  if (score >= 5) return "medium";
  // A single parameter scoring 3 raises the response even at a low total.
  if (hasRedScore) return "low_medium";
  if (score >= 1) return "low";
  return "low";
}

/**
 * Compute NEWS2 from whatever vitals are present.
 *
 * Missing parameters are skipped rather than assumed normal, and the count is
 * returned: a score of 2 from three recorded parameters is not the same claim
 * as a score of 2 from seven, and the chart has to be able to say so.
 */
export function computeNews2(v: VitalsInput): News2Result {
  const parts: News2Result["parts"] = [];
  let missing = 0;

  const add = (
    key: string,
    label_en: string,
    label_ar: string,
    raw: number | null | undefined,
    fmt: (n: number) => string,
    scorer: (n: number) => number,
  ) => {
    if (raw === null || raw === undefined || Number.isNaN(raw)) { missing++; return; }
    parts.push({ key, label_en, label_ar, value: fmt(raw), points: scorer(raw) });
  };

  add("rr", "Respiration", "معدل التنفس", v.respiratory_rate, (n) => `${n}/min`, scoreRespiratoryRate);
  add("spo2", "SpO₂", "تشبع الأكسجين", v.spo2, (n) => `${n}%`, scoreSpo2);

  // Air vs supplemental oxygen is itself a 2-point parameter in NEWS2.
  if (v.on_oxygen !== undefined) {
    parts.push({
      key: "o2", label_en: "Air or oxygen", label_ar: "هواء أم أكسجين",
      value: v.on_oxygen ? "Oxygen" : "Air", points: v.on_oxygen ? 2 : 0,
    });
  } else missing++;

  add("temp", "Temperature", "درجة الحرارة", v.temperature_c, (n) => `${n.toFixed(1)}°C`, scoreTemperature);
  add("sbp", "Systolic BP", "الضغط الانقباضي", v.systolic_bp, (n) => `${n} mmHg`, scoreSystolic);
  add("hr", "Pulse", "النبض", v.heart_rate, (n) => `${n}/min`, scoreHeartRate);

  if (v.consciousness) {
    parts.push({
      key: "acvpu", label_en: "Consciousness", label_ar: "مستوى الوعي",
      value: v.consciousness, points: scoreConsciousness(v.consciousness),
    });
  } else missing++;

  const score = parts.reduce((sum, p) => sum + p.points, 0);
  const hasRedScore = parts.some((p) => p.points >= 3);

  return { score, band: news2Band(score, hasRedScore), parts, hasRedScore, missing };
}

/** What the score obliges the ward to do. Bands map to a fixed escalation. */
export const NEWS2_RESPONSE: Record<News2Band, {
  label_en: string; label_ar: string;
  frequency_en: string; frequency_ar: string;
  response_en: string; response_ar: string;
  tone: "neutral" | "info" | "warning" | "critical";
}> = {
  low: {
    label_en: "Low", label_ar: "منخفض",
    frequency_en: "Minimum 12 hourly", frequency_ar: "كل ١٢ ساعة على الأقل",
    response_en: "Continue routine monitoring", response_ar: "متابعة المراقبة الروتينية",
    tone: "neutral",
  },
  low_medium: {
    label_en: "Low–medium", label_ar: "منخفض إلى متوسط",
    frequency_en: "Minimum 4–6 hourly", frequency_ar: "كل ٤–٦ ساعات على الأقل",
    response_en: "Registered nurse review; decide on escalation", response_ar: "مراجعة الممرض المسجل وتحديد التصعيد",
    tone: "info",
  },
  medium: {
    label_en: "Medium", label_ar: "متوسط",
    frequency_en: "Minimum hourly", frequency_ar: "كل ساعة على الأقل",
    response_en: "Urgent review by ward doctor; consider critical care outreach", response_ar: "مراجعة عاجلة من طبيب القسم مع دراسة إشراك العناية المركزة",
    tone: "warning",
  },
  high: {
    label_en: "High", label_ar: "مرتفع",
    frequency_en: "Continuous monitoring", frequency_ar: "مراقبة مستمرة",
    response_en: "Emergency assessment by critical care team; consider transfer", response_ar: "تقييم طارئ من فريق العناية المركزة مع دراسة النقل",
    tone: "critical",
  },
};

// ─── qSOFA ────────────────────────────────────────────────

/**
 * Quick SOFA — a bedside sepsis prompt, not a diagnosis. Two or more of:
 * RR ≥ 22, altered mentation, systolic BP ≤ 100.
 */
export function computeQSofa(v: VitalsInput): { score: number; positive: boolean; criteria: string[] } {
  const criteria: string[] = [];
  if ((v.respiratory_rate ?? 0) >= 22) criteria.push("Respiratory rate ≥ 22/min");
  if (v.consciousness && v.consciousness !== "alert") criteria.push("Altered mentation");
  if (v.systolic_bp !== null && v.systolic_bp !== undefined && v.systolic_bp <= 100) criteria.push("Systolic BP ≤ 100 mmHg");
  return { score: criteria.length, positive: criteria.length >= 2, criteria };
}

// ─── Emergency Severity Index ─────────────────────────────

export const ESI_LEVELS = [
  { level: 1, en: "Resuscitation", ar: "إنعاش",      targetMinutes: 0,   tone: "critical" as const, desc_en: "Immediate life-saving intervention", desc_ar: "تدخل فوري لإنقاذ الحياة" },
  { level: 2, en: "Emergent",      ar: "طارئ",       targetMinutes: 10,  tone: "critical" as const, desc_en: "High risk, severe pain or distress", desc_ar: "خطورة عالية أو ألم شديد" },
  { level: 3, en: "Urgent",        ar: "عاجل",       targetMinutes: 30,  tone: "warning" as const,  desc_en: "Multiple resources expected",       desc_ar: "يتوقع استخدام موارد متعددة" },
  { level: 4, en: "Less urgent",   ar: "أقل إلحاحاً", targetMinutes: 60,  tone: "info" as const,     desc_en: "One resource expected",             desc_ar: "يتوقع استخدام مورد واحد" },
  { level: 5, en: "Non-urgent",    ar: "غير عاجل",   targetMinutes: 120, tone: "neutral" as const,  desc_en: "No resources expected",             desc_ar: "لا يتوقع استخدام موارد" },
] as const;

export function esiLevel(level: number | null | undefined) {
  return ESI_LEVELS.find((l) => l.level === level) ?? null;
}

/**
 * Whether a waiting ED patient is past the time their triage level allows.
 * Level 1 has a target of 0 minutes, so any wait at all is a breach.
 */
export function isTriageBreached(triageLevel: number | null, waitingMinutes: number): boolean {
  const l = esiLevel(triageLevel);
  if (!l) return false;
  return waitingMinutes > l.targetMinutes;
}

// ─── Demographics ─────────────────────────────────────────

/** Whole years, counting the birthday correctly across month boundaries. */
export function ageFromDob(dob: string, on: Date = new Date()): number {
  const b = new Date(dob);
  let age = on.getFullYear() - b.getFullYear();
  const monthDiff = on.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

/**
 * Age the way clinicians say it: days under a month, months under two years,
 * whole years after that. "3 d" and "0 y" are not the same patient.
 */
export function formatAge(dob: string, ar = false, on: Date = new Date()): string {
  const b = new Date(dob);
  const days = Math.floor((on.getTime() - b.getTime()) / 86_400_000);
  if (days < 1) return ar ? "حديث الولادة" : "newborn";
  if (days < 31) return ar ? `${days} يوم` : `${days} d`;
  const months = (on.getFullYear() - b.getFullYear()) * 12 + (on.getMonth() - b.getMonth());
  if (months < 24) return ar ? `${months} شهر` : `${months} mo`;
  return ar ? `${ageFromDob(dob, on)} سنة` : `${ageFromDob(dob, on)} y`;
}

/** BMI to one decimal, or null when either input is missing. */
export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// ─── Blood compatibility ──────────────────────────────────

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

/** Which donor groups a recipient can safely receive red cells from. */
const RBC_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  "O-":  ["O-"],
  "O+":  ["O-", "O+"],
  "A-":  ["O-", "A-"],
  "A+":  ["O-", "O+", "A-", "A+"],
  "B-":  ["O-", "B-"],
  "B+":  ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

/**
 * Red-cell compatibility only. Plasma and platelets run the other way round
 * (AB is the universal plasma donor), so do NOT reuse this for those
 * components — call sites must check the component first.
 */
export function isRbcCompatible(recipient: BloodGroup, donor: BloodGroup): boolean {
  return RBC_COMPATIBILITY[recipient]?.includes(donor) ?? false;
}

export function compatibleDonorGroups(recipient: BloodGroup): BloodGroup[] {
  return RBC_COMPATIBILITY[recipient] ?? [];
}

// ─── Result interpretation ────────────────────────────────

/** Where a numeric result sits against its own reference interval. */
export function resultFlag(
  value: number | null,
  low: number | null,
  high: number | null,
): "normal" | "low" | "high" | "critical_low" | "critical_high" | null {
  if (value === null || (low === null && high === null)) return null;
  if (low !== null && value < low) {
    // More than 20% below the lower bound is treated as critical.
    return value < low * 0.8 ? "critical_low" : "low";
  }
  if (high !== null && value > high) {
    return value > high * 1.2 ? "critical_high" : "high";
  }
  return "normal";
}
