/**
 * The entry catalogue — every place Al-Madinah records something new.
 *
 * This file is the answer to "where do I enter anything?". It is one list, it
 * is what the ⌘K palette and the New button both read, and a form that is not
 * here does not exist. Adding a way to record something is adding an entry to
 * this array; no screen, no route and no menu needs touching.
 *
 * The specs carry real clinical structure rather than free text wherever the
 * structure changes what the system can do with the answer. Observations are
 * numeric because NEWS2 has to be computable from them; allergy severity is an
 * enum because `fatal` must be able to stop an order; a diagnosis carries its
 * code system because a payer will reject it otherwise. Anything that does not
 * change downstream behaviour is left as text, because forcing a clinician to
 * pick from a list they disagree with is how free-text-in-the-wrong-field
 * happens.
 */

import {
  UserPlus, CalendarPlus, BedDouble, Activity, ClipboardPlus, Pill,
  FileText, Stethoscope, ShieldAlert, FlaskConical, Scan, MessageSquarePlus,
} from "lucide-react";
import type { EntryForm, FieldOption, Values } from "./types";
import { nextNumber } from "@/platform/lib/numbering";
import { computeNews2 } from "@/platform/clinical/scores";

/** Options helper — the two languages sit together so they cannot drift. */
const opt = (value: string, en: string, ar: string): FieldOption => ({ value, en, ar });

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowLocalISO = () => {
  // datetime-local wants no timezone suffix and no seconds.
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const toISO = (localValue: unknown): string =>
  localValue ? new Date(String(localValue)).toISOString() : new Date().toISOString();

// ─── Shared option sets ────────────────────────────────────

const SEX = [
  opt("male", "Male", "ذكر"),
  opt("female", "Female", "أنثى"),
  opt("other", "Other", "آخر"),
  opt("unknown", "Unknown", "غير معروف"),
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"].map((g) =>
  opt(g, g === "unknown" ? "Unknown" : g, g === "unknown" ? "غير معروف" : g),
);

const PRIORITY = [
  opt("routine", "Routine", "روتيني"),
  opt("urgent", "Urgent", "عاجل"),
  opt("stat", "STAT — now", "فوري"),
];

const ROUTES = [
  opt("oral", "Oral", "فموي"),
  opt("iv", "Intravenous", "وريدي"),
  opt("im", "Intramuscular", "عضلي"),
  opt("sc", "Subcutaneous", "تحت الجلد"),
  opt("topical", "Topical", "موضعي"),
  opt("inhaled", "Inhaled", "استنشاق"),
  opt("rectal", "Rectal", "شرجي"),
  opt("sublingual", "Sublingual", "تحت اللسان"),
  opt("ophthalmic", "Ophthalmic", "عيني"),
];

const FREQUENCIES = [
  opt("OD", "Once daily (OD)", "مرة يومياً"),
  opt("BD", "Twice daily (BD)", "مرتين يومياً"),
  opt("TDS", "Three times daily (TDS)", "ثلاث مرات يومياً"),
  opt("QDS", "Four times daily (QDS)", "أربع مرات يومياً"),
  opt("Q6H", "Every 6 hours", "كل ٦ ساعات"),
  opt("Q8H", "Every 8 hours", "كل ٨ ساعات"),
  opt("Q12H", "Every 12 hours", "كل ١٢ ساعة"),
  opt("STAT", "Once, now (STAT)", "جرعة واحدة فوراً"),
  opt("PRN", "As required (PRN)", "عند اللزوم"),
];

// ─── Dynamic option sources ────────────────────────────────

const departmentOptions = (s: { departments: { id: string; name_en: string; name_ar: string | null }[] }) =>
  s.departments.map((d) => opt(d.id, d.name_en, d.name_ar || d.name_en));

const wardOptions = (s: { wards: { id: string; name_en: string; name_ar: string | null }[] }) =>
  s.wards.map((w) => opt(w.id, w.name_en, w.name_ar || w.name_en));

/** Beds that can actually receive a patient, in the chosen ward. */
const freeBedOptions = (
  s: { beds: { id: string; ward_id: string; label: string; status: string }[] },
  values: Values,
) =>
  s.beds
    .filter((b) => b.status === "available" && (!values.ward_id || b.ward_id === values.ward_id))
    .map((b) => opt(b.id, b.label, b.label));

/** A patient's open visits — what a note or an observation attaches to. */
const openEncounterOptions = (
  s: { encounters: { id: string; patient_id: string; encounter_number: string; department_name: string; status: string }[] },
  values: Values,
) =>
  s.encounters
    .filter((e) => e.patient_id === values.patient_id && e.status !== "discharged" && e.status !== "cancelled")
    .map((e) => opt(e.id, `${e.encounter_number} · ${e.department_name}`, `${e.encounter_number} · ${e.department_name}`));

// ─── The catalogue ─────────────────────────────────────────

export const ENTRY_FORMS: EntryForm[] = [
  // ── Registration ────────────────────────────────────────
  {
    id: "register-patient",
    table: "patients",
    name: { en: "Register a patient", ar: "تسجيل مريض" },
    summary: {
      en: "Create a new medical record. Issues an MRN.",
      ar: "إنشاء سجل طبي جديد وإصدار رقم ملف.",
    },
    icon: UserPlus,
    group: "registration",
    personas: ["staff"],
    fields: [
      { name: "name_en", kind: "text", required: true, full: true,
        label: { en: "Full name (English)", ar: "الاسم الكامل (بالإنجليزية)" },
        placeholder: { en: "Ahmad Khalil Mansour", ar: "Ahmad Khalil Mansour" } },
      { name: "name_ar", kind: "text", full: true,
        label: { en: "Full name (Arabic)", ar: "الاسم الكامل (بالعربية)" },
        placeholder: { en: "أحمد خليل منصور", ar: "أحمد خليل منصور" } },
      { name: "date_of_birth", kind: "date", required: true,
        label: { en: "Date of birth", ar: "تاريخ الميلاد" },
        validate: (v) =>
          v && new Date(String(v)) > new Date()
            ? { en: "Date of birth cannot be in the future.", ar: "تاريخ الميلاد لا يمكن أن يكون في المستقبل." }
            : null },
      { name: "sex", kind: "select", required: true, options: SEX, default: "unknown",
        label: { en: "Sex", ar: "الجنس" } },
      { name: "phone", kind: "text",
        label: { en: "Mobile number", ar: "رقم الجوال" },
        placeholder: { en: "+966 5X XXX XXXX", ar: "+966 5X XXX XXXX" },
        hint: { en: "Used for appointment reminders and portal access.", ar: "يُستخدم للتذكير بالمواعيد والدخول للبوابة." } },
      { name: "national_id", kind: "text",
        label: { en: "National ID / Iqama", ar: "الهوية الوطنية / الإقامة" } },
      { name: "blood_group", kind: "select", options: BLOOD_GROUPS, default: "unknown",
        label: { en: "Blood group", ar: "فصيلة الدم" } },
      { name: "preferred_language", kind: "select", default: "ar",
        options: [opt("ar", "Arabic", "العربية"), opt("en", "English", "الإنجليزية")],
        label: { en: "Preferred language", ar: "اللغة المفضلة" } },
      { name: "allergy_summary", kind: "textarea", full: true,
        label: { en: "Known allergies", ar: "الحساسية المعروفة" },
        hint: {
          en: "A summary for the wristband. Record each allergy properly afterwards so decision support can act on it.",
          ar: "ملخص للسوار. سجّل كل حساسية بشكل منفصل لاحقاً حتى يتمكن الدعم القراري من استخدامها.",
        } },
      { name: "next_of_kin_name", kind: "text",
        label: { en: "Next of kin", ar: "أقرب الأقارب" } },
      { name: "next_of_kin_phone", kind: "text",
        label: { en: "Next of kin phone", ar: "هاتف أقرب الأقارب" } },
    ],
    build: (v) => ({
      mrn: nextNumber("mrn"),
      name_en: str(v.name_en).trim(),
      name_ar: str(v.name_ar).trim() || null,
      date_of_birth: str(v.date_of_birth),
      sex: str(v.sex) || "unknown",
      national_id: str(v.national_id).trim() || null,
      phone: str(v.phone).trim() || null,
      email: null,
      address_en: null,
      address_ar: null,
      blood_group: str(v.blood_group) || "unknown",
      allergy_summary: str(v.allergy_summary).trim() || null,
      next_of_kin_name: str(v.next_of_kin_name).trim() || null,
      next_of_kin_phone: str(v.next_of_kin_phone).trim() || null,
      next_of_kin_relation: null,
      preferred_language: str(v.preferred_language) || "ar",
      status: "active",
      merged_into_id: null,
      vip_flag: false,
      photo_url: null,
      registered_at: new Date().toISOString(),
      tags: [],
      metadata: {},
    }),
    next: (saved) => `/patients/${saved.id}`,
    done: (saved) => ({
      en: `Registered ${saved.name_en} · ${saved.mrn}`,
      ar: `تم تسجيل ${saved.name_en} · ${saved.mrn}`,
    }),
  },

  {
    id: "admit-patient",
    table: "encounters",
    name: { en: "Admit / start a visit", ar: "دخول أو بدء زيارة" },
    summary: {
      en: "Open an encounter so orders, notes and observations have somewhere to attach.",
      ar: "فتح زيارة حتى ترتبط بها الأوامر والملاحظات والقياسات.",
    },
    icon: BedDouble,
    group: "registration",
    personas: ["staff"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "class", kind: "select", required: true, default: "outpatient",
        options: [
          opt("outpatient", "Outpatient", "عيادة خارجية"),
          opt("inpatient", "Inpatient — admit to a bed", "تنويم — حجز سرير"),
          opt("emergency", "Emergency", "طوارئ"),
          opt("day_case", "Day case", "جراحة يوم واحد"),
        ],
        label: { en: "Visit type", ar: "نوع الزيارة" } },
      { name: "department_id", kind: "department", required: true,
        label: { en: "Department", ar: "القسم" } },
      { name: "attending_provider_id", kind: "provider",
        label: { en: "Attending clinician", ar: "الطبيب المعالج" } },
      { name: "ward_id", kind: "select", optionsFrom: wardOptions,
        visibleWhen: (v) => v.class === "inpatient",
        label: { en: "Ward", ar: "الجناح" } },
      { name: "bed_id", kind: "select", optionsFrom: freeBedOptions,
        visibleWhen: (v) => v.class === "inpatient",
        label: { en: "Bed", ar: "السرير" },
        hint: { en: "Only beds currently free are listed.", ar: "تظهر الأسرة الشاغرة فقط." } },
      { name: "chief_complaint_en", kind: "textarea", full: true, required: true,
        label: { en: "Reason for visit", ar: "سبب الزيارة" },
        placeholder: { en: "Central chest pain since 06:00, radiating to left arm", ar: "ألم صدري منذ الساعة ٦ صباحاً" } },
      { name: "isolation_required", kind: "checkbox", full: true,
        label: { en: "Isolation required", ar: "يحتاج عزل" },
        hint: { en: "Flags the bed and warns housekeeping and portering.", ar: "يُعلّم السرير وينبه خدمات النظافة والنقل." } },
    ],
    build: (v, s, ctx) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      const dept = s.departments.find((d) => d.id === v.department_id);
      const prov = s.providers.find((p) => p.id === v.attending_provider_id);
      const bed = s.beds.find((b) => b.id === v.bed_id);
      return {
        encounter_number: nextNumber("encounter"),
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        patient_mrn: patient?.mrn ?? "",
        class: str(v.class),
        status: "in_progress",
        department_id: str(v.department_id) || null,
        department_name: dept?.name_en ?? "",
        attending_provider_id: str(v.attending_provider_id) || ctx.providerId,
        attending_provider_name: prov?.name_en ?? ctx.providerName ?? null,
        ward_id: str(v.ward_id) || null,
        bed_id: str(v.bed_id) || null,
        bed_label: bed?.label ?? null,
        admitted_at: new Date().toISOString(),
        discharged_at: null,
        chief_complaint_en: str(v.chief_complaint_en).trim(),
        chief_complaint_ar: null,
        admission_source: "walk_in",
        discharge_disposition: null,
        los_hours: null,
        isolation_required: Boolean(v.isolation_required),
        insurance_policy_id: null,
        metadata: {},
      };
    },
    // Admitting a patient to a bed has to occupy the bed. Leaving that to a
    // separate screen is how two patients end up assigned to bed 12.
    effects: (v, s, _ctx, saved) =>
      v.bed_id
        ? [{
            table: "beds",
            row: {
              id: str(v.bed_id),
              status: "occupied",
              current_encounter_id: str(saved.id),
              current_patient_name: s.patients.find((p) => p.id === v.patient_id)?.name_en ?? null,
            },
          }]
        : [],
    next: (saved) => `/patients/${saved.patient_id}`,
    done: (saved) => ({
      en: `Visit ${saved.encounter_number} opened for ${saved.patient_name}`,
      ar: `تم فتح الزيارة ${saved.encounter_number} للمريض ${saved.patient_name}`,
    }),
  },

  // ── Scheduling ──────────────────────────────────────────
  {
    id: "book-appointment",
    table: "appointments",
    name: { en: "Book an appointment", ar: "حجز موعد" },
    summary: {
      en: "Reserve a clinic slot. Visible immediately to the clinician and the patient.",
      ar: "حجز موعد في العيادة. يظهر فوراً للطبيب وللمريض.",
    },
    icon: CalendarPlus,
    group: "scheduling",
    personas: ["staff", "clinician", "patient"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "provider_id", kind: "provider", required: true,
        label: { en: "Clinician", ar: "الطبيب" } },
      { name: "department_id", kind: "department", required: true,
        label: { en: "Clinic", ar: "العيادة" } },
      { name: "slot_start", kind: "datetime", required: true, default: () => nowLocalISO(),
        label: { en: "Date and time", ar: "التاريخ والوقت" },
        validate: (v) =>
          v && new Date(String(v)).getTime() < Date.now() - 60_000
            ? { en: "That time has already passed.", ar: "هذا الوقت قد مضى بالفعل." }
            : null },
      { name: "duration_minutes", kind: "number", default: 20, min: 5, max: 240, step: 5,
        label: { en: "Length (minutes)", ar: "المدة (دقائق)" } },
      { name: "appointment_type", kind: "select", required: true, default: "follow_up",
        options: [
          opt("new", "New patient", "مريض جديد"),
          opt("follow_up", "Follow-up", "مراجعة"),
          opt("procedure", "Procedure", "إجراء"),
          opt("telehealth", "Telehealth", "استشارة عن بعد"),
          opt("vaccination", "Vaccination", "تطعيم"),
          opt("screening", "Screening", "فحص"),
          opt("review", "Results review", "مراجعة نتائج"),
        ],
        label: { en: "Appointment type", ar: "نوع الموعد" } },
      { name: "reason_en", kind: "textarea", full: true,
        label: { en: "Reason", ar: "السبب" },
        placeholder: { en: "Review of thyroid function results", ar: "مراجعة نتائج وظائف الغدة الدرقية" } },
    ],
    validate: (v, s) => {
      // A clinician cannot be in two rooms. Overlap is checked here rather
      // than field-by-field because it depends on three answers at once.
      const start = new Date(str(v.slot_start)).getTime();
      const end = start + (num(v.duration_minutes) ?? 20) * 60_000;
      const clash = s.appointments.find((a) => {
        if (a.provider_id !== v.provider_id) return false;
        if (a.status === "cancelled" || a.status === "no_show") return false;
        const aStart = new Date(a.slot_start).getTime();
        const aEnd = new Date(a.slot_end).getTime();
        return start < aEnd && end > aStart;
      });
      return clash
        ? {
            en: `That clinician already has ${clash.patient_name} booked at this time.`,
            ar: `الطبيب لديه موعد مع ${clash.patient_name} في هذا الوقت.`,
          }
        : null;
    },
    build: (v, s, ctx) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      const prov = s.providers.find((p) => p.id === v.provider_id);
      const dept = s.departments.find((d) => d.id === v.department_id);
      const start = new Date(str(v.slot_start));
      const mins = num(v.duration_minutes) ?? 20;
      const type = str(v.appointment_type);
      return {
        appointment_number: nextNumber("appointment"),
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        patient_mrn: patient?.mrn ?? "",
        patient_phone: patient?.phone ?? null,
        provider_id: str(v.provider_id) || null,
        provider_name: prov?.name_en ?? "",
        department_id: str(v.department_id) || null,
        department_name: dept?.name_en ?? "",
        clinic_room: null,
        appointment_type: type,
        slot_start: start.toISOString(),
        slot_end: new Date(start.getTime() + mins * 60_000).toISOString(),
        duration_minutes: mins,
        status: "booked",
        reason_en: str(v.reason_en).trim() || null,
        reason_ar: null,
        // Who booked it matters clinically: a slot the patient chose carries
        // different follow-up obligations from one the clinic scheduled.
        booked_by: ctx.patientId ? "patient_portal" : ctx.providerName || "reception",
        booked_at: new Date().toISOString(),
        reminder_sent_at: null,
        confirmed_at: null,
        arrived_at: null,
        cancellation_reason: null,
        rescheduled_from_id: null,
        is_telehealth: type === "telehealth",
        insurance_policy_id: null,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `Booked ${saved.patient_name} with ${saved.provider_name}`,
      ar: `تم حجز موعد ${saved.patient_name} مع ${saved.provider_name}`,
    }),
  },

  // ── Clinical record ─────────────────────────────────────
  {
    id: "record-vitals",
    table: "vitals",
    name: { en: "Record observations", ar: "تسجيل القياسات الحيوية" },
    summary: {
      en: "A full observation set. NEWS2 is scored on save and escalates itself.",
      ar: "مجموعة قياسات كاملة. يُحسب مؤشر NEWS2 عند الحفظ ويصعّد تلقائياً.",
    },
    icon: Activity,
    group: "clinical",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "encounter_id", kind: "select", required: true, full: true, optionsFrom: openEncounterOptions,
        label: { en: "Visit", ar: "الزيارة" },
        hint: { en: "Observations belong to a visit, not to a person in general.", ar: "القياسات ترتبط بزيارة وليس بالمريض بشكل عام." } },
      { name: "respiratory_rate", kind: "number", min: 0, max: 80,
        label: { en: "Respiratory rate", ar: "معدل التنفس" }, hint: { en: "breaths / min", ar: "نفس / دقيقة" } },
      { name: "spo2", kind: "number", min: 0, max: 100,
        label: { en: "SpO₂", ar: "تشبع الأكسجين" }, hint: { en: "%", ar: "٪" } },
      { name: "on_oxygen", kind: "checkbox",
        label: { en: "On supplemental oxygen", ar: "على أكسجين إضافي" },
        hint: { en: "Changes the NEWS2 weighting for SpO₂.", ar: "يغيّر ترجيح NEWS2 لتشبع الأكسجين." } },
      { name: "temperature_c", kind: "number", min: 25, max: 45, step: 0.1,
        label: { en: "Temperature", ar: "الحرارة" }, hint: { en: "°C", ar: "°م" } },
      { name: "systolic_bp", kind: "number", min: 0, max: 300,
        label: { en: "Systolic BP", ar: "الضغط الانقباضي" }, hint: { en: "mmHg", ar: "ملم زئبق" } },
      { name: "diastolic_bp", kind: "number", min: 0, max: 200,
        label: { en: "Diastolic BP", ar: "الضغط الانبساطي" }, hint: { en: "mmHg", ar: "ملم زئبق" } },
      { name: "heart_rate", kind: "number", min: 0, max: 300,
        label: { en: "Heart rate", ar: "معدل النبض" }, hint: { en: "bpm", ar: "نبضة / دقيقة" } },
      { name: "consciousness", kind: "select", default: "alert",
        options: [
          opt("alert", "Alert", "واعٍ"),
          opt("confused", "New confusion", "تشوش جديد"),
          opt("voice", "Responds to voice", "يستجيب للصوت"),
          opt("pain", "Responds to pain", "يستجيب للألم"),
          opt("unresponsive", "Unresponsive", "لا يستجيب"),
        ],
        label: { en: "Consciousness (ACVPU)", ar: "مستوى الوعي" } },
      { name: "pain_score", kind: "number", min: 0, max: 10,
        label: { en: "Pain score", ar: "درجة الألم" }, hint: { en: "0–10", ar: "٠–١٠" } },
      { name: "blood_glucose", kind: "number", min: 0, max: 60, step: 0.1,
        label: { en: "Blood glucose", ar: "سكر الدم" }, hint: { en: "mmol/L", ar: "ملي مول/لتر" } },
    ],
    build: (v, _s, ctx) => {
      const input = {
        respiratory_rate: num(v.respiratory_rate),
        spo2: num(v.spo2),
        on_oxygen: Boolean(v.on_oxygen),
        temperature_c: num(v.temperature_c),
        systolic_bp: num(v.systolic_bp),
        heart_rate: num(v.heart_rate),
        consciousness: (str(v.consciousness) || "alert") as "alert",
      };
      // Scored here, on write, so the number stored beside the observations is
      // always the one those observations produce. A NEWS2 computed later, on
      // read, can silently disagree with what the nurse was shown.
      const news2 = computeNews2(input);
      return {
        encounter_id: str(v.encounter_id),
        patient_id: str(v.patient_id),
        recorded_at: new Date().toISOString(),
        recorded_by: ctx.providerName || "Ward staff",
        temperature_c: num(v.temperature_c),
        heart_rate: num(v.heart_rate),
        respiratory_rate: num(v.respiratory_rate),
        systolic_bp: num(v.systolic_bp),
        diastolic_bp: num(v.diastolic_bp),
        spo2: num(v.spo2),
        on_oxygen: Boolean(v.on_oxygen),
        blood_glucose: num(v.blood_glucose),
        pain_score: num(v.pain_score),
        consciousness: str(v.consciousness) || "alert",
        weight_kg: null,
        height_cm: null,
        news2_score: news2.score,
        news2_band: news2.band,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `Observations recorded · NEWS2 ${saved.news2_score}`,
      ar: `تم تسجيل القياسات · NEWS2 ${saved.news2_score}`,
    }),
  },

  {
    id: "write-note",
    table: "clinical_notes",
    name: { en: "Write a note", ar: "كتابة ملاحظة" },
    summary: {
      en: "Add to the clinical record. Signing makes it part of the legal record.",
      ar: "إضافة إلى السجل السريري. التوقيع يجعلها جزءاً من السجل القانوني.",
    },
    icon: FileText,
    group: "clinical",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "encounter_id", kind: "select", required: true, full: true, optionsFrom: openEncounterOptions,
        label: { en: "Visit", ar: "الزيارة" } },
      { name: "note_type", kind: "select", required: true, default: "progress",
        options: [
          opt("progress", "Progress note", "ملاحظة متابعة"),
          opt("admission", "Admission note", "ملاحظة دخول"),
          opt("nursing", "Nursing note", "ملاحظة تمريض"),
          opt("consult", "Consultation", "استشارة"),
          opt("operative", "Operative note", "تقرير عملية"),
          opt("discharge", "Discharge summary", "ملخص الخروج"),
          opt("handover", "Handover", "تسليم"),
        ],
        label: { en: "Note type", ar: "نوع الملاحظة" } },
      { name: "status", kind: "select", required: true, default: "signed",
        options: [
          opt("signed", "Sign now", "توقيع الآن"),
          opt("draft", "Save as draft", "حفظ كمسودة"),
        ],
        label: { en: "Signature", ar: "التوقيع" },
        hint: { en: "An unsigned note is a draft and does not count as documented care.", ar: "الملاحظة غير الموقعة مسودة ولا تُحتسب توثيقاً." } },
      { name: "title_en", kind: "text", required: true, full: true,
        label: { en: "Title", ar: "العنوان" },
        placeholder: { en: "Post-take ward round", ar: "جولة ما بعد الاستقبال" } },
      { name: "body_en", kind: "textarea", required: true, full: true,
        label: { en: "Note", ar: "نص الملاحظة" },
        placeholder: {
          en: "Subjective / Objective / Assessment / Plan",
          ar: "الشكوى / الفحص / التقييم / الخطة",
        } },
      { name: "confidential", kind: "checkbox", full: true,
        label: { en: "Restricted access", ar: "وصول مقيّد" },
        hint: { en: "Hidden from the patient portal and from staff outside the care team.", ar: "مخفية عن بوابة المريض وعن غير فريق الرعاية." } },
    ],
    build: (v, _s, ctx) => {
      const signing = str(v.status) === "signed";
      return {
        encounter_id: str(v.encounter_id),
        patient_id: str(v.patient_id),
        note_type: str(v.note_type),
        title_en: str(v.title_en).trim(),
        title_ar: null,
        body_en: str(v.body_en).trim(),
        body_ar: null,
        author_id: ctx.providerId,
        author_name: ctx.providerName || "Clinical staff",
        author_role: null,
        status: signing ? "signed" : "draft",
        signed_at: signing ? new Date().toISOString() : null,
        amends_note_id: null,
        confidential: Boolean(v.confidential),
        metadata: {},
      };
    },
    done: (saved) => ({
      en: saved.status === "signed" ? "Note signed and filed" : "Note saved as a draft",
      ar: saved.status === "signed" ? "تم توقيع الملاحظة وحفظها" : "تم حفظ الملاحظة كمسودة",
    }),
  },

  {
    id: "record-diagnosis",
    table: "diagnoses",
    name: { en: "Record a diagnosis", ar: "تسجيل تشخيص" },
    summary: {
      en: "Add to the problem list. Coded so billing and reporting can read it.",
      ar: "إضافة إلى قائمة المشاكل بترميز تقرؤه الفوترة والتقارير.",
    },
    icon: Stethoscope,
    group: "clinical",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "encounter_id", kind: "select", full: true, optionsFrom: openEncounterOptions,
        label: { en: "Visit", ar: "الزيارة" },
        hint: { en: "Leave empty for a long-term problem not tied to this visit.", ar: "اتركه فارغاً لمشكلة مزمنة غير مرتبطة بهذه الزيارة." } },
      { name: "description_en", kind: "text", required: true, full: true,
        label: { en: "Diagnosis", ar: "التشخيص" },
        placeholder: { en: "Type 2 diabetes mellitus", ar: "داء السكري من النوع الثاني" } },
      { name: "code_system", kind: "select", required: true, default: "icd11",
        options: [
          opt("icd11", "ICD-11", "ICD-11"),
          opt("icd10", "ICD-10", "ICD-10"),
          opt("snomed", "SNOMED CT", "SNOMED CT"),
        ],
        label: { en: "Code system", ar: "نظام الترميز" } },
      { name: "code", kind: "text", required: true,
        label: { en: "Code", ar: "الرمز" },
        placeholder: { en: "5A11", ar: "5A11" } },
      { name: "category", kind: "select", required: true, default: "secondary",
        options: [
          opt("principal", "Principal", "رئيسي"),
          opt("admitting", "Admitting", "عند الدخول"),
          opt("secondary", "Secondary", "ثانوي"),
          opt("comorbidity", "Comorbidity", "مرض مصاحب"),
          opt("complication", "Complication", "مضاعفة"),
          opt("discharge", "Discharge", "عند الخروج"),
        ],
        label: { en: "Category", ar: "التصنيف" } },
      { name: "certainty", kind: "select", required: true, default: "confirmed",
        options: [
          opt("suspected", "Suspected", "مشتبه"),
          opt("provisional", "Provisional", "مبدئي"),
          opt("confirmed", "Confirmed", "مؤكد"),
          opt("ruled_out", "Ruled out", "مستبعد"),
        ],
        label: { en: "Certainty", ar: "درجة التأكد" } },
      { name: "onset_date", kind: "date",
        label: { en: "Onset", ar: "تاريخ البدء" } },
    ],
    build: (v, _s, ctx) => ({
      encounter_id: str(v.encounter_id) || null,
      patient_id: str(v.patient_id),
      code_system: str(v.code_system),
      code: str(v.code).trim().toUpperCase(),
      description_en: str(v.description_en).trim(),
      description_ar: null,
      category: str(v.category),
      certainty: str(v.certainty),
      onset_date: str(v.onset_date) || null,
      resolved_date: null,
      status: str(v.certainty) === "ruled_out" ? "inactive" : "active",
      present_on_admission: str(v.category) === "admitting" ? true : null,
      diagnosed_by: ctx.providerName || null,
      metadata: {},
    }),
    done: (saved) => ({
      en: `Added "${saved.description_en}" to the problem list`,
      ar: `تمت إضافة "${saved.description_en}" إلى قائمة المشاكل`,
    }),
  },

  {
    id: "record-allergy",
    table: "allergies",
    name: { en: "Record an allergy", ar: "تسجيل حساسية" },
    summary: {
      en: "Feeds decision support. A severe drug allergy will stop an order.",
      ar: "يغذّي الدعم القراري. الحساسية الدوائية الشديدة توقف الأمر الطبي.",
    },
    icon: ShieldAlert,
    group: "clinical",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "substance_en", kind: "text", required: true, full: true,
        label: { en: "Substance", ar: "المادة" },
        placeholder: { en: "Penicillin", ar: "بنسلين" } },
      { name: "allergen_type", kind: "select", required: true, default: "drug",
        options: [
          opt("drug", "Drug", "دواء"),
          opt("food", "Food", "طعام"),
          opt("environment", "Environmental", "بيئي"),
          opt("latex", "Latex", "لاتكس"),
          opt("contrast", "Contrast medium", "صبغة أشعة"),
          opt("other", "Other", "أخرى"),
        ],
        label: { en: "Type", ar: "النوع" } },
      { name: "kind", kind: "select", required: true, default: "allergy",
        options: [
          opt("allergy", "True allergy", "حساسية حقيقية"),
          opt("intolerance", "Intolerance", "عدم تحمّل"),
        ],
        label: { en: "Allergy or intolerance", ar: "حساسية أم عدم تحمّل" },
        hint: {
          en: "An intolerance warns. A true allergy can block. Recording nausea as an allergy is how a patient loses a drug class for life.",
          ar: "عدم التحمّل ينبّه فقط، أما الحساسية فتمنع. تسجيل الغثيان كحساسية يحرم المريض من فئة دوائية مدى الحياة.",
        } },
      { name: "severity", kind: "select", required: true, default: "moderate",
        options: [
          opt("mild", "Mild", "خفيفة"),
          opt("moderate", "Moderate", "متوسطة"),
          opt("severe", "Severe", "شديدة"),
          opt("fatal", "Life-threatening", "مهددة للحياة"),
        ],
        label: { en: "Severity", ar: "الشدة" } },
      { name: "reaction_en", kind: "textarea", full: true,
        label: { en: "Reaction", ar: "نوع التفاعل" },
        placeholder: { en: "Urticaria and facial swelling within 20 minutes", ar: "شرى وتورم بالوجه خلال ٢٠ دقيقة" } },
    ],
    build: (v, _s, ctx) => ({
      patient_id: str(v.patient_id),
      substance_en: str(v.substance_en).trim(),
      substance_ar: null,
      allergen_type: str(v.allergen_type),
      reaction_en: str(v.reaction_en).trim() || null,
      reaction_ar: null,
      severity: str(v.severity),
      kind: str(v.kind),
      onset_date: null,
      status: "active",
      recorded_by: ctx.providerName || "Clinical staff",
      metadata: {},
    }),
    done: (saved) => ({
      en: `${saved.substance_en} recorded — decision support is now active for it`,
      ar: `تم تسجيل ${saved.substance_en} — الدعم القراري مفعّل عليها الآن`,
    }),
  },

  // ── Orders and prescribing ──────────────────────────────
  {
    id: "place-order",
    table: "clinical_orders",
    name: { en: "Place an order", ar: "إصدار أمر طبي" },
    summary: {
      en: "CPOE. Checked against allergies and interactions before it is signed.",
      ar: "الأوامر الطبية المحوسبة. تُفحص مقابل الحساسية والتداخلات قبل التوقيع.",
    },
    icon: ClipboardPlus,
    group: "orders",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "encounter_id", kind: "select", required: true, full: true, optionsFrom: openEncounterOptions,
        label: { en: "Visit", ar: "الزيارة" } },
      { name: "category", kind: "select", required: true, default: "medication",
        options: [
          opt("medication", "Medication", "دواء"),
          opt("lab", "Laboratory", "مختبر"),
          opt("imaging", "Imaging", "أشعة"),
          opt("procedure", "Procedure", "إجراء"),
          opt("nursing", "Nursing", "تمريض"),
          opt("diet", "Diet", "تغذية"),
          opt("consult", "Consult", "استشارة"),
          opt("blood", "Blood product", "منتج دم"),
          opt("therapy", "Therapy", "علاج طبيعي"),
        ],
        label: { en: "Order type", ar: "نوع الأمر" } },
      { name: "priority", kind: "select", required: true, default: "routine", options: PRIORITY,
        label: { en: "Priority", ar: "الأولوية" } },
      { name: "item_en", kind: "text", required: true, full: true,
        label: { en: "Order", ar: "الأمر" },
        placeholder: { en: "Amoxicillin 500 mg", ar: "أموكسيسيلين ٥٠٠ ملغ" } },
      { name: "dose", kind: "text", visibleWhen: (v) => v.category === "medication",
        label: { en: "Dose", ar: "الجرعة" }, placeholder: { en: "500 mg", ar: "٥٠٠ ملغ" } },
      { name: "route", kind: "select", options: ROUTES, visibleWhen: (v) => v.category === "medication",
        label: { en: "Route", ar: "طريقة الإعطاء" } },
      { name: "frequency", kind: "select", options: FREQUENCIES, visibleWhen: (v) => v.category === "medication",
        label: { en: "Frequency", ar: "التكرار" } },
      { name: "duration_days", kind: "number", min: 1, max: 365, visibleWhen: (v) => v.category === "medication",
        label: { en: "Duration (days)", ar: "المدة (أيام)" } },
      { name: "prn", kind: "checkbox", visibleWhen: (v) => v.category === "medication",
        label: { en: "As required (PRN)", ar: "عند اللزوم" } },
      { name: "prn_reason", kind: "text", visibleWhen: (v) => Boolean(v.prn),
        label: { en: "PRN indication", ar: "دواعي الاستعمال عند اللزوم" },
        placeholder: { en: "For pain score above 4", ar: "لألم أعلى من ٤" } },
      { name: "instructions_en", kind: "textarea", full: true,
        label: { en: "Instructions", ar: "التعليمات" } },
    ],
    build: (v, s, ctx) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      const med = str(v.category) === "medication";
      return {
        order_number: nextNumber("order"),
        encounter_id: str(v.encounter_id),
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        category: str(v.category),
        item_en: str(v.item_en).trim(),
        item_ar: null,
        item_code: null,
        priority: str(v.priority),
        // An order placed by someone who cannot prescribe is a request, not an
        // instruction, and must wait for a signature before anyone acts on it.
        status: ctx.providerId ? "active" : "pending_signature",
        ordered_by_id: ctx.providerId,
        ordered_by_name: ctx.providerName || "Clinical staff",
        ordered_at: new Date().toISOString(),
        start_at: new Date().toISOString(),
        end_at: null,
        dose: med ? str(v.dose).trim() || null : null,
        dose_unit: null,
        route: med ? str(v.route) || null : null,
        frequency: med ? str(v.frequency) || null : null,
        duration_days: med ? num(v.duration_days) : null,
        prn: med ? Boolean(v.prn) : false,
        prn_reason: med && v.prn ? str(v.prn_reason).trim() || null : null,
        instructions_en: str(v.instructions_en).trim() || null,
        instructions_ar: null,
        override_reason: null,
        department_id: null,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `${saved.item_en} ordered · ${saved.order_number}`,
      ar: `تم إصدار ${saved.item_en} · ${saved.order_number}`,
    }),
  },

  {
    id: "prescribe",
    table: "prescriptions",
    name: { en: "Write a prescription", ar: "كتابة وصفة طبية" },
    summary: {
      en: "E-prescribing. Transmits to pharmacy and appears in the patient's portal.",
      ar: "وصفة إلكترونية تُرسل للصيدلية وتظهر في بوابة المريض.",
    },
    icon: Pill,
    group: "orders",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "drug_name_en", kind: "text", required: true, full: true,
        label: { en: "Drug", ar: "الدواء" },
        placeholder: { en: "Metformin", ar: "ميتفورمين" } },
      { name: "strength", kind: "text",
        label: { en: "Strength", ar: "التركيز" }, placeholder: { en: "500 mg", ar: "٥٠٠ ملغ" } },
      { name: "form", kind: "select", default: "tablet",
        options: [
          opt("tablet", "Tablet", "أقراص"),
          opt("capsule", "Capsule", "كبسولات"),
          opt("syrup", "Syrup", "شراب"),
          opt("injection", "Injection", "حقن"),
          opt("cream", "Cream", "كريم"),
          opt("drops", "Drops", "قطرة"),
          opt("inhaler", "Inhaler", "بخاخ"),
          opt("patch", "Patch", "لصقة"),
          opt("suppository", "Suppository", "تحاميل"),
        ],
        label: { en: "Form", ar: "الشكل الصيدلاني" } },
      { name: "dose", kind: "text", required: true,
        label: { en: "Dose", ar: "الجرعة" }, placeholder: { en: "1 tablet", ar: "قرص واحد" } },
      { name: "route", kind: "select", required: true, default: "oral", options: ROUTES,
        label: { en: "Route", ar: "طريقة الإعطاء" } },
      { name: "frequency", kind: "select", required: true, default: "BD", options: FREQUENCIES,
        label: { en: "Frequency", ar: "التكرار" } },
      { name: "duration_days", kind: "number", min: 1, max: 365, default: 30,
        label: { en: "Duration (days)", ar: "المدة (أيام)" } },
      { name: "quantity", kind: "number", min: 1, max: 999, required: true, default: 60,
        label: { en: "Quantity to dispense", ar: "الكمية المصروفة" } },
      { name: "refills_allowed", kind: "number", min: 0, max: 12, default: 0,
        label: { en: "Refills allowed", ar: "عدد مرات الصرف المتكرر" } },
      { name: "substitution_allowed", kind: "checkbox", default: true,
        label: { en: "Generic substitution allowed", ar: "يُسمح بالبديل الجنيس" } },
      { name: "notes_en", kind: "textarea", full: true,
        label: { en: "Directions for the patient", ar: "إرشادات للمريض" },
        placeholder: { en: "Take with food. Do not stop without advice.", ar: "يؤخذ مع الطعام. لا توقفه دون استشارة." } },
    ],
    build: (v, s, ctx) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      return {
        rx_number: nextNumber("rx"),
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        encounter_id: null,
        prescriber_id: ctx.providerId,
        prescriber_name: ctx.providerName || "Prescriber",
        drug_name_en: str(v.drug_name_en).trim(),
        drug_name_ar: null,
        atc_code: null,
        strength: str(v.strength).trim() || null,
        form: str(v.form) || null,
        dose: str(v.dose).trim(),
        route: str(v.route),
        frequency: str(v.frequency),
        duration_days: num(v.duration_days),
        quantity: num(v.quantity) ?? 1,
        refills_allowed: num(v.refills_allowed) ?? 0,
        refills_used: 0,
        controlled_schedule: null,
        substitution_allowed: v.substitution_allowed !== false,
        pharmacy_name: "Al-Madinah Outpatient Pharmacy",
        status: ctx.providerId ? "transmitted" : "draft",
        transmitted_at: ctx.providerId ? new Date().toISOString() : null,
        dispensed_at: null,
        notes_en: str(v.notes_en).trim() || null,
        notes_ar: null,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `${saved.drug_name_en} prescribed · ${saved.rx_number}`,
      ar: `تم وصف ${saved.drug_name_en} · ${saved.rx_number}`,
    }),
  },

  // ── Diagnostics ─────────────────────────────────────────
  {
    id: "order-lab",
    table: "lab_orders",
    name: { en: "Order a lab test", ar: "طلب فحص مختبري" },
    summary: {
      en: "Raises an accession the laboratory can collect against.",
      ar: "يصدر رقم عينة يمكن للمختبر السحب عليه.",
    },
    icon: FlaskConical,
    group: "diagnostics",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "encounter_id", kind: "select", required: true, full: true, optionsFrom: openEncounterOptions,
        label: { en: "Visit", ar: "الزيارة" } },
      { name: "panel_en", kind: "text", required: true, full: true,
        label: { en: "Panel or test", ar: "الفحص أو المجموعة" },
        placeholder: { en: "Full blood count", ar: "صورة دم كاملة" } },
      { name: "discipline", kind: "select", required: true, default: "haematology",
        options: [
          opt("chemistry", "Chemistry", "كيمياء"),
          opt("haematology", "Haematology", "أمراض دم"),
          opt("microbiology", "Microbiology", "أحياء دقيقة"),
          opt("serology", "Serology", "مصلية"),
          opt("histopathology", "Histopathology", "أنسجة"),
          opt("molecular", "Molecular", "جزيئية"),
          opt("blood_bank", "Blood bank", "بنك الدم"),
          opt("urinalysis", "Urinalysis", "تحليل بول"),
        ],
        label: { en: "Discipline", ar: "التخصص" } },
      { name: "specimen_type", kind: "select", required: true, default: "blood",
        options: [
          opt("blood", "Whole blood", "دم كامل"),
          opt("serum", "Serum", "مصل"),
          opt("plasma", "Plasma", "بلازما"),
          opt("urine", "Urine", "بول"),
          opt("stool", "Stool", "براز"),
          opt("csf", "CSF", "سائل نخاعي"),
          opt("sputum", "Sputum", "بلغم"),
          opt("swab", "Swab", "مسحة"),
          opt("tissue", "Tissue", "نسيج"),
          opt("fluid", "Fluid", "سائل"),
        ],
        label: { en: "Specimen", ar: "العينة" } },
      { name: "priority", kind: "select", required: true, default: "routine", options: PRIORITY,
        label: { en: "Priority", ar: "الأولوية" } },
    ],
    build: (v, s, ctx) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      return {
        accession_number: nextNumber("accession"),
        order_id: null,
        encounter_id: str(v.encounter_id),
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        patient_mrn: patient?.mrn ?? "",
        panel_en: str(v.panel_en).trim(),
        panel_ar: null,
        loinc_code: null,
        discipline: str(v.discipline),
        specimen_type: str(v.specimen_type),
        container: null,
        priority: str(v.priority),
        status: "ordered",
        rejection_reason: null,
        ordered_by: ctx.providerName || "Clinical staff",
        ordered_at: new Date().toISOString(),
        collected_at: null,
        collected_by: null,
        received_at: null,
        resulted_at: null,
        verified_at: null,
        verified_by: null,
        tat_minutes: null,
        has_critical_result: false,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `${saved.panel_en} ordered · ${saved.accession_number}`,
      ar: `تم طلب ${saved.panel_en} · ${saved.accession_number}`,
    }),
  },

  {
    id: "order-imaging",
    table: "imaging_orders",
    name: { en: "Order imaging", ar: "طلب أشعة" },
    summary: {
      en: "Sends a request to radiology and reserves an accession in PACS.",
      ar: "يرسل طلباً لقسم الأشعة ويحجز رقم دراسة في نظام الصور.",
    },
    icon: Scan,
    group: "diagnostics",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "encounter_id", kind: "select", required: true, full: true, optionsFrom: openEncounterOptions,
        label: { en: "Visit", ar: "الزيارة" } },
      { name: "modality", kind: "select", required: true, default: "xr",
        options: [
          opt("xr", "X-ray", "أشعة سينية"),
          opt("ct", "CT", "أشعة مقطعية"),
          opt("mri", "MRI", "رنين مغناطيسي"),
          opt("us", "Ultrasound", "موجات صوتية"),
          opt("mammo", "Mammography", "تصوير الثدي"),
          opt("nm", "Nuclear medicine", "طب نووي"),
          opt("pet", "PET", "مسح بوزيتروني"),
          opt("fluoro", "Fluoroscopy", "تنظير إشعاعي"),
          opt("dexa", "DEXA", "قياس كثافة العظام"),
          opt("angio", "Angiography", "قسطرة تصويرية"),
        ],
        label: { en: "Modality", ar: "نوع التصوير" } },
      { name: "procedure_en", kind: "text", required: true, full: true,
        label: { en: "Examination", ar: "الفحص" },
        placeholder: { en: "Chest, PA and lateral", ar: "صدر، أمامي وجانبي" } },
      { name: "body_part", kind: "text",
        label: { en: "Body part", ar: "المنطقة" }, placeholder: { en: "Chest", ar: "الصدر" } },
      { name: "laterality", kind: "select", default: "na",
        options: [
          opt("na", "Not applicable", "غير منطبق"),
          opt("left", "Left", "أيسر"),
          opt("right", "Right", "أيمن"),
          opt("bilateral", "Bilateral", "الجانبان"),
        ],
        label: { en: "Side", ar: "الجهة" } },
      { name: "contrast_required", kind: "checkbox",
        label: { en: "Contrast required", ar: "يحتاج صبغة" },
        hint: { en: "Check renal function and contrast allergy before sending.", ar: "تحقق من وظائف الكلى وحساسية الصبغة قبل الإرسال." } },
      { name: "priority", kind: "select", required: true, default: "routine", options: PRIORITY,
        label: { en: "Priority", ar: "الأولوية" } },
    ],
    build: (v, s) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      return {
        accession_number: nextNumber("accession"),
        order_id: null,
        encounter_id: str(v.encounter_id),
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        patient_mrn: patient?.mrn ?? "",
        modality: str(v.modality),
        procedure_en: str(v.procedure_en).trim(),
        procedure_ar: null,
        body_part: str(v.body_part).trim() || null,
        laterality: str(v.laterality) || "na",
        contrast_required: Boolean(v.contrast_required),
        priority: str(v.priority),
        status: "ordered",
        scheduled_at: null,
        room: null,
        performed_at: null,
        technologist: null,
        reported_at: null,
        radiologist: null,
        report_en: null,
        report_ar: null,
        impression_en: null,
        critical_finding: false,
        critical_notified_at: null,
        study_uid: null,
        series_count: null,
        image_count: null,
        radiation_dose: null,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `${saved.procedure_en} requested · ${saved.accession_number}`,
      ar: `تم طلب ${saved.procedure_en} · ${saved.accession_number}`,
    }),
  },

  // ── Communication ───────────────────────────────────────
  {
    id: "message-patient",
    table: "portal_messages",
    name: { en: "Message a patient", ar: "مراسلة مريض" },
    summary: {
      en: "Lands in the patient's portal inbox and notifies them.",
      ar: "تصل إلى صندوق وارد المريض في البوابة مع إشعار.",
    },
    icon: MessageSquarePlus,
    group: "communication",
    personas: ["staff", "clinician"],
    fields: [
      { name: "patient_id", kind: "patient", required: true, full: true,
        label: { en: "Patient", ar: "المريض" } },
      { name: "category", kind: "select", required: true, default: "question",
        options: [
          opt("question", "General", "عام"),
          opt("result_release", "Results", "نتائج"),
          opt("appointment", "Appointment", "موعد"),
          opt("prescription_refill", "Prescription", "وصفة"),
          opt("billing", "Billing", "الفواتير"),
          opt("reminder", "Reminder", "تذكير"),
        ],
        label: { en: "Subject area", ar: "الموضوع" } },
      { name: "subject_en", kind: "text", required: true,
        label: { en: "Subject", ar: "عنوان الرسالة" } },
      { name: "body_en", kind: "textarea", required: true, full: true,
        label: { en: "Message", ar: "نص الرسالة" },
        hint: {
          en: "Written for the patient, not the chart. Avoid abbreviations and say what they should do next.",
          ar: "اكتبها للمريض لا للسجل. تجنّب الاختصارات ووضّح الخطوة التالية.",
        } },
    ],
    build: (v, s, ctx) => {
      const patient = s.patients.find((p) => p.id === v.patient_id);
      return {
        patient_id: str(v.patient_id),
        patient_name: patient?.name_en ?? "",
        direction: "outbound",
        category: str(v.category),
        subject_en: str(v.subject_en).trim(),
        subject_ar: null,
        body_en: str(v.body_en).trim(),
        body_ar: null,
        provider_id: ctx.providerId,
        provider_name: ctx.providerName || "Care team",
        status: "unread",
        sent_at: new Date().toISOString(),
        read_at: null,
        replied_at: null,
        parent_message_id: null,
        attachment_count: 0,
        metadata: {},
      };
    },
    done: (saved) => ({
      en: `Message sent to ${saved.patient_name}`,
      ar: `تم إرسال الرسالة إلى ${saved.patient_name}`,
    }),
  },
];

export function entryById(id: string): EntryForm | undefined {
  return ENTRY_FORMS.find((f) => f.id === id);
}

export function entriesForPersona(kind: "staff" | "clinician" | "patient"): EntryForm[] {
  return ENTRY_FORMS.filter((f) => f.personas.includes(kind));
}

/** Kept for the department picker, which reads it rather than a hard list. */
export { departmentOptions, todayISO, toISO };
