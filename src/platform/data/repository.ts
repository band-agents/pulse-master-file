/**
 * Data Adapter Layer
 *
 * One interface over two backings: static demo arrays, or live Supabase,
 * chosen by env var. Every page is written against the adapter, never
 * against Supabase directly, so demo and production behave identically —
 * including pagination, filtering and search semantics.
 *
 * Table names here match the Postgres tables exactly. `schema.sql` is the
 * source of truth for the live side; `demo-seed.ts` for the demo side.
 */

import { supabase, isDemoMode } from "@/platform/lib/supabase";
import { DataError, ValidationError, type DataOp } from "@/platform/lib/errors";
import { reportError } from "@/platform/lib/sentry";
import { validateMoneyWrite } from "@/platform/lib/schemas/money-schemas";
import type { Database } from "@/domain/types";
import {
  // Facilities, staff and supply chain
  DEMO_FACILITIES, DEMO_STAFF, DEMO_ATTENDANCE, DEMO_LEAVE_REQUESTS,
  DEMO_COST_ENTRIES, DEMO_ACTIVITY_EVENTS, DEMO_SUPPLIERS, DEMO_PAYERS, DEMO_SUPPLY_ITEMS,
  DEMO_PROCUREMENT, DEMO_STOCK_MOVES,
  // Clinical record
  DEMO_DEPARTMENTS, DEMO_PROVIDERS, DEMO_WARDS, DEMO_BEDS,
  DEMO_PATIENTS, DEMO_ENCOUNTERS, DEMO_ALLERGIES, DEMO_DIAGNOSES,
  DEMO_VITALS, DEMO_CLINICAL_NOTES,
  // Orders and diagnostics
  DEMO_CLINICAL_ORDERS, DEMO_MED_ADMINISTRATIONS, DEMO_PRESCRIPTIONS,
  DEMO_CDSS_ALERTS, DEMO_LAB_ORDERS, DEMO_LAB_RESULTS, DEMO_BLOOD_UNITS,
  DEMO_IMAGING_ORDERS, DEMO_PHARMACY_STOCK, DEMO_DISPENSES,
  // Theatres, emergency, revenue, operations
  DEMO_OT_CASES, DEMO_ED_VISITS, DEMO_APPOINTMENTS,
  DEMO_INSURANCE_POLICIES, DEMO_CHARGE_ITEMS, DEMO_CLAIMS,
  DEMO_BIOMED_ASSETS, DEMO_MAINTENANCE_ORDERS,
  DEMO_DIET_ORDERS, DEMO_MEAL_SERVICES,
  DEMO_HOUSEKEEPING_TASKS, DEMO_LINEN_CYCLES,
  DEMO_PORTAL_MESSAGES, DEMO_TELEHEALTH_SESSIONS,
  DEMO_INTERFACE_ENDPOINTS, DEMO_INTERFACE_MESSAGES,
} from "@/domain/seed";

type Tables = Database["public"]["Tables"];

/** Money writes are schema-checked in BOTH modes before they touch the store.
 *  User input problems, not system failures — no Sentry. */
function guardWrite(op: DataOp, table: string, payload: Record<string, unknown>, workspaceId: string): void {
  const issues = validateMoneyWrite(table, payload);
  if (issues) throw new ValidationError(op, table, issues, workspaceId);
}

// ─── Generic CRUD shape ────────────────────────────────────

/** Server-side pagination options (H2). */
export interface PageOpts {
  /** 0-based page index. Default 0. */
  page?: number;
  /** Rows per page, 1–500. Default 50. */
  pageSize?: number;
  /** Column to sort by. Default "created_at". */
  orderBy?: string;
  /** Sort direction. Default false (newest first). */
  ascending?: boolean;
  /** Equality filters; array values use contains (e.g. skills). */
  filters?: Record<string, unknown>;
  /** Case-insensitive substring match across columns (OR).
   *  Supports jsonb paths like "metadata->>so_number". */
  search?: { columns: string[]; term: string };
}

