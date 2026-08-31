/**
 * Analytics dataset registry.
 *
 * A dataset is a named table the hospital can be questioned about: what its
 * rows are, which of their properties can be grouped by, and which can be
 * measured. Everything the analytics layer can do — the explorer, saved
 * dashboards, drill-through, export — is derived from these declarations.
 *
 * Two rules keep the numbers honest:
 *
 *   1. Every dataset reads from the same `Snapshot`, so two tiles on one
 *      dashboard are always describing the same instant. Charts that disagree
 *      because they loaded a second apart are worse than no charts.
 *
 *   2. A measure is a property of a row, never a pre-computed total. The
 *      aggregation is chosen at query time, so "average length of stay" and
 *      "total bed days" come from one field rather than two fields that can
 *      drift apart.
 */

import type { LucideIcon } from "lucide-react";
import {
  ClipboardList, Siren, ScrollText, FlaskConical, Scan, Scissors, FileText,
  Receipt, BedDouble, CalendarDays, ShieldAlert, Syringe, Pill, Wrench,
  SprayCan, Network, Users,
} from "lucide-react";
import type { Snapshot } from "@/platform/data/snapshot";
import type { Label } from "@/modules/types";

export type FieldKind = "dimension" | "measure" | "date";

export interface Field {
  id: string;
  name: Label;
  kind: FieldKind;
  /**
   * Pull the value out of a row. Dimensions return a display string,
   * measures a number, dates an ISO string. Null means "not applicable to
   * this row" and is excluded from aggregation rather than counted as zero —
   * a missing turnaround must not drag an average down.
   */
  get: (row: Record<string, unknown>) => string | number | null;
  /** Unit suffix for measures, shown on axes and tooltips. */
  unit?: string;
  /** Measures where a lower number is the better outcome. */
  lowerIsBetter?: boolean;
}

export interface Dataset {
  id: string;
  name: Label;
  description: Label;
  icon: LucideIcon;
  rows: (s: Snapshot) => Record<string, unknown>[];
  fields: Field[];
  /** Field ids used when a chart is first created. */
  defaults: { dimension: string; measure: string };
}

// ─── Helpers ──────────────────────────────────────────────

const str = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

/** Title-case a snake_case enum for display without a lookup table. */
const pretty = (v: unknown): string | null => {
  const s = str(v);
  return s === null ? null : s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Minutes between two ISO timestamps; null unless both are present. */
const minutesBetween = (from: unknown, to: unknown): number | null => {
  if (!from || !to) return null;
  const a = new Date(String(from)).getTime();
  const b = new Date(String(to)).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 60_000);
};

/** Bucket a date into a day key — the granularity every trend chart uses. */
const dayOf = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const D = (id: string, en: string, ar: string, get: Field["get"]): Field =>
  ({ id, name: { en, ar }, kind: "dimension", get });

const M = (id: string, en: string, ar: string, get: Field["get"], unit?: string, lowerIsBetter?: boolean): Field =>
  ({ id, name: { en, ar }, kind: "measure", get, unit, lowerIsBetter });

const DT = (id: string, en: string, ar: string, get: Field["get"]): Field =>
  ({ id, name: { en, ar }, kind: "date", get });

// ─── Datasets ─────────────────────────────────────────────

