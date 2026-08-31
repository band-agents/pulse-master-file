/**
 * Emergency Department Tracker — متابعة الطوارئ
 *
 * The board the department runs off. It is organised by physical area rather
 * than by status, because that is how the department is actually staffed —
 * the nurse in charge of majors needs to see majors, not every triage-3 in
 * the building.
 *
 * Breach state is computed from arrival time against the triage target, not
 * stored, so it stays true as the clock moves without anything rewriting rows.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Siren, Ambulance, Clock, AlertTriangle, LogOut, BedDouble, Activity } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, Pill, EmptyState, LoadingRow,
  useCollection, fmtDuration, fmtTime, minutesSince, cardCls, serif,
  TONE_PILL, TONE_DOT, type Tone,
} from "@/platform/ui";
import { ESI_LEVELS, esiLevel, isTriageBreached, computeNews2 } from "@/platform/clinical/scores";

const AREAS: { id: string; en: string; ar: string; tone: Tone }[] = [
  { id: "resus",       en: "Resus",       ar: "الإنعاش",       tone: "critical" },
  { id: "majors",      en: "Majors",      ar: "الحالات الكبرى", tone: "warning" },
  { id: "minors",      en: "Minors",      ar: "الحالات الصغرى", tone: "info" },
  { id: "fast_track",  en: "Fast track",  ar: "المسار السريع",  tone: "info" },
  { id: "paeds",       en: "Paediatrics", ar: "الأطفال",       tone: "info" },
  { id: "observation", en: "Observation", ar: "الملاحظة",      tone: "neutral" },
  { id: "waiting",     en: "Waiting",     ar: "الانتظار",      tone: "neutral" },
  { id: "triage",      en: "In triage",   ar: "قيد الفرز",     tone: "neutral" },
];

const ARRIVAL_LABEL: Record<string, { en: string; ar: string }> = {
  walk_in: { en: "Walk-in", ar: "مشياً" },
  ambulance: { en: "Ambulance", ar: "إسعاف" },
  police: { en: "Police", ar: "شرطة" },
  helicopter: { en: "Air ambulance", ar: "إسعاف جوي" },
  referral: { en: "Referral", ar: "تحويل" },
  transfer: { en: "Transfer", ar: "نقل" },
};

export default function EDTracker() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: visits, loading } = useCollection("ed_visits");
  const { rows: vitals } = useCollection("vitals");
  const [areaFilter, setAreaFilter] = useState("");

  const live = useMemo(
    () => visits.filter((v) => v.status !== "departed" && v.status !== "left_without_being_seen"),
    [visits],
  );

  const breaches = live.filter((v) => v.status === "waiting" && isTriageBreached(v.triage_level, minutesSince(v.arrival_at)));
  const boarding = live.filter((v) => v.boarding_since);
  const departed = visits.filter((v) => v.status === "departed" || v.status === "left_without_being_seen");
  const lwbs = visits.filter((v) => v.disposition === "lwbs");

  /** Median door-to-doctor across everyone seen today — the department's headline. */
  const doorToDoctor = useMemo(() => {
    const seen = visits.filter((v) => v.door_to_doctor_minutes !== null).map((v) => v.door_to_doctor_minutes!);
    if (seen.length === 0) return null;
    const sorted = [...seen].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [visits]);

  /** Latest NEWS2 per encounter, so the board can flag a deteriorating wait. */
  const news2ByEncounter = useMemo(() => {
    const latest = new Map<string, typeof vitals[number]>();
    for (const v of vitals) {
      const prev = latest.get(v.encounter_id);
      if (!prev || new Date(v.recorded_at) > new Date(prev.recorded_at)) latest.set(v.encounter_id, v);
    }
    const scores = new Map<string, number>();
    for (const [encId, v] of latest) scores.set(encId, computeNews2(v).score);
    return scores;
  }, [vitals]);

  const byArea = useMemo(() => {
    const m = new Map<string, typeof live>();
    for (const v of live) {
      const key = v.area === "departed" ? "waiting" : v.area;
      m.set(key, [...(m.get(key) ?? []), v]);
    }
    // Sickest first inside each area: triage level, then longest wait.
    for (const [k, arr] of m) {
      m.set(k, [...arr].sort((a, b) =>
        (a.triage_level ?? 9) - (b.triage_level ?? 9) ||
        new Date(a.arrival_at).getTime() - new Date(b.arrival_at).getTime()));
    }
    return m;
  }, [live]);

  const visibleAreas = AREAS.filter((a) => (!areaFilter || a.id === areaFilter) && (byArea.get(a.id)?.length ?? 0) > 0);

  if (loading) return <Page><PageHeader title="ED Tracker" titleAr="متابعة الطوارئ" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Emergency Department"
        titleAr="قسم الطوارئ"
        subtitle="Live board by area. Within each area, the sickest and the longest waiting come first."
        subtitleAr="لوحة مباشرة حسب المنطقة. الأشد حالة والأطول انتظاراً أولاً في كل منطقة."
        meta={[
          { label: "In department", labelAr: "داخل القسم", value: String(live.length) },
          { label: "Breaching", labelAr: "متجاوز الهدف", value: String(breaches.length), tone: breaches.length > 0 ? "critical" : "success" },
          { label: "Boarding", labelAr: "بانتظار سرير", value: String(boarding.length), tone: boarding.length > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={5}>
        <StatTile label="In department" labelAr="داخل القسم" value={live.length} icon={Siren} tone="brand" />
        <StatTile
          label="Waiting to be seen" labelAr="بانتظار الفحص"
          value={live.filter((v) => v.status === "waiting").length}
          sub={breaches.length > 0 ? `${breaches.length} past target` : "All within target"}
          subAr={breaches.length > 0 ? `${breaches.length} تجاوز الهدف` : "الكل ضمن الهدف"}
          icon={Clock} tone={breaches.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Median door to doctor" labelAr="وسيط الوصول للطبيب"
          value={doorToDoctor !== null ? fmtDuration(doorToDoctor, ar) : "—"}
          icon={Activity} tone={doorToDoctor !== null && doorToDoctor > 30 ? "warning" : "success"}
        />
        <StatTile
          label="Awaiting a bed" labelAr="بانتظار سرير" value={boarding.length}
          sub={boarding.length > 0 ? `Longest ${fmtDuration(Math.max(...boarding.map((v) => minutesSince(v.boarding_since))))}` : undefined}
          subAr={boarding.length > 0 ? `الأطول ${fmtDuration(Math.max(...boarding.map((v) => minutesSince(v.boarding_since))), true)}` : undefined}
          icon={BedDouble} tone={boarding.length > 0 ? "warning" : "success"} href="/beds"
        />
        <StatTile
          label="Left without being seen" labelAr="غادر دون فحص" value={lwbs.length}
          sub={`${departed.length} departed today`} subAr={`${departed.length} غادروا اليوم`}
          icon={LogOut} tone={lwbs.length > 0 ? "warning" : "success"}
        />
      </StatGrid>

      {breaches.length > 0 && (
        <Section title="Past triage target" titleAr="تجاوز هدف الفرز" description="Waiting longer than their triage category allows." descriptionAr="ينتظرون أطول مما تسمح به فئة الفرز.">
          <ul className="divide-y divide-border/25">
            {breaches.map((v) => {
              const level = esiLevel(v.triage_level);
              const waited = minutesSince(v.arrival_at);
              return (
                <li key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <AlertTriangle size={15} className="text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-medium text-foreground truncate">{v.patient_name}</div>
                    <div className="text-micro text-muted-foreground truncate">
                      {v.patient_mrn} · {ar ? (v.complaint_ar ?? v.complaint_en) : v.complaint_en}
                    </div>
                  </div>
                  <Pill tone="critical">{ar ? "فئة" : "Cat"} {v.triage_level}</Pill>
                  <span className="text-body font-semibold tabular-nums text-destructive w-20 text-end">
                    {fmtDuration(waited, ar)}
                  </span>
                  <span className="text-micro text-muted-foreground tabular-nums w-14 text-end shrink-0">
                    / {level?.targetMinutes}m
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Area filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button" onClick={() => setAreaFilter("")}
          className={`px-2.5 h-8 rounded-xl text-caption font-medium transition-colors ${!areaFilter ? TONE_PILL.brand : "text-muted-foreground hover:bg-muted/60"}`}
        >
          {ar ? "كل المناطق" : "All areas"}
          <span className="tabular-nums opacity-70 ms-1.5">{live.length}</span>
        </button>
        {AREAS.map((a) => {
          const n = byArea.get(a.id)?.length ?? 0;
          if (n === 0) return null;
          const active = areaFilter === a.id;
          return (
            <button
              key={a.id} type="button" onClick={() => setAreaFilter(active ? "" : a.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-xl text-caption font-medium transition-colors
                ${active ? TONE_PILL[a.tone] : "text-muted-foreground hover:bg-muted/60"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[a.tone]}`} aria-hidden />
              {ar ? a.ar : a.en}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {visibleAreas.length === 0 ? (
        <Section>
          <EmptyState
            icon={Siren}
            title="The department is empty"
            titleAr="القسم فارغ"
            hint="No patients are currently in the emergency department."
            hintAr="لا يوجد مرضى حالياً في قسم الطوارئ."
          />
        </Section>
      ) : (
        <div className="space-y-5">
          {visibleAreas.map((area) => {
            const rows = byArea.get(area.id) ?? [];
            return (
              <Section
                key={area.id}
                title={area.en} titleAr={area.ar}
                actions={<span className="text-caption text-muted-foreground tabular-nums">{rows.length}</span>}
              >
                <div className="p-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((v) => {
                    const level = esiLevel(v.triage_level);
                    const waited = minutesSince(v.arrival_at);
                    const breached = v.status === "waiting" && isTriageBreached(v.triage_level, waited);
                    const news2 = news2ByEncounter.get(v.encounter_id);
                    return (
                      <div key={v.id} className={`${cardCls} p-3.5 flex flex-col gap-2 ${breached ? "border-destructive/40" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/chart/${v.patient_id}`} className="text-body font-medium text-foreground hover:text-brand-ink transition-colors truncate block">
                              {v.patient_name}
                            </Link>
                            <div className="text-micro text-muted-foreground tabular-nums">{v.patient_mrn}</div>
                          </div>
                          {level && (
                            <span
                              className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 text-body font-bold tabular-nums ${TONE_PILL[level.tone]}`}
                              title={ar ? level.ar : level.en}
                              style={serif}
                            >
                              {level.level}
                            </span>
                          )}
                        </div>

                        <p className="text-caption text-foreground/80 line-clamp-2">
                          {ar ? (v.complaint_ar ?? v.complaint_en) : v.complaint_en}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill tone="neutral" icon={v.arrival_mode === "ambulance" ? Ambulance : undefined}>
                            {ar ? (ARRIVAL_LABEL[v.arrival_mode]?.ar ?? v.arrival_mode) : (ARRIVAL_LABEL[v.arrival_mode]?.en ?? v.arrival_mode)}
                          </Pill>
                          {v.is_trauma && <Pill tone="critical">{ar ? "رضوح" : "Trauma"}</Pill>}
                          {news2 !== undefined && news2 >= 5 && (
                            <Pill tone={news2 >= 7 ? "critical" : "warning"}>NEWS2 {news2}</Pill>
                          )}
                          {v.boarding_since && (
                            <Pill tone="warning" icon={BedDouble}>
                              {ar ? "بانتظار سرير" : "boarding"} {fmtDuration(minutesSince(v.boarding_since), ar)}
                            </Pill>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border/25">
                          <span className="text-micro text-muted-foreground">
                            {ar ? "وصل" : "arrived"} {fmtTime(v.arrival_at, ar)}
                            {v.seen_by && ` · ${v.seen_by}`}
                          </span>
                          <span className={`text-caption font-semibold tabular-nums ${breached ? "text-destructive" : "text-muted-foreground"}`}>
                            {fmtDuration(waited, ar)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })}
        </div>
      )}

      <Section title="Triage targets" titleAr="أهداف الفرز" description="Emergency Severity Index. The target is time to first clinician assessment." descriptionAr="مؤشر شدة الطوارئ. الهدف هو زمن أول تقييم من طبيب.">
        <div className="p-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ESI_LEVELS.map((l) => {
            const n = live.filter((v) => v.triage_level === l.level).length;
            return (
              <div key={l.level} className="rounded-xl bg-muted/40 px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-md grid place-items-center text-caption font-bold tabular-nums ${TONE_PILL[l.tone]}`}>{l.level}</span>
                  <span className="text-body font-medium text-foreground">{ar ? l.ar : l.en}</span>
                </div>
                <div className="text-micro text-muted-foreground mt-1.5">{ar ? l.desc_ar : l.desc_en}</div>
                <div className="text-caption text-foreground mt-1.5 tabular-nums">
                  {ar ? "الهدف" : "Target"} {l.targetMinutes === 0 ? (ar ? "فوري" : "immediate") : `${l.targetMinutes}m`}
                  <span className="text-muted-foreground"> · {n} {ar ? "الآن" : "now"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
