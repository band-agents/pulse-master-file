/**
 * Providers — مقدمو الخدمة
 *
 * The full clinical staff directory. Credentialing risk is surfaced here as
 * a count and a note rather than worked in full — that detail view lives on
 * the Credentialing page.
 */

import { useState, useMemo } from "react";
import { Users, Stethoscope, ShieldAlert, Pill as PillIcon, Phone, Mail } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid,
  Pill, StatusPill, useCollection, matches, fmtDate,
  type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Provider = Database["public"]["Tables"]["providers"]["Row"];

const PROVIDER_TYPE_LABEL: Record<Provider["provider_type"], { en: string; ar: string }> = {
  physician:  { en: "Physician",  ar: "طبيب" },
  surgeon:    { en: "Surgeon",    ar: "جراح" },
  nurse:      { en: "Nurse",      ar: "ممرض" },
  midwife:    { en: "Midwife",    ar: "قابلة" },
  technician: { en: "Technician", ar: "فني" },
  pharmacist: { en: "Pharmacist", ar: "صيدلي" },
  therapist:  { en: "Therapist",  ar: "معالج" },
  dentist:    { en: "Dentist",    ar: "طبيب أسنان" },
  radiologist:{ en: "Radiologist",ar: "أخصائي أشعة" },
  pathologist:{ en: "Pathologist",ar: "أخصائي أمراض" },
};

const CREDENTIAL_STATUS: StatusMap = {
  verified:  { en: "Verified",  ar: "موثّق",  tone: "success" },
  pending:   { en: "Pending",   ar: "قيد المراجعة", tone: "info" },
  expired:   { en: "Expired",   ar: "منتهي", tone: "critical" },
  suspended: { en: "Suspended", ar: "موقوف", tone: "warning" },
  revoked:   { en: "Revoked",   ar: "ملغى",  tone: "critical" },
};

const EMPLOYMENT_LABEL: Record<Provider["employment_type"], { en: string; ar: string }> = {
  full_time: { en: "Full-time", ar: "دوام كامل" },
  part_time: { en: "Part-time", ar: "دوام جزئي" },
  visiting:  { en: "Visiting",  ar: "زائر" },
  locum:     { en: "Locum",     ar: "بديل مؤقت" },
  resident:  { en: "Resident",  ar: "مقيم" },
  consultant:{ en: "Consultant",ar: "استشاري" },
};