export interface PagedResult<T> {
  rows: T[];
  /** Exact total matching rows (all pages), for pager UI + counts. */
  total: number;
  page: number;
  pageSize: number;
}

export interface EntityAdapter<T> {
  list(workspaceId: string, filters?: Record<string, unknown>): Promise<T[]>;
  listPaged(workspaceId: string, opts?: PageOpts): Promise<PagedResult<T>>;
  get(workspaceId: string, id: string): Promise<T | null>;
  create(workspaceId: string, data: Partial<T>): Promise<T | null>;
  update(workspaceId: string, id: string, data: Partial<T>): Promise<T | null>;
  remove(workspaceId: string, id: string): Promise<boolean>;
}

function clampPage(opts: PageOpts): { page: number; pageSize: number } {
  return {
    page: Math.max(0, opts.page ?? 0),
    pageSize: Math.min(500, Math.max(1, opts.pageSize ?? 50)),
  };
}

// ─── Supabase adapter factory ──────────────────────────────

function makeSupabaseAdapter<T extends { id: string; workspace_id: string }>(
  table: keyof Tables
): EntityAdapter<T> {
  // H1 "loud errors": report to Sentry with context, then THROW.
  // The old behavior (console.error + return []/null) rendered failures
  // as empty lists and silently-dropped saves.
  function fail(op: DataOp, detail: string, workspaceId: string, cause?: unknown): never {
    const err = new DataError(op, table as string, detail, { workspaceId, cause });
    reportError(err, { table, op, workspaceId, cause });
    throw err;
  }

  return {
    async list(workspaceId, filters) {
      if (!supabase) fail("list", "no database connection (live mode without Supabase client)", workspaceId);
      let query = supabase.from(table as string).select("*").eq("workspace_id", workspaceId);
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          query = query.eq(k, v as string);
        }
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) fail("list", error.message, workspaceId, error);
      return (data ?? []) as T[];
    },

    async listPaged(workspaceId, opts = {}) {
      if (!supabase) fail("list", "no database connection (live mode without Supabase client)", workspaceId);
      const { page, pageSize } = clampPage(opts);
      let query = supabase
        .from(table as string)
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId);
      if (opts.filters) {
        for (const [k, v] of Object.entries(opts.filters)) {
          query = Array.isArray(v) ? query.contains(k, v) : query.eq(k, v as string);
        }
      }
      const term = opts.search?.term.trim().replace(/[,()%]/g, "") ?? "";
      if (opts.search && term) {
        query = query.or(opts.search.columns.map((c) => `${c}.ilike.%${term}%`).join(","));
      }
      const { data, error, count } = await query
        .order(opts.orderBy ?? "created_at", { ascending: opts.ascending ?? false })
        // Secondary sort on id: orderBy alone isn't unique, and .range over a
        // non-deterministic order can duplicate or skip rows across pages.
        .order("id", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) fail("list", error.message, workspaceId, error);
      return { rows: (data ?? []) as T[], total: count ?? 0, page, pageSize };
    },

    async get(workspaceId, id) {
      if (!supabase) fail("get", "no database connection (live mode without Supabase client)", workspaceId);
      const { data, error } = await supabase
        .from(table as string)
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .maybeSingle();
      // Not-found is a legitimate result (pages branch on null), not a failure.
      if (error) fail("get", error.message, workspaceId, error);
      return (data ?? null) as T | null;
    },

    async create(workspaceId, payload) {
      if (!supabase) fail("create", "no database connection (live mode without Supabase client)", workspaceId);
      guardWrite("create", table as string, payload as Record<string, unknown>, workspaceId);
      const { data, error } = await supabase
        .from(table as string)
        .insert({ ...payload, workspace_id: workspaceId } as never)
        .select()
        .single();
      if (error) fail("create", error.message, workspaceId, error);
      return data as T;
    },

    async update(workspaceId, id, payload) {
      if (!supabase) fail("update", "no database connection (live mode without Supabase client)", workspaceId);
      guardWrite("update", table as string, payload as Record<string, unknown>, workspaceId);
      const { data, error } = await supabase
        .from(table as string)
        .update({ ...payload, updated_at: new Date().toISOString() } as never)
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .select()
        .single();
      // .single() errors when 0 rows matched — that means the write DIDN'T
      // happen (bad id or RLS), which callers must hear about loudly.
      if (error) fail("update", error.message, workspaceId, error);
      return data as T;
    },

    async remove(workspaceId, id) {
      if (!supabase) fail("remove", "no database connection (live mode without Supabase client)", workspaceId);
      const { error } = await supabase
        .from(table as string)
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", id);
      if (error) fail("remove", error.message, workspaceId, error);
      return true;
    },
  };
}

