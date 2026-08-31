/**
 * What a doctor's day actually looks like, derived from the record.
 *
 * The design of this file follows what clinical informatics research
 * consistently finds about physician information needs, rather than what an
 * EHR menu usually offers:
 *
 * 1. Results review is the single most-used function in any EHR, and the
 *    dominant complaint about it is that it answers "what exists" when the
 *    question is "WHAT CHANGED since I last looked". So `changes` is a first-
 *    class concept here, not a notification badge.
 *
 * 2. Patient lists are read in acuity order, not alphabetical order. A ward
 *    round starts with the sickest patient. So the rounding list is ranked by
 *    NEWS2 with unacknowledged critical results promoted above it, because a
 *    critical potassium on a well-looking patient kills faster than a mildly
 *    raised score.
 *
 * 3. Inbasket volume is the most-cited driver of physician burnout, and the
 *    reason is undifferentiation: a critical lab and a form request arrive in
 *    the same list looking the same. So the inbox here is triaged by clinical
 *    consequence and says, for each item, what it is waiting for.
 *
 * Everything is derived from one snapshot. No separate fetch, no second
 * moment in time, no possibility of the list disagreeing with the chart.
 */

import { useMemo } from "react";
import { useSnapshot, type Snapshot, minutesSince } from "@/platform/data/snapshot";
import { usePersona } from "@/app/context/PersonaContext";
import { computeNews2, computeQSofa, ageFromDob } from "@/platform/clinical/scores";
import type { Tone } from "@/platform/ui";

type Encounter = Snapshot["encounters"][number];
type Provider = Snapshot["providers"][number];

/** How long back "recent" reaches on the rounding list. One shift. */
const RECENT_HOURS = 12;

export interface ChangeItem {
  kind: "result" | "vitals" | "order" | "note" | "imaging";
  at: string;
  label: { en: string; ar: string };
  tone: Tone;
}

export interface RoundsPatient {
  encounter: Encounter;
  patientId: string;
  name: string;
  nameAr: string | null;
  mrn: string;
  age: number;
  sex: string;
  location: string;
  /** NEWS2 from the most recent observation set, null if never observed. */
  news2: { score: number; band: "low" | "low_medium" | "medium" | "high" } | null;
  /** Direction of travel against the previous set — the number alone hides it. */
  trend: "up" | "down" | "flat" | null;
  minutesSinceObs: number | null;
  qsofaPositive: boolean;
  activeProblems: string[];
  severeAllergies: string[];
  /** Unacknowledged critical results. The reason to look at this patient now. */
  criticalResults: number;
  changes: ChangeItem[];
  /** Composite rank. Higher sorts first. */
  priority: number;
}

export interface InboxItem {
  id: string;
  kind: "critical_result" | "abnormal_result" | "message" | "unsigned_note" | "refill" | "imaging_report";
  at: string;
  patientId: string;
  patientName: string;
  title: { en: string; ar: string };
  detail: { en: string; ar: string };
  /** What this item is waiting for from the reader. */
  action: { en: string; ar: string };
  tone: Tone;
  /** Higher sorts first. */
  urgency: number;
  href: string;
}

export interface ClinicianData {
  provider: Provider | null;
  rounds: RoundsPatient[];
  inbox: InboxItem[];
  today: Snapshot["appointments"];
  upcomingCount: number;
  loading: boolean;
  snapshot: Snapshot;
}

const BAND_RANK = { low: 0, low_medium: 1, medium: 2, high: 3 } as const;

function isRecent(iso: string | null | undefined, hours = RECENT_HOURS): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < hours * 3_600_000;
}

