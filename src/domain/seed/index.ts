/**
 * Demo Seed Data — بيانات تجريبية للعرض
 *
 * The shared, non-clinical half of the demo hospital: facilities, staff,
 * rosters, supplies, suppliers and the activity stream. The clinical record
 * lives in `clinical-seed.ts`, `clinical-seed-orders.ts` and
 * `clinical-seed-ops.ts`, and is re-exported from here so `data-source.ts`
 * has a single import.
 *
 * Staff IDs (emp-*) line up with provider IDs (prov-*) where the same person
 * appears in both — a consultant is an employee for payroll and a provider
 * for ordering, and those are genuinely different records.
 */

import type { Database } from "@/domain/types";

type T<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];

const W = "demo";
const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
const ts = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const hrs = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const mins = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const inDays = (daysAhead: number) => new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);

// ─── Facilities ──────────────────────────────────────────
// `branches` in the schema; a hospital calls them sites.

export const DEMO_FACILITIES: T<"facilities">[] = [
  { id: "br-01", workspace_id: W, branch_code: "MAIN", name: "Al-Madinah Main Hospital", name_ar: "مستشفى المدينة الرئيسي", address: "King Abdulaziz Road, Riyadh", phone: "+966-11-500-1000", manager_name: "Dr. Hala Al-Rasheed", branch_type: "hospital", is_active: true, metadata: { beds: 320, trauma_centre: true, theatres: 8 }, created_at: ts(1200), updated_at: ts(3) },
  { id: "br-02", workspace_id: W, branch_code: "CLIN", name: "Al Rabwah Outpatient Clinic", name_ar: "عيادات الربوة الخارجية", address: "Al Rabwah District, Riyadh", phone: "+966-11-500-2000", manager_name: "Dr. Lina Al-Yousef", branch_type: "clinic", is_active: true, metadata: { consulting_rooms: 18 }, created_at: ts(900), updated_at: ts(11) },
  { id: "br-03", workspace_id: W, branch_code: "DIAG", name: "North Diagnostic Centre", name_ar: "مركز التشخيص الشمالي", address: "Northern Ring Road, Riyadh", phone: "+966-11-500-3000", manager_name: "Dr. Tariq Al-Balawi", branch_type: "diagnostic", is_active: true, metadata: { modalities: ["CT", "MRI", "US", "XR"] }, created_at: ts(700), updated_at: ts(6) },
  { id: "br-04", workspace_id: W, branch_code: "WHSE", name: "Central Medical Store", name_ar: "المستودع الطبي المركزي", address: "Industrial City 2, Riyadh", phone: "+966-11-500-4000", manager_name: "Eng. Mishal Al-Ruwaili", branch_type: "warehouse", is_active: true, metadata: { cold_chain: true }, created_at: ts(700), updated_at: ts(2) },
];

// ─── Staff ───────────────────────────────────────────────

