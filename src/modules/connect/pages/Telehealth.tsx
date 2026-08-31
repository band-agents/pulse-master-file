/**
 * Telehealth Sessions — الطب عن بعد
 *
 * The virtual-visit session board. A dropped call mid-consult is a clinical
 * safety event here, not a glitch — the schema comment on drop_count says as
 * much — so failures and drops get top billing alongside the day's schedule.
 */

import { useState, useMemo } from "react";
import { Video, PhoneOff, WifiOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill, PatientCell,
  useCollection, matches, fmtDateTime, fmtDuration,
  type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type TelehealthSession = Database["public"]["Tables"]["telehealth_sessions"]["Row"];

const SESSION_STATUS: StatusMap = {
  scheduled:   { en: "Scheduled",   ar: "مجدولة",   tone: "neutral" },
  waiting:     { en: "Waiting",     ar: "بالانتظار", tone: "warning" },
  in_progress: { en: "In progress", ar: "جارية",     tone: "info" },
  completed:   { en: "Completed",   ar: "مكتملة",    tone: "success" },
  no_show:     { en: "No-show",     ar: "لم يحضر",   tone: "warning" },
  failed:      { en: "Failed",      ar: "فشلت",      tone: "critical" },
  cancelled:   { en: "Cancelled",   ar: "ألغيت",     tone: "neutral" },
};

const QUALITY_TONE: Record<string, Tone> = {
  excellent: "success", good: "info", fair: "warning", poor: "critical",
};

const QUALITY_LABEL: Record<string, { en: string; ar: string }> = {
  excellent: { en: "Excellent", ar: "ممتازة" },
  good:      { en: "Good",      ar: "جيدة" },
  fair:      { en: "Fair",      ar: "متوسطة" },
  poor:      { en: "Poor",      ar: "ضعيفة" },
};

export default function Telehealth() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: sessions, loading } = useCollection("telehealth_sessions");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [quality, setQuality] = useState("");

  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
  const todayScheduled = sessions.filter((s) => isToday(s.scheduled_at));
  const active = sessions.filter((s) => s.status === "waiting" || s.status === "in_progress");
  const unreliable = sessions.filter((s) => s.status === "failed" || s.drop_count > 0);
  const qualityIssues = sessions.filter((s) => s.connection_quality === "poor" || s.connection_quality === "fair");

  const filtered = useMemo(
    () => sessions
      .filter((s) =>
        (!status || s.status === status) &&
        (!quality || s.connection_quality === quality) &&
        matches(search, s.patient_name, s.provider_name, s.session_number))
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    [sessions, search, status, quality],
  );

  const columns: Column<TelehealthSession>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      cell: (s) => <PatientCell name={s.patient_name} href={`/chart/${s.patient_id}`} />,
      sortValue: (s) => s.patient_name,
    },
    {
      key: "provider", header: "Provider", headerAr: "مقدم الرعاية",
      cell: (s) => s.provider_name,
      hideBelow: "sm",
    },
    {
      key: "scheduled_at", header: "Scheduled", headerAr: "موعد الجلسة",
      cell: (s) => <span className="tabular-nums text-caption">{fmtDateTime(s.scheduled_at, ar)}</span>,
      sortValue: (s) => new Date(s.scheduled_at).getTime(),
    },
    {
      key: "status", header: "Status", headerAr: "الحالة",
      cell: (s) => <StatusPill map={SESSION_STATUS} value={s.status} />,
    },
    {
      key: "quality", header: "Connection", headerAr: "الاتصال",
      cell: (s) =>
        s.connection_quality
          ? <Pill tone={QUALITY_TONE[s.connection_quality]}>{ar ? QUALITY_LABEL[s.connection_quality].ar : QUALITY_LABEL[s.connection_quality].en}</Pill>
          : <span className="text-muted-foreground">—</span>,
      hideBelow: "md",
    },
    {
      key: "drops", header: "Drops", headerAr: "انقطاعات",
      cell: (s) => (
        <span className={`tabular-nums ${s.drop_count > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {s.drop_count > 0 && <WifiOff size={11} className="inline me-1 -mt-0.5" />}
          {s.drop_count}
        </span>
      ),
      sortValue: (s) => s.drop_count,
      hideBelow: "lg",
      align: "end",
    },
    {
      key: "consent", header: "Consent", headerAr: "الموافقة",
      cell: (s) =>
        s.consent_recorded
          ? <ShieldCheck size={15} className="text-success" aria-label={ar ? "موثقة" : "Recorded"} />
          : <ShieldAlert size={15} className="text-warning" aria-label={ar ? "غير موثقة" : "Not recorded"} />,
      hideBelow: "lg",
      align: "end",
    },
    {
      key: "duration", header: "Duration", headerAr: "المدة",
      cell: (s) => <span className="tabular-nums text-caption">{fmtDuration(s.duration_minutes, ar)}</span>,
      sortValue: (s) => s.duration_minutes ?? -1,
      align: "end",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Telehealth"
        titleAr="الطب عن بعد"
        subtitle="Virtual visit sessions — who is on today, and which calls are struggling."
        subtitleAr="جلسات الزيارات الافتراضية — من على الاتصال اليوم وأي المكالمات تعاني من مشاكل."
        meta={[
          { label: "Live now", labelAr: "جارية الآن", value: String(active.length), tone: active.length > 0 ? "info" : "neutral" },
          { label: "Failed / dropped", labelAr: "فاشلة / منقطعة", value: String(unreliable.length), tone: unreliable.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile
          label="Scheduled today" labelAr="مجدولة اليوم" value={todayScheduled.length}
          icon={Video} tone="neutral"
        />
        <StatTile
          label="Waiting / in progress" labelAr="بالانتظار / جارية" value={active.length}
          icon={Video} tone={active.length > 0 ? "info" : "neutral"}
        />
        <StatTile
          label="Failed or dropped" labelAr="فاشلة أو منقطعة" value={unreliable.length}
          sub="Reliability signal" subAr="مؤشر موثوقية"
          icon={PhoneOff} tone={unreliable.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Connection issues" labelAr="مشاكل اتصال" value={qualityIssues.length}
          sub="Fair or poor quality" subAr="جودة متوسطة أو ضعيفة"
          icon={WifiOff} tone={qualityIssues.length > 0 ? "warning" : "success"}
        />
      </StatGrid>

      <Section title="Sessions" titleAr="الجلسات">
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, provider or session number"
          searchPlaceholderAr="المريض أو مقدم الرعاية أو رقم الجلسة"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(SESSION_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "quality", value: quality, onChange: setQuality,
              allLabel: "All connection quality", allLabelAr: "كل مستويات الاتصال",
              options: Object.entries(QUALITY_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "جلسة" : filtered.length === 1 ? "session" : "sessions"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          initialSort={{ key: "scheduled_at", ascending: false }}
        />
      </Section>
    </Page>
  );
}