// ─── Demo adapters (wrap static data as async) ────────────

/** Resolve a column value on a demo row; supports "metadata->>key" jsonb paths. */
function demoCol(row: Record<string, unknown>, col: string): unknown {
  const jsonb = col.match(/^(\w+)->>(\w+)$/);
  if (jsonb) {
    const outer = row[jsonb[1]];
    return outer && typeof outer === "object" ? (outer as Record<string, unknown>)[jsonb[2]] : undefined;
  }
  return row[col];
}

function makeDemoAdapter<T>(loader: () => T[], table = "demo"): EntityAdapter<T> {
  return {
    async list() { return loader(); },

    // Mirrors the Supabase listPaged semantics so pages behave identically
    // in demo and live mode (filters → eq/contains, search → OR ilike).
    async listPaged(_ws, opts = {}) {
      const { page, pageSize } = clampPage(opts);
      let rows = loader() as Array<Record<string, unknown>>;
      if (opts.filters) {
        rows = rows.filter((r) => Object.entries(opts.filters!).every(([k, v]) =>
          Array.isArray(v)
            ? Array.isArray(r[k]) && v.every((x) => (r[k] as unknown[]).includes(x))
            : r[k] === v));
      }
      const term = opts.search?.term.trim().toLowerCase() ?? "";
      if (opts.search && term) {
        rows = rows.filter((r) => opts.search!.columns.some((c) => {
          const v = demoCol(r, c);
          return typeof v === "string" && v.toLowerCase().includes(term);
        }));
      }
      const ob = opts.orderBy ?? "created_at";
      const asc = opts.ascending ?? false;
      // Plain <> comparison, NOT localeCompare: ISO dates/codes compare
      // correctly bytewise, and ICU collation is ~50x slower — it turned
      // the 100k load-test sort into seconds.
      rows = [...rows].sort((a, b) => {
        const av = a[ob], bv = b[ob];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else { const as = String(av), bs = String(bv); cmp = as < bs ? -1 : as > bs ? 1 : 0; }
        if (cmp !== 0) return asc ? cmp : -cmp;
        // Tiebreak on id so equal orderBy values page deterministically
        // (mirrors the Supabase adapter's secondary .order("id")).
        const ai = String(a.id ?? ""), bi = String(b.id ?? "");
        return ai < bi ? -1 : ai > bi ? 1 : 0;
      });
      return {
        rows: rows.slice(page * pageSize, (page + 1) * pageSize) as T[],
        total: rows.length,
        page,
        pageSize,
      };
    },
    async get(_ws, id) { return loader().find((r: unknown) => (r as { id: string }).id === id) ?? null; },
    async create(ws, data) {
      guardWrite("create", table, data as Record<string, unknown>, ws);
      console.warn("[DS] Demo mode — create is ephemeral");
      return { ...data, id: `demo-${Date.now()}` } as T;
    },
    async update(ws, _id, data) {
      guardWrite("update", table, data as Record<string, unknown>, ws);
      console.warn("[DS] Demo mode — update is ephemeral");
      return data as T;
    },
    async remove() {
      console.warn("[DS] Demo mode — delete is ephemeral");
      return true;
    },
  };
}


