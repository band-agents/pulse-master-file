/**
 * Granular Permission System
 * نظام الصلاحيات التفصيلي
 *
 * Each module has specific permission actions.
 * Role templates auto-assign recommended permissions.
 * Custom per-user overrides stored in workspace_members.permissions JSONB.
 *
 * The module list mirrors the hospital's real navigation (see SECTIONS in
 * ShellNav) collapsed to the boundaries that access control actually cares
 * about: a lab technician and a radiographer are different people, but
 * dietary, housekeeping and linen are one hatch.
 *
 * Two rules shape every map below:
 *   1. Minimum necessary — a role is granted what its job needs and nothing
 *      adjacent. Anything not named in a template resolves to no access.
 *   2. Clinical records are append-only — no clinical module offers `delete`
 *      at all, not even to the owner. Corrections are amendments, not erasures.
 */

// ─── Module definitions with granular permissions ─────────

export interface ModuleDef {
  key: string;
  en: string;
  ar: string;
  permissions: PermissionAction[];
}

/**
 * Clinical verbs sit alongside the generic CRUD ones because the acts they
 * name are legally distinct from editing a record:
 *   sign       — attesting to a note or order under your own licence
 *   prescribe  — issuing a prescription
 *   administer — giving a medication to a patient
 *   verify     — a pharmacist checking a dispense, a lab authorising a result,
 *                a second nurse checking a high-risk dose or a blood unit
 *   override   — proceeding past a decision-support alert with a reason
 */
export type PermissionAction =
  | "view" | "create" | "edit" | "sign" | "prescribe" | "administer" | "verify" | "override"
  | "delete" | "export" | "import" | "approve" | "release" | "assign" | "manage_settings";

export const PERMISSION_LABELS: Record<PermissionAction, { en: string; ar: string }> = {
  view:            { en: "View",       ar: "عرض" },
  create:          { en: "Create",     ar: "إنشاء" },
  edit:            { en: "Edit",       ar: "تعديل" },
  sign:            { en: "Sign",       ar: "توقيع" },
  prescribe:       { en: "Prescribe",  ar: "وصف دواء" },
  administer:      { en: "Administer", ar: "إعطاء" },
  verify:          { en: "Verify",     ar: "تحقق" },
  override:        { en: "Override",   ar: "تجاوز التنبيه" },
  delete:          { en: "Delete",     ar: "حذف" },
  export:          { en: "Export",     ar: "تصدير" },
  import:          { en: "Import",     ar: "استيراد" },
  approve:         { en: "Approve",    ar: "اعتماد" },
  release:         { en: "Release",    ar: "إطلاق" },
  assign:          { en: "Assign",     ar: "تعيين" },
  manage_settings: { en: "Settings",   ar: "إعدادات" },
};

