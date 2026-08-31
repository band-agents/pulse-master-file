/**
 * Admissions & ADT — الدخول والحركة
 *
 * Admission, Discharge and Transfer. Every other module subscribes to what
 * happens here: dietary, housekeeping, billing and the interface engine all
 * key off an ADT event, which is why the message trail is shown alongside the
 * encounter rather than buried in the integration screens.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ClipboardList, LogIn, LogOut, ArrowRightLeft, Plus, Clock, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, PatientCell, useCollection, matches, fmtDateTime, fmtAgo,
  fmtDuration, btnPrimary, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Encounter = Database["public"]["Tables"]["encounters"]["Row"];

const ENCOUNTER_STATUS: StatusMap = {
  planned:     { en: "Planned",     ar: "مخطط",       tone: "neutral" },
  arrived:     { en: "Arrived",     ar: "حضر",        tone: "info" },
  in_progress: { en: "In progress", ar: "قيد الرعاية", tone: "success" },
  on_leave:    { en: "On leave",    ar: "إجازة مؤقتة", tone: "warning" },
  discharged:  { en: "Discharged",  ar: "خرج",        tone: "neutral" },
  cancelled:   { en: "Cancelled",   ar: "ملغى",       tone: "neutral" },
};

const CLASS_LABEL: Record<string, { en: string; ar: string }> = {
  outpatient:  { en: "Outpatient",  ar: "عيادة خارجية" },
  inpatient:   { en: "Inpatient",   ar: "تنويم" },
  emergency:   { en: "Emergency",   ar: "طوارئ" },
  day_case:    { en: "Day case",    ar: "حالة يومية" },
  telehealth:  { en: "Telehealth",  ar: "عن بعد" },
  observation: { en: "Observation", ar: "ملاحظة" },
};

const SOURCE_LABEL: Record<string, { en: string; ar: string }> = {
  emergency: { en: "Emergency", ar: "الطوارئ" },
  referral:  { en: "Referral",  ar: "تحويل" },
  transfer:  { en: "Transfer",  ar: "نقل" },
  elective:  { en: "Elective",  ar: "مخطط" },
  newborn:   { en: "Newborn",   ar: "مولود" },
  walk_in:   { en: "Walk-in",   ar: "مراجعة مباشرة" },
};

/** Hours since admission, for patients still in. */
function stayHours(e: Encounter): number {
  if (!e.admitted_at) return 0;
  const end = e.discharged_at ? new Date(e.discharged_at).getTime() : Date.now();
  return Math.floor((end - new Date(e.admitted_at).getTime()) / 3_600_000);
}

