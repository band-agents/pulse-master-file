/**
 * Laboratory Worklist — قائمة عمل المختبر
 *
 * The pre-analytical chain, which is where most laboratory delay actually
 * lives: ordered → collected → received → processing → resulted → verified.
 * Turnaround is measured ordered-to-verified, not analyser-to-result, because
 * the clinician is waiting from the moment they pressed the button.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { FlaskConical, AlertTriangle, Clock, XCircle, TestTube2, Timer } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, PatientCell, useCollection, matches, fmtDuration, fmtAgo,
  minutesSince, type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type LabOrder = Database["public"]["Tables"]["lab_orders"]["Row"];

const LAB_STATUS: StatusMap = {
  ordered:     { en: "Ordered",    ar: "مطلوب",       tone: "neutral" },
  collected:   { en: "Collected",  ar: "تم السحب",    tone: "info" },
  received:    { en: "Received",   ar: "مستلم",       tone: "info" },
  in_progress: { en: "Processing", ar: "قيد التحليل",  tone: "info" },
  resulted:    { en: "Resulted",   ar: "صدرت النتيجة", tone: "warning" },
  verified:    { en: "Verified",   ar: "معتمد",       tone: "success" },
  rejected:    { en: "Rejected",   ar: "مرفوض",       tone: "critical" },
  cancelled:   { en: "Cancelled",  ar: "ملغى",        tone: "neutral" },
};

const DISCIPLINES: { value: string; en: string; ar: string }[] = [
  { value: "chemistry",      en: "Chemistry",       ar: "الكيمياء" },
  { value: "haematology",    en: "Haematology",     ar: "أمراض الدم" },
  { value: "microbiology",   en: "Microbiology",    ar: "الأحياء الدقيقة" },
  { value: "serology",       en: "Serology",        ar: "المصليات" },
  { value: "histopathology", en: "Histopathology",  ar: "الأنسجة" },
  { value: "molecular",      en: "Molecular",       ar: "الجزيئية" },
  { value: "blood_bank",     en: "Blood bank",      ar: "بنك الدم" },
  { value: "urinalysis",     en: "Urinalysis",      ar: "تحليل البول" },
];

/** Target turnaround by priority, in minutes. */
const TAT_TARGET: Record<string, number> = { stat: 60, urgent: 120, routine: 240 };

