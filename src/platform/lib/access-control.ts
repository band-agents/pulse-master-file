/**
 * Departmental structure.
 *
 * The hospital's department list, used wherever a person or a record has to
 * be attributed to a part of the organisation: staff records, user invitations,
 * cost centres and departmental reporting.
 *
 * This is organisational structure, not permission. What a person may DO lives
 * in `permissions.ts`; what they see FIRST is their working role in
 * `app/shell/RoleContext`. Keeping the three apart is deliberate — conflating
 * "works in Radiology" with "may verify a radiology report" is how systems end
 * up granting clinical authority by org chart.
 */

export type DepartmentType = "clinical" | "ancillary" | "administrative" | "support";

export interface Department {
  value: string;
  en: string;
  ar: string;
  type: DepartmentType;
}

export const DEPARTMENTS: Department[] = [
  // Clinical
  { value: "emergency",         en: "Emergency Medicine",        ar: "الطوارئ",                 type: "clinical" },
  { value: "internal_medicine", en: "Internal Medicine",         ar: "الباطنة",                 type: "clinical" },
  { value: "surgery",           en: "General Surgery",           ar: "الجراحة العامة",           type: "clinical" },
  { value: "obstetrics",        en: "Obstetrics & Gynaecology",  ar: "النساء والولادة",          type: "clinical" },
  { value: "paediatrics",       en: "Paediatrics",               ar: "الأطفال",                 type: "clinical" },
  { value: "cardiology",        en: "Cardiology",                ar: "القلب",                   type: "clinical" },
  { value: "orthopaedics",      en: "Orthopaedics",              ar: "العظام",                  type: "clinical" },
  { value: "icu",               en: "Intensive Care",            ar: "العناية المركزة",          type: "clinical" },
  { value: "theatres",          en: "Operating Theatres",        ar: "غرف العمليات",             type: "clinical" },
  { value: "oncology",          en: "Oncology Day Unit",         ar: "وحدة الأورام النهارية",     type: "clinical" },
  { value: "dermatology",       en: "Dermatology",               ar: "الجلدية",                 type: "clinical" },
  { value: "nursing",           en: "Nursing",                   ar: "التمريض",                 type: "clinical" },
  // Ancillary
  { value: "laboratory",        en: "Laboratory",                ar: "المختبر",                 type: "ancillary" },
  { value: "radiology",         en: "Radiology",                 ar: "الأشعة",                  type: "ancillary" },
  { value: "pharmacy",          en: "Pharmacy",                  ar: "الصيدلية",                type: "ancillary" },
  // Administrative
  { value: "administration",    en: "Administration",            ar: "الإدارة",                 type: "administrative" },
  { value: "revenue_cycle",     en: "Revenue Cycle",             ar: "الدورة الإيرادية",         type: "administrative" },
  { value: "finance",           en: "Finance",                   ar: "المالية",                 type: "administrative" },
  { value: "hr",                en: "Human Resources",           ar: "الموارد البشرية",          type: "administrative" },
  // Support
  { value: "biomedical",        en: "Biomedical Engineering",    ar: "الهندسة الطبية",           type: "support" },
  { value: "housekeeping",      en: "Housekeeping",              ar: "النظافة",                 type: "support" },
  { value: "dietary",           en: "Dietary & Catering",        ar: "التغذية والمطبخ",          type: "support" },
];


export const DEPARTMENT_TYPES: { id: DepartmentType; en: string; ar: string }[] = [
  { id: "clinical",       en: "Clinical",       ar: "سريري" },
  { id: "ancillary",      en: "Ancillary",      ar: "مساند تشخيصي" },
  { id: "administrative", en: "Administrative", ar: "إداري" },
  { id: "support",        en: "Support",        ar: "خدمات مساندة" },
];

export function departmentsOfType(type: DepartmentType): Department[] {
  return DEPARTMENTS.filter((d) => d.type === type);
}

/** Look a department up, falling back to the raw value rather than blank. */
export function departmentLabel(value: string | null | undefined, ar = false): string {
  if (!value) return "—";
  const found = DEPARTMENTS.find((d) => d.value === value);
  if (!found) return value;
  return ar ? found.ar : found.en;
}