export default function Admissions() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: encounters, loading } = useCollection("encounters");
  const { rows: messages } = useCollection("interface_messages");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cls, setCls] = useState("");

  const live = encounters.filter((e) => e.status === "in_progress" || e.status === "arrived");
  const admittedToday = encounters.filter((e) => e.admitted_at && Date.now() - new Date(e.admitted_at).getTime() < 86_400_000);
  const dischargedToday = encounters.filter((e) => e.discharged_at && Date.now() - new Date(e.discharged_at).getTime() < 86_400_000);

  /** Mean length of stay for completed inpatient episodes. */
  const meanLos = useMemo(() => {
    const done = encounters.filter((e) => e.class === "inpatient" && e.los_hours);
    if (done.length === 0) return null;
    return Math.round(done.reduce((s, e) => s + (e.los_hours ?? 0), 0) / done.length);
  }, [encounters]);

  const adtMessages = messages.filter((m) => m.message_type.startsWith("ADT"));

  const filtered = useMemo(
    () => encounters.filter((e) =>
      (!status || e.status === status) &&
      (!cls || e.class === cls) &&
      matches(search, e.patient_name, e.patient_mrn, e.encounter_number, e.department_name, e.bed_label)),
    [encounters, search, status, cls],
  );

  const columns: Column<Encounter>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (e) => e.patient_name,
      cell: (e) => <PatientCell name={e.patient_name} mrn={e.patient_mrn} />,
    },
    {
      key: "encounter", header: "Encounter", headerAr: "رقم الزيارة", hideBelow: "lg",
      cell: (e) => (
        <div>
          <div className="text-body tabular-nums text-foreground">{e.encounter_number}</div>
          <div className="text-micro text-muted-foreground">
            {ar ? (CLASS_LABEL[e.class]?.ar ?? e.class) : (CLASS_LABEL[e.class]?.en ?? e.class)}
          </div>
        </div>
      ),
    },
    {
      key: "location", header: "Location", headerAr: "الموقع",
      cell: (e) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate">{e.department_name ?? "—"}</div>
          {e.bed_label && <div className="text-micro text-muted-foreground tabular-nums">{e.bed_label}</div>}
        </div>
      ),
    },
    {
      key: "attending", header: "Attending", headerAr: "الطبيب المعالج", hideBelow: "md",
      cell: (e) => <span className="text-body text-muted-foreground">{e.attending_provider_name ?? "—"}</span>,
    },
    {
      key: "admitted", header: "Admitted", headerAr: "وقت الدخول", hideBelow: "md",
      sortValue: (e) => e.admitted_at ?? e.created_at,
      cell: (e) => (
        <div>
          <div className="text-body text-foreground">{e.admitted_at ? fmtDateTime(e.admitted_at, ar) : "—"}</div>
          {e.admission_source && (
            <div className="text-micro text-muted-foreground">
              {ar ? (SOURCE_LABEL[e.admission_source]?.ar ?? e.admission_source) : (SOURCE_LABEL[e.admission_source]?.en ?? e.admission_source)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "stay", header: "Stay", headerAr: "مدة البقاء",
      sortValue: (e) => stayHours(e),
      cell: (e) => {
        if (!e.admitted_at) return <span className="text-muted-foreground">—</span>;
        const h = stayHours(e);
        const tone = e.status === "discharged" ? "neutral" : h > 168 ? "warning" : "neutral";
        return <Pill tone={tone} icon={Clock}>{fmtDuration(h * 60, ar)}</Pill>;
      },
    },
    {
      key: "flags", header: "", headerAr: "",
      cell: (e) => e.isolation_required
        ? <Pill tone="critical" icon={ShieldAlert}>{ar ? "عزل" : "Isolation"}</Pill>
        : null,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (e) => <StatusPill map={ENCOUNTER_STATUS} value={e.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Admissions & ADT"
        titleAr="الدخول والحركة"
        subtitle="Admission, discharge and transfer. Every ADT event broadcasts to dietary, housekeeping, billing and the interface engine."
        subtitleAr="الدخول والخروج والنقل. كل حدث يُبث إلى التغذية والنظافة والفوترة ومحرك التكامل."
        actions={
          <button type="button" className={btnPrimary}>
            <Plus size={14} /> {ar ? "دخول جديد" : "New admission"}
          </button>
        }
      />

      <StatGrid cols={5}>
        <StatTile label="Currently in" labelAr="داخل المستشفى" value={live.length} icon={ClipboardList} tone="brand" />
        <StatTile label="Admitted today" labelAr="دخول اليوم" value={admittedToday.length} icon={LogIn} tone="info" />
        <StatTile label="Discharged today" labelAr="خروج اليوم" value={dischargedToday.length} icon={LogOut} tone="success" />
        <StatTile
          label="Mean length of stay" labelAr="متوسط مدة البقاء"
          value={meanLos !== null ? fmtDuration(meanLos * 60, ar) : "—"}
          sub="Completed inpatient episodes" subAr="حالات التنويم المكتملة"
          icon={Clock} tone="neutral"
        />
        <StatTile
          label="ADT messages today" labelAr="رسائل الحركة اليوم"
          value={adtMessages.length}
          sub={`${adtMessages.filter((m) => m.ack_code === "AA").length} acknowledged`}
          subAr={`${adtMessages.filter((m) => m.ack_code === "AA").length} مؤكدة`}
          icon={ArrowRightLeft} tone="neutral" href="/interop/messages"
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, MRN, encounter number or ward"
          searchPlaceholderAr="المريض أو رقم الملف أو رقم الزيارة أو الجناح"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(ENCOUNTER_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "class", value: cls, onChange: setCls,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: Object.entries(CLASS_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "زيارة" : filtered.length === 1 ? "encounter" : "encounters"}
          </span>
        </FilterBar>
        <DataTable
          rows={filtered} columns={columns} loading={loading}
          rowHref={(e) => `/chart/${e.patient_id}`}
          initialSort={{ key: "admitted", ascending: false }}
        />
      </Section>

      <Section
        title="Recent ADT broadcasts"
        titleAr="آخر رسائل الحركة"
        description="What downstream systems were told, and whether they confirmed it."
        descriptionAr="ما أُبلغت به الأنظمة التابعة وهل أكدت الاستلام."
        actions={<Link href="/interop/messages" className="text-caption text-brand-ink font-medium">{ar ? "السجل الكامل" : "Full log"}</Link>}
      >
        <ul className="divide-y divide-border/25">
          {adtMessages.slice(0, 6).map((m) => (
            <li key={m.id} className="px-5 py-2.5 flex items-center gap-3">
              <span className="text-body font-mono text-brand-ink shrink-0">{m.message_type}</span>
              <span className="text-body text-foreground flex-1 min-w-0 truncate">
                {m.patient_mrn ?? "—"} → {m.endpoint_name}
              </span>
              <Pill tone={m.ack_code === "AA" ? "success" : m.status === "error" || m.status === "dead_letter" ? "critical" : "warning"}>
                {m.ack_code ?? m.status}
              </Pill>
              <span className="text-micro text-muted-foreground tabular-nums w-10 text-end shrink-0">{fmtAgo(m.sent_at ?? m.created_at, ar)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
