/**
 * Hospital snapshot.
 *
 * The Hub shows sixteen module cards, each with live numbers. Letting every
 * card fetch for itself would mean sixteen round trips for one screen, and
 * sixteen different moments in time on the same page — a bed count from one
 * second and an ED count from another do not add up, and someone will
 * eventually make a capacity decision on the difference.
 *
 * So the snapshot is loaded once, in one pass, and every card derives its
 * metrics from it. One load, one instant, one consistent picture.
 *
 * The same snapshot backs the analytics layer's datasets, which is why it
 * carries whole collections rather than pre-aggregated counts.
 */

import { useEffect, useState, useMemo } from "react";
import { getDataSource } from "@/platform/data/repository";
import { subscribe } from "@/platform/data/store";
import { useAuth } from "@/app/context/AuthContext";
import type { Database } from "@/domain/types";

type T<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];

export interface Snapshot {
  /* Care */
  patients: T<"patients">[];
  encounters: T<"encounters">[];
  wards: T<"wards">[];
  beds: T<"beds">[];
  vitals: T<"vitals">[];
  clinicalNotes: T<"clinical_notes">[];
  diagnoses: T<"diagnoses">[];
  allergies: T<"allergies">[];
  orders: T<"clinical_orders">[];
  medAdministrations: T<"med_administrations">[];
  prescriptions: T<"prescriptions">[];
  alerts: T<"cdss_alerts">[];
  edVisits: T<"ed_visits">[];
  otCases: T<"ot_cases">[];

  /* Diagnostics */
  labOrders: T<"lab_orders">[];
  labResults: T<"lab_results">[];
  bloodUnits: T<"blood_units">[];
  imagingOrders: T<"imaging_orders">[];

  /* Pharmacy */
  pharmacyStock: T<"pharmacy_stock">[];
  dispenses: T<"dispenses">[];

  /* Scheduling */
  appointments: T<"appointments">[];
  providers: T<"providers">[];
  departments: T<"departments">[];

  /* Revenue */
  charges: T<"charge_items">[];
  claims: T<"claims">[];
  policies: T<"insurance_policies">[];

  /* Operations */
  biomedAssets: T<"biomed_assets">[];
  maintenanceOrders: T<"maintenance_orders">[];
  dietOrders: T<"diet_orders">[];
  mealServices: T<"meal_services">[];
  housekeeping: T<"housekeeping_tasks">[];
  linen: T<"linen_cycles">[];
  stockItems: T<"supply_items">[];
  procurement: T<"procurement_orders">[];

  /* Workforce */
  staff: T<"staff">[];
  attendance: T<"attendance">[];
  leave: T<"leave_requests">[];

  /* Connectivity */
  portalMessages: T<"portal_messages">[];
  telehealth: T<"telehealth_sessions">[];
  interfaceEndpoints: T<"interface_endpoints">[];
  interfaceMessages: T<"interface_messages">[];

  suppliers: T<"suppliers">[];
  payers: T<"payers">[];
  /* Shared */
  facilities: T<"facilities">[];
  costEntries: T<"cost_entries">[];
  activity: T<"activity_events">[];
}

/** An empty snapshot, so consumers never branch on undefined. */
export const EMPTY_SNAPSHOT: Snapshot = {
  patients: [], encounters: [], wards: [], beds: [], vitals: [],
  clinicalNotes: [], diagnoses: [], allergies: [], orders: [],
  medAdministrations: [], prescriptions: [], alerts: [], edVisits: [], otCases: [],
  labOrders: [], labResults: [], bloodUnits: [], imagingOrders: [],
  pharmacyStock: [], dispenses: [],
  appointments: [], providers: [], departments: [],
  charges: [], claims: [], policies: [],
  biomedAssets: [], maintenanceOrders: [], dietOrders: [], mealServices: [],
  housekeeping: [], linen: [], stockItems: [], procurement: [],
  staff: [], attendance: [], leave: [],
  portalMessages: [], telehealth: [], interfaceEndpoints: [], interfaceMessages: [],
  suppliers: [], payers: [],
  facilities: [], costEntries: [], activity: [],
};

