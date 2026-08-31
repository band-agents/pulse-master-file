/**
 * Blood Bank — بنك الدم
 *
 * An inventory board for blood components: what is on the shelf, what is
 * about to expire, and what has been set aside for a patient. A unit that
 * failed donor screening must never blend in with the rest of the shelf, so
 * it gets the same critical treatment as an expired one.
 */

import { useState, useMemo } from "react";
import { Droplet, AlertTriangle, Snowflake, ShieldCheck, ShieldX, Clock3 } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, PatientCell, useCollection, matches, fmtDate, type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type BloodUnit = Database["public"]["Tables"]["blood_units"]["Row"];

const UNIT_STATUS: StatusMap = {
  quarantine:   { en: "Quarantine",   ar: "حجر",         tone: "warning" },
  available:    { en: "Available",    ar: "متاح",        tone: "success" },
  crossmatched: { en: "Crossmatched", ar: "مطابق",       tone: "info" },
  reserved:     { en: "Reserved",     ar: "محجوز",       tone: "info" },
  issued:       { en: "Issued",       ar: "مصروف",       tone: "brand" },
  transfused:   { en: "Transfused",   ar: "تم النقل",    tone: "neutral" },
  discarded:    { en: "Discarded",    ar: "تالف",        tone: "critical" },
  expired:      { en: "Expired",      ar: "منتهي",       tone: "critical" },
};