export const MODULES: ModuleDef[] = [
  // ── Patient & encounter ──
  { key: "patients",         en: "Patient Registry",           ar: "سجل المرضى",              permissions: ["view", "create", "edit", "delete", "export", "import", "assign"] },
  { key: "encounters",       en: "Admissions, ADT & Beds",     ar: "الدخول والحركة والأسرة",   permissions: ["view", "create", "edit", "export", "approve", "assign"] },
  // ── Clinical record ──
  { key: "chart",            en: "Patient Chart",              ar: "الملف السريري",            permissions: ["view", "create", "edit", "sign", "export"] },
  { key: "nursing",          en: "Nursing Care",               ar: "الرعاية التمريضية",        permissions: ["view", "create", "edit", "sign", "assign"] },
  { key: "orders",           en: "Clinical Orders",            ar: "الأوامر السريرية",         permissions: ["view", "create", "edit", "sign", "verify", "approve"] },
  { key: "prescribing",      en: "Prescribing",                ar: "الوصفات الطبية",           permissions: ["view", "prescribe", "edit", "sign", "verify", "export"] },
  { key: "medications",      en: "Medication Administration",  ar: "إعطاء الأدوية",            permissions: ["view", "create", "edit", "administer", "verify", "sign"] },
  { key: "cdss",             en: "Decision Support",           ar: "دعم القرار السريري",       permissions: ["view", "create", "edit", "override", "manage_settings"] },
  // ── Departments ──
  { key: "emergency",        en: "Emergency Department",       ar: "قسم الطوارئ",              permissions: ["view", "create", "edit", "sign", "assign", "export"] },
  { key: "theatres",         en: "Operating Theatres",         ar: "غرف العمليات",             permissions: ["view", "create", "edit", "sign", "assign", "approve", "export"] },
  // ── Diagnostics ──
  { key: "laboratory",       en: "Laboratory",                 ar: "المختبر",                  permissions: ["view", "create", "edit", "verify", "release", "approve", "export"] },
  { key: "blood_bank",       en: "Blood Bank",                 ar: "بنك الدم",                 permissions: ["view", "create", "edit", "verify", "release", "approve"] },
  { key: "imaging",          en: "Radiology & Imaging",        ar: "الأشعة والتصوير",          permissions: ["view", "create", "edit", "sign", "verify", "release", "approve", "export"] },
  // ── Medicines supply ──
  { key: "pharmacy",         en: "Pharmacy",                   ar: "الصيدلية",                 permissions: ["view", "create", "edit", "verify", "delete", "export", "import", "approve"] },
  // ── Access & workforce ──
  { key: "appointments",     en: "Appointments & Scheduling",  ar: "المواعيد والجدولة",        permissions: ["view", "create", "edit", "delete", "export", "assign"] },
  { key: "providers",        en: "Providers & Credentialing",  ar: "مقدمو الخدمة والاعتماد",   permissions: ["view", "create", "edit", "delete", "export", "approve", "assign"] },
  // ── Revenue ──
  { key: "billing",          en: "Billing & Charges",          ar: "الفوترة والرسوم",          permissions: ["view", "create", "edit", "export", "approve", "release"] },
  { key: "claims",           en: "Claims & Insurance",         ar: "المطالبات والتأمين",       permissions: ["view", "create", "edit", "export", "import", "approve", "release"] },
  { key: "finance",          en: "Finance",                    ar: "المالية",                  permissions: ["view", "create", "edit", "delete", "export", "approve", "release"] },
  // ── Operations ──
  { key: "supplies",         en: "Supplies & Purchasing",      ar: "المستلزمات والمشتريات",    permissions: ["view", "create", "edit", "delete", "export", "import", "approve", "release"] },
  { key: "biomed",           en: "Biomedical Assets",          ar: "الأجهزة الطبية والصيانة",  permissions: ["view", "create", "edit", "delete", "export", "approve", "assign"] },
  { key: "support_services", en: "Support Services",           ar: "الخدمات المساندة",         permissions: ["view", "create", "edit", "assign", "export"] },
  // ── Reach & integration ──
  { key: "portal",           en: "Patient Portal & Telehealth", ar: "بوابة المرضى والطب عن بعد", permissions: ["view", "create", "edit", "release", "manage_settings"] },
  { key: "interop",          en: "Interoperability",           ar: "التكامل والتشغيل البيني",  permissions: ["view", "create", "edit", "export", "manage_settings"] },
  // ── Administration ──
  { key: "workforce",        en: "HR & Workforce",             ar: "الموارد البشرية",          permissions: ["view", "create", "edit", "delete", "export", "approve"] },
  { key: "reports",          en: "Reports & Analytics",        ar: "التقارير والتحليلات",      permissions: ["view", "export"] },
  { key: "settings",         en: "Settings",                   ar: "الإعدادات",                permissions: ["view", "edit", "manage_settings"] },
  { key: "users",            en: "Users & Access",             ar: "المستخدمين والصلاحيات",    permissions: ["view", "create", "edit", "delete", "manage_settings"] },
];

// ─── Permission map type ──────────────────────────────────

export type PermissionMap = Record<string, PermissionAction[]>;

// ─── Role templates ───────────────────────────────────────

export interface RoleTemplate {
  id: string;
  en: string;
  ar: string;
  color: string;
  description: string;
  descriptionAr: string;
  permissions: PermissionMap;
  risk: "low" | "medium" | "high";
}

