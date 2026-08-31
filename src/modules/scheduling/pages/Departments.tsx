/**
 * Departments — الأقسام
 *
 * The department registry — small, mostly-static reference data rather than
 * a busy worklist. It exists so any other page can resolve a department name
 * to who runs it, where it is, and whether it takes bookings.
 */

import { useState, useMemo } from "react";
import { Building2, Stethoscope, CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid,
  Pill, StatusPill, useCollection, matches,
  type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Department = Database["public"]["Tables"]["departments"]["Row"];

const DEPARTMENT_TYPE_LABEL: Record<Department["department_type"], { en: string; ar: string }> = {
  clinical:       { en: "Clinical",       ar: "سريري" },
  ancillary:      { en: "Ancillary",      ar: "مساند" },
  administrative: { en: "Administrative", ar: "إداري" },
  support:        { en: "Support",        ar: "دعم" },
};

const DEPARTMENT_STATUS: StatusMap = {
  active:   { en: "Active",   ar: "نشط",     tone: "success" },
  inactive: { en: "Inactive", ar: "غير نشط", tone: "neutral" },
};

export default function Departments() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: departments, loading } = useCollection("departments");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const clinical = departments.filter((d) => d.department_type === "clinical");
  const acceptsAppointments = departments.filter((d) => d.accepts_appointments);

  const filtered = useMemo(
    () => departments.filter((d) =>
      (!type || d.department_type === type) &&
      (!status || d.status === status) &&
      matches(search, d.name_en, d.name_ar, d.code, d.head_provider_name, d.location)),
    [departments, search, type, status],
  );

  const columns: Column<Department>[] = [
    {
      key: "code", header: "Code", headerAr: "الرمز", hideBelow: "sm",
      sortValue: (d) => d.code,
      cell: (d) => <span className="text-body font-medium tabular-nums text-foreground">{d.code}</span>,
    },
    {
      key: "name", header: "Department", headerAr: "القسم",
      sortValue: (d) => d.name_en,
      cell: (d) => <span className="text-body font-medium text-foreground">{ar ? (d.name_ar ?? d.name_en) : d.name_en}</span>,
    },
    {
      key: "type", header: "Type", headerAr: "النوع", hideBelow: "sm",
      sortValue: (d) => d.department_type,
      cell: (d) => <Pill tone="neutral">{ar ? DEPARTMENT_TYPE_LABEL[d.department_type].ar : DEPARTMENT_TYPE_LABEL[d.department_type].en}</Pill>,
    },
    {
      key: "head", header: "Head", headerAr: "الرئيس", hideBelow: "md",
      cell: (d) => <span className="text-body text-foreground">{d.head_provider_name ?? "—"}</span>,
    },
    {
      key: "location", header: "Location", headerAr: "الموقع", hideBelow: "lg",
      cell: (d) => (
        <div>
          <div className="text-body text-foreground">{d.location ?? "—"}</div>
          {d.phone_extension && <div className="text-micro text-muted-foreground tabular-nums">ext. {d.phone_extension}</div>}
        </div>
      ),
    },
    {
      key: "accepts_appointments", header: "Bookable", headerAr: "قابل للحجز", align: "start",
      cell: (d) => d.accepts_appointments
        ? <CheckCircle2 size={16} className="text-success" aria-label={ar ? "قابل للحجز" : "Accepts appointments"} />
        : <XCircle size={16} className="text-muted-foreground/50" aria-label={ar ? "غير قابل للحجز" : "Does not accept appointments"} />,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (d) => <StatusPill map={DEPARTMENT_STATUS} value={d.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Departments"
        titleAr="الأقسام"
        subtitle="The department registry — who runs each one, where it is, and whether it takes bookings."
        subtitleAr="سجل الأقسام — من يديرها، وموقعها، وإمكانية الحجز فيها."
      />

      <StatGrid cols={3}>
        <StatTile label="Total departments" labelAr="إجمالي الأقسام" value={departments.length} icon={Building2} tone="brand" />
        <StatTile label="Clinical" labelAr="سريري" value={clinical.length} icon={Stethoscope} tone="info" />
        <StatTile label="Accept appointments" labelAr="تقبل الحجز" value={acceptsAppointments.length} icon={CalendarCheck} tone="neutral" />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Name, code, head or location"
          searchPlaceholderAr="الاسم أو الرمز أو الرئيس أو الموقع"
          filters={[
            {
              key: "type", value: type, onChange: setType,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: Object.entries(DEPARTMENT_TYPE_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(DEPARTMENT_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
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
          initialSort={{ key: "name", ascending: true }}
        />
      </Section>
    </Page>
  );
}