export const DATASETS: Dataset[] = [
  {
    id: "encounters",
    name: { en: "Encounters", ar: "الزيارات" },
    description: {
      en: "Every contact with the hospital: admissions, discharges, length of stay and case mix.",
      ar: "كل تواصل مع المستشفى: الدخول والخروج ومدة البقاء وتوزيع الحالات.",
    },
    icon: ClipboardList,
    rows: (s) => s.encounters as unknown as Record<string, unknown>[],
    defaults: { dimension: "department", measure: "__count" },
    fields: [
      D("department", "Department", "القسم", (r) => str(r.department_name)),
      D("class", "Encounter type", "نوع الزيارة", (r) => pretty(r.class)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("source", "Admission source", "مصدر الدخول", (r) => pretty(r.admission_source)),
      D("disposition", "Discharge to", "وجهة الخروج", (r) => pretty(r.discharge_disposition)),
      D("ward", "Ward", "الجناح", (r) => str(r.bed_label)?.split("-")[0] ?? null),
      D("attending", "Attending", "الطبيب المعالج", (r) => str(r.attending_provider_name)),
      D("isolation", "Isolation", "عزل", (r) => (r.isolation_required ? "Isolation" : "Standard")),
      DT("admitted", "Admission date", "تاريخ الدخول", (r) => dayOf(r.admitted_at)),
      DT("discharged", "Discharge date", "تاريخ الخروج", (r) => dayOf(r.discharged_at)),
      M("los", "Length of stay", "مدة البقاء", (r) => num(r.los_hours), "h", true),
      M("los_days", "Bed days", "أيام الإقامة", (r) => {
        const h = num(r.los_hours);
        return h === null ? null : Math.max(1, Math.round(h / 24));
      }, "d"),
    ],
  },

  {
    id: "ed_visits",
    name: { en: "Emergency attendances", ar: "زيارات الطوارئ" },
    description: {
      en: "Arrivals, triage acuity, waiting times, breaches and disposition.",
      ar: "الوصول وشدة الفرز وأوقات الانتظار والتجاوزات والوجهة النهائية.",
    },
    icon: Siren,
    rows: (s) => s.edVisits as unknown as Record<string, unknown>[],
    defaults: { dimension: "triage", measure: "door_to_doctor" },
    fields: [
      D("triage", "Triage category", "فئة الفرز", (r) => (r.triage_level ? `Category ${r.triage_level}` : "Not triaged")),
      D("arrival_mode", "Arrival mode", "طريقة الوصول", (r) => pretty(r.arrival_mode)),
      D("area", "Area", "المنطقة", (r) => pretty(r.area)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("disposition", "Disposition", "الوجهة", (r) => pretty(r.disposition)),
      D("trauma", "Trauma", "رضوح", (r) => (r.is_trauma ? "Trauma" : "Non-trauma")),
      DT("arrival", "Arrival date", "تاريخ الوصول", (r) => dayOf(r.arrival_at)),
      M("door_to_doctor", "Door to doctor", "الوصول للطبيب", (r) => num(r.door_to_doctor_minutes), "min", true),
      M("total_los", "Time in department", "الزمن في القسم", (r) => num(r.total_los_minutes), "min", true),
      M("triage_wait", "Arrival to triage", "الوصول للفرز", (r) => minutesBetween(r.arrival_at, r.triage_at), "min", true),
      M("boarding", "Boarding time", "انتظار السرير", (r) =>
        r.boarding_since ? minutesBetween(r.boarding_since, new Date().toISOString()) : null, "min", true),
    ],
  },

  {
    id: "lab_orders",
    name: { en: "Laboratory orders", ar: "طلبات المختبر" },
    description: {
      en: "Turnaround by discipline and priority, rejections and critical results.",
      ar: "زمن الإنجاز حسب التخصص والأولوية والرفض والنتائج الحرجة.",
    },
    icon: FlaskConical,
    rows: (s) => s.labOrders as unknown as Record<string, unknown>[],
    defaults: { dimension: "discipline", measure: "tat" },
    fields: [
      D("discipline", "Discipline", "التخصص", (r) => pretty(r.discipline)),
      D("priority", "Priority", "الأولوية", (r) => pretty(r.priority)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("specimen", "Specimen", "نوع العينة", (r) => pretty(r.specimen_type)),
      D("ordered_by", "Ordered by", "الطالب", (r) => str(r.ordered_by)),
      D("critical", "Critical result", "نتيجة حرجة", (r) => (r.has_critical_result ? "Critical" : "Routine")),
      DT("ordered", "Order date", "تاريخ الطلب", (r) => dayOf(r.ordered_at)),
      M("tat", "Turnaround", "زمن الإنجاز", (r) => num(r.tat_minutes), "min", true),
      M("collection_delay", "Order to collection", "من الطلب للسحب", (r) => minutesBetween(r.ordered_at, r.collected_at), "min", true),
      M("bench_time", "Receipt to result", "من الاستلام للنتيجة", (r) => minutesBetween(r.received_at, r.resulted_at), "min", true),
    ],
  },

  {
    id: "imaging_orders",
    name: { en: "Imaging studies", ar: "دراسات الأشعة" },
    description: {
      en: "Modality mix, reporting turnaround, radiation dose and critical findings.",
      ar: "توزيع الأجهزة وزمن التقرير وجرعة الإشعاع والنتائج الحرجة.",
    },
    icon: Scan,
    rows: (s) => s.imagingOrders as unknown as Record<string, unknown>[],
    defaults: { dimension: "modality", measure: "__count" },
    fields: [
      D("modality", "Modality", "الجهاز", (r) => str(r.modality)?.toUpperCase() ?? null),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("priority", "Priority", "الأولوية", (r) => pretty(r.priority)),
      D("body_part", "Body part", "المنطقة", (r) => str(r.body_part)),
      D("radiologist", "Reporting radiologist", "طبيب الأشعة", (r) => str(r.radiologist)),
      D("contrast", "Contrast", "الصبغة", (r) => (r.contrast_required ? "With contrast" : "No contrast")),
      D("critical", "Critical finding", "نتيجة حرجة", (r) => (r.critical_finding ? "Critical" : "Routine")),
      DT("performed", "Performed date", "تاريخ التنفيذ", (r) => dayOf(r.performed_at)),
      M("report_tat", "Scan to report", "من التصوير للتقرير", (r) => minutesBetween(r.performed_at, r.reported_at), "min", true),
      M("dose", "Radiation dose", "جرعة الإشعاع", (r) => num(r.radiation_dose), "mGy·cm", true),
      M("images", "Images", "عدد الصور", (r) => num(r.image_count)),
    ],
  },

  {
    id: "ot_cases",
    name: { en: "Surgical cases", ar: "الحالات الجراحية" },
    description: {
      en: "Theatre utilisation, case duration, turnover and cancellation causes.",
      ar: "استغلال الغرف ومدة العمليات وزمن التحضير وأسباب الإلغاء.",
    },
    icon: Scissors,
    rows: (s) => s.otCases as unknown as Record<string, unknown>[],
    defaults: { dimension: "theatre", measure: "duration" },
    fields: [
      D("theatre", "Theatre", "الغرفة", (r) => str(r.theatre)),
      D("surgeon", "Surgeon", "الجراح", (r) => str(r.surgeon_name)),
      D("urgency", "Urgency", "درجة الاستعجال", (r) => pretty(r.urgency)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("anaesthesia", "Anaesthesia", "نوع التخدير", (r) => pretty(r.anaesthesia_type)),
      D("asa", "ASA grade", "تصنيف ASA", (r) => (r.asa_grade ? `ASA ${r.asa_grade}` : null)),
      D("destination", "Post-op destination", "الوجهة بعد العملية", (r) => pretty(r.post_op_destination)),
      DT("scheduled", "Scheduled date", "تاريخ الجدولة", (r) => dayOf(r.scheduled_start)),
      M("duration", "Case duration", "مدة العملية", (r) => num(r.duration_minutes), "min"),
      M("turnover", "Turnover", "زمن التحضير", (r) => num(r.turnover_minutes), "min", true),
      M("blood_loss", "Blood loss", "فقد الدم", (r) => num(r.estimated_blood_loss_ml), "mL", true),
      M("start_delay", "Start delay", "تأخر البدء", (r) => minutesBetween(r.scheduled_start, r.actual_start), "min", true),
    ],
  },

  {
    id: "claims",
    name: { en: "Payer claims", ar: "مطالبات جهات الدفع" },
    description: {
      en: "Claim value, denial reasons, days in accounts receivable and payer performance.",
      ar: "قيمة المطالبات وأسباب الرفض وأيام التحصيل وأداء جهات الدفع.",
    },
    icon: FileText,
    rows: (s) => s.claims as unknown as Record<string, unknown>[],
    defaults: { dimension: "payer", measure: "claimed" },
    fields: [
      D("payer", "Payer", "جهة الدفع", (r) => str(r.payer_name)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("type", "Claim type", "نوع المطالبة", (r) => pretty(r.claim_type)),
      D("denial_code", "Denial code", "رمز الرفض", (r) => str(r.denial_code)),
      D("submitted_by", "Submitted by", "مقدم الطلب", (r) => str(r.submitted_by)),
      DT("submitted", "Submission date", "تاريخ التقديم", (r) => dayOf(r.submitted_at)),
      M("claimed", "Claimed", "المبلغ المطالب", (r) => num(r.claimed_amount), "SAR"),
      M("approved", "Approved", "المبلغ المعتمد", (r) => num(r.approved_amount), "SAR"),
      M("paid", "Paid", "المبلغ المدفوع", (r) => num(r.paid_amount), "SAR"),
      M("shortfall", "Shortfall", "الفرق", (r) => {
        const c = num(r.claimed_amount), p = num(r.paid_amount);
        return c === null ? null : c - (p ?? 0);
      }, "SAR", true),
      M("ar_days", "Days in AR", "أيام التحصيل", (r) => num(r.ar_days), "d", true),
    ],
  },

  {
    id: "charges",
    name: { en: "Charges", ar: "الرسوم" },
    description: {
      en: "Itemised revenue by department, category and contracted rate.",
      ar: "الإيراد التفصيلي حسب القسم والفئة والسعر التعاقدي.",
    },
    icon: Receipt,
    rows: (s) => s.charges as unknown as Record<string, unknown>[],
    defaults: { dimension: "category", measure: "total" },
    fields: [
      D("category", "Category", "الفئة", (r) => pretty(r.category)),
      D("department", "Department", "القسم", (r) => str(r.department_name)),
      D("source", "Raised by", "مصدر الرسم", (r) => pretty(r.source_type)),
      D("posted", "Posted", "مُرحّل", (r) => (r.posted ? "Posted" : "Unposted")),
      DT("charged", "Charge date", "تاريخ الرسم", (r) => dayOf(r.charged_at)),
      M("total", "Charged", "المبلغ", (r) => num(r.total), "SAR"),
      M("contracted", "Contracted", "السعر التعاقدي", (r) => num(r.contracted_price), "SAR"),
      M("discount", "Discount", "الخصم", (r) => num(r.discount_amount), "SAR", true),
      M("variance", "Rate variance", "فرق السعر", (r) => {
        const t = num(r.total), c = num(r.contracted_price);
        return t === null || c === null ? null : t - c;
      }, "SAR", true),
      M("quantity", "Quantity", "الكمية", (r) => num(r.quantity)),
    ],
  },

  {
    id: "appointments",
    name: { en: "Appointments", ar: "المواعيد" },
    description: {
      en: "Clinic demand, no-shows, cancellations and lead time to booking.",
      ar: "الطلب على العيادات وعدم الحضور والإلغاء ومهلة الحجز.",
    },
    icon: CalendarDays,
    rows: (s) => s.appointments as unknown as Record<string, unknown>[],
    defaults: { dimension: "department", measure: "__count" },
    fields: [
      D("department", "Department", "القسم", (r) => str(r.department_name)),
      D("provider", "Provider", "مقدم الخدمة", (r) => str(r.provider_name)),
      D("type", "Appointment type", "نوع الموعد", (r) => pretty(r.appointment_type)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("channel", "Booked by", "طريقة الحجز", (r) => str(r.booked_by)),
      D("telehealth", "Delivery", "طريقة التقديم", (r) => (r.is_telehealth ? "Telehealth" : "In person")),
      DT("slot", "Appointment date", "تاريخ الموعد", (r) => dayOf(r.slot_start)),
      M("duration", "Slot length", "مدة الموعد", (r) => num(r.duration_minutes), "min"),
      M("lead_time", "Booking lead time", "مهلة الحجز", (r) => {
        const m = minutesBetween(r.booked_at, r.slot_start);
        return m === null ? null : Math.round(m / 1440);
      }, "d"),
      M("wait_in_clinic", "Arrival to seen", "من الوصول للفحص", (r) => minutesBetween(r.arrived_at, r.slot_start), "min", true),
    ],
  },

  {
    id: "cdss_alerts",
    name: { en: "Decision support alerts", ar: "تنبيهات دعم القرار" },
    description: {
      en: "Alert volume by rule, override rate and time to a clinician response.",
      ar: "حجم التنبيهات حسب القاعدة ونسبة التجاوز وزمن استجابة الطبيب.",
    },
    icon: ShieldAlert,
    rows: (s) => s.alerts as unknown as Record<string, unknown>[],
    defaults: { dimension: "alert_type", measure: "__count" },
    fields: [
      D("alert_type", "Rule type", "نوع القاعدة", (r) => pretty(r.alert_type)),
      D("severity", "Severity", "الشدة", (r) => pretty(r.severity)),
      D("status", "Outcome", "النتيجة", (r) => pretty(r.status)),
      D("responder", "Answered by", "المستجيب", (r) => str(r.responded_by)),
      D("rule", "Rule", "القاعدة", (r) => str(r.rule_id)),
      DT("fired", "Fired date", "تاريخ الإطلاق", (r) => dayOf(r.fired_at)),
      M("response_time", "Time to response", "زمن الاستجابة", (r) => minutesBetween(r.fired_at, r.responded_at), "min", true),
    ],
  },

  {
    id: "med_administrations",
    name: { en: "Medication administration", ar: "إعطاء الأدوية" },
    description: {
      en: "Doses given, missed, refused and held, and how late they ran.",
      ar: "الجرعات المعطاة والفائتة والمرفوضة والموقوفة ومدى تأخرها.",
    },
    icon: Syringe,
    rows: (s) => s.medAdministrations as unknown as Record<string, unknown>[],
    defaults: { dimension: "status", measure: "__count" },
    fields: [
      D("status", "Outcome", "النتيجة", (r) => pretty(r.status)),
      D("route", "Route", "طريق الإعطاء", (r) => str(r.route)?.toUpperCase() ?? null),
      D("drug", "Drug", "الدواء", (r) => str(r.drug_name)),
      D("administered_by", "Administered by", "المُعطي", (r) => str(r.administered_by)),
      D("witnessed", "Second check", "تحقق ثانٍ", (r) => (r.witnessed_by ? "Witnessed" : "Single check")),
      DT("scheduled", "Scheduled date", "تاريخ الاستحقاق", (r) => dayOf(r.scheduled_at)),
      M("lateness", "Minutes late", "دقائق التأخير", (r) => minutesBetween(r.scheduled_at, r.administered_at), "min", true),
    ],
  },

  {
    id: "beds",
    name: { en: "Beds", ar: "الأسرة" },
    description: {
      en: "Bed state and capacity by ward, room and bed type.",
      ar: "حالة الأسرة والسعة حسب الجناح والغرفة والنوع.",
    },
    icon: BedDouble,
    rows: (s) => s.beds as unknown as Record<string, unknown>[],
    defaults: { dimension: "ward", measure: "__count" },
    fields: [
      D("ward", "Ward", "الجناح", (r) => str(r.ward_name)),
      D("status", "State", "الحالة", (r) => pretty(r.status)),
      D("bed_type", "Bed type", "نوع السرير", (r) => pretty(r.bed_type)),
      D("room", "Room", "الغرفة", (r) => str(r.room)),
      D("oxygen", "Oxygen", "أكسجين", (r) => (r.has_oxygen ? "Piped oxygen" : "None")),
      D("monitor", "Monitoring", "مراقبة", (r) => (r.has_monitor ? "Monitored" : "Unmonitored")),
      M("occupied_hours", "Hours occupied", "ساعات الإشغال", (r) =>
        r.occupied_since ? Math.round((minutesBetween(r.occupied_since, new Date().toISOString()) ?? 0) / 60) : null, "h"),
    ],
  },

  {
    id: "pharmacy_stock",
    name: { en: "Pharmacy stock", ar: "مخزون الصيدلية" },
    description: {
      en: "Stock value, cover, expiry exposure and controlled-drug holdings.",
      ar: "قيمة المخزون والتغطية وخطر انتهاء الصلاحية والأدوية المراقبة.",
    },
    icon: Pill,
    rows: (s) => s.pharmacyStock as unknown as Record<string, unknown>[],
    defaults: { dimension: "location", measure: "value" },
    fields: [
      D("location", "Location", "الموقع", (r) => str(r.location)),
      D("form", "Form", "الشكل", (r) => str(r.form)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("supplier", "Supplier", "المورد", (r) => str(r.supplier_name)),
      D("controlled", "Controlled", "مراقب", (r) => (r.controlled_schedule ? String(r.controlled_schedule) : "Not controlled")),
      D("high_alert", "High alert", "عالي الخطورة", (r) => (r.high_alert ? "High alert" : "Standard")),
      D("cold_chain", "Storage", "التخزين", (r) => (r.requires_refrigeration ? "Refrigerated" : "Ambient")),
      DT("expiry", "Expiry date", "تاريخ الانتهاء", (r) => dayOf(r.expiry_date)),
      M("value", "Stock value", "قيمة المخزون", (r) => {
        const q = num(r.quantity_on_hand), c = num(r.unit_cost);
        return q === null || c === null ? null : Math.round(q * c);
      }, "SAR"),
      M("on_hand", "Quantity on hand", "الكمية المتوفرة", (r) => num(r.quantity_on_hand)),
      M("days_to_expiry", "Days to expiry", "أيام حتى الانتهاء", (r) => {
        const d = r.expiry_date ? new Date(String(r.expiry_date)).getTime() : NaN;
        return Number.isNaN(d) ? null : Math.round((d - Date.now()) / 86_400_000);
      }, "d"),
    ],
  },

  {
    id: "biomed_assets",
    name: { en: "Biomedical assets", ar: "الأجهزة الطبية" },
    description: {
      en: "Device availability, downtime, maintenance compliance and asset value.",
      ar: "توفر الأجهزة وزمن التعطل والالتزام بالصيانة وقيمة الأصول.",
    },
    icon: Wrench,
    rows: (s) => s.biomedAssets as unknown as Record<string, unknown>[],
    defaults: { dimension: "category", measure: "downtime" },
    fields: [
      D("category", "Category", "الفئة", (r) => pretty(r.category)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("manufacturer", "Manufacturer", "الشركة المصنعة", (r) => str(r.manufacturer)),
      D("risk_class", "Risk class", "فئة الخطورة", (r) => pretty(r.risk_class)),
      D("location", "Location", "الموقع", (r) => str(r.location)),
      D("technician", "Technician", "الفني", (r) => str(r.assigned_technician)),
      M("downtime", "Downtime this year", "التعطل هذا العام", (r) => num(r.downtime_hours_ytd), "h", true),
      M("purchase_cost", "Purchase cost", "تكلفة الشراء", (r) => num(r.purchase_cost), "SAR"),
      M("pm_overdue_days", "Maintenance overdue", "تأخر الصيانة", (r) => {
        if (!r.next_pm_due) return null;
        const days = Math.round((Date.now() - new Date(String(r.next_pm_due)).getTime()) / 86_400_000);
        return days > 0 ? days : 0;
      }, "d", true),
    ],
  },

  {
    id: "housekeeping",
    name: { en: "Bed turnaround", ar: "دوران الأسرة" },
    description: {
      en: "Cleaning turnaround by ward and task type — the constraint on capacity.",
      ar: "زمن التنظيف حسب الجناح ونوع المهمة — القيد الحقيقي على السعة.",
    },
    icon: SprayCan,
    rows: (s) => s.housekeeping as unknown as Record<string, unknown>[],
    defaults: { dimension: "ward", measure: "turnaround" },
    fields: [
      D("ward", "Ward", "الجناح", (r) => str(r.ward_name)),
      D("task_type", "Task type", "نوع المهمة", (r) => pretty(r.task_type)),
      D("priority", "Priority", "الأولوية", (r) => pretty(r.priority)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("assigned_to", "Assigned to", "المكلف", (r) => str(r.assigned_to)),
      D("isolation", "Precautions", "الاحتياطات", (r) => (r.isolation_precaution ? "Isolation clean" : "Standard clean")),
      DT("requested", "Requested date", "تاريخ الطلب", (r) => dayOf(r.requested_at)),
      M("turnaround", "Turnaround", "زمن الإنجاز", (r) => num(r.turnaround_minutes), "min", true),
      M("response", "Request to start", "من الطلب للبدء", (r) => minutesBetween(r.requested_at, r.started_at), "min", true),
    ],
  },

  {
    id: "interface_messages",
    name: { en: "Interface messages", ar: "رسائل التكامل" },
    description: {
      en: "Integration throughput, acknowledgement rate and failures by endpoint.",
      ar: "حجم التكامل ونسبة التأكيد والأخطاء حسب نقطة الاتصال.",
    },
    icon: Network,
    rows: (s) => s.interfaceMessages as unknown as Record<string, unknown>[],
    defaults: { dimension: "endpoint", measure: "__count" },
    fields: [
      D("endpoint", "Endpoint", "نقطة الاتصال", (r) => str(r.endpoint_name)),
      D("protocol", "Protocol", "البروتوكول", (r) => str(r.protocol)?.toUpperCase() ?? null),
      D("message_type", "Message type", "نوع الرسالة", (r) => str(r.message_type)),
      D("direction", "Direction", "الاتجاه", (r) => pretty(r.direction)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("ack", "Acknowledgement", "التأكيد", (r) => str(r.ack_code) ?? "None"),
      M("processing", "Processing time", "زمن المعالجة", (r) => num(r.processing_ms), "ms", true),
      M("retries", "Retries", "المحاولات", (r) => num(r.retry_count), "", true),
      M("payload", "Payload size", "حجم الرسالة", (r) => num(r.payload_size_bytes), "B"),
    ],
  },

  {
    id: "workforce",
    name: { en: "Workforce", ar: "القوى العاملة" },
    description: {
      en: "Headcount, contract mix and payroll cost by department.",
      ar: "عدد الموظفين وأنواع التعاقد وتكلفة الرواتب حسب القسم.",
    },
    icon: Users,
    rows: (s) => s.staff as unknown as Record<string, unknown>[],
    defaults: { dimension: "department", measure: "__count" },
    fields: [
      D("department", "Department", "القسم", (r) => str(r.department)),
      D("employment_type", "Contract", "التعاقد", (r) => pretty(r.employment_type)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("job_title", "Job title", "المسمى الوظيفي", (r) => str(r.job_title)),
      DT("hired", "Join date", "تاريخ الالتحاق", (r) => dayOf(r.hire_date)),
      M("salary", "Monthly cost", "التكلفة الشهرية", (r) => num(r.salary), "SAR"),
    ],
  },

  {
    id: "payers",
    name: { en: "Payers", ar: "جهات الدفع" },
    description: {
      en: "Payer performance: how long each takes to pay and how much it denies.",
      ar: "أداء جهات الدفع: مدة السداد ونسبة الرفض لكل جهة.",
    },
    icon: Receipt,
    rows: (s) => s.payers as unknown as Record<string, unknown>[],
    defaults: { dimension: "payer_type", measure: "denial_rate" },
    fields: [
      D("name", "Payer", "جهة الدفع", (r) => str(r.name_en)),
      D("payer_type", "Type", "النوع", (r) => pretty(r.payer_type)),
      D("status", "Contract status", "حالة العقد", (r) => pretty(r.status)),
      D("pre_auth", "Pre-authorisation", "التصريح المسبق", (r) => (r.requires_pre_auth ? "Required" : "Not required")),
      DT("contract_expiry", "Contract expiry", "انتهاء العقد", (r) => dayOf(r.contract_expiry)),
      M("days_to_pay", "Days to pay", "أيام السداد", (r) => num(r.avg_days_to_pay), "d", true),
      M("denial_rate", "Denial rate", "نسبة الرفض", (r) => num(r.denial_rate_percent), "%", true),
    ],
  },

  {
    id: "suppliers",
    name: { en: "Suppliers", ar: "الموردون" },
    description: {
      en: "Supplier reliability: lead time, delivery performance and contract cover.",
      ar: "موثوقية الموردين: مهلة التوريد وأداء التسليم وتغطية العقود.",
    },
    icon: ClipboardList,
    rows: (s) => s.suppliers as unknown as Record<string, unknown>[],
    defaults: { dimension: "category", measure: "otif" },
    fields: [
      D("name", "Supplier", "المورد", (r) => str(r.name_en)),
      D("category", "Category", "الفئة", (r) => str(r.category)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      DT("contract_expiry", "Contract expiry", "انتهاء العقد", (r) => dayOf(r.contract_expiry)),
      M("lead_time", "Lead time", "مهلة التوريد", (r) => num(r.lead_time_days), "d", true),
      M("otif", "On time in full", "التسليم الكامل في الموعد", (r) => num(r.otif_percent), "%"),
      M("performance", "Performance score", "درجة الأداء", (r) => num(r.performance_score), ""),
    ],
  },

  {
    id: "orders",
    name: { en: "Clinical orders", ar: "الأوامر السريرية" },
    description: {
      en: "Ordering volume by category, priority and clinician.",
      ar: "حجم الأوامر حسب الفئة والأولوية والطبيب.",
    },
    icon: ScrollText,
    rows: (s) => s.orders as unknown as Record<string, unknown>[],
    defaults: { dimension: "category", measure: "__count" },
    fields: [
      D("category", "Category", "الفئة", (r) => pretty(r.category)),
      D("priority", "Priority", "الأولوية", (r) => pretty(r.priority)),
      D("status", "Status", "الحالة", (r) => pretty(r.status)),
      D("ordered_by", "Ordered by", "الطالب", (r) => str(r.ordered_by_name)),
      D("route", "Route", "طريق الإعطاء", (r) => str(r.route)?.toUpperCase() ?? null),
      D("overridden", "Alert overridden", "تجاوز تنبيه", (r) => (r.override_reason ? "Overridden" : "No override")),
      DT("ordered", "Order date", "تاريخ الطلب", (r) => dayOf(r.ordered_at)),
      M("duration_days", "Course length", "مدة العلاج", (r) => num(r.duration_days), "d"),
    ],
  },
];

export function getDataset(id: string): Dataset | undefined {
  return DATASETS.find((d) => d.id === id);
}

export function getField(dataset: Dataset, fieldId: string): Field | undefined {
  return dataset.fields.find((f) => f.id === fieldId);
}

export const dimensionsOf = (d: Dataset) => d.fields.filter((f) => f.kind === "dimension");
export const measuresOf = (d: Dataset) => d.fields.filter((f) => f.kind === "measure");
export const datesOf = (d: Dataset) => d.fields.filter((f) => f.kind === "date");