// ─── DataSource interface ──────────────────────────────────

export interface DataSource {
  mode: "demo" | "live";

  /* Clinical core */
  patients:            EntityAdapter<Tables["patients"]["Row"]>;
  encounters:          EntityAdapter<Tables["encounters"]["Row"]>;
  wards:               EntityAdapter<Tables["wards"]["Row"]>;
  beds:                EntityAdapter<Tables["beds"]["Row"]>;
  vitals:              EntityAdapter<Tables["vitals"]["Row"]>;
  clinical_notes:      EntityAdapter<Tables["clinical_notes"]["Row"]>;
  diagnoses:           EntityAdapter<Tables["diagnoses"]["Row"]>;
  allergies:           EntityAdapter<Tables["allergies"]["Row"]>;
  clinical_orders:     EntityAdapter<Tables["clinical_orders"]["Row"]>;
  med_administrations: EntityAdapter<Tables["med_administrations"]["Row"]>;
  prescriptions:       EntityAdapter<Tables["prescriptions"]["Row"]>;
  cdss_alerts:         EntityAdapter<Tables["cdss_alerts"]["Row"]>;

  /* Ancillary & departmental */
  lab_orders:      EntityAdapter<Tables["lab_orders"]["Row"]>;
  lab_results:     EntityAdapter<Tables["lab_results"]["Row"]>;
  blood_units:     EntityAdapter<Tables["blood_units"]["Row"]>;
  imaging_orders:  EntityAdapter<Tables["imaging_orders"]["Row"]>;
  pharmacy_stock:  EntityAdapter<Tables["pharmacy_stock"]["Row"]>;
  dispenses:       EntityAdapter<Tables["dispenses"]["Row"]>;
  ot_cases:        EntityAdapter<Tables["ot_cases"]["Row"]>;
  ed_visits:       EntityAdapter<Tables["ed_visits"]["Row"]>;

  /* Administrative & financial */
  appointments:        EntityAdapter<Tables["appointments"]["Row"]>;
  providers:           EntityAdapter<Tables["providers"]["Row"]>;
  departments:         EntityAdapter<Tables["departments"]["Row"]>;
  charge_items:        EntityAdapter<Tables["charge_items"]["Row"]>;
  claims:              EntityAdapter<Tables["claims"]["Row"]>;
  insurance_policies:  EntityAdapter<Tables["insurance_policies"]["Row"]>;

  /* Operational & supply chain */
  biomed_assets:      EntityAdapter<Tables["biomed_assets"]["Row"]>;
  maintenance_orders: EntityAdapter<Tables["maintenance_orders"]["Row"]>;
  diet_orders:        EntityAdapter<Tables["diet_orders"]["Row"]>;
  meal_services:      EntityAdapter<Tables["meal_services"]["Row"]>;
  housekeeping_tasks: EntityAdapter<Tables["housekeeping_tasks"]["Row"]>;
  linen_cycles:       EntityAdapter<Tables["linen_cycles"]["Row"]>;
  supply_items:          EntityAdapter<Tables["supply_items"]["Row"]>;
  procurement_orders:         EntityAdapter<Tables["procurement_orders"]["Row"]>;

  /* Patient-facing & connectivity */
  portal_messages:      EntityAdapter<Tables["portal_messages"]["Row"]>;
  telehealth_sessions:  EntityAdapter<Tables["telehealth_sessions"]["Row"]>;
  interface_messages:   EntityAdapter<Tables["interface_messages"]["Row"]>;
  interface_endpoints:  EntityAdapter<Tables["interface_endpoints"]["Row"]>;

