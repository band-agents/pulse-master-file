/**
 * The patient's own view of their record.
 *
 * Every derivation here answers a question a patient actually asks, in the
 * order they ask it: when am I next seen, what am I supposed to be taking,
 * what did my tests say, and who do I talk to.
 *
 * One rule shapes the whole file, and it is a clinical-safety rule rather
 * than a design preference: a result is never released to a patient with a
 * number and no interpretation. A potassium of 6.9 shown as a red figure to
 * someone sitting at home at eleven at night causes harm and no benefit —
 * they cannot act on it, and the person who can has already been paged. So
 * results are classified into three plain statements, and anything critical
 * says that the care team is dealing with it.
 */

import { useMemo } from "react";
import { useSnapshot, type Snapshot } from "@/platform/data/snapshot";
import { usePersona } from "@/app/context/PersonaContext";

type Patient = Snapshot["patients"][number];
type Appointment = Snapshot["appointments"][number];

/** What a patient is told about a result. Never a raw abnormal number. */
export type ResultRelease = "normal" | "review" | "with_team";

export interface PortalResult {
  id: string;
  panel: string;
  at: string;
  release: ResultRelease;
  /** Analyte-level detail, shown only for results released in full. */
  lines: { analyte: string; value: string; unit: string | null; normal: boolean }[];
}

export interface PortalAction {
  id: string;
  kind: "confirm_appointment" | "unread_message" | "refill_due";
  label: { en: string; ar: string };
  detail: { en: string; ar: string };
  href: string;
}

export interface PortalData {
  patient: Patient | null;
  nextAppointment: Appointment | null;
  upcoming: Appointment[];
  past: Appointment[];
  medicines: Snapshot["prescriptions"];
  results: PortalResult[];
  messages: Snapshot["portalMessages"];
  unreadCount: number;
  careTeam: { id: string; name: string; nameAr: string | null; speciality: string | null }[];
  actions: PortalAction[];
  admitted: Snapshot["encounters"][number] | null;
  loading: boolean;
}