export function useClinician(): ClinicianData {
  const { persona } = usePersona();
  const { snapshot, loading } = useSnapshot();

  return useMemo(() => {
    const provider = snapshot.providers.find((p) => p.id === persona.id) ?? null;
    const pid = provider?.id ?? null;

    // ── Whose patients are mine? ────────────────────────────
    // Attending clinician first. Without that, a clinician with no admissions
    // opens an empty workspace and concludes the software is broken, so an
    // unmatched persona falls back to the whole active census.
    const openEncounters = snapshot.encounters.filter(
      (e) => e.status === "in_progress" || e.status === "arrived",
    );
    const mine = pid
      ? openEncounters.filter((e) => e.attending_provider_id === pid)
      : [];
    const census = mine.length > 0 ? mine : openEncounters;

    // ── Indexes, built once ─────────────────────────────────
    const vitalsByEnc = new Map<string, Snapshot["vitals"]>();
    for (const v of snapshot.vitals) {
      const list = vitalsByEnc.get(v.encounter_id) ?? [];
      list.push(v);
      vitalsByEnc.set(v.encounter_id, list);
    }
    for (const list of vitalsByEnc.values()) {
      list.sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at));
    }

    const labOrderById = new Map(snapshot.labOrders.map((o) => [o.id, o]));

    const resultsByPatient = new Map<string, Snapshot["labResults"]>();
    for (const r of snapshot.labResults) {
      const list = resultsByPatient.get(r.patient_id) ?? [];
      list.push(r);
      resultsByPatient.set(r.patient_id, list);
    }

    // ── Rounding list ───────────────────────────────────────
    const rounds: RoundsPatient[] = census.map((enc) => {
      const patient = snapshot.patients.find((p) => p.id === enc.patient_id);
      const obs = vitalsByEnc.get(enc.id) ?? [];
      const latest = obs[0];
      const previous = obs[1];

      const news2 = latest
        ? computeNews2({
            respiratory_rate: latest.respiratory_rate,
            spo2: latest.spo2,
            on_oxygen: latest.on_oxygen,
            temperature_c: latest.temperature_c,
            systolic_bp: latest.systolic_bp,
            heart_rate: latest.heart_rate,
            consciousness: latest.consciousness,
          })
        : null;

      const prevScore = previous
        ? computeNews2({
            respiratory_rate: previous.respiratory_rate,
            spo2: previous.spo2,
            on_oxygen: previous.on_oxygen,
            temperature_c: previous.temperature_c,
            systolic_bp: previous.systolic_bp,
            heart_rate: previous.heart_rate,
            consciousness: previous.consciousness,
          }).score
        : null;

      const trend: RoundsPatient["trend"] =
        news2 === null || prevScore === null
          ? null
          : news2.score > prevScore ? "up"
          : news2.score < prevScore ? "down"
          : "flat";

      const qsofa = latest
        ? computeQSofa({
            respiratory_rate: latest.respiratory_rate,
            spo2: latest.spo2,
            on_oxygen: latest.on_oxygen,
            temperature_c: latest.temperature_c,
            systolic_bp: latest.systolic_bp,
            heart_rate: latest.heart_rate,
            consciousness: latest.consciousness,
          })
        : { positive: false };

      const patientResults = resultsByPatient.get(enc.patient_id) ?? [];
      const criticalResults = patientResults.filter(
        (r) => (r.flag === "critical_high" || r.flag === "critical_low") && !r.critical_notified_at,
      ).length;

      // ── What changed on this patient in the last shift ────
      const changes: ChangeItem[] = [];

      for (const r of patientResults) {
        if (!isRecent(r.resulted_at)) continue;
        if (r.flag === "normal" || r.flag === null) continue;
        const critical = r.flag === "critical_high" || r.flag === "critical_low";
        changes.push({
          kind: "result",
          at: r.resulted_at,
          label: {
            en: `${r.analyte_en} ${r.value}${r.unit ? ` ${r.unit}` : ""}`,
            ar: `${r.analyte_ar || r.analyte_en} ${r.value}${r.unit ? ` ${r.unit}` : ""}`,
          },
          tone: critical ? "critical" : "warning",
        });
      }

      if (latest && isRecent(latest.recorded_at) && news2 && news2.score >= 5) {
        changes.push({
          kind: "vitals",
          at: latest.recorded_at,
          label: {
            en: `NEWS2 ${news2.score}${trend === "up" ? " and rising" : ""}`,
            ar: `NEWS2 ${news2.score}${trend === "up" ? " ويرتفع" : ""}`,
          },
          tone: news2.score >= 7 ? "critical" : "warning",
        });
      }

      for (const img of snapshot.imagingOrders) {
        if (img.patient_id !== enc.patient_id) continue;
        if (!isRecent(img.reported_at)) continue;
        changes.push({
          kind: "imaging",
          at: img.reported_at as string,
          label: {
            en: `${img.procedure_en} reported`,
            ar: `صدر تقرير ${img.procedure_ar || img.procedure_en}`,
          },
          tone: img.critical_finding ? "critical" : "info",
        });
      }

      for (const n of snapshot.clinicalNotes) {
        if (n.encounter_id !== enc.id) continue;
        if (!isRecent(n.signed_at ?? n.created_at)) continue;
        changes.push({
          kind: "note",
          at: (n.signed_at ?? n.created_at) as string,
          label: {
            en: `${n.title_en} — ${n.author_name}`,
            ar: `${n.title_ar || n.title_en} — ${n.author_name}`,
          },
          tone: "neutral",
        });
      }

      changes.sort((a, b) => +new Date(b.at) - +new Date(a.at));

      const problems = snapshot.diagnoses
        .filter((d) => d.patient_id === enc.patient_id && d.status === "active")
        .map((d) => d.description_en);

      const severeAllergies = snapshot.allergies
        .filter(
          (a) => a.patient_id === enc.patient_id && a.status === "active" &&
            (a.severity === "severe" || a.severity === "fatal"),
        )
        .map((a) => a.substance_en);

      // Ranking. A critical result outweighs any score, because it is the
      // thing most likely to be both actionable and time-limited; after that
      // it is NEWS2 band, then qSOFA, then how stale the observations are.
      const priority =
        criticalResults * 1000 +
        (news2 ? BAND_RANK[news2.band] * 100 : 0) +
        (news2?.score ?? 0) * 4 +
        (qsofa.positive ? 60 : 0) +
        (trend === "up" ? 25 : 0) +
        Math.min(minutesSince(latest?.recorded_at) / 60, 24);

      return {
        encounter: enc,
        patientId: enc.patient_id,
        name: enc.patient_name,
        nameAr: patient?.name_ar ?? null,
        mrn: enc.patient_mrn,
        age: patient ? ageFromDob(patient.date_of_birth) : 0,
        sex: patient?.sex ?? "unknown",
        location: enc.bed_label
          ? `${enc.department_name ?? ""} · ${enc.bed_label}`
          : enc.department_name ?? "",
        news2: news2 ? { score: news2.score, band: news2.band } : null,
        trend,
        minutesSinceObs: latest ? minutesSince(latest.recorded_at) : null,
        qsofaPositive: qsofa.positive,
        activeProblems: problems,
        severeAllergies,
        criticalResults,
        changes,
        priority,
      };
    });

    rounds.sort((a, b) => b.priority - a.priority);

    // ── Inbox ───────────────────────────────────────────────
    const inbox: InboxItem[] = [];

    for (const r of snapshot.labResults) {
      const order = labOrderById.get(r.lab_order_id);
      if (pid && order && order.ordered_by !== provider?.name_en) continue;

      const critical = r.flag === "critical_high" || r.flag === "critical_low";
      const abnormal = r.flag === "high" || r.flag === "low" || r.flag === "abnormal";
      if (!critical && !abnormal) continue;
      if (critical && r.critical_notified_at) continue;
      if (!isRecent(r.resulted_at, 72)) continue;

      const patient = snapshot.patients.find((p) => p.id === r.patient_id);
      inbox.push({
        id: `res-${r.id}`,
        kind: critical ? "critical_result" : "abnormal_result",
        at: r.resulted_at,
        patientId: r.patient_id,
        patientName: patient?.name_en ?? "",
        title: {
          en: `${r.analyte_en} ${r.value}${r.unit ? ` ${r.unit}` : ""}`,
          ar: `${r.analyte_ar || r.analyte_en} ${r.value}${r.unit ? ` ${r.unit}` : ""}`,
        },
        detail: {
          en: order?.panel_en ?? "",
          ar: order?.panel_ar || order?.panel_en || "",
        },
        action: critical
          ? { en: "Acknowledge and act — this has not been passed on", ar: "أقرّ وتصرّف — لم يُبلّغ به أحد بعد" }
          : { en: "Review", ar: "مراجعة" },
        tone: critical ? "critical" : "warning",
        urgency: critical ? 1000 : 300,
        href: `/clinic/${r.patient_id}`,
      });
    }

    for (const m of snapshot.portalMessages) {
      if (m.direction !== "inbound") continue;
      if (m.status !== "unread") continue;
      if (pid && m.provider_id && m.provider_id !== pid) continue;
      inbox.push({
        id: `msg-${m.id}`,
        kind: m.category === "prescription_refill" ? "refill" : "message",
        at: m.sent_at,
        patientId: m.patient_id,
        patientName: m.patient_name,
        title: { en: m.subject_en, ar: m.subject_ar || m.subject_en },
        detail: { en: m.body_en.slice(0, 120), ar: (m.body_ar || m.body_en).slice(0, 120) },
        action: m.category === "prescription_refill"
          ? { en: "Approve or decline the refill", ar: "الموافقة على إعادة الصرف أو رفضها" }
          : { en: "Reply to the patient", ar: "الرد على المريض" },
        tone: m.category === "prescription_refill" ? "info" : "neutral",
        urgency: m.category === "prescription_refill" ? 200 : 120,
        href: `/clinic/${m.patient_id}`,
      });
    }

    for (const n of snapshot.clinicalNotes) {
      if (n.status !== "draft") continue;
      if (pid && n.author_id !== pid) continue;
      inbox.push({
        id: `note-${n.id}`,
        kind: "unsigned_note",
        at: n.created_at,
        patientId: n.patient_id,
        patientName: snapshot.patients.find((p) => p.id === n.patient_id)?.name_en ?? "",
        title: { en: n.title_en, ar: n.title_ar || n.title_en },
        detail: {
          en: "Unsigned — not yet part of the record",
          ar: "غير موقّعة — ليست جزءاً من السجل بعد",
        },
        action: { en: "Sign or discard", ar: "وقّع أو احذف" },
        tone: "warning",
        urgency: 250,
        href: `/clinic/${n.patient_id}`,
      });
    }

    for (const img of snapshot.imagingOrders) {
      if (img.status !== "reported" && img.status !== "verified") continue;
      if (!isRecent(img.reported_at, 72)) continue;
      if (!img.critical_finding) continue;
      if (img.critical_notified_at) continue;
      inbox.push({
        id: `img-${img.id}`,
        kind: "imaging_report",
        at: img.reported_at as string,
        patientId: img.patient_id,
        patientName: img.patient_name,
        title: {
          en: `${img.procedure_en} — critical finding`,
          ar: `${img.procedure_ar || img.procedure_en} — نتيجة حرجة`,
        },
        detail: { en: img.impression_en ?? "", ar: img.impression_en ?? "" },
        action: { en: "Read the report and act", ar: "اقرأ التقرير وتصرّف" },
        tone: "critical",
        urgency: 900,
        href: `/clinic/${img.patient_id}`,
      });
    }

    inbox.sort((a, b) => b.urgency - a.urgency || +new Date(b.at) - +new Date(a.at));

    // ── Today's clinic ──────────────────────────────────────
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const today = snapshot.appointments
      .filter((a) => {
        if (pid && a.provider_id !== pid) return false;
        const t = new Date(a.slot_start).getTime();
        return t >= startOfDay.getTime() && t < endOfDay.getTime();
      })
      .sort((a, b) => +new Date(a.slot_start) - +new Date(b.slot_start));

    const upcomingCount = snapshot.appointments.filter(
      (a) =>
        (!pid || a.provider_id === pid) &&
        new Date(a.slot_start).getTime() >= endOfDay.getTime() &&
        a.status !== "cancelled",
    ).length;

    return { provider, rounds, inbox, today, upcomingCount, loading, snapshot };
  }, [snapshot, persona.id, loading]);
}
