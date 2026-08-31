/**
 * Appointments — المواعيد
 *
 * The outpatient scheduling worklist. Oriented around today: staff arrive
 * knowing roughly when a patient is due, and the default sort keeps the
 * clinic in the order it actually runs.
 */

import { useState, useMemo } from "react";
import { Calendar, UserX, Video, Bell, BellOff, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid,
  Pill, StatusPill, PatientCell, useCollection, matches, fmtTime,
  type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

const APPOINTMENT_STATUS: StatusMap = {
  booked:      { en: "Booked",      ar: "محجوز",     tone: "neutral" },
  confirmed:   { en: "Confirmed",   ar: "مؤكد",       tone: "info" },
  arrived:     { en: "Arrived",     ar: "وصل",        tone: "brand" },
  in_progress: { en: "In progress", ar: "قيد التنفيذ", tone: "info" },
  completed:   { en: "Completed",   ar: "مكتمل",      tone: "success" },
  no_show:     { en: "No-show",     ar: "لم يحضر",    tone: "warning" },
  cancelled:   { en: "Cancelled",   ar: "ملغى",        tone: "neutral" },
  rescheduled: { en: "Rescheduled", ar: "أعيدت جدولته", tone: "neutral" },
};

const TYPE_LABEL: Record<Appointment["appointment_type"], { en: string; ar: string }> = {
  new:         { en: "New",         ar: "جديد" },
  follow_up:   { en: "Follow-up",   ar: "متابعة" },
  procedure:   { en: "Procedure",   ar: "إجراء" },
  telehealth:  { en: "Telehealth",  ar: "اتصال مرئي" },
  vaccination: { en: "Vaccination", ar: "تطعيم" },
  screening:   { en: "Screening",   ar: "فحص" },
  review:      { en: "Review",      ar: "مراجعة" },
};

export default function Appointments() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: appointments, loading } = useCollection("appointments");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");

  const todayKey = new Date().toDateString();
  const today = useMemo(
    () => appointments.filter((a) => new Date(a.slot_start).toDateString() === todayKey),
    [appointments, todayKey],
  );

  const waiting = today.filter((a) => a.status === "arrived");
  const noShow = today.filter((a) => a.status === "no_show");
  const telehealth = today.filter((a) => a.is_telehealth);

  const departmentOptions = useMemo(() => {
    const set = new Set(appointments.map((a) => a.department_name).filter(Boolean));
    return [...set].sort().map((v) => ({ value: v, en: v, ar: v }));
  }, [appointments]);

  const filtered = useMemo(
    () => appointments.filter((a) =>
      (!type || a.appointment_type === type) &&
      (!status || a.status === status) &&
      (!department || a.department_name === department) &&
      matches(search, a.patient_name, a.patient_mrn, a.patient_phone, a.provider_name, a.appointment_number)),
    [appointments, search, type, status, department],
  );

  const columns: Column<Appointment>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (a) => a.patient_name,
      cell: (a) => <PatientCell name={a.patient_name} mrn={a.patient_mrn} href={`/chart/${a.patient_id}`} />,
    },
    {
      key: "provider", header: "Provider", headerAr: "مقدم الخدمة", hideBelow: "md",
      sortValue: (a) => a.provider_name,
      cell: (a) => <span className="text-body text-foreground">{a.provider_name}</span>,
    },
    {
      key: "department", header: "Department", headerAr: "القسم", hideBelow: "lg",
      sortValue: (a) => a.department_name,
      cell: (a) => (
        <div>
          <div className="text-body text-foreground">{a.department_name}</div>
          {a.clinic_room && <div className="text-micro text-muted-foreground">{a.clinic_room}</div>}
        </div>
      ),
    },
    {
      key: "slot_start", header: "Time", headerAr: "الوقت",
      sortValue: (a) => a.slot_start,
      cell: (a) => (
        <div>
          <span className="text-body font-medium tabular-nums text-foreground">
            {fmtTime(a.slot_start, ar)}–{fmtTime(a.slot_end, ar)}
          </span>
          <div className="text-micro text-muted-foreground tabular-nums">{a.duration_minutes}m</div>
        </div>
      ),
    },
    {
      key: "type", header: "Type", headerAr: "النوع",
      sortValue: (a) => a.appointment_type,
      cell: (a) => (
        <Pill tone={a.appointment_type === "telehealth" ? "info" : "neutral"} icon={a.appointment_type === "telehealth" ? Video : undefined}>
          {ar ? TYPE_LABEL[a.appointment_type].ar : TYPE_LABEL[a.appointment_type].en}
        </Pill>
      ),
    },
    {
      key: "reminder", header: "Reminder", headerAr: "التذكير", align: "start", hideBelow: "md",
      cell: (a) => a.reminder_sent_at
        ? <Bell size={14} className="text-success" aria-label={ar ? "تم إرسال التذكير" : "Reminder sent"} />
        : <BellOff size={14} className="text-muted-foreground/50" aria-label={ar ? "لم يُرسل تذكير" : "No reminder sent"} />,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (a) => <StatusPill map={APPOINTMENT_STATUS} value={a.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Appointments"
        titleAr="المواعيد"
        subtitle="Today's outpatient schedule, in the order the clinic actually runs."
        subtitleAr="جدول العيادات الخارجية لليوم، بالترتيب الفعلي للعيادة."
      />

      <StatGrid cols={4}>
        <StatTile label="Booked today" labelAr="محجوز اليوم" value={today.length} icon={Calendar} tone="brand" />
        <StatTile
          label="Arrived / waiting" labelAr="وصل / بالانتظار" value={waiting.length}
          icon={CheckCircle2} tone={waiting.length > 0 ? "info" : "neutral"}
        />
        <StatTile
          label="No-shows today" labelAr="لم يحضروا اليوم" value={noShow.length}
          icon={UserX} tone={noShow.length > 0 ? "warning" : "neutral"}
        />
        <StatTile label="Telehealth today" labelAr="اتصال مرئي اليوم" value={telehealth.length} icon={Video} tone="info" />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, MRN, phone or provider"
          searchPlaceholderAr="المريض أو رقم الملف أو الهاتف أو مقدم الخدمة"
          filters={[
            {
              key: "type", value: type, onChange: setType,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: Object.entries(TYPE_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(APPOINTMENT_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "department", value: department, onChange: setDepartment,
              allLabel: "All departments", allLabelAr: "كل الأقسام",
              options: departmentOptions,
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "نتيجة" : filtered.length === 1 ? "result" : "results"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          initialSort={{ key: "slot_start", ascending: true }}
        />
      </Section>
    </Page>
  );
}