export function usePortal(): PortalData {
  const { persona } = usePersona();
  const { snapshot, loading } = useSnapshot();

  return useMemo(() => {
    const patient =
      snapshot.patients.find((p) => p.id === persona.id) ??
      // A portal with no patient selected would be a blank screen with no way
      // out, so it falls back to the first active record rather than nothing.
      snapshot.patients.find((p) => p.status === "active") ??
      null;

    if (!patient) {
      return {
        patient: null, nextAppointment: null, upcoming: [], past: [], medicines: [],
        results: [], messages: [], unreadCount: 0, careTeam: [], actions: [],
        admitted: null, loading,
      };
    }

    const now = Date.now();

    const mine = snapshot.appointments.filter((a) => a.patient_id === patient.id);
    const upcoming = mine
      .filter((a) => new Date(a.slot_start).getTime() >= now && a.status !== "cancelled")
      .sort((a, b) => +new Date(a.slot_start) - +new Date(b.slot_start));
    const past = mine
      .filter((a) => new Date(a.slot_start).getTime() < now || a.status === "cancelled")
      .sort((a, b) => +new Date(b.slot_start) - +new Date(a.slot_start));

    const medicines = snapshot.prescriptions
      .filter(
        (r) => r.patient_id === patient.id &&
          r.status !== "cancelled" && r.status !== "expired" && r.status !== "draft",
      )
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    // ── Results, classified rather than dumped ──────────────
    const myLabOrders = snapshot.labOrders.filter(
      (o) => o.patient_id === patient.id && (o.status === "verified" || o.status === "resulted"),
    );

    const results: PortalResult[] = myLabOrders
      .map((order) => {
        const lines = snapshot.labResults.filter((r) => r.lab_order_id === order.id);
        const anyCritical = lines.some(
          (r) => r.flag === "critical_high" || r.flag === "critical_low",
        );
        const anyAbnormal = lines.some(
          (r) => r.flag === "high" || r.flag === "low" || r.flag === "abnormal",
        );

        // Only verified results are ever shown at all. A resulted-but-
        // unverified value can still be retracted by the laboratory.
        const release: ResultRelease =
          anyCritical || order.status !== "verified" ? "with_team"
            : anyAbnormal ? "review"
            : "normal";

        return {
          id: order.id,
          panel: order.panel_en,
          at: order.verified_at ?? order.resulted_at ?? order.ordered_at,
          release,
          lines:
            release === "with_team"
              ? []
              : lines.map((r) => ({
                  analyte: r.analyte_en,
                  value: r.value,
                  unit: r.unit,
                  normal: r.flag === "normal" || r.flag === null,
                })),
        };
      })
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));

    const messages = snapshot.portalMessages
      .filter((m) => m.patient_id === patient.id)
      .sort((a, b) => +new Date(b.sent_at) - +new Date(a.sent_at));

    const unreadCount = messages.filter(
      (m) => m.direction === "outbound" && m.status === "unread",
    ).length;

    // The care team is whoever is actually looking after them — the people on
    // their appointments and their open visit, not a directory listing.
    const teamIds = new Set<string>();
    for (const a of upcoming) if (a.provider_id) teamIds.add(a.provider_id);
    for (const a of past.slice(0, 5)) if (a.provider_id) teamIds.add(a.provider_id);
    const encounters = snapshot.encounters.filter((e) => e.patient_id === patient.id);
    const admitted =
      encounters.find((e) => e.status === "in_progress" || e.status === "arrived") ?? null;
    if (admitted?.attending_provider_id) teamIds.add(admitted.attending_provider_id);

    const careTeam = [...teamIds]
      .map((id) => snapshot.providers.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        id: p.id,
        name: p.name_en,
        nameAr: p.name_ar,
        speciality: p.speciality_en,
      }));

    // ── Things the patient has to do ────────────────────────
    const actions: PortalAction[] = [];

    for (const a of upcoming) {
      if (a.status !== "booked") continue;
      const midnightToday = new Date();
      midnightToday.setHours(0, 0, 0, 0);
      const midnightSlot = new Date(a.slot_start);
      midnightSlot.setHours(0, 0, 0, 0);
      const days = Math.round((+midnightSlot - +midnightToday) / 86_400_000);
      if (days > 7) continue;
      actions.push({
        id: `confirm-${a.id}`,
        kind: "confirm_appointment",
        label: { en: "Confirm your appointment", ar: "أكّد موعدك" },
        detail: {
          en: `${a.department_name} with ${a.provider_name}, ${
            days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`
          }`,
          ar: `${a.department_name} مع ${a.provider_name}، ${
            days === 0 ? "اليوم" : days === 1 ? "غداً" : `بعد ${days} أيام`
          }`,
        },
        href: "/portal/visits",
      });
    }

    if (unreadCount > 0) {
      actions.push({
        id: "unread",
        kind: "unread_message",
        label: {
          en: `${unreadCount} new message${unreadCount === 1 ? "" : "s"} from your care team`,
          ar: `${unreadCount} رسالة جديدة من فريق الرعاية`,
        },
        detail: { en: "Read and reply", ar: "اقرأ ورد" },
        href: "/portal/messages",
      });
    }

    for (const m of medicines) {
      if (m.refills_allowed <= m.refills_used) continue;
      if (m.status !== "dispensed") continue;
      actions.push({
        id: `refill-${m.id}`,
        kind: "refill_due",
        label: { en: `Request more ${m.drug_name_en}`, ar: `اطلب المزيد من ${m.drug_name_ar || m.drug_name_en}` },
        detail: {
          en: `${m.refills_allowed - m.refills_used} repeat${m.refills_allowed - m.refills_used === 1 ? "" : "s"} left`,
          ar: `متبقٍ ${m.refills_allowed - m.refills_used} صرفة`,
        },
        href: "/portal/medicines",
      });
    }

    return {
      patient,
      nextAppointment: upcoming[0] ?? null,
      upcoming, past, medicines, results, messages, unreadCount,
      careTeam, actions, admitted, loading,
    };
  }, [snapshot, persona.id, loading]);
}
