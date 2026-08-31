/**
 * Triage Board — لوحة الفرز
 *
 * The waiting room, ordered the way triage actually works: by acuity first
 * and arrival time second, never by arrival time alone. The countdown column
 * shows time remaining against the category target, going negative when
 * breached, so a nurse can see at a glance who is closest to the edge.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Ambulance, Clock, AlertTriangle, Activity, LogOut } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, Pill, EmptyState, LoadingRow,
  useCollection, fmtDuration, fmtTime, minutesSince, serif, TONE_PILL,
} from "@/platform/ui";
import { ESI_LEVELS, esiLevel, isTriageBreached, computeNews2 } from "@/platform/clinical/scores";

export default function TriageBoard() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: visits, loading } = useCollection("ed_visits");
  const { rows: vitals } = useCollection("vitals");

  /** Untriaged and waiting patients only — once someone is in treatment they
   *  belong on the department tracker, not the triage queue. */
  const queue = useMemo(
    () => visits
      .filter((v) => v.status === "waiting" || v.status === "in_triage")
      .sort((a, b) =>
        (a.triage_level ?? 9) - (b.triage_level ?? 9) ||
        new Date(a.arrival_at).getTime() - new Date(b.arrival_at).getTime()),
    [visits],
  );

  const untriaged = visits.filter((v) => !v.triage_at && v.status !== "departed");
  const breaching = queue.filter((v) => isTriageBreached(v.triage_level, minutesSince(v.arrival_at)));

  const news2ByEncounter = useMemo(() => {
    const latest = new Map<string, typeof vitals[number]>();
    for (const v of vitals) {
      const prev = latest.get(v.encounter_id);
      if (!prev || new Date(v.recorded_at) > new Date(prev.recorded_at)) latest.set(v.encounter_id, v);
    }
    return new Map([...latest].map(([k, v]) => [k, computeNews2(v).score]));
  }, [vitals]);

  /** Mean time from arrival to triage, the metric triage itself is judged on. */
  const meanTimeToTriage = useMemo(() => {
    const done = visits.filter((v) => v.triage_at);
    if (done.length === 0) return null;
    const total = done.reduce((s, v) =>
      s + (new Date(v.triage_at!).getTime() - new Date(v.arrival_at).getTime()) / 60_000, 0);
    return Math.round(total / done.length);
  }, [visits]);

  if (loading) return <Page><PageHeader title="Triage Board" titleAr="لوحة الفرز" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Triage Board"
        titleAr="لوحة الفرز"
        subtitle="Acuity first, arrival time second. The countdown runs against the target for each category."
        subtitleAr="الأولوية للشدة ثم لوقت الوصول. العد التنازلي محسوب مقابل هدف كل فئة."
        meta={[
          { label: "In queue", labelAr: "في الطابور", value: String(queue.length) },
          { label: "Breaching", labelAr: "متجاوز", value: String(breaching.length), tone: breaching.length > 0 ? "critical" : "success" },
          { label: "Not yet triaged", labelAr: "لم يُفرز بعد", value: String(untriaged.length), tone: untriaged.length > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Waiting" labelAr="بانتظار" value={queue.length} icon={Clock} tone="brand" />
        <StatTile
          label="Past target" labelAr="تجاوز الهدف" value={breaching.length}
          icon={AlertTriangle} tone={breaching.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Mean time to triage" labelAr="متوسط زمن الفرز"
          value={meanTimeToTriage !== null ? fmtDuration(meanTimeToTriage, ar) : "—"}
          sub="Arrival to triage decision" subAr="من الوصول إلى قرار الفرز"
          icon={Activity} tone={meanTimeToTriage !== null && meanTimeToTriage > 15 ? "warning" : "success"}
        />
        <StatTile
          label="Left without being seen" labelAr="غادر دون فحص"
          value={visits.filter((v) => v.disposition === "lwbs").length}
          icon={LogOut} tone={visits.some((v) => v.disposition === "lwbs") ? "warning" : "success"}
        />
      </StatGrid>

      <Section
        title="Waiting queue"
        titleAr="طابور الانتظار"
        description="Ordered by triage category, then by how long they have waited."
        descriptionAr="مرتب حسب فئة الفرز ثم حسب مدة الانتظار."
        actions={<Link href="/ed" className="text-caption text-brand-ink font-medium">{ar ? "لوحة القسم" : "Department board"}</Link>}
      >
        {queue.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nobody is waiting"
            titleAr="لا يوجد أحد في الانتظار"
            hint="Every patient in the department has been seen or is in treatment."
            hintAr="كل مريض في القسم تم فحصه أو هو قيد العلاج."
          />
        ) : (
          <ul className="divide-y divide-border/25">
            {queue.map((v, i) => {
              const level = esiLevel(v.triage_level);
              const waited = minutesSince(v.arrival_at);
              const remaining = (level?.targetMinutes ?? 0) - waited;
              const breached = isTriageBreached(v.triage_level, waited);
              const news2 = news2ByEncounter.get(v.encounter_id);
              return (
                <li key={v.id} className={`px-5 py-3.5 flex items-center gap-4 ${breached ? "bg-destructive/5" : ""}`}>
                  <span className="text-caption text-muted-foreground tabular-nums w-5 shrink-0">{i + 1}</span>

                  {level ? (
                    <span
                      className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-body-lg font-bold tabular-nums ${TONE_PILL[level.tone]}`}
                      title={ar ? level.ar : level.en}
                      style={serif}
                    >
                      {level.level}
                    </span>
                  ) : (
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-muted text-muted-foreground text-micro">
                      {ar ? "لم يُفرز" : "—"}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/chart/${v.patient_id}`} className="text-body font-medium text-foreground hover:text-brand-ink transition-colors">
                        {v.patient_name}
                      </Link>
                      {v.arrival_mode === "ambulance" && <Pill tone="info" icon={Ambulance}>{ar ? "إسعاف" : "Ambulance"}</Pill>}
                      {v.is_trauma && <Pill tone="critical">{ar ? "رضوح" : "Trauma"}</Pill>}
                      {news2 !== undefined && news2 >= 5 && <Pill tone={news2 >= 7 ? "critical" : "warning"}>NEWS2 {news2}</Pill>}
                    </div>
                    <div className="text-caption text-muted-foreground truncate">
                      {v.patient_mrn} · {ar ? (v.complaint_ar ?? v.complaint_en) : v.complaint_en}
                    </div>
                    <div className="text-micro text-muted-foreground mt-0.5">
                      {ar ? "وصل" : "arrived"} {fmtTime(v.arrival_at, ar)}
                      {v.triage_nurse && ` · ${ar ? "فرز" : "triaged by"} ${v.triage_nurse}`}
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <div className={`text-body-lg font-semibold tabular-nums ${breached ? "text-destructive" : "text-foreground"}`}>
                      {fmtDuration(waited, ar)}
                    </div>
                    {level && (
                      <div className={`text-micro tabular-nums ${breached ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {breached
                          ? (ar ? `تجاوز بـ ${fmtDuration(-remaining, true)}` : `${fmtDuration(-remaining)} over`)
                          : (ar ? `متبقٍ ${fmtDuration(remaining, true)}` : `${fmtDuration(remaining)} left`)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Category targets" titleAr="أهداف الفئات">
        <div className="p-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ESI_LEVELS.map((l) => {
            const inQueue = queue.filter((v) => v.triage_level === l.level);
            const over = inQueue.filter((v) => isTriageBreached(l.level, minutesSince(v.arrival_at)));
            return (
              <div key={l.level} className="rounded-xl bg-muted/40 px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-md grid place-items-center text-caption font-bold tabular-nums ${TONE_PILL[l.tone]}`}>{l.level}</span>
                  <span className="text-body font-medium text-foreground">{ar ? l.ar : l.en}</span>
                </div>
                <div className="text-micro text-muted-foreground mt-1.5">{ar ? l.desc_ar : l.desc_en}</div>
                <div className="text-caption mt-1.5 tabular-nums">
                  <span className="text-foreground font-medium">{inQueue.length}</span>
                  <span className="text-muted-foreground"> {ar ? "في الانتظار" : "waiting"}</span>
                  {over.length > 0 && (
                    <span className="text-destructive font-medium"> · {over.length} {ar ? "متجاوز" : "over"}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