export const DEMO_STAFF: T<"staff">[] = [
  { id: "emp-01", workspace_id: W, employee_number: "E-1001", full_name: "Dr. Hala Al-Rasheed", full_name_ar: "د. هالة الرشيد", phone: "+966-55-410-0001", email: "h.rasheed@almadinah.sa", national_id: null, department: "Cardiology", job_title: "Consultant Cardiologist", job_title_ar: "استشاري قلب", employment_type: "full_time", status: "active", hire_date: d(1400), termination_date: null, salary: 68000, salary_type: "monthly", photo_url: null, emergency_contact: "Saleh Al-Rasheed", emergency_phone: "+966-55-999-0001", address: "Riyadh, Al Nakheel", skills: ["interventional cardiology", "echocardiography", "teaching"], documents: [], notes: null, metadata: { on_call_rota: "A", provider_id: "prov-01" }, created_at: ts(1400), updated_at: ts(3) },
  { id: "emp-02", workspace_id: W, employee_number: "E-1002", full_name: "Dr. Faisal Al-Harthy", full_name_ar: "د. فيصل الحارثي", phone: "+966-55-410-0002", email: "f.harthy@almadinah.sa", national_id: null, department: "General Surgery", job_title: "Consultant Surgeon", job_title_ar: "استشاري جراحة", employment_type: "full_time", status: "active", hire_date: d(1250), termination_date: null, salary: 65000, salary_type: "monthly", photo_url: null, emergency_contact: "Nawal Al-Harthy", emergency_phone: "+966-55-999-0002", address: "Riyadh, Al Yasmin", skills: ["laparoscopy", "hepatobiliary", "emergency surgery"], documents: [], notes: null, metadata: { provider_id: "prov-02" }, created_at: ts(1250), updated_at: ts(4) },
  { id: "emp-03", workspace_id: W, employee_number: "E-1003", full_name: "Nurse Aisha Al-Dakhil", full_name_ar: "الممرضة عائشة الدخيل", phone: "+966-55-410-0005", email: "a.dakhil@almadinah.sa", national_id: null, department: "Intensive Care", job_title: "Charge Nurse", job_title_ar: "رئيسة تمريض", employment_type: "full_time", status: "active", hire_date: d(1100), termination_date: null, salary: 19500, salary_type: "monthly", photo_url: null, emergency_contact: "Faisal Al-Dakhil", emergency_phone: "+966-55-999-0003", address: "Riyadh, Al Malaz", skills: ["critical care", "ventilation", "ALS instructor"], documents: [], notes: null, metadata: { shift_pattern: "12h rotating", provider_id: "prov-05" }, created_at: ts(1100), updated_at: ts(1) },
  { id: "emp-04", workspace_id: W, employee_number: "E-1004", full_name: "Nurse Sara Bin Ali", full_name_ar: "الممرضة سارة بن علي", phone: "+966-55-410-0021", email: "s.binali@almadinah.sa", national_id: null, department: "General Surgery", job_title: "Staff Nurse", job_title_ar: "ممرضة", employment_type: "full_time", status: "active", hire_date: d(600), termination_date: null, salary: 14200, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Aziziyah", skills: ["wound care", "post-operative", "cannulation"], documents: [], notes: null, metadata: { shift_pattern: "12h rotating" }, created_at: ts(600), updated_at: ts(2) },
  { id: "emp-05", workspace_id: W, employee_number: "E-1005", full_name: "Nurse Khalid Al-Ruwais", full_name_ar: "الممرض خالد الرويس", phone: "+966-55-410-0015", email: "k.ruwais@almadinah.sa", national_id: null, department: "Emergency Medicine", job_title: "Triage Nurse", job_title_ar: "ممرض الفرز", employment_type: "full_time", status: "active", hire_date: d(820), termination_date: null, salary: 16800, salary_type: "monthly", photo_url: null, emergency_contact: "Hessa Al-Ruwais", emergency_phone: "+966-55-999-0005", address: "Riyadh, Al Naseem", skills: ["triage", "trauma", "paediatric resuscitation"], documents: [], notes: null, metadata: { shift_pattern: "night rotation", provider_id: "prov-15" }, created_at: ts(820), updated_at: ts(1) },
  { id: "emp-06", workspace_id: W, employee_number: "E-1006", full_name: "Dr. Huda Al-Qarni", full_name_ar: "د. هدى القرني", phone: "+966-55-410-0012", email: "h.qarni@almadinah.sa", national_id: null, department: "Pharmacy", job_title: "Chief Pharmacist", job_title_ar: "رئيسة الصيادلة", employment_type: "full_time", status: "active", hire_date: d(1000), termination_date: null, salary: 34000, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Wurud", skills: ["clinical pharmacy", "antimicrobial stewardship", "cytotoxics"], documents: [], notes: null, metadata: { provider_id: "prov-12" }, created_at: ts(1000), updated_at: ts(1) },
  { id: "emp-07", workspace_id: W, employee_number: "E-1007", full_name: "Eng. Mishal Al-Ruwaili", full_name_ar: "م. مشعل الرويلي", phone: "+966-55-410-0031", email: "m.ruwaili@almadinah.sa", national_id: null, department: "Biomedical Engineering", job_title: "Head of Biomedical", job_title_ar: "رئيس الهندسة الطبية", employment_type: "full_time", status: "active", hire_date: d(1500), termination_date: null, salary: 28000, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Muruj", skills: ["ventilators", "anaesthesia machines", "electrical safety", "IEC 60601"], documents: [], notes: null, metadata: {}, created_at: ts(1500), updated_at: ts(6) },
  { id: "emp-08", workspace_id: W, employee_number: "E-1008", full_name: "Eng. Tariq Al-Sulami", full_name_ar: "م. طارق السلمي", phone: "+966-55-410-0032", email: "t.sulami@almadinah.sa", national_id: null, department: "Biomedical Engineering", job_title: "Biomedical Technician", job_title_ar: "فني هندسة طبية", employment_type: "full_time", status: "active", hire_date: d(500), termination_date: null, salary: 15500, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Izdihar", skills: ["infusion pumps", "monitors", "calibration"], documents: [], notes: null, metadata: {}, created_at: ts(500), updated_at: ts(2) },
  { id: "emp-09", workspace_id: W, employee_number: "E-1009", full_name: "Waleed Al-Sudairi", full_name_ar: "وليد السديري", phone: "+966-55-410-0041", email: "w.sudairi@almadinah.sa", national_id: null, department: "Revenue Cycle", job_title: "Head of Revenue Cycle", job_title_ar: "رئيس الدورة الإيرادية", employment_type: "full_time", status: "active", hire_date: d(1050), termination_date: null, salary: 31000, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Rabwah", skills: ["claims", "ICD-11 coding", "denial management", "NPHIES"], documents: [], notes: null, metadata: {}, created_at: ts(1050), updated_at: ts(2) },
  { id: "emp-10", workspace_id: W, employee_number: "E-1010", full_name: "Noura Al-Mansouri", full_name_ar: "نورة المنصوري", phone: "+966-55-410-0042", email: "n.mansouri@almadinah.sa", national_id: null, department: "Revenue Cycle", job_title: "Senior Claims Officer", job_title_ar: "أخصائية مطالبات أولى", employment_type: "full_time", status: "active", hire_date: d(400), termination_date: null, salary: 17500, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Nahdah", skills: ["pre-authorisation", "appeals", "payer contracts"], documents: [], notes: null, metadata: {}, created_at: ts(400), updated_at: ts(2) },
  { id: "emp-11", workspace_id: W, employee_number: "E-1011", full_name: "Housekeeper Ahmed Al-Rashidi", full_name_ar: "أحمد الراشدي", phone: "+966-55-410-0051", email: null, national_id: null, department: "Housekeeping", job_title: "Housekeeping Supervisor", job_title_ar: "مشرف النظافة", employment_type: "full_time", status: "active", hire_date: d(760), termination_date: null, salary: 7800, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Shifa", skills: ["terminal cleaning", "isolation protocols", "spill response"], documents: [], notes: null, metadata: {}, created_at: ts(760), updated_at: ts(1) },
  { id: "emp-12", workspace_id: W, employee_number: "E-1012", full_name: "Dana Al-Muhaisen", full_name_ar: "دانة المحيسن", phone: "+966-55-410-0061", email: "d.muhaisen@almadinah.sa", national_id: null, department: "Paediatrics", job_title: "Paediatric Nurse", job_title_ar: "ممرضة أطفال", employment_type: "part_time", status: "active", hire_date: d(300), termination_date: null, salary: 9400, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Sulaimaniyah", skills: ["paediatric nursing", "PEWS", "family liaison"], documents: [], notes: null, metadata: { fte: 0.6 }, created_at: ts(300), updated_at: ts(2) },
  { id: "emp-13", workspace_id: W, employee_number: "E-1013", full_name: "Dr. Maha Al-Sanea", full_name_ar: "د. مها الصانع", phone: "+966-55-410-0004", email: "m.sanea@almadinah.sa", national_id: null, department: "Cardiology", job_title: "Specialist Physician", job_title_ar: "أخصائية باطنة", employment_type: "full_time", status: "active", hire_date: d(720), termination_date: null, salary: 38000, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Malqa", skills: ["internal medicine", "endocrinology"], documents: [], notes: "Licence renewal pending with SCFHS — prescribing suspended.", metadata: { provider_id: "prov-04", credential_flag: true }, created_at: ts(720), updated_at: ts(1) },
  { id: "emp-14", workspace_id: W, employee_number: "E-1014", full_name: "Catering — Fahad Al-Otaibi", full_name_ar: "فهد العتيبي", phone: "+966-55-410-0071", email: null, national_id: null, department: "Dietary", job_title: "Catering Assistant", job_title_ar: "مساعد تغذية", employment_type: "full_time", status: "active", hire_date: d(450), termination_date: null, salary: 6900, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Khaleej", skills: ["allergen control", "tray service", "food hygiene L3"], documents: [], notes: null, metadata: {}, created_at: ts(450), updated_at: ts(1) },
  { id: "emp-15", workspace_id: W, employee_number: "E-1015", full_name: "Dr. Rakan Al-Shammari", full_name_ar: "د. راكان الشمري", phone: "+966-55-410-0081", email: "r.shammari@almadinah.sa", national_id: null, department: "Emergency Medicine", job_title: "Registrar", job_title_ar: "طبيب مقيم أول", employment_type: "full_time", status: "active", hire_date: d(200), termination_date: null, salary: 24000, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Olaya", skills: ["emergency medicine", "point-of-care ultrasound"], documents: [], notes: null, metadata: {}, created_at: ts(200), updated_at: ts(1) },
  { id: "emp-16", workspace_id: W, employee_number: "E-1016", full_name: "Nurse Mona Al-Faraj", full_name_ar: "الممرضة منى الفرج", phone: "+966-55-410-0091", email: "m.faraj@almadinah.sa", national_id: null, department: "Intensive Care", job_title: "Staff Nurse", job_title_ar: "ممرضة", employment_type: "full_time", status: "on_leave", hire_date: d(540), termination_date: null, salary: 14800, salary_type: "monthly", photo_url: null, emergency_contact: null, emergency_phone: null, address: "Riyadh, Al Rawdah", skills: ["critical care", "CRRT"], documents: [], notes: null, metadata: {}, created_at: ts(540), updated_at: ts(4) },
];

/**
 * Attendance across the last 30 days. Generated rather than written out:
 * 480 rows of hand-typed clock-ins would be noise, and the roster patterns
 * (nights, weekends, the one absence streak) are what the HR screens read.
 */
function generateAttendance(): T<"attendance">[] {
  const rows: T<"attendance">[] = [];
  let n = 0;
  for (const emp of DEMO_STAFF) {
    if (emp.status === "on_leave") continue;
    for (let day = 1; day <= 30; day++) {
      const date = new Date(Date.now() - day * 86_400_000);
      const dow = date.getDay();
      // Friday and Saturday are the weekend here; clinical staff still rota on.
      const isWeekend = dow === 5 || dow === 6;
      const clinical = ["Intensive Care", "Emergency Medicine", "Paediatrics", "General Surgery", "Cardiology"].includes(emp.department);
      if (isWeekend && !clinical) continue;

      // One deliberate short absence, so the absence report is not empty.
      const absent = emp.id === "emp-04" && day >= 12 && day <= 14;
      const nightShift = emp.id === "emp-05" && day % 3 === 0;
      const late = !absent && (day * 7 + n) % 23 === 0;

      const dateStr = date.toISOString().slice(0, 10);
      rows.push({
        id: `att-${String(++n).padStart(4, "0")}`,
        workspace_id: W,
        employee_id: emp.id,
        date: dateStr,
        check_in: absent ? null : `${dateStr}T${nightShift ? "19" : late ? "08" : "07"}:${late ? "42" : "05"}:00Z`,
        check_out: absent ? null : `${dateStr}T${nightShift ? "07" : "19"}:${nightShift ? "10" : "20"}:00Z`,
        status: absent ? "absent" : late ? "late" : "present",
        overtime_hours: (day * 3 + n) % 11 === 0 ? 2 : 0,
        notes: absent ? "Sick leave — self-certified" : nightShift ? "Night shift" : null,
        metadata: nightShift ? { shift: "night" } : {},
        created_at: `${dateStr}T06:00:00Z`,
        updated_at: `${dateStr}T20:00:00Z`,
      });
    }
  }
  return rows;
}

export const DEMO_ATTENDANCE = generateAttendance();

export const DEMO_LEAVE_REQUESTS: T<"leave_requests">[] = [
  { id: "lv-01", workspace_id: W, employee_id: "emp-16", leave_type: "annual", start_date: d(4), end_date: inDays(10), days: 14, reason: "Annual leave — booked six months ahead", status: "approved", approved_by: "emp-03", approved_at: ts(40), metadata: { cover_arranged: "Agency nurse booked for 10 shifts" }, created_at: ts(60), updated_at: ts(40) },
  { id: "lv-02", workspace_id: W, employee_id: "emp-04", leave_type: "sick", start_date: d(14), end_date: d(12), days: 3, reason: "Viral illness, self-certified", status: "approved", approved_by: "emp-03", approved_at: ts(13), metadata: {}, created_at: ts(14), updated_at: ts(13) },
  { id: "lv-03", workspace_id: W, employee_id: "emp-12", leave_type: "annual", start_date: inDays(20), end_date: inDays(27), days: 8, reason: "Family travel", status: "pending", approved_by: null, approved_at: null, metadata: { conflict: "Paediatric ward already one nurse short that week" }, created_at: ts(3), updated_at: ts(3) },
  { id: "lv-04", workspace_id: W, employee_id: "emp-08", leave_type: "training", start_date: inDays(6), end_date: inDays(8), days: 3, reason: "Infusion pump manufacturer certification", status: "approved", approved_by: "emp-07", approved_at: ts(9), metadata: { funded: true }, created_at: ts(12), updated_at: ts(9) },
  { id: "lv-05", workspace_id: W, employee_id: "emp-15", leave_type: "study", start_date: inDays(35), end_date: inDays(39), days: 5, reason: "Emergency medicine board examination", status: "pending", approved_by: null, approved_at: null, metadata: {}, created_at: ts(2), updated_at: ts(2) },
  { id: "lv-06", workspace_id: W, employee_id: "emp-11", leave_type: "unpaid", start_date: d(45), end_date: d(38), days: 8, reason: "Family matter abroad", status: "rejected", approved_by: "emp-07", approved_at: ts(50), metadata: { reason_declined: "Two supervisors already off that week" }, created_at: ts(55), updated_at: ts(50) },
];

// ─── Cost entries ────────────────────────────────────────
// Case costing: what an encounter or a theatre case actually consumed.

export const DEMO_COST_ENTRIES: T<"cost_entries">[] = [
  { id: "ce-01", workspace_id: W, encounter_id: "enc-14", ot_case_id: "ot-06", cost_type: "consumable", description: "Laparoscopic stapler and reloads", quantity: 1, unit_cost: 1850, total_cost: 1850, currency: "SAR", date: d(4), supplier: "Medtronic Saudi", notes: null, metadata: {}, created_at: ts(4), updated_at: ts(4) },
  { id: "ce-02", workspace_id: W, encounter_id: "enc-14", ot_case_id: "ot-06", cost_type: "theatre_time", description: "Theatre 3 — 72 minutes at SAR 42/min", quantity: 72, unit_cost: 42, total_cost: 3024, currency: "SAR", date: d(4), supplier: null, notes: null, metadata: {}, created_at: ts(4), updated_at: ts(4) },
  { id: "ce-03", workspace_id: W, encounter_id: "enc-02", ot_case_id: "ot-01", cost_type: "consumable", description: "Laparoscopic clip applier, trocars, drapes", quantity: 1, unit_cost: 2240, total_cost: 2240, currency: "SAR", date: d(1), supplier: "Johnson & Johnson", notes: null, metadata: {}, created_at: hrs(26), updated_at: hrs(26) },
  { id: "ce-04", workspace_id: W, encounter_id: "enc-02", ot_case_id: "ot-01", cost_type: "theatre_time", description: "Theatre 1 — 96 minutes at SAR 42/min", quantity: 96, unit_cost: 42, total_cost: 4032, currency: "SAR", date: d(1), supplier: null, notes: null, metadata: {}, created_at: hrs(26), updated_at: hrs(26) },
  { id: "ce-05", workspace_id: W, encounter_id: "enc-06", ot_case_id: null, cost_type: "medication", description: "Meropenem 1 g × 9 doses", quantity: 9, unit_cost: 38.5, total_cost: 346.5, currency: "SAR", date: d(0), supplier: "Jamjoom Pharma", notes: "Day 3 of 7", metadata: {}, created_at: hrs(8), updated_at: hrs(8) },
  { id: "ce-06", workspace_id: W, encounter_id: "enc-06", ot_case_id: null, cost_type: "bed_day", description: "ICU bed day × 3, level 3 care", quantity: 3, unit_cost: 6800, total_cost: 20400, currency: "SAR", date: d(0), supplier: null, notes: null, metadata: {}, created_at: hrs(4), updated_at: hrs(4) },
  { id: "ce-07", workspace_id: W, encounter_id: "enc-07", ot_case_id: "ot-04", cost_type: "implant", description: "AcrySof IQ SN60WF intraocular lens, 21.5 D", quantity: 1, unit_cost: 1680, total_cost: 1680, currency: "SAR", date: d(1), supplier: "Alcon", notes: "Serial IOL-88213", metadata: { implant_register: true }, created_at: hrs(30), updated_at: hrs(30) },
  { id: "ce-08", workspace_id: W, encounter_id: "enc-09", ot_case_id: null, cost_type: "medication", description: "Oxaliplatin 150 mg, cycle 4", quantity: 2, unit_cost: 620, total_cost: 1240, currency: "SAR", date: d(0), supplier: "Accord Healthcare", notes: "Compounded in isolator", metadata: { cytotoxic: true }, created_at: hrs(6.5), updated_at: hrs(6.5) },
  { id: "ce-09", workspace_id: W, encounter_id: "enc-01", ot_case_id: null, cost_type: "diagnostic", description: "Troponin T × 3, chest X-ray", quantity: 4, unit_cost: 215, total_cost: 860, currency: "SAR", date: d(0), supplier: null, notes: null, metadata: {}, created_at: hrs(4), updated_at: hrs(1) },
  { id: "ce-10", workspace_id: W, encounter_id: "enc-08", ot_case_id: "ot-02", cost_type: "implant", description: "Tibial intramedullary nail with locking screws", quantity: 1, unit_cost: 9400, total_cost: 9400, currency: "SAR", date: d(0), supplier: "Stryker", notes: "Reserved for theatre — not yet implanted", metadata: { reserved: true }, created_at: hrs(18), updated_at: hrs(18) },
];

// ─── Payers ──────────────────────────────────────────────
// Who pays for care. Denial rate and days-to-pay are the two numbers the
// revenue cycle is actually managed on, so they are columns, not metadata.

export const DEMO_PAYERS: T<"payers">[] = [
  { id: "pay-01", workspace_id: W, name_en: "Bupa Arabia", name_ar: "بوبا العربية", payer_type: "insurance", website: "bupa.com.sa", phone: "+966-92-000-4040", claims_email: "claims@bupa.com.sa", avg_days_to_pay: 26, denial_rate_percent: 6.2, contract_expiry: d(-120), requires_pre_auth: true, status: "active", tags: ["major"], metadata: {}, created_at: ts(900), updated_at: ts(2) },
  { id: "pay-02", workspace_id: W, name_en: "Tawuniya", name_ar: "التعاونية", payer_type: "insurance", website: "tawuniya.com", phone: "+966-92-000-8555", claims_email: "medical@tawuniya.com", avg_days_to_pay: 34, denial_rate_percent: 8.9, contract_expiry: d(-200), requires_pre_auth: true, status: "active", tags: ["major"], metadata: {}, created_at: ts(900), updated_at: ts(3) },
  { id: "pay-03", workspace_id: W, name_en: "MedGulf", name_ar: "ميدغلف", payer_type: "insurance", website: "medgulf.com.sa", phone: "+966-92-000-1121", claims_email: "claims@medgulf.com.sa", avg_days_to_pay: 47, denial_rate_percent: 14.1, contract_expiry: d(-45), requires_pre_auth: true, status: "under_review", tags: [], metadata: { note: "Highest denial rate — quarterly contract review scheduled" }, created_at: ts(900), updated_at: hrs(20) },
  { id: "pay-04", workspace_id: W, name_en: "Ministry of Health", name_ar: "وزارة الصحة", payer_type: "government", website: "moh.gov.sa", phone: "+966-11-212-0000", claims_email: null, avg_days_to_pay: 60, denial_rate_percent: 1.4, contract_expiry: null, requires_pre_auth: false, status: "active", tags: ["government"], metadata: {}, created_at: ts(1200), updated_at: ts(5) },
  { id: "pay-05", workspace_id: W, name_en: "Al Rajhi Takaful", name_ar: "الراجحي تكافل", payer_type: "insurance", website: "alrajhitakaful.com", phone: "+966-92-000-3344", claims_email: "health@alrajhitakaful.com", avg_days_to_pay: 29, denial_rate_percent: 7.4, contract_expiry: d(-310), requires_pre_auth: true, status: "active", tags: [], metadata: {}, created_at: ts(800), updated_at: ts(4) },
  { id: "pay-06", workspace_id: W, name_en: "Self-funded", name_ar: "دفع ذاتي", payer_type: "self_pay", website: null, phone: null, claims_email: null, avg_days_to_pay: 0, denial_rate_percent: 0, contract_expiry: null, requires_pre_auth: false, status: "active", tags: [], metadata: { note: "Patients paying directly; no claim is raised" }, created_at: ts(1200), updated_at: ts(30) },
];

// ─── Suppliers ───────────────────────────────────────────
// Who the hospital buys from. Lead time and OTIF drive reorder points, so a
// supplier that slips shows up as a stock risk long before it shows as a bill.

export const DEMO_SUPPLIERS: T<"suppliers">[] = [
  { id: "sup-01", workspace_id: W, name_en: "Jamjoom Pharma", name_ar: "جمجوم فارما", category: "Pharmaceuticals", website: "jamjoompharma.com", phone: "+966-12-608-0000", email: "orders@jamjoompharma.com", lead_time_days: 5, otif_percent: 96, performance_score: 90, contract_expiry: d(-260), status: "active", tags: ["pharmacy"], metadata: {}, created_at: ts(800), updated_at: ts(8) },
  { id: "sup-02", workspace_id: W, name_en: "Tabuk Pharmaceuticals", name_ar: "تبوك للصناعات الدوائية", category: "Pharmaceuticals", website: "tabukpharmaceuticals.com", phone: "+966-14-422-0000", email: "orders@tabukpharma.com", lead_time_days: 7, otif_percent: 92, performance_score: 87, contract_expiry: d(-180), status: "active", tags: ["pharmacy"], metadata: {}, created_at: ts(800), updated_at: ts(12) },
  { id: "sup-03", workspace_id: W, name_en: "Medtronic Saudi", name_ar: "ميدترونيك السعودية", category: "Medical devices", website: "medtronic.com", phone: "+966-11-293-0000", email: "sa.orders@medtronic.com", lead_time_days: 14, otif_percent: 89, performance_score: 92, contract_expiry: d(-400), status: "active", tags: ["consumables", "implants"], metadata: {}, created_at: ts(700), updated_at: ts(4) },
  { id: "sup-04", workspace_id: W, name_en: "Siemens Healthineers", name_ar: "سيمنس هيلثينيرز", category: "Imaging & service", website: "siemens-healthineers.com", phone: "+966-11-260-0000", email: "service.sa@siemens-healthineers.com", lead_time_days: 21, otif_percent: 94, performance_score: 89, contract_expiry: d(-400), status: "active", tags: ["imaging", "service_contract"], metadata: { response_sla_hours: 8 }, created_at: ts(1600), updated_at: ts(30) },
  { id: "sup-05", workspace_id: W, name_en: "Gulf Medical Supplies", name_ar: "الخليج للمستلزمات الطبية", category: "Distribution", website: null, phone: "+966-11-455-2200", email: "sales@gulfmedsupplies.sa", lead_time_days: 3, otif_percent: 78, performance_score: 74, contract_expiry: d(-90), status: "under_review", tags: ["consumables"], metadata: { note: "Two short deliveries this quarter — performance meeting booked" }, created_at: ts(500), updated_at: ts(6) },
  { id: "sup-06", workspace_id: W, name_en: "Riyadh Blood Bank", name_ar: "بنك الدم بالرياض", category: "Blood services", website: null, phone: "+966-11-477-1100", email: "supply@riyadhbloodbank.sa", lead_time_days: 1, otif_percent: 99, performance_score: 96, contract_expiry: null, status: "active", tags: ["blood"], metadata: { emergency_response_minutes: 45 }, created_at: ts(1000), updated_at: ts(1) },
  { id: "sup-07", workspace_id: W, name_en: "Johnson & Johnson Medical", name_ar: "جونسون آند جونسون الطبية", category: "Surgical consumables", website: "jnjmedtech.com", phone: "+966-11-299-0000", email: "sa.orders@its.jnj.com", lead_time_days: 10, otif_percent: 91, performance_score: 88, contract_expiry: d(-500), status: "active", tags: ["theatre", "consumables"], metadata: {}, created_at: ts(900), updated_at: ts(5) },
  { id: "sup-08", workspace_id: W, name_en: "Dräger Arabia", name_ar: "دريجر العربية", category: "Critical care equipment", website: "draeger.com", phone: "+966-11-201-4400", email: "service.sa@draeger.com", lead_time_days: 28, otif_percent: 85, performance_score: 83, contract_expiry: d(-190), status: "active", tags: ["biomedical", "service_contract"], metadata: {}, created_at: ts(900), updated_at: ts(20) },
];
// Consumables and equipment held as `resources`.

export const DEMO_SUPPLY_ITEMS: T<"supply_items">[] = [
  { id: "inv-01", workspace_id: W, name_en: "Nitrile examination gloves, medium", name_ar: "قفازات نيتريل فحص، وسط", type: "consumable", utilization: 78, department: "All wards", skills: [], metadata: { sku: "PPE-GLV-M", qty: 42_000, unit: "glove", reorder_level: 15_000, unit_cost: 0.28, location: "Central store B-01", supplier: "Gulf Medical Supplies", expiry: d(-540) }, created_at: ts(300), updated_at: ts(1) },
  { id: "inv-02", workspace_id: W, name_en: "Surgical face masks, type IIR", name_ar: "كمامات جراحية نوع IIR", type: "consumable", utilization: 84, department: "All wards", skills: [], metadata: { sku: "PPE-MSK-IIR", qty: 18_500, unit: "mask", reorder_level: 8_000, unit_cost: 0.34, location: "Central store B-02", supplier: "Gulf Medical Supplies", expiry: d(-700) }, created_at: ts(300), updated_at: ts(1) },
  { id: "inv-03", workspace_id: W, name_en: "IV cannula 20G", name_ar: "قسطرة وريدية ٢٠ج", type: "consumable", utilization: 66, department: "Wards & ED", skills: [], metadata: { sku: "IV-CAN-20", qty: 3_400, unit: "unit", reorder_level: 1_200, unit_cost: 2.10, location: "Central store C-04", supplier: "Medtronic Saudi", expiry: d(-900) }, created_at: ts(300), updated_at: ts(2) },
  { id: "inv-04", workspace_id: W, name_en: "Sterile surgical gown, large", name_ar: "عباءة جراحية معقمة، كبير", type: "consumable", utilization: 91, department: "Theatres", skills: [], metadata: { sku: "OT-GWN-L", qty: 480, unit: "gown", reorder_level: 600, unit_cost: 18.50, location: "Theatre store", supplier: "Johnson & Johnson", expiry: d(-1100), below_reorder: true }, created_at: ts(300), updated_at: hrs(9) },
  { id: "inv-05", workspace_id: W, name_en: "Ventilator circuit, adult single-use", name_ar: "دائرة تنفس صناعي للبالغين", type: "consumable", utilization: 72, department: "ICU", skills: [], metadata: { sku: "ICU-VCIRC-A", qty: 96, unit: "circuit", reorder_level: 40, unit_cost: 64.00, location: "ICU store", supplier: "Dräger", expiry: d(-800) }, created_at: ts(240), updated_at: hrs(20) },
  { id: "inv-06", workspace_id: W, name_en: "Blood collection tube, EDTA", name_ar: "أنبوب سحب دم EDTA", type: "consumable", utilization: 58, department: "Laboratory", skills: [], metadata: { sku: "LAB-EDTA", qty: 12_800, unit: "tube", reorder_level: 4_000, unit_cost: 0.62, location: "Lab store", supplier: "Gulf Medical Supplies", expiry: d(-400) }, created_at: ts(300), updated_at: ts(3) },
  { id: "inv-07", workspace_id: W, name_en: "Iodinated contrast, 350 mg/mL 100 mL", name_ar: "صبغة يودية ٣٥٠ ملغ/مل ١٠٠ مل", type: "consumable", utilization: 62, department: "Radiology", skills: [], metadata: { sku: "RAD-CON-350", qty: 210, unit: "bottle", reorder_level: 80, unit_cost: 88.00, location: "Radiology store", supplier: "Jamjoom Pharma", expiry: d(-260) }, created_at: ts(200), updated_at: ts(5) },
  { id: "inv-08", workspace_id: W, name_en: "Suture, Vicryl 3-0", name_ar: "خيط جراحي فيكريل ٣-٠", type: "consumable", utilization: 70, department: "Theatres", skills: [], metadata: { sku: "OT-SUT-V30", qty: 640, unit: "pack", reorder_level: 250, unit_cost: 14.20, location: "Theatre store", supplier: "Johnson & Johnson", expiry: d(-1400) }, created_at: ts(300), updated_at: hrs(26) },
  { id: "inv-09", workspace_id: W, name_en: "Oxygen mask with reservoir, adult", name_ar: "قناع أكسجين بخزان، بالغين", type: "consumable", utilization: 55, department: "ED & wards", skills: [], metadata: { sku: "RSP-O2M-A", qty: 1_100, unit: "mask", reorder_level: 400, unit_cost: 6.40, location: "Central store C-09", supplier: "Gulf Medical Supplies", expiry: d(-1000) }, created_at: ts(300), updated_at: mins(75) },
  { id: "inv-10", workspace_id: W, name_en: "Alcohol hand rub, 500 mL", name_ar: "معقم يدين كحولي ٥٠٠ مل", type: "consumable", utilization: 88, department: "All areas", skills: [], metadata: { sku: "IPC-AHR-500", qty: 340, unit: "bottle", reorder_level: 500, unit_cost: 11.80, location: "Central store B-06", supplier: "Gulf Medical Supplies", expiry: d(-500), below_reorder: true }, created_at: ts(300), updated_at: ts(1) },
  { id: "inv-11", workspace_id: W, name_en: "Wheelchair, standard adult", name_ar: "كرسي متحرك، بالغين", type: "equipment", utilization: 64, department: "Portering", skills: [], metadata: { sku: "EQP-WCH-A", qty: 42, unit: "unit", reorder_level: 8, unit_cost: 1_240, location: "Main entrance bay" }, created_at: ts(900), updated_at: ts(14) },
  { id: "inv-12", workspace_id: W, name_en: "Patient trolley, hydraulic", name_ar: "عربة نقل مرضى هيدروليكية", type: "equipment", utilization: 81, department: "ED", skills: [], metadata: { sku: "EQP-TRL-H", qty: 18, unit: "unit", reorder_level: 4, unit_cost: 8_600, location: "ED bay" }, created_at: ts(900), updated_at: ts(9) },
];

// ─── Supply chain work items ─────────────────────────────

export const DEMO_PROCUREMENT: T<"procurement_orders">[] = [
  { id: "po-h01", workspace_id: W, title_en: "PO-2026-4410 — Sterile surgical gowns × 1,200", title_ar: "أمر شراء ٤٤١٠ — عباءات جراحية معقمة ١٢٠٠", type: "purchase_order", status: "ordered", priority: "high", assignee_id: null, parent_id: null, organization_id: "sup-03", due_date: inDays(6), progress: 40, total_amount: 22200, tags: ["theatres", "below_reorder"], metadata: { supplier: "Johnson & Johnson", items: 1, resource_id: "inv-04" }, created_at: ts(4), updated_at: ts(1) },
  { id: "po-h02", workspace_id: W, title_en: "PO-2026-4412 — Alcohol hand rub × 800", title_ar: "أمر شراء ٤٤١٢ — معقم يدين ٨٠٠", type: "purchase_order", status: "approved", priority: "medium", assignee_id: null, parent_id: null, organization_id: "sup-05", due_date: inDays(3), progress: 20, total_amount: 9440, tags: ["infection_control", "below_reorder"], metadata: { supplier: "Gulf Medical Supplies", resource_id: "inv-10" }, created_at: ts(2), updated_at: ts(1) },
  { id: "po-h03", workspace_id: W, title_en: "PO-2026-4398 — Meropenem 1 g × 200 vials", title_ar: "أمر شراء ٤٣٩٨ — ميروبينيم ١غ ٢٠٠ قارورة", type: "purchase_order", status: "received", priority: "medium", assignee_id: null, parent_id: null, organization_id: "sup-01", due_date: d(6), progress: 100, total_amount: 7700, tags: ["pharmacy"], metadata: { supplier: "Jamjoom Pharma", received_at: ts(6) }, created_at: ts(14), updated_at: ts(6) },
  { id: "po-h04", workspace_id: W, title_en: "PR-2026-0881 — Conductivity cell, Fresenius 5008S", title_ar: "طلب شراء ٠٨٨١ — خلية موصلية لجهاز الغسيل", type: "purchase_request", status: "submitted", priority: "critical", assignee_id: null, parent_id: null, organization_id: null, due_date: inDays(6), progress: 10, total_amount: 4200, tags: ["biomedical", "asset_down"], metadata: { asset_tag: "BIO-DIAL-0003", work_order: "BIOM-WO-0225", downtime_hours: 96 }, created_at: ts(4), updated_at: ts(1) },
  { id: "po-h05", workspace_id: W, title_en: "PR-2026-0884 — SpO2 board, Mindray uMEC12", title_ar: "طلب شراء ٠٨٨٤ — لوحة تشبع الأكسجين", type: "purchase_request", status: "approved", priority: "high", assignee_id: null, parent_id: null, organization_id: null, due_date: inDays(6), progress: 30, total_amount: 2800, tags: ["biomedical", "asset_down"], metadata: { asset_tag: "BIO-MON-0098", work_order: "BIOM-WO-0231" }, created_at: ts(8), updated_at: ts(2) },
  { id: "po-h06", workspace_id: W, title_en: "PO-2026-4415 — IV cannulae, mixed gauges × 5,000", title_ar: "أمر شراء ٤٤١٥ — قساطر وريدية مقاسات مختلفة ٥٠٠٠", type: "purchase_order", status: "partially_received", priority: "medium", assignee_id: null, parent_id: null, organization_id: "sup-03", due_date: d(1), progress: 60, total_amount: 10500, tags: ["consumables"], metadata: { supplier: "Medtronic Saudi", received: 3000, outstanding: 2000 }, created_at: ts(12), updated_at: ts(1) },
];

export const DEMO_STOCK_MOVES: T<"procurement_orders">[] = [
  { id: "sm-h01", workspace_id: W, title_en: "Stock Out: Sterile surgical gown, large (24)", title_ar: "إخراج: عباءة جراحية معقمة، كبير (٢٤)", type: "stock_movement", status: "done", priority: "medium", assignee_id: null, parent_id: null, organization_id: null, due_date: null, progress: 100, tags: ["theatres"], metadata: { resource_name: "Sterile surgical gown, large", move_qty: 24, move_type: "stock_out", from_location: "Theatre store", to_location: null, reason: "Theatre list — 4 cases" }, created_at: hrs(28), updated_at: hrs(28) },
  { id: "sm-h02", workspace_id: W, title_en: "Stock In: Meropenem 1 g (200)", title_ar: "إدخال: ميروبينيم ١غ (٢٠٠)", type: "stock_movement", status: "done", priority: "medium", assignee_id: null, parent_id: null, organization_id: "sup-01", due_date: null, progress: 100, tags: ["pharmacy"], metadata: { resource_name: "Meropenem 1 g", move_qty: 200, move_type: "stock_in", from_location: null, to_location: "Main store C-04", batch: "MP-24552" }, created_at: ts(6), updated_at: ts(6) },
  { id: "sm-h03", workspace_id: W, title_en: "Stock Out: Ventilator circuit, adult (2)", title_ar: "إخراج: دائرة تنفس صناعي (٢)", type: "stock_movement", status: "done", priority: "high", assignee_id: null, parent_id: null, organization_id: null, due_date: null, progress: 100, tags: ["icu"], metadata: { resource_name: "Ventilator circuit, adult single-use", move_qty: 2, move_type: "stock_out", from_location: "ICU store", to_location: null, reason: "ICU bed 2 circuit change" }, created_at: hrs(20), updated_at: hrs(20) },
  { id: "sm-h04", workspace_id: W, title_en: "Stock Out: Oxygen mask with reservoir (6)", title_ar: "إخراج: قناع أكسجين بخزان (٦)", type: "stock_movement", status: "done", priority: "urgent", assignee_id: null, parent_id: null, organization_id: null, due_date: null, progress: 100, tags: ["ed"], metadata: { resource_name: "Oxygen mask with reservoir, adult", move_qty: 6, move_type: "stock_out", from_location: "Central store C-09", to_location: null, reason: "ED resus restock" }, created_at: mins(75), updated_at: mins(75) },
  { id: "sm-h05", workspace_id: W, title_en: "Stock Adjust: Ceftriaxone 1 g (−34, expired)", title_ar: "تسوية: سيفترياكسون ١غ (−٣٤، منتهي)", type: "stock_movement", status: "done", priority: "medium", assignee_id: null, parent_id: null, organization_id: null, due_date: null, progress: 100, tags: ["pharmacy", "wastage"], metadata: { resource_name: "Ceftriaxone 1 g", move_qty: -34, move_type: "adjustment", from_location: "Quarantine shelf", to_location: null, reason: "Expired — pending destruction certificate", value_lost: 183.6 }, created_at: ts(10), updated_at: ts(10) },
  { id: "sm-h06", workspace_id: W, title_en: "Stock In: IV cannula 20G (3,000 of 5,000)", title_ar: "إدخال: قسطرة وريدية ٢٠ج (٣٠٠٠ من ٥٠٠٠)", type: "stock_movement", status: "done", priority: "medium", assignee_id: null, parent_id: null, organization_id: "sup-03", due_date: null, progress: 100, tags: ["consumables", "partial"], metadata: { resource_name: "IV cannula 20G", move_qty: 3000, move_type: "stock_in", from_location: null, to_location: "Central store C-04", po: "PO-2026-4415", shortfall: 2000 }, created_at: ts(1), updated_at: ts(1) },
];

// ─── Activity stream ─────────────────────────────────────

export const DEMO_ACTIVITY_EVENTS: T<"activity_events">[] = [
  { id: "act-01", workspace_id: W, actor_id: "prov-03", action: "patient_admitted", entity_type: "encounter", entity_id: "enc-01", description_en: "Khalid Al-Otaibi admitted to CCU from the emergency department", description_ar: "دخول خالد العتيبي إلى العناية القلبية من الطوارئ", metadata: { ward: "Coronary Care Unit", bed: "CCU-01" }, created_at: hrs(9) },
  { id: "act-02", workspace_id: W, actor_id: "prov-01", action: "cdss_override", entity_type: "cdss_alert", entity_id: "alert-01", description_en: "Penicillin allergy alert overridden for co-amoxiclav, reason documented", description_ar: "تجاوز تنبيه حساسية البنسلين للكو-أموكسيكلاف مع توثيق السبب", metadata: { severity: "high", patient: "MRN-100241" }, created_at: hrs(6) },
  { id: "act-03", workspace_id: W, actor_id: null, action: "critical_result", entity_type: "lab_result", entity_id: "res-03", description_en: "Critical potassium 6.4 mmol/L reported and phoned to the ICU consultant", description_ar: "نتيجة بوتاسيوم حرجة ٦٫٤ أُبلغت هاتفياً لاستشاري العناية", metadata: { notified_within_minutes: 4, patient: "MRN-100677" }, created_at: hrs(5) },
  { id: "act-04", workspace_id: W, actor_id: "prov-02", action: "case_completed", entity_type: "ot_case", entity_id: "ot-01", description_en: "Laparoscopic cholecystectomy completed in 96 minutes, no complications", description_ar: "اكتمل استئصال المرارة بالمنظار في ٩٦ دقيقة دون مضاعفات", metadata: { theatre: "Theatre 1" }, created_at: hrs(26) },
  { id: "act-05", workspace_id: W, actor_id: null, action: "case_cancelled", entity_type: "ot_case", entity_id: "ot-05", description_en: "Thyroidectomy cancelled — Theatre 1 anaesthetic machine failed its pre-use check", description_ar: "أُلغيت عملية الغدة الدرقية لفشل جهاز التخدير في اختبار ما قبل الاستخدام", metadata: { work_order: "BIOM-WO-0229", category: "equipment" }, created_at: hrs(31) },
  { id: "act-06", workspace_id: W, actor_id: null, action: "claim_denied", entity_type: "claim", entity_id: "clm-03", description_en: "MedGulf denied CLM-2026-70551 — coverage terminated before the date of service", description_ar: "رفضت ميدغلف المطالبة ٧٠٥٥١ لانتهاء التغطية قبل تاريخ الخدمة", metadata: { amount: 11200, denial_code: "CO-27" }, created_at: hrs(20) },
  { id: "act-07", workspace_id: W, actor_id: null, action: "interface_down", entity_type: "interface_endpoint", entity_id: "ep-05", description_en: "Pharmacy dispensing robot unreachable — dispensing reverted to manual", description_ar: "تعذر الوصول لروبوت الصرف — تحول الصرف إلى اليدوي", metadata: { incident: "INC-2026-0912", queued_messages: 1 }, created_at: mins(52) },
  { id: "act-08", workspace_id: W, actor_id: "prov-15", action: "triage_completed", entity_type: "ed_visit", entity_id: "ed-01", description_en: "Turki Al-Malki triaged as category 2 and moved directly to majors", description_ar: "تم فرز تركي المالكي كفئة ٢ ونُقل مباشرة للحالات الكبرى", metadata: { news2: 9, arrival_mode: "ambulance" }, created_at: mins(88) },
  { id: "act-09", workspace_id: W, actor_id: null, action: "triage_breach", entity_type: "ed_visit", entity_id: "ed-06", description_en: "Category 3 patient waiting 198 minutes against a 30-minute target", description_ar: "مريض فئة ٣ ينتظر ١٩٨ دقيقة مقابل هدف ٣٠ دقيقة", metadata: { target_minutes: 30, waited_minutes: 198 }, created_at: mins(30) },
  { id: "act-10", workspace_id: W, actor_id: "prov-01", action: "order_stopped", entity_type: "clinical_order", entity_id: "ord-12", description_en: "Metformin stopped for Fatima Al-Harbi — eGFR fell to 26", description_ar: "أُوقف الميتفورمين لفاطمة الحربي بعد انخفاض معدل الترشيح إلى ٢٦", metadata: { replaced_with: "Linagliptin 5 mg OD" }, created_at: hrs(30) },
  { id: "act-11", workspace_id: W, actor_id: null, action: "bed_released", entity_type: "bed", entity_id: "bed-SA-04", description_en: "Bed SA-04 cleaned and released 90 minutes after discharge", description_ar: "تم تنظيف السرير SA-04 وإتاحته بعد ٩٠ دقيقة من الخروج", metadata: { turnaround_minutes: 90 }, created_at: hrs(24.5) },
  { id: "act-12", workspace_id: W, actor_id: null, action: "pm_overdue", entity_type: "biomed_asset", entity_id: "asset-01", description_en: "ICU ventilator BIO-VENT-0012 preventive maintenance 28 days overdue", description_ar: "تأخر الصيانة الوقائية لجهاز التنفس ٢٨ يوماً", metadata: { blocker: "In continuous clinical use" }, created_at: ts(1) },
  { id: "act-13", workspace_id: W, actor_id: "prov-13", action: "chemo_started", entity_type: "clinical_order", entity_id: "ord-27", description_en: "Hessa Al-Subaie started FOLFOX cycle 4 in the day unit", description_ar: "بدأت حصة السبيعي الدورة الرابعة من فولفوكس في الوحدة النهارية", metadata: { cycle: 4, of: 12 }, created_at: hrs(6) },
  { id: "act-14", workspace_id: W, actor_id: null, action: "credential_blocked", entity_type: "prescription", entity_id: "rx-06", description_en: "Prescription blocked — Dr. Maha Al-Sanea's licence had lapsed at signing", description_ar: "حُجبت وصفة طبية لانتهاء رخصة د. مها الصانع وقت التوقيع", metadata: { reissued_as: "rx-07" }, created_at: hrs(47) },
  { id: "act-15", workspace_id: W, actor_id: "prov-06", action: "sepsis_bundle", entity_type: "encounter", entity_id: "enc-06", description_en: "Sepsis Six completed within 41 minutes of arrival for Abdullah Al-Shehri", description_ar: "اكتملت حزمة الإنتان خلال ٤١ دقيقة من وصول عبدالله الشهري", metadata: { target_minutes: 60, actual_minutes: 41 }, created_at: hrs(76) },
];

// ─── Re-exports ──────────────────────────────────────────
// data-source.ts imports everything from here.

export {
  DEMO_DEPARTMENTS, DEMO_PROVIDERS, DEMO_WARDS, DEMO_BEDS,
  DEMO_PATIENTS, DEMO_ENCOUNTERS, DEMO_ALLERGIES, DEMO_DIAGNOSES,
  DEMO_VITALS, DEMO_CLINICAL_NOTES,
} from "@/domain/seed/clinical-seed";

export {
  DEMO_CLINICAL_ORDERS, DEMO_MED_ADMINISTRATIONS, DEMO_PRESCRIPTIONS,
  DEMO_CDSS_ALERTS, DEMO_LAB_ORDERS, DEMO_LAB_RESULTS, DEMO_BLOOD_UNITS,
  DEMO_IMAGING_ORDERS, DEMO_PHARMACY_STOCK, DEMO_DISPENSES,
} from "@/domain/seed/clinical-seed-orders";

export {
  DEMO_OT_CASES, DEMO_ED_VISITS, DEMO_APPOINTMENTS,
  DEMO_INSURANCE_POLICIES, DEMO_CHARGE_ITEMS, DEMO_CLAIMS,
  DEMO_BIOMED_ASSETS, DEMO_MAINTENANCE_ORDERS,
  DEMO_DIET_ORDERS, DEMO_MEAL_SERVICES,
  DEMO_HOUSEKEEPING_TASKS, DEMO_LINEN_CYCLES,
  DEMO_PORTAL_MESSAGES, DEMO_TELEHEALTH_SESSIONS,
  DEMO_INTERFACE_ENDPOINTS, DEMO_INTERFACE_MESSAGES,
} from "@/domain/seed/clinical-seed-ops";
