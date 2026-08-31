/**
 * Nursing Care — الرعاية التمريضية
 *
 * The ward round view: observations, escalation status and outstanding doses,
 * organised by ward. NEWS2 is computed from the latest observation set rather
 * than read from the row, so the board can never show a score that disagrees
 * with the numbers printed beside it.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ClipboardCheck, Activity, Syringe, AlertTriangle, Clock, Utensils } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, Pill, EmptyState, LoadingRow,
  useCollection, fmtAgo, fmtTime, minutesSince, cardCls, serif, TONE_PILL, type Tone,
} from "@/platform/ui";
import { computeNews2, NEWS2_RESPONSE } from "@/platform/clinical/scores";

export default function NursingCare() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: encounters, loading } = useCollection("encounters");
  const { rows: vitals } = useCollection("vitals");
  const { rows: mar } = useCollection("med_administrations");
  const { rows: notes } = useCollection("clinical_notes");
  const { rows: diets } = useCollection("diet_orders");
  const [wardFilter, setWardFilter] = useState("");

  /** One row per inpatient: latest observations, score, and what is outstanding. */
  const patients = useMemo(() => {
    const inpatients = encounters.filter(
      (e) => (e.status === "in_progress" || e.status === "arrived") && e.ward_id,
    );
    return inpatients.map((e) => {
      const obs = vitals
        .filter((v) => v.encounter_id === e.id)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      const latest = obs[0];
      const score = latest ? computeNews2(latest) : null;
      const doses = mar.filter((m) => m.encounter_id === e.id);
      return {
        encounter: e,
        latest,
        score,
        obsAgeMinutes: latest ? minutesSince(latest.recorded_at) : null,
        due: doses.filter((m) => m.status === "due").length,
        missed: doses.filter((m) => m.status === "missed").length,
        lastNote: notes
          .filter((n) => n.encounter_id === e.id && n.note_type === "nursing")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0],
        diet: diets.find((d) => d.encounter_id === e.id && d.status === "active"),
      };
    });
  }, [encounters, vitals, mar, notes, diets]);

  const wards = useMemo(
    () => [...new Set(patients.map((p) => p.encounter.ward_id))].filter(Boolean) as string[],
    [patients],
  );

  const wardName = (id: string) => patients.find((p) => p.encounter.ward_id === id)?.encounter.department_name ?? id;

  const filtered = wardFilter ? patients.filter((p) => p.encounter.ward_id === wardFilter) : patients;

  const escalating = patients.filter((p) => p.score && (p.score.band === "medium" || p.score.band === "high"));
  const obsOverdue = patients.filter((p) => {
    if (!p.score || p.obsAgeMinutes === null) return false;
    // The band dictates the observation interval; overdue is measured against it.
    const limit = p.score.band === "high" ? 60 : p.score.band === "medium" ? 60 : p.score.band === "low_medium" ? 360 : 720;
    return p.obsAgeMinutes > limit;
  });
  const dosesDue = patients.reduce((s, p) => s + p.due, 0);
  const dosesMissed = patients.reduce((s, p) => s + p.missed, 0);

  if (loading) return <Page><PageHeader title="Nursing Care" titleAr="الرعاية التمريضية" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Nursing Care"
        titleAr="الرعاية التمريضية"
        subtitle="Ward round view: observations, escalation and outstanding doses for every inpatient."
        subtitleAr="عرض الجولة التمريضية: القياسات والتصعيد والجرعات القائمة لكل مريض منوم."
        meta={[
          { label: "Inpatients", labelAr: "المنومون", value: String(patients.length) },
          { label: "Needing escalation", labelAr: "بحاجة لتصعيد", value: String(escalating.length), tone: escalating.length > 0 ? "critical" : "success" },
          { label: "Observations overdue", labelAr: "قياسات متأخرة", value: String(obsOverdue.length), tone: obsOverdue.length > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Inpatients" labelAr="المنومون" value={patients.length} icon={ClipboardCheck} tone="brand" />
        <StatTile
          label="Needing escalation" labelAr="بحاجة لتصعيد" value={escalating.length}
          sub="NEWS2 5 or above" subAr="مؤشر إنذار ٥ فأعلى"
          icon={Activity} tone={escalating.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Observations overdue" labelAr="قياسات متأخرة" value={obsOverdue.length}
          sub="Past the interval their score sets" subAr="تجاوزت الفترة التي تحددها الدرجة"
          icon={Clock} tone={obsOverdue.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Doses outstanding" labelAr="جرعات قائمة" value={dosesDue}
          sub={dosesMissed > 0 ? `${dosesMissed} recorded as missed` : "None missed"}
          subAr={dosesMissed > 0 ? `${dosesMissed} مسجلة كفائتة` : "لا يوجد فائت"}
          icon={Syringe} tone={dosesMissed > 0 ? "critical" : dosesDue > 0 ? "info" : "success"} href="/mar"
        />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button" onClick={() => setWardFilter("")}
          className={`px-2.5 h-8 rounded-xl text-caption font-medium transition-colors ${!wardFilter ? TONE_PILL.brand : "text-muted-foreground hover:bg-muted/60"}`}
        >
          {ar ? "كل الأجنحة" : "All wards"} <span className="tabular-nums opacity-70 ms-1">{patients.length}</span>
        </button>
        {wards.map((w) => {
          const n = patients.filter((p) => p.encounter.ward_id === w).length;
          const active = wardFilter === w;
          return (
            <button
              key={w} type="button" onClick={() => setWardFilter(active ? "" : w)}
              className={`px-2.5 h-8 rounded-xl text-caption font-medium transition-colors ${active ? TONE_PILL.brand : "text-muted-foreground hover:bg-muted/60"}`}
            >
              {wardName(w)} <span className="tabular-nums opacity-70 ms-1">{n}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Section><EmptyState icon={ClipboardCheck} title="No inpatients in this ward" titleAr="لا يوجد منومون في هذا الجناح" /></Section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered
            .sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1))
            .map((p) => {
              const band = p.score?.band;
              const tone: Tone = band === "high" ? "critical" : band === "medium" ? "warning" : band === "low_medium" ? "info" : "success";
              const response = band ? NEWS2_RESPONSE[band] : null;
              return (
                <div key={p.encounter.id} className={`${cardCls} p-4 space-y-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/chart/${p.encounter.patient_id}`} className="text-body-lg font-semibold text-foreground hover:text-brand-ink transition-colors" style={serif}>
                        {p.encounter.patient_name}
                      </Link>
                      <div className="text-micro text-muted-foreground tabular-nums">
                        {p.encounter.patient_mrn} · {p.encounter.bed_label ?? "—"} · {p.encounter.department_name}
                      </div>
                    </div>
                    {p.score && (
                      <div className="text-end shrink-0">
                        <span className={`inline-grid place-items-center w-10 h-10 rounded-xl text-title font-bold tabular-nums ${TONE_PILL[tone]}`} style={serif}>
                          {p.score.score}
                        </span>
                        <div className="text-micro text-muted-foreground mt-0.5">NEWS2</div>
                      </div>
                    )}
                  </div>

                  {p.latest && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {[
                        ["BP", "ضغط", p.latest.systolic_bp && p.latest.diastolic_bp ? `${p.latest.systolic_bp}/${p.latest.diastolic_bp}` : null],
                        ["HR", "نبض", p.latest.heart_rate],
                        ["RR", "تنفس", p.latest.respiratory_rate],
                        ["SpO₂", "أكسجين", p.latest.spo2 ? `${p.latest.spo2}%${p.latest.on_oxygen ? " O₂" : ""}` : null],
                        ["T", "حرارة", p.latest.temperature_c ? `${p.latest.temperature_c}°` : null],
                      ].filter(([, , v]) => v !== null && v !== undefined).map(([en, arLabel, v]) => (
                        <span key={String(en)} className="text-caption">
                          <span className="text-muted-foreground">{ar ? arLabel : en} </span>
                          <span className="text-foreground font-medium tabular-nums">{String(v)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {response && (
                    <div className={`rounded-lg px-3 py-2 ${TONE_PILL[tone]}`}>
                      <div className="text-caption font-medium">{ar ? response.frequency_ar : response.frequency_en}</div>
                      <div className="text-micro opacity-90 mt-0.5">{ar ? response.response_ar : response.response_en}</div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.latest && (
                      <Pill tone={p.obsAgeMinutes !== null && p.obsAgeMinutes > 240 ? "warning" : "neutral"} icon={Clock}>
                        {ar ? "آخر قياس" : "obs"} {fmtAgo(p.latest.recorded_at, ar)}
                      </Pill>
                    )}
                    {p.due > 0 && <Pill tone="info" icon={Syringe}>{p.due} {ar ? "جرعة مستحقة" : "due"}</Pill>}
                    {p.missed > 0 && <Pill tone="critical" icon={AlertTriangle}>{p.missed} {ar ? "فائتة" : "missed"}</Pill>}
                    {p.encounter.isolation_required && <Pill tone="critical">{ar ? "عزل" : "Isolation"}</Pill>}
                    {p.diet && (
                      <Pill tone={p.diet.diet_type === "npo" ? "warning" : "neutral"} icon={Utensils}>
                        {p.diet.diet_type === "npo" ? (ar ? "صائم" : "NPO") : p.diet.diet_type}
                      </Pill>
                    )}
                  </div>

                  {p.lastNote && (
                    <div className="pt-2 border-t border-border/25">
                      <div className="text-micro text-muted-foreground">
                        {ar ? "آخر ملاحظة تمريضية" : "Last nursing note"} · {p.lastNote.author_name} · {fmtTime(p.lastNote.created_at, ar)}
                      </div>
                      <p className="text-caption text-foreground/80 mt-1 line-clamp-2">
                        {ar ? (p.lastNote.body_ar ?? p.lastNote.body_en) : p.lastNote.body_en}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </Page>
  );
}
