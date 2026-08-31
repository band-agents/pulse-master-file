/**
 * Theatre Schedule — جدول العمليات
 *
 * The day's lists by theatre. Utilisation and cancellation are shown together
 * because they are the same conversation: a list that finishes early and a
 * list that gets cancelled both cost the same theatre hour, and only one of
 * them usually gets investigated.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Scissors, Clock, Ban, CheckCircle2, AlertTriangle, Droplet, Users } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, Pill, StatusPill, EmptyState,
  LoadingRow, Meter, useCollection, fmtTime, fmtDuration, fmtDate,
  cardCls, serif, type StatusMap, type Tone,
} from "@/platform/ui";

const CASE_STATUS: StatusMap = {
  requested:  { en: "Requested",  ar: "مطلوبة",     tone: "neutral" },
  scheduled:  { en: "Scheduled",  ar: "مجدولة",     tone: "info" },
  pre_op:     { en: "Pre-op",     ar: "تحضير",      tone: "warning" },
  in_theatre: { en: "In theatre", ar: "داخل الغرفة", tone: "critical" },
  recovery:   { en: "Recovery",   ar: "الإفاقة",    tone: "info" },
  completed:  { en: "Completed",  ar: "مكتملة",     tone: "success" },
  cancelled:  { en: "Cancelled",  ar: "ملغاة",      tone: "critical" },
  postponed:  { en: "Postponed",  ar: "مؤجلة",      tone: "warning" },
};

const URGENCY_TONE: Record<string, Tone> = {
  elective: "neutral", urgent: "warning", emergency: "critical", immediate: "critical",
};

export default function TheatreSchedule() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: cases, loading } = useCollection("ot_cases");
  const [theatreFilter, setTheatreFilter] = useState("");

  /** Cases within a day and a half of now — "the current list" in practice. */
  const window = useMemo(
    () => cases.filter((c) => Math.abs(new Date(c.scheduled_start).getTime() - Date.now()) < 36 * 3_600_000),
    [cases],
  );

  const theatres = useMemo(() => [...new Set(window.map((c) => c.theatre))].sort(), [window]);
  const shown = theatreFilter ? window.filter((c) => c.theatre === theatreFilter) : window;

  const completed = cases.filter((c) => c.status === "completed");
  const cancelled = cases.filter((c) => c.status === "cancelled");

  /** Mean actual case duration, and mean turnover between cases. */
  const meanDuration = useMemo(() => {
    const d = completed.filter((c) => c.duration_minutes).map((c) => c.duration_minutes!);
    return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
  }, [completed]);

  const meanTurnover = useMemo(() => {
    const t = completed.filter((c) => c.turnover_minutes).map((c) => c.turnover_minutes!);
    return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : null;
  }, [completed]);

  const cancellationRate = cases.length > 0 ? Math.round((cancelled.length / cases.length) * 100) : 0;

  const byTheatre = useMemo(() => {
    const m = new Map<string, typeof shown>();
    for (const c of shown) m.set(c.theatre, [...(m.get(c.theatre) ?? []), c]);
    for (const [k, v] of m) {
      m.set(k, [...v].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shown]);

  if (loading) return <Page><PageHeader title="Theatre Schedule" titleAr="جدول العمليات" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Theatre Schedule"
        titleAr="جدول العمليات"
        subtitle="Today's lists by theatre, with utilisation and cancellations side by side."
        subtitleAr="قوائم اليوم حسب الغرفة مع الاستغلال والإلغاءات جنباً إلى جنب."
        meta={[
          { label: "Cases on the list", labelAr: "عمليات مجدولة", value: String(window.length) },
          { label: "In theatre now", labelAr: "جارية الآن", value: String(window.filter((c) => c.status === "in_theatre").length), tone: "info" },
          { label: "Cancellation rate", labelAr: "نسبة الإلغاء", value: `${cancellationRate}%`, tone: cancellationRate > 10 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Cases scheduled" labelAr="عمليات مجدولة" value={window.length} icon={Scissors} tone="brand" />
        <StatTile
          label="Mean case duration" labelAr="متوسط مدة العملية"
          value={meanDuration !== null ? fmtDuration(meanDuration, ar) : "—"}
          sub="Wheels in to wheels out" subAr="من الدخول إلى الخروج"
          icon={Clock} tone="neutral"
        />
        <StatTile
          label="Mean turnover" labelAr="متوسط زمن التحضير"
          value={meanTurnover !== null ? fmtDuration(meanTurnover, ar) : "—"}
          sub="Between consecutive cases" subAr="بين عمليتين متتاليتين"
          icon={Clock} tone={meanTurnover !== null && meanTurnover > 30 ? "warning" : "success"}
        />
        <StatTile
          label="Cancelled" labelAr="عمليات ملغاة" value={cancelled.length}
          sub={`${cancellationRate}% of all cases`} subAr={`${cancellationRate}٪ من كل العمليات`}
          icon={Ban} tone={cancelled.length > 0 ? "warning" : "success"}
        />
      </StatGrid>

      {cancelled.length > 0 && (
        <Section title="Cancellations" titleAr="الإلغاءات" description="Every cancelled case with its recorded cause." descriptionAr="كل عملية ملغاة مع السبب الموثق.">
          <ul className="divide-y divide-border/25">
            {cancelled.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-start gap-3">
                <Ban size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground">
                    {ar ? (c.procedure_ar ?? c.procedure_en) : c.procedure_en}
                  </div>
                  <div className="text-micro text-muted-foreground">
                    {c.patient_name} · {c.theatre} · {fmtDate(c.scheduled_start, ar)} {fmtTime(c.scheduled_start, ar)}
                  </div>
                  {c.cancellation_reason && (
                    <p className="text-caption text-foreground/80 mt-1">{c.cancellation_reason}</p>
                  )}
                </div>
                {(c.metadata as Record<string, unknown> | null)?.cancellation_category ? (
                  <Pill tone="warning">{String((c.metadata as Record<string, unknown>).cancellation_category)}</Pill>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button" onClick={() => setTheatreFilter("")}
          className={`px-2.5 h-8 rounded-xl text-caption font-medium transition-colors ${!theatreFilter ? "bg-brand-wash text-brand-ink" : "text-muted-foreground hover:bg-muted/60"}`}
        >
          {ar ? "كل الغرف" : "All theatres"} <span className="tabular-nums opacity-70 ms-1">{window.length}</span>
        </button>
        {theatres.map((t) => {
          const active = theatreFilter === t;
          return (
            <button
              key={t} type="button" onClick={() => setTheatreFilter(active ? "" : t)}
              className={`px-2.5 h-8 rounded-xl text-caption font-medium transition-colors ${active ? "bg-brand-wash text-brand-ink" : "text-muted-foreground hover:bg-muted/60"}`}
            >
              {t} <span className="tabular-nums opacity-70 ms-1">{window.filter((c) => c.theatre === t).length}</span>
            </button>
          );
        })}
      </div>

      {byTheatre.length === 0 ? (
        <Section><EmptyState icon={Scissors} title="No cases on the list" titleAr="لا توجد عمليات مجدولة" /></Section>
      ) : (
        <div className="space-y-5">
          {byTheatre.map(([theatre, list]) => {
            const booked = list.reduce((s, c) =>
              s + (new Date(c.scheduled_end).getTime() - new Date(c.scheduled_start).getTime()) / 60_000, 0);
            // A standard session is eight hours; anything beyond that overruns.
            const sessionMinutes = 8 * 60;
            return (
              <Section
                key={theatre}
                title={theatre} titleAr={theatre}
                actions={
                  <div className="flex items-center gap-3">
                    <span className="text-caption text-muted-foreground tabular-nums">
                      {fmtDuration(Math.round(booked), ar)} {ar ? "محجوزة" : "booked"}
                    </span>
                    <Meter value={booked} max={sessionMinutes} tone={booked > sessionMinutes ? "critical" : booked > sessionMinutes * 0.85 ? "warning" : "success"} />
                  </div>
                }
              >
                <ul className="divide-y divide-border/25">
                  {list.map((c) => (
                    <li key={c.id} className="px-5 py-3.5 flex items-start gap-4">
                      <div className="text-end shrink-0 w-16">
                        <div className="text-body font-semibold text-foreground tabular-nums">{fmtTime(c.scheduled_start, ar)}</div>
                        <div className="text-micro text-muted-foreground tabular-nums">{fmtTime(c.scheduled_end, ar)}</div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-body font-medium text-foreground">
                            {ar ? (c.procedure_ar ?? c.procedure_en) : c.procedure_en}
                          </span>
                          {c.laterality && c.laterality !== "na" && <Pill tone="warning">{c.laterality}</Pill>}
                          <Pill tone={URGENCY_TONE[c.urgency] ?? "neutral"}>{c.urgency}</Pill>
                          {c.asa_grade && <Pill tone={c.asa_grade >= 3 ? "warning" : "neutral"}>ASA {c.asa_grade}</Pill>}
                        </div>
                        <div className="text-caption text-muted-foreground mt-0.5">
                          <Link href={`/chart/${c.patient_id}`} className="hover:text-brand-ink transition-colors">{c.patient_name}</Link>
                          {" · "}{c.patient_mrn}
                        </div>
                        <div className="text-micro text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          <span className="inline-flex items-center gap-1"><Users size={10} />{c.surgeon_name}</span>
                          {c.anaesthetist_name && <span>{c.anaesthetist_name}</span>}
                          {c.anaesthesia_type && <span>{c.anaesthesia_type}</span>}
                          {c.blood_requested_units ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <Droplet size={10} />{c.blood_requested_units} {ar ? "وحدة" : "units"}
                            </span>
                          ) : null}
                        </div>
                        <ChecklistStrip checklist={c.checklist} status={c.status} />
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <StatusPill map={CASE_STATUS} value={c.status} />
                        {c.duration_minutes && (
                          <span className="text-micro text-muted-foreground tabular-nums">
                            {ar ? "استغرقت" : "took"} {fmtDuration(c.duration_minutes, ar)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
        </div>
      )}
    </Page>
  );
}

/** WHO Surgical Safety Checklist state, as three dots. Not decoration —
 *  a case that reaches "in theatre" without sign-in is a reportable event. */
function ChecklistStrip({ checklist, status }: { checklist: unknown; status: string }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const c = checklist as { sign_in?: { completed: boolean }; time_out?: { completed: boolean }; sign_out?: { completed: boolean } } | null;
  if (!c) return null;
  if (status === "scheduled" || status === "requested" || status === "cancelled") return null;

  const steps = [
    { key: "sign_in", en: "Sign in", ar: "التحقق الأول", done: c.sign_in?.completed },
    { key: "time_out", en: "Time out", ar: "التوقف التحققي", done: c.time_out?.completed },
    { key: "sign_out", en: "Sign out", ar: "التحقق الختامي", done: c.sign_out?.completed },
  ];

  return (
    <div className="flex items-center gap-3 mt-1.5">
      <span className="text-micro text-muted-foreground">{ar ? "قائمة السلامة" : "WHO checklist"}</span>
      {steps.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1 text-micro">
          {s.done
            ? <CheckCircle2 size={11} className="text-success" />
            : <AlertTriangle size={11} className="text-warning" />}
          <span className={s.done ? "text-muted-foreground" : "text-warning"}>
            {ar ? s.ar : s.en}
          </span>
        </span>
      ))}
    </div>
  );
}