const ALL_ACTIONS: PermissionAction[] = [
  "view", "create", "edit", "sign", "prescribe", "administer", "verify", "override",
  "delete", "export", "import", "approve", "release", "assign", "manage_settings",
];

/**
 * Acts that require a clinical licence. An administrative role — however
 * senior — never gets these: the owner of the workspace still cannot write a
 * prescription or sign a note in someone else's name.
 */
const CLINICAL_ACTS: PermissionAction[] = ["sign", "prescribe", "administer", "verify", "override"];
const ADMIN_ACTIONS: PermissionAction[] = ALL_ACTIONS.filter(a => !CLINICAL_ACTS.includes(a));

const READ_ONLY: PermissionAction[] = ["view"];
const CRUD: PermissionAction[] = ["view", "create", "edit"];
const CRUD_EXPORT: PermissionAction[] = ["view", "create", "edit", "export"];

function allModulesWithPerms(perms: PermissionAction[]): PermissionMap {
  const map: PermissionMap = {};
  for (const m of MODULES) {
    map[m.key] = perms.filter(p => m.permissions.includes(p));
  }
  return map;
}

/**
 * Build a template map from the grants a role actually needs. Modules left
 * unnamed resolve to no access, and an action a module does not offer is
 * dropped — so a template can never hand out a permission that does not exist.
 */
