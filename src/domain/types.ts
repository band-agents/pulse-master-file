export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          plan: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workspaces"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member" | "viewer";
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workspace_members"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
      };
      /**
       * Organisations the hospital buys from. Kept separate from `payers`
       * because they are opposite sides of the ledger and share almost no
       * fields: a supplier has lead times and fill rates, a payer has denial
       * rates and days to pay. One table for both would be half empty either way.
       */
      suppliers: {
        Row: {
          id: string;
          workspace_id: string;
          name_en: string;
          name_ar: string | null;
          category: string | null;
          website: string | null;
          phone: string | null;
          email: string | null;
          /** Working days from purchase order to delivery. */
          lead_time_days: number | null;
          /** On time and in full, as a percentage of recent orders. */
          otif_percent: number | null;
          /** Quality/reliability score out of 100, from receipt inspections. */
          performance_score: number;
          contract_expiry: string | null;
          status: "active" | "suspended" | "under_review" | "inactive";
          tags: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["suppliers"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };

      /** Insurance companies and government schemes that pay for care. */
      payers: {
        Row: {
          id: string;
          workspace_id: string;
          name_en: string;
          name_ar: string | null;
          payer_type: "insurance" | "government" | "corporate" | "self_pay" | "charity";
          website: string | null;
          phone: string | null;
          claims_email: string | null;
          /** Mean calendar days from submission to payment. */
          avg_days_to_pay: number | null;
          /** Share of submitted claims denied, as a percentage. */
          denial_rate_percent: number | null;
          contract_expiry: string | null;
          /** Whether claims must clear pre-authorisation before service. */
          requires_pre_auth: boolean;
          status: "active" | "suspended" | "under_review" | "inactive";
          tags: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payers"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["payers"]["Insert"]>;
      };
      procurement_orders: {
        Row: {
          id: string;
          workspace_id: string;
          title_en: string;
          title_ar: string | null;
          type: "task" | "project" | "milestone" | "action" | "initiative" | "ticket" | "request" | "purchase_request" | "purchase_order" | "production_order" | "stock_movement" | "maintenance" | "quotation" | "sales_order";
          status: "backlog" | "planned" | "todo" | "in_progress" | "review" | "done" | "blocked" | "cancelled" | "draft" | "submitted" | "approved" | "rejected" | "ordered" | "sent" | "partially_received" | "received" | "expired" | "converted";
          priority: "critical" | "urgent" | "high" | "medium" | "low";
          assignee_id: string | null;
          parent_id: string | null;
          organization_id: string | null;
          due_date: string | null;
          progress: number;
          total_amount?: number;
          title?: string;
          tags: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["procurement_orders"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["procurement_orders"]["Insert"]>;
      };
      supply_items: {
        Row: {
          id: string;
          workspace_id: string;
          name_en: string;
          name_ar: string | null;
          type: string;
          utilization: number;
          department: string | null;
          skills: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["supply_items"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["supply_items"]["Insert"]>;
      };
      activity_events: {
        Row: {
          id: string;
          workspace_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          description_en: string | null;
          description_ar: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["activity_events"]["Row"], "id" | "created_at">;
        Update: never;
      };
      staff: {
        Row: {
          id: string;
          workspace_id: string;
          employee_number: string;
          full_name: string;
          full_name_ar: string | null;
          phone: string | null;
          email: string | null;
          national_id: string | null;
          department: string;
          job_title: string | null;
          job_title_ar: string | null;
          employment_type: string;
          status: string;
          hire_date: string | null;
          termination_date: string | null;
          salary: number | null;
          salary_type: string;
          photo_url: string | null;
          emergency_contact: string | null;
          emergency_phone: string | null;
          address: string | null;
          skills: unknown[];
          documents: unknown[];
          notes: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["staff"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
      };
      attendance: {
        Row: {
          id: string;
          workspace_id: string;
          employee_id: string;
          date: string;
          check_in: string | null;
          check_out: string | null;
          status: string;
          overtime_hours: number;
          notes: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["attendance"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
      };
      leave_requests: {
        Row: {
          id: string;
          workspace_id: string;
          employee_id: string;
          leave_type: string;
          start_date: string;
          end_date: string;
          days: number;
          reason: string | null;
          status: string;
          approved_by: string | null;
          approved_at: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["leave_requests"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["leave_requests"]["Insert"]>;
      };
      cost_entries: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string | null;
          ot_case_id: string | null;
          cost_type: string;
          description: string;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          currency: string;
          date: string | null;
          supplier: string | null;
          notes: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cost_entries"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["cost_entries"]["Insert"]>;
      };
      facilities: {
        Row: {
          id: string;
          workspace_id: string;
          branch_code: string;
          name: string;
          name_ar: string | null;
          address: string | null;
          phone: string | null;
          manager_name: string | null;
          branch_type: string;
          is_active: boolean;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["facilities"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["facilities"]["Insert"]>;
      };

      /* ══════════════════════════════════════════════════════
         CLINICAL CORE
         ══════════════════════════════════════════════════════ */

      patients: {
        Row: {
          id: string;
          workspace_id: string;
          /** Medical Record Number — the identifier clinicians actually say out loud. */
          mrn: string;
          name_en: string;
          name_ar: string | null;
          date_of_birth: string;
          sex: "male" | "female" | "other" | "unknown";
          national_id: string | null;
          phone: string | null;
          email: string | null;
          address_en: string | null;
          address_ar: string | null;
          blood_group: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown" | null;
          /** Free-text summary; the structured record lives in `allergies`. */
          allergy_summary: string | null;
          next_of_kin_name: string | null;
          next_of_kin_phone: string | null;
          next_of_kin_relation: string | null;
          preferred_language: "en" | "ar" | null;
          /** Deceased, merged and inactive records stay queryable but out of active lists. */
          status: "active" | "inactive" | "deceased" | "merged";
          /** Set when status = merged: the surviving record. */
          merged_into_id: string | null;
          vip_flag: boolean;
          photo_url: string | null;
          registered_at: string;
          tags: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["patients"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };

      /** Admission / Discharge / Transfer. One row per contact with the hospital. */
      encounters: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_number: string;
          patient_id: string;
          patient_name: string;
          patient_mrn: string;
          class: "outpatient" | "inpatient" | "emergency" | "day_case" | "telehealth" | "observation";
          status: "planned" | "arrived" | "in_progress" | "on_leave" | "discharged" | "cancelled";
          department_id: string | null;
          department_name: string | null;
          attending_provider_id: string | null;
          attending_provider_name: string | null;
          ward_id: string | null;
          bed_id: string | null;
          bed_label: string | null;
          admitted_at: string | null;
          discharged_at: string | null;
          chief_complaint_en: string | null;
          chief_complaint_ar: string | null;
          admission_source: "emergency" | "referral" | "transfer" | "elective" | "newborn" | "walk_in" | null;
          discharge_disposition: "home" | "transfer" | "against_advice" | "deceased" | "rehab" | "hospice" | null;
          /** Length of stay in hours; derived on discharge, cached for reporting. */
          los_hours: number | null;
          isolation_required: boolean;
          insurance_policy_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["encounters"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["encounters"]["Insert"]>;
      };

      wards: {
        Row: {
          id: string;
          workspace_id: string;
          code: string;
          name_en: string;
          name_ar: string | null;
          branch_id: string | null;
          floor: string | null;
          speciality: string | null;
          ward_type: "general" | "icu" | "hdu" | "nicu" | "picu" | "maternity" | "surgical" | "isolation" | "psychiatric" | "day_care";
          bed_count: number;
          sex_restriction: "male" | "female" | "mixed" | null;
          charge_nurse_id: string | null;
          status: "open" | "closed" | "partial";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["wards"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["wards"]["Insert"]>;
      };

      beds: {
        Row: {
          id: string;
          workspace_id: string;
          ward_id: string;
          ward_name: string;
          room: string;
          label: string;
          bed_type: "standard" | "icu" | "isolation" | "bariatric" | "paediatric" | "incubator" | "recovery";
          /** `cleaning` and `blocked` are the states that actually govern turnover. */
          status: "available" | "occupied" | "cleaning" | "blocked" | "reserved";
          current_encounter_id: string | null;
          current_patient_name: string | null;
          occupied_since: string | null;
          /** Set when status = reserved, so the hold can expire. */
          reserved_until: string | null;
          has_oxygen: boolean;
          has_monitor: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["beds"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["beds"]["Insert"]>;
      };

      vitals: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string;
          patient_id: string;
          recorded_at: string;
          recorded_by: string | null;
          temperature_c: number | null;
          heart_rate: number | null;
          respiratory_rate: number | null;
          systolic_bp: number | null;
          diastolic_bp: number | null;
          spo2: number | null;
          /** Supplemental oxygen changes the NEWS2 weighting for SpO2. */
          on_oxygen: boolean;
          blood_glucose: number | null;
          pain_score: number | null;
          consciousness: "alert" | "voice" | "pain" | "unresponsive" | "confused" | null;
          weight_kg: number | null;
          height_cm: number | null;
          /** NEWS2 aggregate, computed on write — see lib/clinical-scores.ts. */
          news2_score: number | null;
          news2_band: "low" | "low_medium" | "medium" | "high" | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["vitals"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["vitals"]["Insert"]>;
      };

      clinical_notes: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string;
          patient_id: string;
          note_type: "admission" | "progress" | "nursing" | "consult" | "operative" | "discharge" | "referral" | "triage" | "handover";
          title_en: string;
          title_ar: string | null;
          body_en: string;
          body_ar: string | null;
          author_id: string | null;
          author_name: string;
          author_role: string | null;
          /** An unsigned note is a draft; signing makes it part of the legal record. */
          status: "draft" | "signed" | "amended" | "retracted";
          signed_at: string | null;
          /** Amendments never overwrite — they chain back to what they revise. */
          amends_note_id: string | null;
          confidential: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clinical_notes"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["clinical_notes"]["Insert"]>;
      };

      diagnoses: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string | null;
          patient_id: string;
          /** ICD-11 by default; ICD-10 kept for payers that have not migrated. */
          code_system: "icd11" | "icd10" | "snomed";
          code: string;
          description_en: string;
          description_ar: string | null;
          category: "admitting" | "principal" | "secondary" | "discharge" | "complication" | "comorbidity";
          certainty: "suspected" | "provisional" | "confirmed" | "ruled_out";
          onset_date: string | null;
          resolved_date: string | null;
          status: "active" | "resolved" | "inactive";
          /** Present On Admission — drives complication reporting and payer rules. */
          present_on_admission: boolean | null;
          diagnosed_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["diagnoses"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["diagnoses"]["Insert"]>;
      };

      allergies: {
        Row: {
          id: string;
          workspace_id: string;
          patient_id: string;
          substance_en: string;
          substance_ar: string | null;
          allergen_type: "drug" | "food" | "environment" | "latex" | "contrast" | "other";
          reaction_en: string | null;
          reaction_ar: string | null;
          severity: "mild" | "moderate" | "severe" | "fatal";
          /** `intolerance` must not fire the same hard stop as a true allergy. */
          kind: "allergy" | "intolerance";
          onset_date: string | null;
          status: "active" | "inactive" | "refuted";
          recorded_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["allergies"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["allergies"]["Insert"]>;
      };

      /** CPOE. Every order a clinician places, whatever the department fulfils it. */
      clinical_orders: {
        Row: {
          id: string;
          workspace_id: string;
          order_number: string;
          encounter_id: string;
          patient_id: string;
          patient_name: string;
          category: "medication" | "lab" | "imaging" | "procedure" | "nursing" | "diet" | "consult" | "blood" | "therapy";
          item_en: string;
          item_ar: string | null;
          /** Code in whichever catalogue the category implies (LOINC, CPT, ATC…). */
          item_code: string | null;
          priority: "routine" | "urgent" | "stat" | "asap";
          status: "draft" | "pending_signature" | "active" | "in_progress" | "completed" | "held" | "cancelled" | "expired";
          ordered_by_id: string | null;
          ordered_by_name: string;
          ordered_at: string;
          start_at: string | null;
          end_at: string | null;
          /** Medication fields — null for every other category. */
          dose: string | null;
          dose_unit: string | null;
          route: "oral" | "iv" | "im" | "sc" | "topical" | "inhaled" | "rectal" | "sublingual" | "ophthalmic" | null;
          frequency: string | null;
          duration_days: number | null;
          prn: boolean;
          prn_reason: string | null;
          instructions_en: string | null;
          instructions_ar: string | null;
          /** Set when a CDSS alert was overridden to place this order. */
          override_reason: string | null;
          department_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clinical_orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["clinical_orders"]["Insert"]>;
      };

      /** Medication Administration Record — one row per scheduled dose. */
      med_administrations: {
        Row: {
          id: string;
          workspace_id: string;
          order_id: string;
          encounter_id: string;
          patient_id: string;
          drug_name: string;
          dose: string;
          route: string;
          scheduled_at: string;
          administered_at: string | null;
          administered_by: string | null;
          /** `missed` is set by the scheduler, not a nurse — it is the audit trail. */
          status: "due" | "given" | "held" | "refused" | "missed" | "not_required";
          hold_reason: string | null;
          site: string | null;
          /** Second signature, required for controlled drugs and high-alert meds. */
          witnessed_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["med_administrations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["med_administrations"]["Insert"]>;
      };

      /** Outpatient e-prescribing — what leaves the building with the patient. */
      prescriptions: {
        Row: {
          id: string;
          workspace_id: string;
          rx_number: string;
          patient_id: string;
          patient_name: string;
          encounter_id: string | null;
          prescriber_id: string | null;
          prescriber_name: string;
          drug_name_en: string;
          drug_name_ar: string | null;
          /** WHO ATC classification code. */
          atc_code: string | null;
          strength: string | null;
          form: "tablet" | "capsule" | "syrup" | "injection" | "cream" | "drops" | "inhaler" | "patch" | "suppository" | null;
          dose: string;
          route: string;
          frequency: string;
          duration_days: number | null;
          quantity: number;
          refills_allowed: number;
          refills_used: number;
          /** Controlled substances cannot be refilled without a fresh script. */
          controlled_schedule: string | null;
          substitution_allowed: boolean;
          pharmacy_name: string | null;
          status: "draft" | "signed" | "transmitted" | "dispensed" | "partially_dispensed" | "cancelled" | "expired";
          transmitted_at: string | null;
          dispensed_at: string | null;
          notes_en: string | null;
          notes_ar: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["prescriptions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["prescriptions"]["Insert"]>;
      };

      /** Clinical Decision Support — every alert the system fired, and what was done about it. */
      cdss_alerts: {
        Row: {
          id: string;
          workspace_id: string;
          patient_id: string;
          encounter_id: string | null;
          order_id: string | null;
          alert_type: "drug_interaction" | "allergy" | "duplicate_therapy" | "dose_range" | "renal_dosing" | "pregnancy" | "critical_lab" | "sepsis" | "deterioration" | "vte_risk" | "care_gap";
          severity: "info" | "low" | "moderate" | "high" | "contraindicated";
          title_en: string;
          title_ar: string | null;
          message_en: string;
          message_ar: string | null;
          /** What the rule looked at — shown so clinicians can judge the alert. */
          evidence: Json;
          recommendation_en: string | null;
          recommendation_ar: string | null;
          status: "active" | "acknowledged" | "overridden" | "resolved" | "expired";
          fired_at: string;
          responded_at: string | null;
          responded_by: string | null;
          override_reason: string | null;
          rule_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cdss_alerts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["cdss_alerts"]["Insert"]>;
      };

      /* ══════════════════════════════════════════════════════
         ANCILLARY & DEPARTMENTAL
         ══════════════════════════════════════════════════════ */

      lab_orders: {
        Row: {
          id: string;
          workspace_id: string;
          accession_number: string;
          order_id: string | null;
          encounter_id: string;
          patient_id: string;
          patient_name: string;
          patient_mrn: string;
          panel_en: string;
          panel_ar: string | null;
          /** LOINC panel code. */
          loinc_code: string | null;
          discipline: "chemistry" | "haematology" | "microbiology" | "serology" | "histopathology" | "molecular" | "blood_bank" | "urinalysis";
          specimen_type: "blood" | "serum" | "plasma" | "urine" | "stool" | "csf" | "sputum" | "swab" | "tissue" | "fluid";
          container: string | null;
          priority: "routine" | "urgent" | "stat";
          /** The full pre-analytical chain; `rejected` ends it. */
          status: "ordered" | "collected" | "received" | "in_progress" | "resulted" | "verified" | "rejected" | "cancelled";
          rejection_reason: string | null;
          ordered_by: string;
          ordered_at: string;
          collected_at: string | null;
          collected_by: string | null;
          received_at: string | null;
          resulted_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          /** Turnaround in minutes, ordered → verified. Cached for the TAT board. */
          tat_minutes: number | null;
          has_critical_result: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["lab_orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["lab_orders"]["Insert"]>;
      };

      lab_results: {
        Row: {
          id: string;
          workspace_id: string;
          lab_order_id: string;
          patient_id: string;
          analyte_en: string;
          analyte_ar: string | null;
          loinc_code: string | null;
          value: string;
          value_numeric: number | null;
          unit: string | null;
          reference_low: number | null;
          reference_high: number | null;
          reference_text: string | null;
          /** Critical flags page the ordering clinician; normal ones do not. */
          flag: "normal" | "low" | "high" | "critical_low" | "critical_high" | "abnormal" | null;
          /** Set once someone has actually been told about a critical value. */
          critical_notified_at: string | null;
          critical_notified_to: string | null;
          method: string | null;
          instrument: string | null;
          resulted_at: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["lab_results"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["lab_results"]["Insert"]>;
      };

      blood_units: {
        Row: {
          id: string;
          workspace_id: string;
          unit_number: string;
          blood_group: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
          component: "whole_blood" | "prbc" | "ffp" | "platelets" | "cryoprecipitate";
          volume_ml: number;
          collected_at: string;
          expires_at: string;
          status: "quarantine" | "available" | "crossmatched" | "reserved" | "issued" | "transfused" | "discarded" | "expired";
          /** Set from crossmatch onward. */
          reserved_for_patient_id: string | null;
          reserved_for_patient_name: string | null;
          crossmatch_result: "compatible" | "incompatible" | "pending" | null;
          issued_at: string | null;
          transfused_at: string | null;
          discard_reason: string | null;
          storage_location: string | null;
          donor_reference: string | null;
          screening_passed: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["blood_units"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["blood_units"]["Insert"]>;
      };

      /** RIS. `study_uid` is the join to PACS — the images themselves never live here. */
      imaging_orders: {
        Row: {
          id: string;
          workspace_id: string;
          accession_number: string;
          order_id: string | null;
          encounter_id: string;
          patient_id: string;
          patient_name: string;
          patient_mrn: string;
          modality: "xr" | "ct" | "mri" | "us" | "mammo" | "nm" | "pet" | "fluoro" | "dexa" | "angio";
          procedure_en: string;
          procedure_ar: string | null;
          body_part: string | null;
          laterality: "left" | "right" | "bilateral" | "na" | null;
          contrast_required: boolean;
          priority: "routine" | "urgent" | "stat";
          status: "ordered" | "scheduled" | "arrived" | "in_progress" | "acquired" | "reported" | "verified" | "cancelled" | "no_show";
          scheduled_at: string | null;
          room: string | null;
          performed_at: string | null;
          technologist: string | null;
          reported_at: string | null;
          radiologist: string | null;
          report_en: string | null;
          report_ar: string | null;
          impression_en: string | null;
          /** A critical finding must be phoned through, not just filed. */
          critical_finding: boolean;
          critical_notified_at: string | null;
          /** DICOM Study Instance UID — the PACS handle. */
          study_uid: string | null;
          series_count: number | null;
          image_count: number | null;
          /** Dose Length Product (CT) or equivalent, for dose audit. */
          radiation_dose: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["imaging_orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["imaging_orders"]["Insert"]>;
      };

      pharmacy_stock: {
        Row: {
          id: string;
          workspace_id: string;
          drug_code: string;
          name_en: string;
          name_ar: string | null;
          generic_name: string | null;
          atc_code: string | null;
          form: string;
          strength: string;
          /** Batch and expiry are per-row: the same drug has many live batches. */
          batch_number: string;
          expiry_date: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          reorder_level: number;
          unit: string;
          unit_cost: number;
          location: string;
          /** Non-null means it needs a controlled-drugs register entry on every move. */
          controlled_schedule: string | null;
          /** High-alert drugs require the two-nurse check at administration. */
          high_alert: boolean;
          requires_refrigeration: boolean;
          supplier_name: string | null;
          status: "active" | "quarantine" | "recalled" | "expired" | "discontinued";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pharmacy_stock"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pharmacy_stock"]["Insert"]>;
      };

      dispenses: {
        Row: {
          id: string;
          workspace_id: string;
          dispense_number: string;
          prescription_id: string | null;
          order_id: string | null;
          encounter_id: string | null;
          patient_id: string;
          patient_name: string;
          stock_id: string | null;
          drug_name: string;
          batch_number: string | null;
          quantity: number;
          unit: string;
          dispense_type: "outpatient" | "inpatient" | "discharge" | "ward_stock" | "emergency";
          status: "pending" | "verified" | "dispensed" | "collected" | "returned" | "cancelled";
          /** The pharmacist check that must precede handover. */
          verified_by: string | null;
          dispensed_by: string | null;
          dispensed_at: string | null;
          counselled: boolean;
          total_cost: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["dispenses"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["dispenses"]["Insert"]>;
      };

      ot_cases: {
        Row: {
          id: string;
          workspace_id: string;
          case_number: string;
          patient_id: string;
          patient_name: string;
          patient_mrn: string;
          encounter_id: string | null;
          theatre: string;
          procedure_en: string;
          procedure_ar: string | null;
          /** CPT / procedure catalogue code, for billing and case-mix. */
          procedure_code: string | null;
          laterality: "left" | "right" | "bilateral" | "na" | null;
          surgeon_id: string | null;
          surgeon_name: string;
          assistant_name: string | null;
          anaesthetist_name: string | null;
          scrub_nurse_name: string | null;
          circulating_nurse_name: string | null;
          anaesthesia_type: "general" | "regional" | "spinal" | "local" | "sedation" | null;
          /** ASA physical status, 1–6. Drives pre-op workup and risk. */
          asa_grade: number | null;
          urgency: "elective" | "urgent" | "emergency" | "immediate";
          status: "requested" | "scheduled" | "pre_op" | "in_theatre" | "recovery" | "completed" | "cancelled" | "postponed";
          scheduled_start: string;
          scheduled_end: string;
          actual_start: string | null;
          actual_end: string | null;
          /** Wheels-in to wheels-out, cached for utilisation reporting. */
          duration_minutes: number | null;
          turnover_minutes: number | null;
          cancellation_reason: string | null;
          /** WHO Surgical Safety Checklist: sign-in, time-out, sign-out. */
          checklist: Json;
          blood_requested_units: number | null;
          implants_used: Json;
          specimen_sent: boolean;
          estimated_blood_loss_ml: number | null;
          post_op_destination: "ward" | "icu" | "hdu" | "day_case_discharge" | null;
          notes_en: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ot_cases"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["ot_cases"]["Insert"]>;
      };

      ed_visits: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string;
          patient_id: string;
          patient_name: string;
          patient_mrn: string;
          arrival_at: string;
          arrival_mode: "walk_in" | "ambulance" | "police" | "helicopter" | "referral" | "transfer";
          /** Emergency Severity Index, 1 (resus) to 5 (non-urgent). */
          triage_level: 1 | 2 | 3 | 4 | 5 | null;
          triage_at: string | null;
          triage_nurse: string | null;
          complaint_en: string;
          complaint_ar: string | null;
          area: "waiting" | "triage" | "resus" | "majors" | "minors" | "fast_track" | "paeds" | "observation" | "departed";
          status: "waiting" | "in_triage" | "in_treatment" | "awaiting_results" | "awaiting_bed" | "departed" | "left_without_being_seen";
          seen_at: string | null;
          seen_by: string | null;
          /** Door-to-doctor in minutes — the number the department is judged on. */
          door_to_doctor_minutes: number | null;
          total_los_minutes: number | null;
          disposition: "discharged" | "admitted" | "transferred" | "deceased" | "lwbs" | "against_advice" | null;
          disposition_at: string | null;
          admitted_to_ward_id: string | null;
          /** Set when the patient is admitted but no bed is free yet. */
          boarding_since: string | null;
          is_trauma: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ed_visits"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["ed_visits"]["Insert"]>;
      };

      /* ══════════════════════════════════════════════════════
         ADMINISTRATIVE & FINANCIAL
         ══════════════════════════════════════════════════════ */

      appointments: {
        Row: {
          id: string;
          workspace_id: string;
          appointment_number: string;
          patient_id: string;
          patient_name: string;
          patient_mrn: string;
          patient_phone: string | null;
          provider_id: string | null;
          provider_name: string;
          department_id: string | null;
          department_name: string;
          clinic_room: string | null;
          appointment_type: "new" | "follow_up" | "procedure" | "telehealth" | "vaccination" | "screening" | "review";
          slot_start: string;
          slot_end: string;
          duration_minutes: number;
          status: "booked" | "confirmed" | "arrived" | "in_progress" | "completed" | "no_show" | "cancelled" | "rescheduled";
          reason_en: string | null;
          reason_ar: string | null;
          booked_by: string | null;
          booked_at: string;
          /** Reminder state, so the no-show follow-up knows what was actually sent. */
          reminder_sent_at: string | null;
          confirmed_at: string | null;
          arrived_at: string | null;
          cancellation_reason: string | null;
          /** Set when this appointment replaced another. */
          rescheduled_from_id: string | null;
          is_telehealth: boolean;
          insurance_policy_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["appointments"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
      };

      providers: {
        Row: {
          id: string;
          workspace_id: string;
          employee_id: string | null;
          name_en: string;
          name_ar: string | null;
          title: string | null;
          provider_type: "physician" | "surgeon" | "nurse" | "midwife" | "technician" | "pharmacist" | "therapist" | "dentist" | "radiologist" | "pathologist";
          speciality_en: string | null;
          speciality_ar: string | null;
          department_id: string | null;
          department_name: string | null;
          license_number: string;
          license_authority: string | null;
          license_expiry: string;
          /** Credentialing is a gate: `expired` must block ordering, not just warn. */
          credential_status: "verified" | "pending" | "expired" | "suspended" | "revoked";
          credentialed_at: string | null;
          employment_type: "full_time" | "part_time" | "visiting" | "locum" | "resident" | "consultant";
          /** Whether the provider may sign orders and prescriptions. */
          can_prescribe: boolean;
          dea_number: string | null;
          phone: string | null;
          email: string | null;
          photo_url: string | null;
          languages: string[];
          status: "active" | "on_leave" | "inactive";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["providers"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["providers"]["Insert"]>;
      };

      departments: {
        Row: {
          id: string;
          workspace_id: string;
          code: string;
          name_en: string;
          name_ar: string | null;
          department_type: "clinical" | "ancillary" | "administrative" | "support";
          branch_id: string | null;
          head_provider_id: string | null;
          head_provider_name: string | null;
          cost_centre: string | null;
          location: string | null;
          phone_extension: string | null;
          /** Whether this department can be the target of an outpatient booking. */
          accepts_appointments: boolean;
          status: "active" | "inactive";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["departments"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
      };

      /** Itemised charges. The bill is assembled from these, never typed by hand. */
      charge_items: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string;
          patient_id: string;
          invoice_id: string | null;
          /** CPT / HCPCS / local chargemaster code. */
          cpt_code: string | null;
          description_en: string;
          description_ar: string | null;
          category: "consultation" | "procedure" | "medication" | "lab" | "imaging" | "bed" | "theatre" | "consumable" | "nursing" | "other";
          quantity: number;
          unit_price: number;
          total: number;
          /** What the payer contract actually allows, once applied. */
          contracted_price: number | null;
          discount_amount: number;
          department_id: string | null;
          department_name: string | null;
          source_type: "clinical_order" | "lab_order" | "imaging_order" | "dispense" | "ot_case" | "encounter" | "manual" | null;
          source_id: string | null;
          charged_at: string;
          /** Unposted charges are still editable; posted ones are on the bill. */
          posted: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["charge_items"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["charge_items"]["Insert"]>;
      };

      claims: {
        Row: {
          id: string;
          workspace_id: string;
          claim_number: string;
          encounter_id: string;
          invoice_id: string | null;
          patient_id: string;
          patient_name: string;
          payer_id: string | null;
          payer_name: string;
          policy_number: string | null;
          claim_type: "institutional" | "professional" | "dental" | "pharmacy" | "pre_authorisation";
          /** Diagnosis and procedure codes as submitted, frozen at submission. */
          diagnosis_codes: string[];
          procedure_codes: string[];
          claimed_amount: number;
          approved_amount: number | null;
          paid_amount: number | null;
          patient_responsibility: number | null;
          currency: string;
          status: "draft" | "ready" | "submitted" | "acknowledged" | "in_review" | "approved" | "partially_paid" | "paid" | "denied" | "appealed" | "written_off";
          submitted_at: string | null;
          adjudicated_at: string | null;
          paid_at: string | null;
          /** Payer's own denial code, kept verbatim for the appeal. */
          denial_code: string | null;
          denial_reason_en: string | null;
          denial_reason_ar: string | null;
          appeal_count: number;
          /** Days in accounts receivable, cached for the ageing report. */
          ar_days: number | null;
          submitted_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["claims"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["claims"]["Insert"]>;
      };

      insurance_policies: {
        Row: {
          id: string;
          workspace_id: string;
          patient_id: string;
          patient_name: string;
          payer_id: string | null;
          payer_name: string;
          policy_number: string;
          plan_name: string | null;
          /** Primary pays first; secondary picks up the remainder. */
          coverage_rank: "primary" | "secondary" | "tertiary";
          policy_holder_name: string | null;
          relationship_to_holder: "self" | "spouse" | "child" | "other" | null;
          effective_from: string;
          effective_to: string | null;
          coverage_percent: number;
          copay_amount: number | null;
          deductible_amount: number | null;
          deductible_met: number | null;
          annual_limit: number | null;
          /** Eligibility goes stale; the check timestamp is what makes it trustworthy. */
          eligibility_status: "verified" | "pending" | "inactive" | "rejected" | "unknown";
          eligibility_checked_at: string | null;
          requires_pre_auth: boolean;
          status: "active" | "expired" | "cancelled" | "suspended";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["insurance_policies"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["insurance_policies"]["Insert"]>;
      };

      /* ══════════════════════════════════════════════════════
         OPERATIONAL & SUPPLY CHAIN
         ══════════════════════════════════════════════════════ */

      biomed_assets: {
        Row: {
          id: string;
          workspace_id: string;
          asset_tag: string;
          name_en: string;
          name_ar: string | null;
          category: "ventilator" | "defibrillator" | "infusion_pump" | "monitor" | "imaging" | "anaesthesia" | "dialysis" | "surgical" | "laboratory" | "sterilisation" | "other";
          manufacturer: string | null;
          model: string | null;
          serial_number: string | null;
          ward_id: string | null;
          location: string | null;
          department_id: string | null;
          purchase_date: string | null;
          purchase_cost: number | null;
          warranty_expiry: string | null;
          install_date: string | null;
          /** IEC 60601 / local risk classification — drives PM frequency. */
          risk_class: "high" | "medium" | "low" | null;
          pm_frequency_days: number | null;
          last_pm_at: string | null;
          next_pm_due: string | null;
          last_calibration_at: string | null;
          calibration_due: string | null;
          status: "in_service" | "under_maintenance" | "awaiting_parts" | "out_of_service" | "retired" | "on_loan";
          /** Cumulative hours the asset was unavailable this year. */
          downtime_hours_ytd: number;
          assigned_technician: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["biomed_assets"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["biomed_assets"]["Insert"]>;
      };

      maintenance_orders: {
        Row: {
          id: string;
          workspace_id: string;
          work_order_number: string;
          asset_id: string;
          asset_tag: string;
          asset_name: string;
          maintenance_type: "preventive" | "corrective" | "calibration" | "safety_test" | "inspection" | "upgrade";
          priority: "critical" | "high" | "medium" | "low";
          status: "open" | "assigned" | "in_progress" | "awaiting_parts" | "completed" | "verified" | "cancelled";
          reported_by: string | null;
          reported_at: string;
          fault_description_en: string | null;
          fault_description_ar: string | null;
          assigned_to: string | null;
          scheduled_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          findings_en: string | null;
          action_taken_en: string | null;
          parts_used: Json;
          labour_hours: number | null;
          cost: number | null;
          /** How long the device was unusable — the number that matters clinically. */
          downtime_minutes: number | null;
          passed_safety_test: boolean | null;
          next_due: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["maintenance_orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["maintenance_orders"]["Insert"]>;
      };

      diet_orders: {
        Row: {
          id: string;
          workspace_id: string;
          encounter_id: string;
          patient_id: string;
          patient_name: string;
          ward_id: string | null;
          ward_name: string | null;
          bed_label: string | null;
          diet_type: "regular" | "diabetic" | "renal" | "cardiac" | "low_sodium" | "high_protein" | "soft" | "pureed" | "liquid" | "npo" | "enteral" | "paediatric";
          texture: "regular" | "minced" | "pureed" | "liquid" | null;
          fluid_consistency: "thin" | "nectar" | "honey" | "pudding" | null;
          calories_target: number | null;
          protein_target_g: number | null;
          fluid_restriction_ml: number | null;
          /** Copied forward from the patient's allergy record at order time. */
          allergens_to_avoid: string[];
          cultural_preference: "halal" | "kosher" | "vegetarian" | "vegan" | "none" | null;
          special_instructions_en: string | null;
          special_instructions_ar: string | null;
          ordered_by: string;
          dietitian_reviewed: boolean;
          start_at: string;
          end_at: string | null;
          status: "active" | "on_hold" | "completed" | "cancelled";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["diet_orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["diet_orders"]["Insert"]>;
      };

      meal_services: {
        Row: {
          id: string;
          workspace_id: string;
          diet_order_id: string;
          patient_id: string;
          patient_name: string;
          ward_name: string;
          bed_label: string | null;
          service_date: string;
          meal: "breakfast" | "lunch" | "dinner" | "snack_am" | "snack_pm";
          menu_en: string | null;
          menu_ar: string | null;
          status: "planned" | "prepared" | "dispatched" | "delivered" | "refused" | "returned" | "cancelled";
          prepared_at: string | null;
          delivered_at: string | null;
          delivered_by: string | null;
          /** Rough intake, for nutrition monitoring. */
          intake_percent: number | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["meal_services"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["meal_services"]["Insert"]>;
      };

      housekeeping_tasks: {
        Row: {
          id: string;
          workspace_id: string;
          task_number: string;
          ward_id: string | null;
          ward_name: string | null;
          bed_id: string | null;
          location: string;
          task_type: "discharge_clean" | "daily_clean" | "terminal_clean" | "spill" | "isolation_clean" | "linen_change" | "deep_clean";
          priority: "urgent" | "high" | "normal" | "low";
          status: "pending" | "assigned" | "in_progress" | "completed" | "verified" | "cancelled";
          requested_at: string;
          requested_by: string | null;
          assigned_to: string | null;
          assigned_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          /** Requested → verified, in minutes. This is bed turnaround. */
          turnaround_minutes: number | null;
          /** Isolation cleans need a different agent and a longer contact time. */
          isolation_precaution: string | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["housekeeping_tasks"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["housekeeping_tasks"]["Insert"]>;
      };

      linen_cycles: {
        Row: {
          id: string;
          workspace_id: string;
          cycle_number: string;
          ward_id: string | null;
          ward_name: string;
          cycle_date: string;
          category: "bed_sheets" | "pillow_cases" | "blankets" | "towels" | "gowns" | "scrubs" | "theatre_drapes" | "curtains";
          quantity_issued: number;
          quantity_returned: number;
          quantity_condemned: number;
          /** Soiled → clean turnaround; a shortfall here shows up as bed delays. */
          status: "issued" | "collected" | "washing" | "returned" | "shortfall";
          issued_at: string;
          returned_at: string | null;
          handled_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["linen_cycles"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["linen_cycles"]["Insert"]>;
      };

      /* ══════════════════════════════════════════════════════
         PATIENT-FACING & CONNECTIVITY
         ══════════════════════════════════════════════════════ */

      portal_messages: {
        Row: {
          id: string;
          workspace_id: string;
          patient_id: string;
          patient_name: string;
          /** `inbound` is patient → hospital. */
          direction: "inbound" | "outbound";
          category: "question" | "result_release" | "appointment" | "prescription_refill" | "billing" | "document" | "reminder";
          subject_en: string;
          subject_ar: string | null;
          body_en: string;
          body_ar: string | null;
          provider_id: string | null;
          provider_name: string | null;
          status: "unread" | "read" | "replied" | "closed" | "escalated";
          sent_at: string;
          read_at: string | null;
          replied_at: string | null;
          /** Set when the message chains onto an earlier one. */
          parent_message_id: string | null;
          attachment_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["portal_messages"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["portal_messages"]["Insert"]>;
      };

      telehealth_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          session_number: string;
          appointment_id: string | null;
          encounter_id: string | null;
          patient_id: string;
          patient_name: string;
          provider_id: string | null;
          provider_name: string;
          scheduled_at: string;
          started_at: string | null;
          ended_at: string | null;
          duration_minutes: number | null;
          status: "scheduled" | "waiting" | "in_progress" | "completed" | "no_show" | "failed" | "cancelled";
          /** Joining is by one-time link; the room id is what the bridge uses. */
          room_id: string | null;
          patient_joined_at: string | null;
          provider_joined_at: string | null;
          connection_quality: "excellent" | "good" | "fair" | "poor" | null;
          /** A dropped call mid-consult is a clinical safety event, not a glitch. */
          drop_count: number;
          consent_recorded: boolean;
          recording_url: string | null;
          documents_shared: number;
          chat_message_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["telehealth_sessions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["telehealth_sessions"]["Insert"]>;
      };

      /** One row per message crossing the boundary. This table is the audit trail. */
      interface_messages: {
        Row: {
          id: string;
          workspace_id: string;
          message_id: string;
          endpoint_id: string | null;
          endpoint_name: string;
          direction: "inbound" | "outbound";
          protocol: "hl7v2" | "fhir_r4" | "dicom" | "x12" | "custom";
          /** HL7 trigger (ADT^A01, ORU^R01…) or FHIR resource type. */
          message_type: string;
          patient_id: string | null;
          patient_mrn: string | null;
          encounter_id: string | null;
          status: "queued" | "sending" | "sent" | "acknowledged" | "rejected" | "error" | "retrying" | "dead_letter";
          sent_at: string | null;
          acknowledged_at: string | null;
          /** HL7 ACK code — AA accept, AE app error, AR reject. */
          ack_code: string | null;
          error_message: string | null;
          retry_count: number;
          payload_size_bytes: number | null;
          /** Kept truncated: full payloads live in object storage, not the row. */
          payload_preview: string | null;
          processing_ms: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["interface_messages"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["interface_messages"]["Insert"]>;
      };

      interface_endpoints: {
        Row: {
          id: string;
          workspace_id: string;
          name_en: string;
          name_ar: string | null;
          system_name: string;
          protocol: "hl7v2" | "fhir_r4" | "dicom" | "x12" | "custom";
          direction: "inbound" | "outbound" | "bidirectional";
          transport: "mllp" | "https" | "sftp" | "file" | "tcp";
          host: string | null;
          port: number | null;
          /** HL7 MSH-3/MSH-4 sending application and facility. */
          sending_application: string | null;
          sending_facility: string | null;
          message_types: string[];
          status: "up" | "degraded" | "down" | "disabled";
          last_heartbeat_at: string | null;
          last_message_at: string | null;
          messages_today: number;
          errors_today: number;
          /** Consecutive failures before the endpoint is marked down. */
          failure_threshold: number;
          retry_policy: string | null;
          owner_team: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["interface_endpoints"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["interface_endpoints"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