  /* Shared */
  suppliers:       EntityAdapter<Tables["suppliers"]["Row"]>;
  payers:          EntityAdapter<Tables["payers"]["Row"]>;
  staff:       EntityAdapter<Tables["staff"]["Row"]>;
  attendance:      EntityAdapter<Tables["attendance"]["Row"]>;
  leave_requests:  EntityAdapter<Tables["leave_requests"]["Row"]>;
  cost_entries:    EntityAdapter<Tables["cost_entries"]["Row"]>;
  facilities:        EntityAdapter<Tables["facilities"]["Row"]>;
  activity_events: EntityAdapter<Tables["activity_events"]["Row"]>;

  /* Not yet backed by a typed table */
  workspace_invitations: EntityAdapter<Record<string, unknown>>;
  notifications:         EntityAdapter<Record<string, unknown>>;
}

// ─── Load-test seed ────────────────────────────────────────
// Set localStorage.pulse_loadtest = "100000" and reload: demo mode then
// backs `encounters` with N synthetic rows, so pagination can be proven
// against a realistic volume without a live database.

type EncounterRow = Tables["encounters"]["Row"];

let loadTestCache: { n: number; rows: EncounterRow[] } | null = null;

function loadTestRows(): EncounterRow[] {
  const n = typeof localStorage === "undefined"
    ? 0
    : Math.min(500_000, parseInt(localStorage.getItem("pulse_loadtest") || "0", 10) || 0);
  if (n <= 0) return [];
  if (loadTestCache?.n !== n) {
    const now = Date.now();
    const classes: EncounterRow["class"][] = ["outpatient", "inpatient", "emergency", "day_case"];
    const rows: EncounterRow[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const stamp = new Date(now - i * 60_000).toISOString();
      rows[i] = {
        id: `loadtest-${i}`,
        workspace_id: "demo",
        encounter_number: `ENC-LT-${String(i).padStart(7, "0")}`,
        patient_id: `loadtest-pt-${i % 5000}`,
        patient_name: `Load Test Patient ${i % 5000}`,
        patient_mrn: `MRN-LT-${String(i % 5000).padStart(6, "0")}`,
        class: classes[i % classes.length],
        status: "discharged",
        department_id: null,
        department_name: "Load Test",
        attending_provider_id: null,
        attending_provider_name: null,
        ward_id: null,
        bed_id: null,
        bed_label: null,
        admitted_at: stamp,
        discharged_at: stamp,
        chief_complaint_en: `Synthetic encounter #${i}`,
        chief_complaint_ar: `زيارة اصطناعية رقم ${i}`,
        admission_source: "walk_in",
        discharge_disposition: "home",
        los_hours: (i % 96) + 1,
        isolation_required: false,
        insurance_policy_id: null,
        metadata: {},
        created_at: stamp,
        updated_at: stamp,
      };
    }
    loadTestCache = { n, rows };
  }
  return loadTestCache.rows;
}

// ─── Demo DataSource ───────────────────────────────────────

