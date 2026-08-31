/**
 * Dispensing Queue — قائمة الصرف
 *
 * The pharmacy counter's worklist: pending → verified → dispensed →
 * collected. Emergency dispenses that skip the pharmacist verification step
 * are the safety signal this screen is built to surface, not just another
 * filter value.
 */

import { useState, useMemo } from "react";
import { PillBottle, Clock, CheckCircle2, Siren, GraduationCap } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, PatientCell, useCollection, matches, fmtMoney,
  type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Dispense = Database["public"]["Tables"]["dispenses"]["Row"];

const DISPENSE_STATUS: StatusMap = {
  pending:   { en: "Pending",   ar: "قيد الانتظار", tone: "neutral" },
  verified:  { en: "Verified",  ar: "تم التحقق",    tone: "info" },
  dispensed: { en: "Dispensed", ar: "تم الصرف",     tone: "success" },
  collected: { en: "Collected", ar: "تم الاستلام",  tone: "success" },
  returned:  { en: "Returned",  ar: "مرتجع",         tone: "warning" },
  cancelled: { en: "Cancelled", ar: "ملغى",          tone: "warning" },
};

const DISPENSE_TYPE: { value: string; en: string; ar: string }[] = [
  { value: "outpatient", en: "Outpatient", ar: "عيادات خارجية" },
  { value: "inpatient",  en: "Inpatient",  ar: "مرضى داخليون" },
  { value: "discharge",  en: "Discharge",  ar: "خروج" },
  { value: "ward_stock", en: "Ward stock", ar: "مخزون القسم" },
  { value: "emergency",  en: "Emergency",  ar: "طوارئ" },
];

export default function PharmacyQueue() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: dispenses, loading } = useCollection("dispenses");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const pending = dispenses.filter((d) => d.status === "pending");
  const awaitingCollection = dispenses.filter((d) => d.status === "verified" || d.status === "dispensed");
  const dispensedToday = useMemo(() => {
    const today = new Date().toDateString();
    return dispenses.filter((d) => d.dispensed_at && new Date(d.dispensed_at).toDateString() === today);
  }, [dispenses]);
  const emergencyUnverified = useMemo(
    () => dispenses.filter((d) => d.dispense_type === "emergency" && !d.verified_by),
    [dispenses],
  );

  const filtered = useMemo(
    () => dispenses.filter((d) =>
      (!type || d.dispense_type === type) &&
      (!status || d.status === status) &&
      matches(search, d.patient_name, d.drug_name, d.dispense_number, d.batch_number)),
    [dispenses, search, type, status],
  );

  const columns: Column<Dispense>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (d) => d.patient_name,
      cell: (d) => <PatientCell name={d.patient_name} href={`/chart/${d.patient_id}`} />,
    },
    {
      key: "drug", header: "Drug", headerAr: "الدواء",
      sortValue: (d) => d.drug_name,
      cell: (d) => (
        <div className="min-w-0">
          <div className="text-body text-foreground">{d.drug_name}</div>
          <div className="text-micro text-muted-foreground tabular-nums">
            {d.dispense_number}{d.batch_number ? ` · ${ar ? "دفعة" : "batch"} ${d.batch_number}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "quantity", header: "Quantity", headerAr: "الكمية", align: "end",
      sortValue: (d) => d.quantity,
      cell: (d) => <span className="text-body text-foreground tabular-nums">{d.quantity} {d.unit}</span>,
    },
    {
      key: "type", header: "Type", headerAr: "النوع",
      sortValue: (d) => d.dispense_type,
      cell: (d) => {
        const def = DISPENSE_TYPE.find((t) => t.value === d.dispense_type);
        return <Pill tone={d.dispense_type === "emergency" ? "critical" : "neutral"} icon={d.dispense_type === "emergency" ? Siren : undefined}>
          {ar ? (def?.ar ?? d.dispense_type) : (def?.en ?? d.dispense_type)}
        </Pill>;
      },
    },
    {
      key: "handledBy", header: "Verified / dispensed by", headerAr: "التحقق / الصرف", hideBelow: "lg",
      cell: (d) => (
        <div className="text-caption text-muted-foreground">
          <div>{d.verified_by ?? "—"}</div>
          <div>{d.dispensed_by ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "counselled", header: "Counselled", headerAr: "تم الإرشاد", hideBelow: "lg", align: "end",
      cell: (d) => d.counselled
        ? <Pill tone="success" icon={GraduationCap}>{ar ? "نعم" : "Yes"}</Pill>
        : <span className="text-micro text-muted-foreground">{ar ? "لا" : "No"}</span>,
    },
    {
      key: "cost", header: "Cost", headerAr: "التكلفة", align: "end",
      sortValue: (d) => d.total_cost,
      cell: (d) => <span className="text-body text-foreground tabular-nums">{fmtMoney(d.total_cost, undefined, ar)}</span>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (d) => <StatusPill map={DISPENSE_STATUS} value={d.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Dispensing Queue"
        titleAr="قائمة الصرف"
        subtitle="The pharmacy counter's worklist, from pending verification to collection."
        subtitleAr="قائمة عمل صيدلية العيادات، من التحقق المعلق إلى الاستلام."
        meta={[
          { label: "Pending", labelAr: "قيد الانتظار", value: String(pending.length), tone: pending.length > 0 ? "warning" : "success" },
          { label: "Emergency unverified", labelAr: "طوارئ دون تحقق", value: String(emergencyUnverified.length), tone: emergencyUnverified.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Pending" labelAr="قيد الانتظار" value={pending.length} icon={Clock} tone={pending.length > 0 ? "warning" : "success"} />
        <StatTile
          label="Awaiting collection" labelAr="بانتظار الاستلام" value={awaitingCollection.length}
          icon={PillBottle} tone="info"
        />
        <StatTile
          label="Dispensed today" labelAr="تم صرفه اليوم" value={dispensedToday.length}
          icon={CheckCircle2} tone="brand"
        />
        <StatTile
          label="Emergency dispenses unverified" labelAr="صرف طوارئ دون تحقق" value={emergencyUnverified.length}
          sub="Skipped the two-step check" subAr="تخطت خطوة التحقق"
          icon={Siren} tone={emergencyUnverified.length > 0 ? "critical" : "success"}
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, drug, dispense number or batch"
          searchPlaceholderAr="المريض أو الدواء أو رقم الصرف أو الدفعة"
          filters={[
            {
              key: "type", value: type, onChange: setType,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: DISPENSE_TYPE,
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(DISPENSE_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "صرف" : filtered.length === 1 ? "dispense" : "dispenses"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "status", ascending: true }} />
      </Section>
    </Page>
  );
}
