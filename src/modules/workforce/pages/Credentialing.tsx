/**
 * Credentialing — الاعتماد المهني
 *
 * A compliance view over the same provider roster as Providers.tsx. There is
 * no dedicated table: the whole point of this page is to reorder and
 * highlight rows the directory already has, by credentialing risk. An
 * expired or suspended provider must read as "cannot prescribe" at a glance
 * — that is the operational consequence, not an abstract compliance flag.
 */

import { useState, useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid,
  StatusPill, useCollection, matches, fmtDate,
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

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function Credentialing() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: providers, loading } = useCollection("providers");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const verified = providers.filter((p) => p.credential_status === "verified");
  const pending = providers.filter((p) => p.credential_status === "pending");
  const blocked = providers.filter((p) => p.credential_status === "expired" || p.credential_status === "suspended" || p.credential_status === "revoked");
  const expiringSoon = providers.filter((p) => {
    const d = daysUntil(p.license_expiry);
    return d >= 0 && d <= 60;
  });

  const isAtRisk = (p: Provider) => {
    const d = daysUntil(p.license_expiry);
    return p.credential_status !== "verified" || (d >= 0 && d <= 60);
  };

  const needsAttention = useMemo(
    () => [...providers].filter(isAtRisk).sort((a, b) => daysUntil(a.license_expiry) - daysUntil(b.license_expiry)),
    [providers],
  );

  const filtered = useMemo(
    () => providers.filter((p) =>
      (!type || p.provider_type === type) &&
      (!status || p.credential_status === status) &&
      matches(search, p.name_en, p.name_ar, p.license_number, p.license_authority)),
    [providers, search, type, status],
  );

  const columns: Column<Provider>[] = [
    {
      key: "provider", header: "Provider", headerAr: "مقدم الخدمة",
      sortValue: (p) => p.name_en,
      cell: (p) => (
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground truncate">{ar ? (p.name_ar ?? p.name_en) : p.name_en}</div>
          <div className="text-micro text-muted-foreground truncate">
            {ar ? PROVIDER_TYPE_LABEL[p.provider_type].ar : PROVIDER_TYPE_LABEL[p.provider_type].en}
          </div>
        </div>
      ),
    },
    {
      key: "license_number", header: "License #", headerAr: "رقم الترخيص", hideBelow: "sm",
      cell: (p) => <span className="text-body tabular-nums text-foreground">{p.license_number}</span>,
    },
    {
      key: "license_authority", header: "Authority", headerAr: "جهة الترخيص", hideBelow: "lg",
      cell: (p) => <span className="text-body text-foreground">{p.license_authority ?? "—"}</span>,
    },
    {
      key: "license_expiry", header: "Expiry", headerAr: "تاريخ الانتهاء",
      sortValue: (p) => p.license_expiry,
      cell: (p) => {
        const days = daysUntil(p.license_expiry);
        const expired = days < 0;
        const soon = days >= 0 && days <= 60;
        return (
          <span className={`text-body tabular-nums font-medium ${expired ? "text-destructive" : soon ? "text-warning" : "text-foreground"}`}>
            {fmtDate(p.license_expiry, ar)}
          </span>
        );
      },
    },
    {
      key: "credential_status", header: "Status", headerAr: "الحالة",
      sortValue: (p) => p.credential_status,
      cell: (p) => <StatusPill map={CREDENTIAL_STATUS} value={p.credential_status} />,
    },
    {
      key: "can_prescribe", header: "Can prescribe", headerAr: "يمكنه الوصف", align: "start",
      cell: (p) => p.can_prescribe
        ? <CheckCircle2 size={16} className="text-success" aria-label={ar ? "يمكنه الوصف" : "Can prescribe"} />
        : <XCircle size={16} className="text-destructive" aria-label={ar ? "لا يمكنه الوصف" : "Cannot prescribe"} />,
    },
    {
      key: "department", header: "Department", headerAr: "القسم", align: "end", hideBelow: "md",
      cell: (p) => <span className="text-body text-foreground">{p.department_name ?? "—"}</span>,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Credentialing"
        titleAr="الاعتماد المهني"
        subtitle="Licence and credential compliance across the provider roster."
        subtitleAr="متابعة الترخيص والاعتماد المهني لكادر مقدمي الخدمة."
      />

      <StatGrid cols={4}>
        <StatTile label="Verified" labelAr="موثّق" value={verified.length} icon={ShieldCheck} tone="success" />
        <StatTile label="Pending review" labelAr="قيد المراجعة" value={pending.length} icon={Clock3} tone="info" />
        <StatTile
          label="Expired / suspended / revoked" labelAr="منتهي / موقوف / ملغى" value={blocked.length}
          icon={ShieldX} tone={blocked.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Expiring within 60 days" labelAr="ينتهي خلال 60 يوماً" value={expiringSoon.length}
          icon={ShieldAlert} tone={expiringSoon.length > 0 ? "warning" : "success"}
        />
      </StatGrid>

      <Section
        title="Needs attention"
        titleAr="بحاجة لمتابعة"
        description="Not verified, or licensed to practise for 60 days or fewer."
        descriptionAr="غير موثّق، أو الترخيص سارٍ لمدة 60 يوماً أو أقل."
      >
        <DataTable
          rows={needsAttention}
          columns={columns}
          loading={loading}
          empty={
            <div className="py-12 px-6 text-center text-body text-muted-foreground">
              {ar ? "لا يوجد مقدمو خدمة بحاجة لمتابعة الآن." : "No providers currently need attention."}
            </div>
          }
        />
      </Section>

      <Section title="All providers" titleAr="جميع مقدمي الخدمة">
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Name, license number or authority"
          searchPlaceholderAr="الاسم أو رقم الترخيص أو الجهة"
          filters={[
            {
              key: "type", value: type, onChange: setType,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: Object.entries(PROVIDER_TYPE_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(CREDENTIAL_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
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
          initialSort={{ key: "provider", ascending: true }}
        />
      </Section>
    </Page>
  );
}