function grant(grants: PermissionMap): PermissionMap {
  const map: PermissionMap = {};
  for (const m of MODULES) {
    map[m.key] = (grants[m.key] ?? []).filter(a => m.permissions.includes(a));
  }
  return map;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "owner", en: "Owner", ar: "مالك",
    color: "bg-warning/15 text-warning",
    description: "Full administrative control; clinical acts still need a licence",
    descriptionAr: "تحكم إداري كامل؛ الأعمال السريرية تحتاج ترخيصًا",
    permissions: allModulesWithPerms(ADMIN_ACTIONS),
    risk: "high",
  },
  {
    id: "admin", en: "IT Administrator", ar: "مسؤول النظام",
    color: "bg-chart-4/15 text-chart-4",
    description: "System configuration and every record; cannot prescribe or sign",
    descriptionAr: "إعدادات النظام وكل السجلات؛ لا يصف ولا يوقّع",
    permissions: allModulesWithPerms(ADMIN_ACTIONS),
    risk: "high",
  },
  {
    id: "physician", en: "Physician", ar: "طبيب",
    color: "bg-blue-100 text-blue-700",
    description: "Full chart, orders, prescribing and CDSS override",
    descriptionAr: "الملف الكامل والأوامر والوصفات وتجاوز التنبيهات",
    permissions: grant({
      patients: CRUD_EXPORT,
      encounters: ["view", "create", "edit", "approve", "assign"],
      chart: ["view", "create", "edit", "sign", "export"],
      nursing: READ_ONLY,
      orders: ["view", "create", "edit", "sign", "approve"],
      prescribing: ["view", "prescribe", "edit", "sign", "export"],
      medications: READ_ONLY,
      cdss: ["view", "override"],
      emergency: ["view", "create", "edit", "sign", "assign"],
      theatres: ["view", "create", "edit", "assign"],
      laboratory: ["view", "create", "export"],
      blood_bank: ["view", "create"],
      imaging: ["view", "create", "export"],
      pharmacy: READ_ONLY,
      appointments: CRUD,
      providers: READ_ONLY,
      billing: READ_ONLY,
      claims: READ_ONLY,
      support_services: ["view", "create"],
      portal: ["view", "create", "release"],
      reports: ["view", "export"],
      settings: READ_ONLY,
    }),
    risk: "medium",
  },
  {
    id: "surgeon", en: "Surgeon", ar: "جراح",
    color: "bg-indigo-100 text-indigo-700",
    description: "Physician access plus the theatre list and operation notes",
    descriptionAr: "صلاحيات الطبيب مع قائمة العمليات وتقاريرها",
    permissions: grant({
      patients: CRUD_EXPORT,
      encounters: ["view", "create", "edit", "approve", "assign"],
      chart: ["view", "create", "edit", "sign", "export"],
      nursing: READ_ONLY,
      orders: ["view", "create", "edit", "sign", "approve"],
      prescribing: ["view", "prescribe", "edit", "sign", "export"],
      medications: READ_ONLY,
      cdss: ["view", "override"],
      emergency: ["view", "create", "edit", "sign"],
      theatres: ["view", "create", "edit", "sign", "assign", "approve", "export"],
      laboratory: ["view", "create", "export"],
      blood_bank: ["view", "create", "approve"],
      imaging: ["view", "create", "export"],
      pharmacy: READ_ONLY,
      appointments: CRUD,
      providers: READ_ONLY,
      billing: READ_ONLY,
      claims: READ_ONLY,
      supplies: READ_ONLY,
      portal: ["view", "create", "release"],
      reports: ["view", "export"],
      settings: READ_ONLY,
    }),
    risk: "medium",
  },
  {
    id: "resident", en: "Resident", ar: "طبيب مقيم",
    color: "bg-sky-100 text-sky-700",
    description: "Documents and prescribes, but nothing is signed without a consultant",
    descriptionAr: "يكتب ويصف، لكن لا توقيع إلا من الاستشاري",
    permissions: grant({
      patients: ["view", "edit"],
      encounters: CRUD,
      // No `sign` anywhere: a resident's note and orders await countersignature.
      chart: CRUD,
      nursing: READ_ONLY,
      orders: CRUD,
      prescribing: ["view", "prescribe", "edit"],
      medications: READ_ONLY,
      // No `override`: a resident cannot dismiss a decision-support alert alone.
      cdss: READ_ONLY,
      emergency: CRUD,
      theatres: READ_ONLY,
      laboratory: ["view", "create"],
      blood_bank: READ_ONLY,
      imaging: ["view", "create"],
      pharmacy: READ_ONLY,
      appointments: ["view", "create"],
      providers: READ_ONLY,
      portal: READ_ONLY,
      reports: READ_ONLY,
    }),
    risk: "medium",
  },
  {
    id: "nurse", en: "Nurse", ar: "ممرض",
    color: "bg-teal-100 text-teal-700",
    description: "Charts observations and gives medicines; never prescribes",
    descriptionAr: "توثيق الملاحظات وإعطاء الأدوية دون وصفها",
    permissions: grant({
      patients: ["view", "edit"],
      encounters: CRUD,
      chart: READ_ONLY,
      nursing: ["view", "create", "edit", "sign"],
      // Acknowledges and transcribes orders; cannot write or sign one.
      orders: ["view", "verify"],
      prescribing: READ_ONLY,
      medications: ["view", "create", "edit", "administer", "verify", "sign"],
      cdss: READ_ONLY,
      emergency: CRUD,
      theatres: READ_ONLY,
      laboratory: ["view", "create"],
      // `verify` here is the two-person bedside check before a transfusion.
      blood_bank: ["view", "verify"],
      imaging: READ_ONLY,
      pharmacy: READ_ONLY,
      appointments: READ_ONLY,
      providers: READ_ONLY,
      support_services: ["view", "create"],
      portal: READ_ONLY,
      reports: READ_ONLY,
    }),
    risk: "medium",
  },
  {
    id: "charge_nurse", en: "Charge Nurse", ar: "رئيس التمريض",
    color: "bg-cyan-100 text-cyan-700",
    description: "Nursing access plus beds, staffing and ward escalation",
    descriptionAr: "صلاحيات التمريض مع الأسرة والتوزيع وتصعيد الجناح",
    permissions: grant({
      patients: ["view", "edit", "export"],
      encounters: ["view", "create", "edit", "approve", "assign", "export"],
      chart: READ_ONLY,
      nursing: ["view", "create", "edit", "sign", "assign"],
      orders: ["view", "verify"],
      prescribing: READ_ONLY,
      medications: ["view", "create", "edit", "administer", "verify", "sign"],
      cdss: READ_ONLY,
      emergency: ["view", "create", "edit", "assign"],
      theatres: ["view", "assign"],
      laboratory: ["view", "create"],
      blood_bank: ["view", "verify"],
      imaging: READ_ONLY,
      pharmacy: READ_ONLY,
      appointments: ["view", "edit", "assign"],
      providers: READ_ONLY,
      supplies: ["view", "create"],
      biomed: ["view", "create"],
      support_services: ["view", "create", "edit", "assign"],
      workforce: READ_ONLY,
      portal: READ_ONLY,
      reports: ["view", "export"],
    }),
    risk: "medium",
  },
  {
    id: "pharmacist", en: "Pharmacist", ar: "صيدلي",
    color: "bg-emerald-100 text-emerald-700",
    description: "Verifies dispensing, owns drug stock, reads the chart only",
    descriptionAr: "التحقق من الصرف وإدارة مخزون الأدوية مع عرض الملف فقط",
    permissions: grant({
      patients: READ_ONLY,
      encounters: READ_ONLY,
      chart: READ_ONLY,
      nursing: READ_ONLY,
      orders: ["view", "verify"],
      // Verifies and annotates a prescription; cannot write one.
      prescribing: ["view", "verify", "export"],
      medications: ["view", "verify"],
      // Pharmacy owns the interaction rule set, so it may tune and override it.
      cdss: ["view", "create", "edit", "override"],
      laboratory: READ_ONLY,
      blood_bank: READ_ONLY,
      pharmacy: ["view", "create", "edit", "verify", "delete", "export", "import", "approve"],
      appointments: READ_ONLY,
      // Reads credentials to confirm a prescriber may prescribe.
      providers: READ_ONLY,
      billing: READ_ONLY,
      supplies: CRUD_EXPORT,
      reports: ["view", "export"],
      settings: READ_ONLY,
    }),
    risk: "medium",
  },
  {
    id: "lab_technician", en: "Lab Technician", ar: "فني مختبر",
    color: "bg-violet-100 text-violet-700",
    description: "Lab and blood bank bench work; no access to the chart",
    descriptionAr: "أعمال المختبر وبنك الدم دون الوصول للملف السريري",
    permissions: grant({
      // Demographics only, enough to label a specimen correctly.
      patients: READ_ONLY,
      encounters: READ_ONLY,
      orders: READ_ONLY,
      laboratory: ["view", "create", "edit", "verify", "release", "export"],
      blood_bank: ["view", "create", "edit", "verify", "release"],
      // Deliberately nothing on imaging — a different bench, a different licence.
      supplies: ["view", "create"],
      biomed: ["view", "create"],
      interop: READ_ONLY,
      reports: ["view", "export"],
    }),
    risk: "low",
  },
  {
    id: "radiographer", en: "Radiographer", ar: "فني أشعة",
    color: "bg-purple-100 text-purple-700",
    description: "Acquires studies and runs the imaging list; does not report",
    descriptionAr: "تنفيذ الفحوصات وإدارة قائمة الأشعة دون كتابة التقرير",
    permissions: grant({
      patients: READ_ONLY,
      encounters: READ_ONLY,
      // The request carries the clinical indication, so no chart access needed.
      orders: READ_ONLY,
      imaging: ["view", "create", "edit", "export"],
      appointments: CRUD,
      supplies: ["view", "create"],
      biomed: ["view", "create"],
      reports: READ_ONLY,
    }),
    risk: "low",
  },
  {
    id: "radiologist", en: "Radiologist", ar: "طبيب أشعة",
    color: "bg-fuchsia-100 text-fuchsia-700",
    description: "Reports and authorises imaging; vets incoming requests",
    descriptionAr: "كتابة واعتماد تقارير الأشعة ومراجعة الطلبات",
    permissions: grant({
      patients: READ_ONLY,
      encounters: READ_ONLY,
      chart: READ_ONLY,
      orders: ["view", "approve"],
      imaging: ["view", "create", "edit", "sign", "verify", "release", "approve", "export"],
      laboratory: READ_ONLY,
      cdss: READ_ONLY,
      appointments: ["view", "edit"],
      providers: READ_ONLY,
      portal: ["view", "release"],
      reports: ["view", "export"],
    }),
    risk: "medium",
  },
  {
    id: "receptionist", en: "Receptionist", ar: "موظف استقبال",
    color: "bg-amber-100 text-amber-700",
    description: "Registration and scheduling only — demographics, never clinical data",
    descriptionAr: "التسجيل والمواعيد فقط — بيانات شخصية دون بيانات سريرية",
    permissions: grant({
      // Demographics and arrival. No chart, no results, no diagnoses, and no
      // export — a registration desk has no reason to extract a patient list.
      patients: CRUD,
      encounters: CRUD,
      appointments: ["view", "create", "edit", "delete", "assign"],
      emergency: ["view", "create"],
      billing: ["view", "create"],
      claims: READ_ONLY,
      providers: READ_ONLY,
      portal: ["view", "create"],
    }),
    risk: "low",
  },
  {
    id: "billing_officer", en: "Billing Officer", ar: "موظف الفوترة والمطالبات",
    color: "bg-green-100 text-green-700",
    description: "Charges, claims and insurance; demographics but no clinical detail",
    descriptionAr: "الرسوم والمطالبات والتأمين مع البيانات الشخصية دون التفاصيل السريرية",
    permissions: grant({
      patients: ["view", "export"],
      // Dates of service only — the chart itself stays closed.
      encounters: ["view", "export"],
      billing: ["view", "create", "edit", "export", "approve", "release"],
      claims: ["view", "create", "edit", "export", "import", "approve", "release"],
      finance: CRUD_EXPORT,
      appointments: READ_ONLY,
      providers: READ_ONLY,
      pharmacy: READ_ONLY,
      supplies: READ_ONLY,
      portal: READ_ONLY,
      reports: ["view", "export"],
    }),
    risk: "medium",
  },
  {
    id: "hr_manager", en: "HR Manager", ar: "مدير الموارد البشرية",
    color: "bg-rose-100 text-rose-700",
    description: "Staff records, payroll and credential expiry; no patient data at all",
    descriptionAr: "ملفات الموظفين والرواتب وانتهاء التراخيص دون أي بيانات مرضى",
    permissions: grant({
      workforce: ["view", "create", "edit", "delete", "export", "approve"],
      providers: CRUD_EXPORT,
      support_services: ["view", "assign"],
      finance: ["view", "export"],
      users: READ_ONLY,
      reports: ["view", "export"],
      settings: READ_ONLY,
    }),
    risk: "medium",
  },
  {
    id: "biomed_technician", en: "Biomedical Technician", ar: "فني هندسة طبية",
    color: "bg-orange-100 text-orange-700",
    description: "Equipment and maintenance only; no clinical access of any kind",
    descriptionAr: "الأجهزة والصيانة فقط دون أي صلاحيات سريرية",
    permissions: grant({
      biomed: ["view", "create", "edit", "export", "assign"],
      supplies: ["view", "create"],
      support_services: READ_ONLY,
      reports: READ_ONLY,
    }),
    risk: "low",
  },
  {
    id: "viewer", en: "Viewer", ar: "مشاهد فقط",
    color: "bg-slate-100 text-slate-600",
    description: "Read-only access to everything", descriptionAr: "عرض فقط بدون تعديل",
    permissions: allModulesWithPerms(["view"]),
    risk: "low",
  },
];

// ─── Permission checking helpers ──────────────────────────

export function hasPermission(
  permissions: PermissionMap | undefined,
  module: string,
  action: PermissionAction,
): boolean {
  if (!permissions) return false;
  const modulePerms = permissions[module];
  if (!modulePerms) return false;
  return modulePerms.includes(action);
}

export function countPermissions(permissions: PermissionMap): number {
  return Object.values(permissions).reduce((sum, acts) => sum + acts.length, 0);
}

export function countDangerousPermissions(permissions: PermissionMap): number {
  const dangerous: PermissionAction[] = ["delete", "manage_settings", "release", "approve"];
  return Object.values(permissions).reduce(
    (sum, acts) => sum + acts.filter(a => dangerous.includes(a)).length,
    0,
  );
}

export function getTemplateById(id: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find(t => t.id === id);
}