export default function LabWorklist() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: orders, loading } = useCollection("lab_orders");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [discipline, setDiscipline] = useState("");

  const pending = orders.filter((o) => ["ordered", "collected", "received", "in_progress"].includes(o.status));
  const awaitingVerify = orders.filter((o) => o.status === "resulted");
  const rejected = orders.filter((o) => o.status === "rejected");
  const critical = orders.filter((o) => o.has_critical_result);

  /** Orders past the turnaround target for their priority. */
  const breaching = useMemo(
    () => pending.filter((o) => minutesSince(o.ordered_at) > (TAT_TARGET[o.priority] ?? 240)),
    [pending],
  );

  const medianTat = useMemo(() => {
    const t = orders.filter((o) => o.tat_minutes).map((o) => o.tat_minutes!).sort((a, b) => a - b);
    return t.length ? t[Math.floor(t.length / 2)] : null;
  }, [orders]);

  const filtered = useMemo(
    () => orders.filter((o) =>
      (!status || o.status === status) &&
      (!discipline || o.discipline === discipline) &&
      matches(search, o.panel_en, o.panel_ar, o.patient_name, o.patient_mrn, o.accession_number, o.ordered_by)),
    [orders, search, status, discipline],
  );

  const columns: Column<LabOrder>[] = [
    {
      key: "panel", header: "Panel", headerAr: "الفحص",
      sortValue: (o) => o.panel_en,
      cell: (o) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-body font-medium text-foreground">{ar ? (o.panel_ar ?? o.panel_en) : o.panel_en}</span>
            {o.priority === "stat" && <Pill tone="critical">STAT</Pill>}
            {o.priority === "urgent" && <Pill tone="warning">{ar ? "عاجل" : "Urgent"}</Pill>}
            {o.has_critical_result && <Pill tone="critical" icon={AlertTriangle}>{ar ? "حرج" : "Critical"}</Pill>}
          </div>
          <div className="text-micro text-muted-foreground tabular-nums">
            {o.accession_number} · {o.specimen_type}{o.container ? ` · ${o.container}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (o) => o.patient_name,
      cell: (o) => <PatientCell name={o.patient_name} mrn={o.patient_mrn} href={`/chart/${o.patient_id}`} />,
    },
    {
      key: "discipline", header: "Discipline", headerAr: "التخصص", hideBelow: "lg",
      cell: (o) => <span className="text-body text-muted-foreground">
        {ar ? (DISCIPLINES.find((d) => d.value === o.discipline)?.ar ?? o.discipline) : (DISCIPLINES.find((d) => d.value === o.discipline)?.en ?? o.discipline)}
      </span>,
    },
    {
      key: "orderedBy", header: "Ordered by", headerAr: "الطالب", hideBelow: "lg",
      cell: (o) => <span className="text-body text-muted-foreground">{o.ordered_by}</span>,
    },
    {
      key: "elapsed", header: "Elapsed", headerAr: "الزمن المنقضي",
      sortValue: (o) => o.tat_minutes ?? minutesSince(o.ordered_at),
      cell: (o) => {
        const done = o.status === "verified" || o.status === "rejected" || o.status === "cancelled";
        const mins = done ? (o.tat_minutes ?? 0) : minutesSince(o.ordered_at);
        const target = TAT_TARGET[o.priority] ?? 240;
        const tone: Tone = done ? "neutral" : mins > target ? "critical" : mins > target * 0.75 ? "warning" : "neutral";
        return (
          <Pill tone={tone} icon={done ? Timer : Clock}>
            {fmtDuration(mins, ar)}
            {!done && <span className="opacity-60"> / {target}m</span>}
          </Pill>
        );
      },
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (o) => <StatusPill map={LAB_STATUS} value={o.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Laboratory Worklist"
        titleAr="قائمة عمل المختبر"
        subtitle="The full pre-analytical chain. Turnaround is measured from the order, not from the analyser."
        subtitleAr="السلسلة الكاملة قبل التحليل. زمن الإنجاز يُحسب من وقت الطلب لا من الجهاز."
        meta={[
          { label: "In progress", labelAr: "قيد التنفيذ", value: String(pending.length) },
          { label: "Past target", labelAr: "تجاوز الهدف", value: String(breaching.length), tone: breaching.length > 0 ? "critical" : "success" },
          { label: "Critical results", labelAr: "نتائج حرجة", value: String(critical.length), tone: critical.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={5}>
        <StatTile label="In progress" labelAr="قيد التنفيذ" value={pending.length} icon={FlaskConical} tone="brand" />
        <StatTile
          label="Awaiting verification" labelAr="بانتظار الاعتماد" value={awaitingVerify.length}
          sub="Resulted, not yet released" subAr="صدرت ولم تُعتمد"
          icon={TestTube2} tone={awaitingVerify.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Past turnaround target" labelAr="تجاوزت زمن الإنجاز" value={breaching.length}
          icon={Clock} tone={breaching.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Median turnaround" labelAr="وسيط زمن الإنجاز"
          value={medianTat !== null ? fmtDuration(medianTat, ar) : "—"}
          sub="Ordered to verified" subAr="من الطلب إلى الاعتماد"
          icon={Timer} tone="neutral"
        />
        <StatTile
          label="Specimens rejected" labelAr="عينات مرفوضة" value={rejected.length}
          sub="Recollection needed" subAr="تحتاج إعادة سحب"
          icon={XCircle} tone={rejected.length > 0 ? "warning" : "success"}
        />
      </StatGrid>

      {rejected.length > 0 && (
        <Section title="Rejected specimens" titleAr="عينات مرفوضة" description="These will not produce a result until the sample is recollected." descriptionAr="لن تصدر نتيجة حتى تُعاد العينة.">
          <ul className="divide-y divide-border/25">
            {rejected.map((o) => (
              <li key={o.id} className="px-5 py-3 flex items-start gap-3">
                <XCircle size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground">
                    {ar ? (o.panel_ar ?? o.panel_en) : o.panel_en} · {o.patient_name}
                  </div>
                  <div className="text-caption text-foreground/80 mt-0.5">{o.rejection_reason}</div>
                  <div className="text-micro text-muted-foreground tabular-nums mt-0.5">
                    {o.accession_number} · {ar ? "طُلب" : "ordered"} {fmtAgo(o.ordered_at, ar)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        actions={<Link href="/lab/results" className="text-caption text-brand-ink font-medium">{ar ? "عرض النتائج" : "View results"}</Link>}
      >
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Panel, patient, MRN or accession"
          searchPlaceholderAr="الفحص أو المريض أو رقم الملف أو رقم العينة"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(LAB_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "discipline", value: discipline, onChange: setDiscipline,
              allLabel: "All disciplines", allLabelAr: "كل التخصصات",
              options: DISCIPLINES,
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "طلب" : filtered.length === 1 ? "order" : "orders"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "elapsed", ascending: false }} />
      </Section>
    </Page>
  );
}