const demoDataSource: DataSource = {
  mode: "demo",

  patients:            makeDemoAdapter(() => DEMO_PATIENTS, "patients"),
  encounters:          makeDemoAdapter(() => [...DEMO_ENCOUNTERS, ...loadTestRows()], "encounters"),
  wards:               makeDemoAdapter(() => DEMO_WARDS, "wards"),
  beds:                makeDemoAdapter(() => DEMO_BEDS, "beds"),
  vitals:              makeDemoAdapter(() => DEMO_VITALS, "vitals"),
  clinical_notes:      makeDemoAdapter(() => DEMO_CLINICAL_NOTES, "clinical_notes"),
  diagnoses:           makeDemoAdapter(() => DEMO_DIAGNOSES, "diagnoses"),
  allergies:           makeDemoAdapter(() => DEMO_ALLERGIES, "allergies"),
  clinical_orders:     makeDemoAdapter(() => DEMO_CLINICAL_ORDERS, "clinical_orders"),
  med_administrations: makeDemoAdapter(() => DEMO_MED_ADMINISTRATIONS, "med_administrations"),
  prescriptions:       makeDemoAdapter(() => DEMO_PRESCRIPTIONS, "prescriptions"),
  cdss_alerts:         makeDemoAdapter(() => DEMO_CDSS_ALERTS, "cdss_alerts"),

  lab_orders:      makeDemoAdapter(() => DEMO_LAB_ORDERS, "lab_orders"),
  lab_results:     makeDemoAdapter(() => DEMO_LAB_RESULTS, "lab_results"),
  blood_units:     makeDemoAdapter(() => DEMO_BLOOD_UNITS, "blood_units"),
  imaging_orders:  makeDemoAdapter(() => DEMO_IMAGING_ORDERS, "imaging_orders"),
  pharmacy_stock:  makeDemoAdapter(() => DEMO_PHARMACY_STOCK, "pharmacy_stock"),
  dispenses:       makeDemoAdapter(() => DEMO_DISPENSES, "dispenses"),
  ot_cases:        makeDemoAdapter(() => DEMO_OT_CASES, "ot_cases"),
  ed_visits:       makeDemoAdapter(() => DEMO_ED_VISITS, "ed_visits"),

  appointments:        makeDemoAdapter(() => DEMO_APPOINTMENTS, "appointments"),
  providers:           makeDemoAdapter(() => DEMO_PROVIDERS, "providers"),
  departments:         makeDemoAdapter(() => DEMO_DEPARTMENTS, "departments"),
  charge_items:        makeDemoAdapter(() => DEMO_CHARGE_ITEMS, "charge_items"),
  claims:              makeDemoAdapter(() => DEMO_CLAIMS, "claims"),
  insurance_policies:  makeDemoAdapter(() => DEMO_INSURANCE_POLICIES, "insurance_policies"),

  biomed_assets:      makeDemoAdapter(() => DEMO_BIOMED_ASSETS, "biomed_assets"),
  maintenance_orders: makeDemoAdapter(() => DEMO_MAINTENANCE_ORDERS, "maintenance_orders"),
  diet_orders:        makeDemoAdapter(() => DEMO_DIET_ORDERS, "diet_orders"),
  meal_services:      makeDemoAdapter(() => DEMO_MEAL_SERVICES, "meal_services"),
  housekeeping_tasks: makeDemoAdapter(() => DEMO_HOUSEKEEPING_TASKS, "housekeeping_tasks"),
  linen_cycles:       makeDemoAdapter(() => DEMO_LINEN_CYCLES, "linen_cycles"),
  supply_items:          makeDemoAdapter(() => DEMO_SUPPLY_ITEMS, "supply_items"),
  procurement_orders:         makeDemoAdapter(() => [...DEMO_PROCUREMENT, ...DEMO_STOCK_MOVES], "procurement_orders"),

  portal_messages:     makeDemoAdapter(() => DEMO_PORTAL_MESSAGES, "portal_messages"),
  telehealth_sessions: makeDemoAdapter(() => DEMO_TELEHEALTH_SESSIONS, "telehealth_sessions"),
  interface_messages:  makeDemoAdapter(() => DEMO_INTERFACE_MESSAGES, "interface_messages"),
  interface_endpoints: makeDemoAdapter(() => DEMO_INTERFACE_ENDPOINTS, "interface_endpoints"),

  suppliers:       makeDemoAdapter(() => DEMO_SUPPLIERS, "suppliers"),
  payers:          makeDemoAdapter(() => DEMO_PAYERS, "payers"),
  staff:       makeDemoAdapter(() => DEMO_STAFF, "staff"),
  attendance:      makeDemoAdapter(() => DEMO_ATTENDANCE, "attendance"),
  leave_requests:  makeDemoAdapter(() => DEMO_LEAVE_REQUESTS, "leave_requests"),
  cost_entries:    makeDemoAdapter(() => DEMO_COST_ENTRIES, "cost_entries"),
  facilities:        makeDemoAdapter(() => DEMO_FACILITIES, "facilities"),
  activity_events: makeDemoAdapter(() => DEMO_ACTIVITY_EVENTS, "activity_events"),

  workspace_invitations: makeDemoAdapter(() => []),
  notifications:         makeDemoAdapter(() => []),
};

