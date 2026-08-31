/**
 * Radiology Worklist — قائمة عمل الأشعة
 *
 * The imaging pipeline while it is still moving: ordered → scheduled →
 * arrived → in progress → acquired → reported → verified. Mirrors the lab
 * worklist's pre-analytical framing, but for the RIS — turnaround is
 * measured from the order, and STAT studies need to surface immediately.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ScanLine, Clock, Activity, Radio } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, PatientCell, useCollection, matches, fmtDuration, fmtDateTime,
  minutesSince, type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type ImagingOrder = Database["public"]["Tables"]["imaging_orders"]["Row"];

const STUDY_STATUS: StatusMap = {
  ordered:     { en: "Ordered",     ar: "مطلوب",       tone: "neutral" },
  scheduled:   { en: "Scheduled",   ar: "مجدول",       tone: "info" },
  arrived:     { en: "Arrived",     ar: "وصل",         tone: "info" },
  in_progress: { en: "In progress", ar: "قيد التنفيذ", tone: "warning" },
  acquired:    { en: "Acquired",    ar: "تم التصوير",  tone: "warning" },
  reported:    { en: "Reported",    ar: "تم التقرير",  tone: "success" },
  verified:    { en: "Verified",    ar: "معتمد",       tone: "success" },
  cancelled:   { en: "Cancelled",   ar: "ملغى",        tone: "neutral" },
  no_show:     { en: "No-show",     ar: "لم يحضر",     tone: "critical" },
};

const MODALITIES: { value: string; en: string; ar: string }[] = [
  { value: "xr",     en: "X-Ray",    ar: "أشعة سينية" },
  { value: "ct",     en: "CT",       ar: "مقطعية" },
  { value: "mri",    en: "MRI",      ar: "رنين مغناطيسي" },
  { value: "us",     en: "Ultrasound", ar: "موجات صوتية" },
  { value: "mammo",  en: "Mammography", ar: "تصوير الثدي" },
  { value: "nm",     en: "Nuclear medicine", ar: "طب نووي" },
  { value: "pet",    en: "PET", ar: "بيت" },
  { value: "fluoro", en: "Fluoroscopy", ar: "تنظير إشعاعي" },
  { value: "dexa",   en: "DEXA", ar: "قياس كثافة العظام" },
  { value: "angio",  en: "Angiography", ar: "قسطرة تشخيصية" },
];

const PRIORITY_TONE: Record<string, Tone> = { routine: "neutral", urgent: "warning", stat: "critical" };
const PRIORITY_LABEL: Record<string, { en: string; ar: string }> = {
  routine: { en: "Routine", ar: "روتيني" },
  urgent: { en: "Urgent", ar: "عاجل" },
  stat: { en: "STAT", ar: "فوري" },
};

const TERMINAL = new Set(["reported", "verified", "cancelled", "no_show"]);

export default function Radiology() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: orders, loading } = useCollection("imaging_orders");
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const todayOrdered = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter((o) => new Date(o.created_at).toDateString() === today);
  }, [orders]);

  const active = orders.filter((o) => ["in_progress", "acquired"].includes(o.status));
  const statCount = orders.filter((o) => o.priority === "stat" && !TERMINAL.has(o.status)).length;

  const avgTurnaround = useMemo(() => {
    const times = orders
      .filter((o) => o.reported_at)
      .map((o) => (new Date(o.reported_at!).getTime() - new Date(o.created_at).getTime()) / 60_000);
    return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  }, [orders]);

  const filtered = useMemo(
    () => orders.filter((o) =>
      (!modality || o.modality === modality) &&
      (!status || o.status === status) &&
      (!priority || o.priority === priority) &&
      matches(search, o.procedure_en, o.procedure_ar, o.patient_name, o.patient_mrn, o.accession_number, o.technologist)),
    [orders, search, modality, status, priority],
  );

  const columns: Column<ImagingOrder>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (o) => o.patient_name,
      cell: (o) => <PatientCell name={o.patient_name} mrn={o.patient_mrn} href={`/chart/${o.patient_id}`} />,
    },
    {
      key: "modality", header: "Modality", headerAr: "الوسيلة",
      sortValue: (o) => o.modality,
      cell: (o) => {
        const d = MODALITIES.find((m) => m.value === o.modality);
        return <Pill tone="brand">{(d?.en ?? o.modality).toUpperCase()}</Pill>;
      },
    },
    {
      key: "procedure", header: "Procedure", headerAr: "الإجراء",
      sortValue: (o) => o.procedure_en,
      cell: (o) => (
        <div className="min-w-0">
          <div className="text-body text-foreground">{ar ? (o.procedure_ar ?? o.procedure_en) : o.procedure_en}</div>
          <div className="text-micro text-muted-foreground tabular-nums">{o.accession_number}</div>
        </div>
      ),
    },
    {
      key: "priority", header: "Priority", headerAr: "الأولوية",
      sortValue: (o) => o.priority,
      cell: (o) => <Pill tone={PRIORITY_TONE[o.priority] ?? "neutral"}>{ar ? PRIORITY_LABEL[o.priority]?.ar : PRIORITY_LABEL[o.priority]?.en}</Pill>,
    },
    {
      key: "scheduled", header: "Scheduled", headerAr: "الموعد", hideBelow: "md",
      sortValue: (o) => o.scheduled_at ?? "",
      cell: (o) => <span className="text-body text-muted-foreground tabular-nums whitespace-nowrap">{fmtDateTime(o.scheduled_at, ar)}</span>,
    },
    {
      key: "room", header: "Room", headerAr: "الغرفة", hideBelow: "lg",
      cell: (o) => <span className="text-body text-muted-foreground">{o.room ?? "—"}</span>,
    },
    {
      key: "tech", header: "Technologist", headerAr: "الفني", hideBelow: "lg",
      cell: (o) => <span className="text-body text-muted-foreground">{o.technologist ?? "—"}</span>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (o) => <StatusPill map={STUDY_STATUS} value={o.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Radiology Worklist"
        titleAr="قائمة عمل الأشعة"
        subtitle="Studies moving through the imaging pipeline, from order to verified report."
        subtitleAr="الدراسات التي تمر عبر مسار التصوير، من الطلب إلى التقرير المعتمد."
        meta={[
          { label: "In progress", labelAr: "قيد التنفيذ", value: String(active.length), tone: "info" },
          { label: "STAT active", labelAr: "فوري نشط", value: String(statCount), tone: statCount > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Ordered today" labelAr="طُلب اليوم" value={todayOrdered.length} icon={ScanLine} tone="brand" />
        <StatTile
          label="In progress / acquired" labelAr="قيد التنفيذ / تم التصوير" value={active.length}
          icon={Activity} tone={active.length > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Avg. ordered to reported" labelAr="متوسط الطلب إلى التقرير"
          value={avgTurnaround !== null ? fmtDuration(avgTurnaround, ar) : "—"}
          icon={Clock} tone="neutral"
        />
        <StatTile
          label="STAT priority" labelAr="أولوية فورية" value={statCount}
          sub="Still in the pipeline" subAr="لا تزال قيد التنفيذ"
          icon={Radio} tone={statCount > 0 ? "critical" : "success"}
        />
      </StatGrid>

      <Section
        actions={<Link href="/radiology/studies" className="text-caption text-brand-ink font-medium">{ar ? "عرض الدراسات والأرشيف" : "View studies & PACS"}</Link>}
      >
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Procedure, patient, MRN, accession or technologist"
          searchPlaceholderAr="الإجراء أو المريض أو رقم الملف أو رقم العينة أو الفني"
          filters={[
            {
              key: "modality", value: modality, onChange: setModality,
              allLabel: "All modalities", allLabelAr: "كل الوسائل",
              options: MODALITIES,
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(STUDY_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "priority", value: priority, onChange: setPriority,
              allLabel: "All priorities", allLabelAr: "كل الأولويات",
              options: Object.entries(PRIORITY_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "دراسة" : filtered.length === 1 ? "study" : "studies"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "scheduled", ascending: false }} />
      </Section>
    </Page>
  );
}