/** Snapshot key → repository table. The one place the mapping is written. */
const SOURCES = {
  patients: "patients", encounters: "encounters", wards: "wards", beds: "beds",
  vitals: "vitals", clinicalNotes: "clinical_notes", diagnoses: "diagnoses",
  allergies: "allergies", orders: "clinical_orders",
  medAdministrations: "med_administrations", prescriptions: "prescriptions",
  alerts: "cdss_alerts", edVisits: "ed_visits", otCases: "ot_cases",
  labOrders: "lab_orders", labResults: "lab_results", bloodUnits: "blood_units",
  imagingOrders: "imaging_orders", pharmacyStock: "pharmacy_stock",
  dispenses: "dispenses", appointments: "appointments", providers: "providers",
  departments: "departments", charges: "charge_items", claims: "claims",
  policies: "insurance_policies", biomedAssets: "biomed_assets",
  maintenanceOrders: "maintenance_orders", dietOrders: "diet_orders",
  mealServices: "meal_services", housekeeping: "housekeeping_tasks",
  linen: "linen_cycles", stockItems: "supply_items", procurement: "procurement_orders",
  staff: "staff", attendance: "attendance", leave: "leave_requests",
  portalMessages: "portal_messages", telehealth: "telehealth_sessions",
  interfaceEndpoints: "interface_endpoints", interfaceMessages: "interface_messages",
  suppliers: "suppliers", payers: "payers",
  facilities: "facilities", costEntries: "cost_entries", activity: "activity_events",
} as const satisfies Record<keyof Snapshot, string>;

export interface SnapshotState {
  snapshot: Snapshot;
  loading: boolean;
  /** Collections that failed, by snapshot key. One bad table must not blank
   *  the whole Hub — the rest of the hospital is still running. */
  failed: string[];
  /** When the snapshot was taken; every number on screen is from this instant. */
  takenAt: Date | null;
  reload: () => void;
}

/**
 * Load every collection once. Failures are collected rather than thrown:
 * a Hub that renders fifteen working cards and one marked unavailable is
 * more useful than an error page.
 */
export function useSnapshot(): SnapshotState {
  const { workspace } = useAuth();
  // Demo mode has no workspace id; the repository accepts "demo" directly.
  const wsId = workspace?.id ?? "demo";

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [takenAt, setTakenAt] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const ds = getDataSource();
    const keys = Object.keys(SOURCES) as (keyof Snapshot)[];

    Promise.all(
      keys.map(async (key) => {
        const table = SOURCES[key] as keyof typeof ds;
        try {
          const adapter = ds[table] as { list: (w: string) => Promise<unknown[]> };
          return { key, rows: await adapter.list(wsId), ok: true as const };
        } catch {
          return { key, rows: [] as unknown[], ok: false as const };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next = { ...EMPTY_SNAPSHOT } as Record<string, unknown[]>;
      const bad: string[] = [];
      for (const r of results) {
        next[r.key] = r.rows;
        if (!r.ok) bad.push(r.key);
      }
      setSnapshot(next as unknown as Snapshot);
      setFailed(bad);
      setTakenAt(new Date());
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [wsId, nonce]);

  // Any local write re-reads the snapshot. This is what makes the three
  // surfaces feel like one hospital: a patient booking in the portal shows up
  // on the clinic list and the ward board without anyone pressing refresh,
  // including when those screens are open in a different browser tab.
  useEffect(() => subscribe(() => setNonce((n) => n + 1)), []);

  return useMemo(
    () => ({ snapshot, loading, failed, takenAt, reload: () => setNonce((n) => n + 1) }),
    [snapshot, loading, failed, takenAt],
  );
}

// ─── Derivations shared across modules ────────────────────
// Metrics that more than one card needs live here rather than being
// recomputed slightly differently in two manifests.

/** Minutes elapsed since an ISO timestamp. */
export function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

/** Beds broken down by state, with occupancy as a whole percentage. */
export function bedSummary(s: Snapshot) {
  const total = s.beds.length;
  const by = (st: string) => s.beds.filter((b) => b.status === st).length;
  const occupied = by("occupied");
  return {
    total, occupied,
    available: by("available"),
    cleaning: by("cleaning"),
    blocked: by("blocked"),
    reserved: by("reserved"),
    pct: total > 0 ? Math.round((occupied / total) * 100) : 0,
  };
}

/** Patients physically in the emergency department right now. */
export function edLive(s: Snapshot) {
  return s.edVisits.filter((v) => v.status !== "departed" && v.status !== "left_without_being_seen");
}

/** The latest observation set per encounter — the basis of every NEWS2 view. */
export function latestVitalsByEncounter(s: Snapshot) {
  const latest = new Map<string, Snapshot["vitals"][number]>();
  for (const v of s.vitals) {
    const prev = latest.get(v.encounter_id);
    if (!prev || new Date(v.recorded_at) > new Date(prev.recorded_at)) latest.set(v.encounter_id, v);
  }
  return latest;
}