// ─── Live DataSource ───────────────────────────────────────

const liveDataSource: DataSource = {
  mode: "live",

  patients:            makeSupabaseAdapter("patients"),
  encounters:          makeSupabaseAdapter("encounters"),
  wards:               makeSupabaseAdapter("wards"),
  beds:                makeSupabaseAdapter("beds"),
  vitals:              makeSupabaseAdapter("vitals"),
  clinical_notes:      makeSupabaseAdapter("clinical_notes"),
  diagnoses:           makeSupabaseAdapter("diagnoses"),
  allergies:           makeSupabaseAdapter("allergies"),
  clinical_orders:     makeSupabaseAdapter("clinical_orders"),
  med_administrations: makeSupabaseAdapter("med_administrations"),
  prescriptions:       makeSupabaseAdapter("prescriptions"),
  cdss_alerts:         makeSupabaseAdapter("cdss_alerts"),

  lab_orders:      makeSupabaseAdapter("lab_orders"),
  lab_results:     makeSupabaseAdapter("lab_results"),
  blood_units:     makeSupabaseAdapter("blood_units"),
  imaging_orders:  makeSupabaseAdapter("imaging_orders"),
  pharmacy_stock:  makeSupabaseAdapter("pharmacy_stock"),
  dispenses:       makeSupabaseAdapter("dispenses"),
  ot_cases:        makeSupabaseAdapter("ot_cases"),
  ed_visits:       makeSupabaseAdapter("ed_visits"),

  appointments:        makeSupabaseAdapter("appointments"),
  providers:           makeSupabaseAdapter("providers"),
  departments:         makeSupabaseAdapter("departments"),
  charge_items:        makeSupabaseAdapter("charge_items"),
  claims:              makeSupabaseAdapter("claims"),
  insurance_policies:  makeSupabaseAdapter("insurance_policies"),

  biomed_assets:      makeSupabaseAdapter("biomed_assets"),
  maintenance_orders: makeSupabaseAdapter("maintenance_orders"),
  diet_orders:        makeSupabaseAdapter("diet_orders"),
  meal_services:      makeSupabaseAdapter("meal_services"),
  housekeeping_tasks: makeSupabaseAdapter("housekeeping_tasks"),
  linen_cycles:       makeSupabaseAdapter("linen_cycles"),
  supply_items:          makeSupabaseAdapter("supply_items"),
  procurement_orders:         makeSupabaseAdapter("procurement_orders"),

  portal_messages:     makeSupabaseAdapter("portal_messages"),
  telehealth_sessions: makeSupabaseAdapter("telehealth_sessions"),
  interface_messages:  makeSupabaseAdapter("interface_messages"),
  interface_endpoints: makeSupabaseAdapter("interface_endpoints"),

  suppliers:       makeSupabaseAdapter("suppliers"),
  payers:          makeSupabaseAdapter("payers"),
  staff:       makeSupabaseAdapter("staff"),
  attendance:      makeSupabaseAdapter("attendance"),
  leave_requests:  makeSupabaseAdapter("leave_requests"),
  cost_entries:    makeSupabaseAdapter("cost_entries"),
  facilities:        makeSupabaseAdapter("facilities"),
  activity_events: makeSupabaseAdapter("activity_events"),

  workspace_invitations: makeSupabaseAdapter("workspace_invitations" as never),
  notifications:         makeSupabaseAdapter("notifications" as never),
};

// ─── Public API ────────────────────────────────────────────

export function getDataSource(): DataSource {
  return isDemoMode ? demoDataSource : liveDataSource;
}

export { isDemoMode };
