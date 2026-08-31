/**
 * CSV Export Utility
 *
 * Exports workspace data tables as CSV files.
 * Works entirely client-side — no server round-trip needed.
 */

type Row = Record<string, unknown>;

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Strip internal columns that aren't useful in exports */
const INTERNAL_COLS = new Set(["workspace_id", "metadata", "id"]);

export function exportCSV(rows: Row[], filename: string, columns?: string[]): void {
  if (rows.length === 0) return;

  const cols = columns ?? Object.keys(rows[0]).filter((k) => !INTERNAL_COLS.has(k));

  const header = cols.join(",");
  const body = rows.map((row) => cols.map((col) => escapeCSV(row[col])).join(",")).join("\n");
  const csv = header + "\n" + body;

  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

/** Download a string as a file */
function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download a CSV template (just headers, no data) */
export function downloadTemplate(headers: string[], filename: string): void {
  downloadFile(headers.join(",") + "\n", filename, "text/csv;charset=utf-8;");
}

/** Parse a CSV string into rows */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  // Remove BOM if present
  const headerLine = lines[0].replace(/^﻿/, "");
  const headers = parseLine(headerLine);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/** Parse a single CSV line handling quoted fields */
function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── Import templates ─────────────────────────────────────

export interface ImportTemplate {
  id: string;
  labelEn: string;
  labelAr: string;
  headers: string[];
  requiredHeaders: string[];
  mapRow: (row: Record<string, string>) => Record<string, unknown>;
}

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "patients",
    labelEn: "Patients",
    labelAr: "المرضى",
    headers: ["mrn", "name_en", "name_ar", "date_of_birth", "sex", "national_id", "phone", "email", "blood_group", "preferred_language"],
    requiredHeaders: ["mrn", "name_en", "date_of_birth"],
    mapRow: (r) => ({
      mrn: r.mrn,
      name_en: r.name_en,
      name_ar: r.name_ar || null,
      date_of_birth: r.date_of_birth,
      sex: (["male", "female", "other", "unknown"].includes(r.sex) ? r.sex : "unknown"),
      national_id: r.national_id || null,
      phone: r.phone || null,
      email: r.email || null,
      address_en: null,
      address_ar: null,
      blood_group: (["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(r.blood_group) ? r.blood_group : "unknown"),
      allergy_summary: null,
      next_of_kin_name: null,
      next_of_kin_phone: null,
      next_of_kin_relation: null,
      preferred_language: (["en", "ar"].includes(r.preferred_language) ? r.preferred_language : null),
      status: "active",
      merged_into_id: null,
      vip_flag: false,
      photo_url: null,
      registered_at: new Date().toISOString(),
      tags: [],
      metadata: {},
    }),
  },
  {
    id: "providers",
    labelEn: "Providers",
    labelAr: "مقدمو الرعاية",
    headers: ["name_en", "name_ar", "provider_type", "speciality_en", "license_number", "license_expiry", "department_name", "phone", "email"],
    requiredHeaders: ["name_en", "license_number", "license_expiry"],
    mapRow: (r) => ({
      employee_id: null,
      name_en: r.name_en,
      name_ar: r.name_ar || null,
      title: null,
      provider_type: (["physician", "surgeon", "nurse", "midwife", "technician", "pharmacist", "therapist", "dentist", "radiologist", "pathologist"].includes(r.provider_type) ? r.provider_type : "physician"),
      speciality_en: r.speciality_en || null,
      speciality_ar: null,
      department_id: null,
      department_name: r.department_name || null,
      license_number: r.license_number,
      license_authority: "SCFHS",
      license_expiry: r.license_expiry,
      // Imported providers start unverified: credentialing is a human check,
      // never something a spreadsheet upload can assert.
      credential_status: "pending",
      credentialed_at: null,
      employment_type: "full_time",
      can_prescribe: false,
      dea_number: null,
      phone: r.phone || null,
      email: r.email || null,
      photo_url: null,
      languages: [],
      status: "active",
      metadata: {},
    }),
  },
  {
    id: "staff",
    labelEn: "Employees",
    labelAr: "الموظفين",
    headers: ["employee_number", "full_name", "full_name_ar", "department", "job_title", "employment_type", "status", "phone", "email", "hire_date"],
    requiredHeaders: ["employee_number", "full_name", "department"],
    mapRow: (r) => ({
      employee_number: r.employee_number,
      full_name: r.full_name,
      full_name_ar: r.full_name_ar || null,
      phone: r.phone || null,
      email: r.email || null,
      national_id: null,
      department: r.department,
      job_title: r.job_title || null,
      job_title_ar: null,
      employment_type: r.employment_type || "full_time",
      status: (["active", "on_leave", "inactive"].includes(r.status) ? r.status : "active"),
      hire_date: r.hire_date || null,
      termination_date: null,
      salary: null,
      salary_type: "monthly",
      photo_url: null,
      emergency_contact: null,
      emergency_phone: null,
      address: null,
      skills: [],
      documents: [],
      notes: null,
      metadata: {},
    }),
  },
  {
    id: "insurance_policies",
    labelEn: "Insurance Policies",
    labelAr: "وثائق التأمين",
    headers: ["patient_name", "payer_name", "policy_number", "plan_name", "coverage_rank", "effective_from", "effective_to", "coverage_percent", "copay_amount"],
    requiredHeaders: ["patient_name", "payer_name", "policy_number", "effective_from"],
    mapRow: (r) => ({
      patient_id: "",
      patient_name: r.patient_name,
      payer_id: null,
      payer_name: r.payer_name,
      policy_number: r.policy_number,
      plan_name: r.plan_name || null,
      coverage_rank: (["primary", "secondary", "tertiary"].includes(r.coverage_rank) ? r.coverage_rank : "primary"),
      policy_holder_name: null,
      relationship_to_holder: "self",
      effective_from: r.effective_from,
      effective_to: r.effective_to || null,
      coverage_percent: Math.min(100, Math.max(0, parseFloat(r.coverage_percent) || 80)),
      copay_amount: parseFloat(r.copay_amount) || null,
      deductible_amount: null,
      deductible_met: null,
      annual_limit: null,
      // Eligibility must be checked against the payer, not asserted by a CSV.
      eligibility_status: "unknown",
      eligibility_checked_at: null,
      requires_pre_auth: false,
      status: "active",
      metadata: {},
    }),
  },
  {
    id: "pharmacy_stock",
    labelEn: "Pharmacy Stock",
    labelAr: "مخزون الصيدلية",
    headers: ["drug_code", "name_en", "name_ar", "generic_name", "form", "strength", "batch_number", "expiry_date", "quantity_on_hand", "reorder_level", "unit", "unit_cost", "location"],
    requiredHeaders: ["drug_code", "name_en", "batch_number", "expiry_date"],
    mapRow: (r) => ({
      drug_code: r.drug_code,
      name_en: r.name_en,
      name_ar: r.name_ar || null,
      generic_name: r.generic_name || null,
      atc_code: null,
      form: r.form || "tablet",
      strength: r.strength || "",
      batch_number: r.batch_number,
      expiry_date: r.expiry_date,
      quantity_on_hand: parseInt(r.quantity_on_hand) || 0,
      quantity_reserved: 0,
      reorder_level: parseInt(r.reorder_level) || 0,
      unit: r.unit || "unit",
      unit_cost: parseFloat(r.unit_cost) || 0,
      location: r.location || "Main store",
      controlled_schedule: null,
      high_alert: false,
      requires_refrigeration: false,
      supplier_name: null,
      status: "active",
      metadata: {},
    }),
  },
  {
    id: "biomed_assets",
    labelEn: "Biomedical Assets",
    labelAr: "الأجهزة الطبية",
    headers: ["asset_tag", "name_en", "name_ar", "category", "manufacturer", "model", "serial_number", "location", "risk_class", "pm_frequency_days"],
    requiredHeaders: ["asset_tag", "name_en"],
    mapRow: (r) => ({
      asset_tag: r.asset_tag,
      name_en: r.name_en,
      name_ar: r.name_ar || null,
      category: (["ventilator", "defibrillator", "infusion_pump", "monitor", "imaging", "anaesthesia", "dialysis", "surgical", "laboratory", "sterilisation", "other"].includes(r.category) ? r.category : "other"),
      manufacturer: r.manufacturer || null,
      model: r.model || null,
      serial_number: r.serial_number || null,
      ward_id: null,
      location: r.location || null,
      department_id: null,
      purchase_date: null,
      purchase_cost: null,
      warranty_expiry: null,
      install_date: null,
      risk_class: (["high", "medium", "low"].includes(r.risk_class) ? r.risk_class : null),
      pm_frequency_days: parseInt(r.pm_frequency_days) || null,
      last_pm_at: null,
      next_pm_due: null,
      last_calibration_at: null,
      calibration_due: null,
      status: "in_service",
      downtime_hours_ytd: 0,
      assigned_technician: null,
      metadata: {},
    }),
  },
];