const PROVIDER_STATUS: StatusMap = {
  active:   { en: "Active",   ar: "نشط",     tone: "success" },
  on_leave: { en: "On leave", ar: "إجازة",   tone: "warning" },
  inactive: { en: "Inactive", ar: "غير نشط", tone: "neutral" },
};

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function Providers() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: providers, loading } = useCollection("providers");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("active");

  const active = providers.filter((p) => p.status === "active");
  const clinicians = active.filter((p) => p.provider_type === "physician" || p.provider_type === "surgeon");
  const atRisk = providers.filter((p) => p.credential_status !== "verified");
  const canPrescribe = active.filter((p) => p.can_prescribe);

  const departmentOptions = useMemo(() => {
    const set = new Set(providers.map((p) => p.department_name).filter((v): v is string => Boolean(v)));
    return [...set].sort().map((v) => ({ value: v, en: v, ar: v }));
  }, [providers]);

  const filtered = useMemo(
    () => providers.filter((p) =>
      (!type || p.provider_type === type) &&
      (!department || p.department_name === department) &&
      (!status || p.status === status) &&
      matches(search, p.name_en, p.name_ar, p.license_number, p.speciality_en, p.employee_id)),
    [providers, search, type, department, status],
  );

  const columns: Column<Provider>[] = [
    {
      key: "name", header: "Provider", headerAr: "مقدم الخدمة",
      sortValue: (p) => p.name_en,
      cell: (p) => (
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground truncate">{ar ? (p.name_ar ?? p.name_en) : p.name_en}</div>
          {p.title && <div className="text-micro text-muted-foreground truncate">{p.title}</div>}
        </div>
      ),
    },
    {
      key: "type", header: "Type", headerAr: "النوع", hideBelow: "sm",
      sortValue: (p) => p.provider_type,
      cell: (p) => <Pill tone="neutral">{ar ? PROVIDER_TYPE_LABEL[p.provider_type].ar : PROVIDER_TYPE_LABEL[p.provider_type].en}</Pill>,
    },
    {
      key: "speciality", header: "Speciality", headerAr: "التخصص", hideBelow: "md",
      cell: (p) => <span className="text-body text-foreground">{(ar ? p.speciality_ar : p.speciality_en) ?? "—"}</span>,
    },
    {
      key: "department", header: "Department", headerAr: "القسم", hideBelow: "lg",
      sortValue: (p) => p.department_name ?? "",
      cell: (p) => <span className="text-body text-foreground">{p.department_name ?? "—"}</span>,
    },
    {
      key: "license", header: "License", headerAr: "الترخيص", hideBelow: "md",
      sortValue: (p) => p.license_expiry,
      cell: (p) => {
        const days = daysUntil(p.license_expiry);
        const warn = days < 0 || days <= 60;
        return (
          <div>
            <div className="text-body tabular-nums text-foreground">{p.license_number}</div>
            <div className={`text-micro tabular-nums ${warn ? (days < 0 ? "text-destructive" : "text-warning") : "text-muted-foreground"}`}>
              {fmtDate(p.license_expiry, ar)}
            </div>
          </div>
        );
      },
    },
    {
      key: "credential_status", header: "Credentialing", headerAr: "الاعتماد",
      sortValue: (p) => p.credential_status,
      cell: (p) => <StatusPill map={CREDENTIAL_STATUS} value={p.credential_status} />,
    },
    {
      key: "employment", header: "Employment", headerAr: "التوظيف", hideBelow: "lg",
      cell: (p) => <span className="text-body text-foreground">{ar ? EMPLOYMENT_LABEL[p.employment_type].ar : EMPLOYMENT_LABEL[p.employment_type].en}</span>,
    },
    {
      key: "contact", header: "Contact", headerAr: "التواصل", align: "end", hideBelow: "lg",
      cell: (p) => (
        <div className="flex items-center gap-2 justify-end text-muted-foreground">
          {p.phone && <Phone size={13} aria-label={p.phone} />}
          {p.email && <Mail size={13} aria-label={p.email} />}
          {!p.phone && !p.email && "—"}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Providers"
        titleAr="مقدمو الخدمة"
        subtitle="The clinical staff directory — physicians, nurses and allied professionals."
        subtitleAr="دليل الكادر الطبي — الأطباء والتمريض والمهن المساندة."
      />

      <StatGrid cols={4}>
        <StatTile label="Active providers" labelAr="مقدمو خدمة نشطون" value={active.length} icon={Users} tone="brand" />
        <StatTile label="Physicians & surgeons" labelAr="أطباء وجراحون" value={clinicians.length} icon={Stethoscope} tone="info" />
        <StatTile
          label="Needs credentialing review" labelAr="بحاجة لمراجعة الاعتماد" value={atRisk.length}
          sub="See Credentialing for detail" subAr="راجع صفحة الاعتماد للتفاصيل"
          icon={ShieldAlert} tone={atRisk.length > 0 ? "warning" : "success"} href="/credentialing"
        />
        <StatTile label="Can prescribe" labelAr="يمكنهم الوصف" value={canPrescribe.length} icon={PillIcon} tone="neutral" />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Name, license number, speciality or employee ID"
          searchPlaceholderAr="الاسم أو رقم الترخيص أو التخصص أو الرقم الوظيفي"
          filters={[
            {
              key: "type", value: type, onChange: setType,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: Object.entries(PROVIDER_TYPE_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "department", value: department, onChange: setDepartment,
              allLabel: "All departments", allLabelAr: "كل الأقسام",
              options: departmentOptions,
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(PROVIDER_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
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