const COMPONENTS: { value: string; en: string; ar: string }[] = [
  { value: "whole_blood",     en: "Whole blood",    ar: "دم كامل" },
  { value: "prbc",            en: "PRBC",            ar: "خلايا مرتصة" },
  { value: "ffp",             en: "FFP",             ar: "بلازما طازجة" },
  { value: "platelets",       en: "Platelets",       ar: "صفائح دموية" },
  { value: "cryoprecipitate", en: "Cryoprecipitate", ar: "راسب برد" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Days until a timestamp, negative when already past. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function BloodBank() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: units, loading } = useCollection("blood_units");
  const [search, setSearch] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [component, setComponent] = useState("");
  const [status, setStatus] = useState("");

  const available = units.filter((u) => u.status === "available");
  const expiringSoon = useMemo(
    () => units.filter((u) => (u.status === "available" || u.status === "reserved" || u.status === "crossmatched") && daysUntil(u.expires_at) <= 7),
    [units],
  );
  const quarantined = units.filter((u) => u.status === "quarantine");
  const held = units.filter((u) => u.status === "reserved" || u.status === "crossmatched");
  const failedScreening = units.filter((u) => !u.screening_passed);

  const filtered = useMemo(
    () => units.filter((u) =>
      (!bloodGroup || u.blood_group === bloodGroup) &&
      (!component || u.component === component) &&
      (!status || u.status === status) &&
      matches(search, u.unit_number, u.reserved_for_patient_name, u.donor_reference, u.storage_location)),
    [units, search, bloodGroup, component, status],
  );

  const columns: Column<BloodUnit>[] = [
    {
      key: "unit", header: "Unit", headerAr: "الوحدة",
      sortValue: (u) => u.unit_number,
      cell: (u) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-body font-medium text-foreground tabular-nums">{u.unit_number}</span>
            {!u.screening_passed && <Pill tone="critical" icon={ShieldX}>{ar ? "فشل الفحص" : "Screening failed"}</Pill>}
          </div>
          <div className="text-micro text-muted-foreground">
            {u.donor_reference ?? "—"}{u.storage_location ? ` · ${u.storage_location}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "group", header: "Group", headerAr: "الفصيلة",
      sortValue: (u) => u.blood_group,
      cell: (u) => <Pill tone="brand" icon={Droplet}><span className="font-semibold">{u.blood_group}</span></Pill>,
    },
    {
      key: "component", header: "Component", headerAr: "المكون",
      sortValue: (u) => u.component,
      cell: (u) => {
        const d = COMPONENTS.find((c) => c.value === u.component);
        return <span className="text-body text-foreground">{ar ? (d?.ar ?? u.component) : (d?.en ?? u.component)}</span>;
      },
    },
    {
      key: "volume", header: "Volume", headerAr: "الحجم", hideBelow: "md", align: "end",
      sortValue: (u) => u.volume_ml,
      cell: (u) => <span className="text-body text-muted-foreground tabular-nums">{u.volume_ml} {ar ? "مل" : "mL"}</span>,
    },
    {
      key: "expires", header: "Expires", headerAr: "الصلاحية",
      sortValue: (u) => u.expires_at,
      cell: (u) => {
        const d = daysUntil(u.expires_at);
        const tone: Tone = d < 0 ? "critical" : d <= 7 ? "warning" : "neutral";
        return (
          <Pill tone={tone} icon={d <= 7 ? Clock3 : undefined}>
            {fmtDate(u.expires_at, ar)}
            {d < 0 ? ` · ${ar ? "منتهي" : "expired"}` : d <= 7 ? ` · ${d}${ar ? "ي" : "d"}` : ""}
          </Pill>
        );
      },
    },
    {
      key: "reserved", header: "Reserved for", headerAr: "محجوز لـ",
      sortValue: (u) => u.reserved_for_patient_name ?? "",
      cell: (u) => u.reserved_for_patient_name
        ? <PatientCell name={u.reserved_for_patient_name} href={u.reserved_for_patient_id ? `/chart/${u.reserved_for_patient_id}` : undefined} />
        : <span className="text-body text-muted-foreground">—</span>,
    },
    {
      key: "screening", header: "Screening", headerAr: "الفحص", hideBelow: "lg", align: "end",
      cell: (u) => u.screening_passed
        ? <Pill tone="success" icon={ShieldCheck}>{ar ? "سليم" : "Passed"}</Pill>
        : <Pill tone="critical" icon={ShieldX}>{ar ? "فشل" : "Failed"}</Pill>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (u) => <StatusPill map={UNIT_STATUS} value={u.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Blood Bank"
        titleAr="بنك الدم"
        subtitle="Component inventory, expiry watch and reservations for the blood bank."
        subtitleAr="مخزون المكونات، مراقبة الصلاحية وحجوزات بنك الدم."
        meta={[
          { label: "Available", labelAr: "متاح", value: String(available.length), tone: "success" },
          { label: "Expiring within 7 days", labelAr: "تنتهي خلال 7 أيام", value: String(expiringSoon.length), tone: expiringSoon.length > 0 ? "warning" : "success" },
          { label: "Screening failures", labelAr: "فشل الفحص", value: String(failedScreening.length), tone: failedScreening.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Units available" labelAr="وحدات متاحة" value={available.length} icon={Droplet} tone="brand" />
        <StatTile
          label="Expiring within 7 days" labelAr="تنتهي خلال 7 أيام" value={expiringSoon.length}
          icon={Clock3} tone={expiringSoon.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="In quarantine" labelAr="قيد الحجر" value={quarantined.length}
          sub="Not yet released" subAr="لم تُعتمد بعد"
          icon={Snowflake} tone={quarantined.length > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Reserved / crossmatched" labelAr="محجوز / مطابق" value={held.length}
          icon={ShieldCheck} tone="info"
        />
      </StatGrid>

      {failedScreening.length > 0 && (
        <Section
          title="Failed screening"
          titleAr="وحدات فشلت في الفحص"
          description="These units must not be released for transfusion under any status."
          descriptionAr="هذه الوحدات يجب ألا تُصرف للنقل تحت أي حالة."
        >
          <ul className="divide-y divide-border/25">
            {failedScreening.map((u) => (
              <li key={u.id} className="px-5 py-3 flex items-start gap-3">
                <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground">
                    {u.unit_number} · {u.blood_group} · {COMPONENTS.find((c) => c.value === u.component)?.[ar ? "ar" : "en"] ?? u.component}
                  </div>
                  <div className="text-micro text-muted-foreground tabular-nums mt-0.5">
                    {u.storage_location ?? "—"} · <StatusPill map={UNIT_STATUS} value={u.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Unit number, donor ref, patient or location"
          searchPlaceholderAr="رقم الوحدة أو المتبرع أو المريض أو الموقع"
          filters={[
            {
              key: "bloodGroup", value: bloodGroup, onChange: setBloodGroup,
              allLabel: "All groups", allLabelAr: "كل الفصائل",
              options: BLOOD_GROUPS.map((g) => ({ value: g, en: g, ar: g })),
            },
            {
              key: "component", value: component, onChange: setComponent,
              allLabel: "All components", allLabelAr: "كل المكونات",
              options: COMPONENTS,
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(UNIT_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "وحدة" : filtered.length === 1 ? "unit" : "units"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "expires", ascending: true }} />
      </Section>
    </Page>
  );
}
