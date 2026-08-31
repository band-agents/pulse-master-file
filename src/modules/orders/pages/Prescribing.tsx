/**
 * E-Prescribing — الوصفات الإلكترونية
 *
 * Outpatient and discharge prescribing: what leaves the building with the
 * patient. Two things are enforced here that a paper pad cannot enforce —
 * the prescriber's licence must be current at the moment of signing, and a
 * controlled drug cannot carry repeats.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { FileText, Send, Check, ShieldAlert, Repeat, Ban, Plus } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, PatientCell, useCollection, matches, fmtDateTime, fmtAgo,
  btnPrimary, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Rx = Database["public"]["Tables"]["prescriptions"]["Row"];

const RX_STATUS: StatusMap = {
  draft:               { en: "Draft",               ar: "مسودة",       tone: "neutral" },
  signed:              { en: "Signed",              ar: "موقّعة",      tone: "info" },
  transmitted:         { en: "Sent to pharmacy",    ar: "أُرسلت",      tone: "info" },
  dispensed:           { en: "Dispensed",           ar: "صُرفت",       tone: "success" },
  partially_dispensed: { en: "Partially dispensed", ar: "صُرفت جزئياً", tone: "warning" },
  cancelled:           { en: "Cancelled",           ar: "ملغاة",       tone: "critical" },
  expired:             { en: "Expired",             ar: "منتهية",      tone: "neutral" },
};

export default function Prescribing() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: prescriptions, loading } = useCollection("prescriptions");
  const { rows: providers } = useCollection("providers");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(
    () => prescriptions.filter((r) =>
      (!status || r.status === status) &&
      matches(search, r.drug_name_en, r.drug_name_ar, r.patient_name, r.rx_number, r.prescriber_name)),
    [prescriptions, search, status],
  );

  const awaiting = prescriptions.filter((r) => r.status === "signed" || r.status === "transmitted");
  const controlled = prescriptions.filter((r) => r.controlled_schedule);
  const blocked = prescriptions.filter((r) => (r.metadata as Record<string, unknown> | null)?.blocked_by === "credential_check");

  /** Prescribers whose licence has lapsed or is close to it — the gate that
   *  produced the cancelled prescription in this list. */
  const credentialRisk = useMemo(
    () => providers.filter((p) =>
      p.can_prescribe === false ||
      p.credential_status === "expired" ||
      p.credential_status === "pending" ||
      new Date(p.license_expiry).getTime() - Date.now() < 45 * 86_400_000),
    [providers],
  );

  const columns: Column<Rx>[] = [
    {
      key: "drug", header: "Prescription", headerAr: "الوصفة",
      sortValue: (r) => r.drug_name_en,
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-body font-medium text-foreground">{ar ? (r.drug_name_ar ?? r.drug_name_en) : r.drug_name_en}</span>
            {r.strength && <span className="text-caption text-muted-foreground">{r.strength}</span>}
            {r.controlled_schedule && <Pill tone="warning" icon={ShieldAlert}>{r.controlled_schedule}</Pill>}
          </div>
          <div className="text-micro text-muted-foreground">
            {[r.dose, r.route.toUpperCase(), r.frequency, r.duration_days ? `${r.duration_days}d` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
      ),
    },
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (r) => r.patient_name,
      cell: (r) => <PatientCell name={r.patient_name} href={`/chart/${r.patient_id}`} />,
    },
    {
      key: "prescriber", header: "Prescriber", headerAr: "الطبيب", hideBelow: "md",
      cell: (r) => <span className="text-body text-muted-foreground">{r.prescriber_name}</span>,
    },
    {
      key: "qty", header: "Qty", headerAr: "الكمية", hideBelow: "lg", align: "end",
      sortValue: (r) => r.quantity,
      cell: (r) => (
        <div className="text-end">
          <div className="text-body tabular-nums text-foreground">{r.quantity}</div>
          {r.refills_allowed > 0 && (
            <div className="text-micro text-muted-foreground tabular-nums inline-flex items-center gap-1">
              <Repeat size={9} />{r.refills_used}/{r.refills_allowed}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "pharmacy", header: "Pharmacy", headerAr: "الصيدلية", hideBelow: "lg",
      cell: (r) => <span className="text-body text-muted-foreground truncate">{r.pharmacy_name ?? "—"}</span>,
    },
    {
      key: "when", header: "Issued", headerAr: "تاريخ الإصدار", hideBelow: "md",
      sortValue: (r) => r.created_at,
      cell: (r) => <span className="text-body text-muted-foreground">{fmtAgo(r.created_at, ar)}</span>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (r) => <StatusPill map={RX_STATUS} value={r.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="E-Prescribing"
        titleAr="الوصفات الإلكترونية"
        subtitle="Outpatient and discharge prescriptions, transmitted directly to the dispensing pharmacy."
        subtitleAr="وصفات العيادات والخروج، تُرسل مباشرة إلى الصيدلية الصارفة."
        actions={<button type="button" className={btnPrimary}><Plus size={14} /> {ar ? "وصفة جديدة" : "New prescription"}</button>}
      />

      <StatGrid cols={4}>
        <StatTile label="Awaiting dispensing" labelAr="بانتظار الصرف" value={awaiting.length} icon={Send} tone={awaiting.length > 0 ? "info" : "success"} href="/pharmacy" />
        <StatTile label="Dispensed" labelAr="صُرفت" value={prescriptions.filter((r) => r.status === "dispensed").length} icon={Check} tone="success" />
        <StatTile
          label="Controlled drugs" labelAr="أدوية مراقبة" value={controlled.length}
          sub="No repeats permitted" subAr="لا يُسمح بإعادة الصرف"
          icon={ShieldAlert} tone={controlled.length > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Blocked at signing" labelAr="محجوبة عند التوقيع" value={blocked.length}
          sub="Prescriber credential check" subAr="فحص اعتماد الطبيب"
          icon={Ban} tone={blocked.length > 0 ? "critical" : "success"} href="/credentialing"
        />
      </StatGrid>

      {blocked.length > 0 && (
        <Section
          title="Blocked by credential check"
          titleAr="محجوبة بفحص الاعتماد"
          description="Signing was refused because the prescriber's licence was not current at that moment."
          descriptionAr="رُفض التوقيع لأن رخصة الطبيب لم تكن سارية في تلك اللحظة."
        >
          <ul className="divide-y divide-border/25">
            {blocked.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-start gap-3">
                <Ban size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground">
                    {ar ? (r.drug_name_ar ?? r.drug_name_en) : r.drug_name_en} · {r.patient_name}
                  </div>
                  <div className="text-caption text-muted-foreground mt-0.5">
                    {ar ? (r.notes_ar ?? r.notes_en) : r.notes_en}
                  </div>
                  <div className="text-micro text-muted-foreground mt-0.5 tabular-nums">
                    {r.rx_number} · {r.prescriber_name} · {fmtDateTime(r.created_at, ar)}
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
          searchPlaceholder="Drug, patient, prescriber or Rx number"
          searchPlaceholderAr="الدواء أو المريض أو الطبيب أو رقم الوصفة"
          filters={[{
            key: "status", value: status, onChange: setStatus,
            allLabel: "All statuses", allLabelAr: "كل الحالات",
            options: Object.entries(RX_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
          }]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "وصفة" : filtered.length === 1 ? "prescription" : "prescriptions"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "when", ascending: false }} />
      </Section>

      {credentialRisk.length > 0 && (
        <Section
          title="Prescribing rights at risk"
          titleAr="صلاحيات وصف معرضة للخطر"
          description="Licences that have lapsed or expire within 45 days. An expired licence blocks signing outright."
          descriptionAr="رخص منتهية أو تنتهي خلال ٤٥ يوماً. الرخصة المنتهية تمنع التوقيع تماماً."
          actions={<Link href="/credentialing" className="text-caption text-brand-ink font-medium">{ar ? "الاعتماد المهني" : "Credentialing"}</Link>}
        >
          <ul className="divide-y divide-border/25">
            {credentialRisk.map((p) => {
              const days = Math.ceil((new Date(p.license_expiry).getTime() - Date.now()) / 86_400_000);
              return (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium text-foreground">{ar ? (p.name_ar ?? p.name_en) : p.name_en}</div>
                    <div className="text-micro text-muted-foreground">{p.speciality_en} · {p.license_number}</div>
                  </div>
                  {!p.can_prescribe && <Pill tone="critical" icon={Ban}>{ar ? "الوصف موقوف" : "Cannot prescribe"}</Pill>}
                  <Pill tone={days < 0 ? "critical" : days < 30 ? "warning" : "neutral"}>
                    {days < 0
                      ? (ar ? `منتهية منذ ${-days} يوم` : `Expired ${-days}d ago`)
                      : (ar ? `تنتهي خلال ${days} يوم` : `Expires in ${days}d`)}
                  </Pill>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </Page>
  );
}
