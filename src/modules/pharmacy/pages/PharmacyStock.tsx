/**
 * Drug Stock — مخزون الأدوية
 *
 * Inventory by batch: the same drug can have several live batches with
 * different expiries and locations, so the row unit here is the batch, not
 * the drug. Below-reorder and near-expiry are the two conditions a
 * pharmacy manager scans this screen for first.
 */

import { useState, useMemo } from "react";
import { Package, AlertTriangle, ShieldAlert, Snowflake, Lock } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  StatusPill, Meter, useCollection, matches, fmtDate, fmtMoney,
  type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type PharmacyStock = Database["public"]["Tables"]["pharmacy_stock"]["Row"];

const STOCK_STATUS: StatusMap = {
  active:       { en: "Active",       ar: "نشط",         tone: "success" },
  quarantine:   { en: "Quarantine",   ar: "حجر",         tone: "warning" },
  recalled:     { en: "Recalled",     ar: "مسحوب",       tone: "critical" },
  expired:      { en: "Expired",      ar: "منتهي",       tone: "critical" },
  discontinued: { en: "Discontinued", ar: "متوقف",       tone: "neutral" },
};

/** Days until a timestamp, negative when already past. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function PharmacyStock() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: stock, loading } = useCollection("pharmacy_stock");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState("");
  const [flagFilter, setFlagFilter] = useState("");

  const belowReorder = stock.filter((s) => s.quantity_on_hand < s.reorder_level);
  const expiringSoon = useMemo(
    () => stock.filter((s) => s.status === "active" && daysUntil(s.expiry_date) <= 90),
    [stock],
  );
  const highAlert = stock.filter((s) => s.high_alert);

  const forms = useMemo(
    () => Array.from(new Set(stock.map((s) => s.form))).sort().map((f) => ({ value: f, en: f, ar: f })),
    [stock],
  );

  const filtered = useMemo(
    () => stock.filter((s) =>
      (!status || s.status === status) &&
      (!form || s.form === form) &&
      (!flagFilter || (flagFilter === "controlled" && s.controlled_schedule) || (flagFilter === "high_alert" && s.high_alert) || (flagFilter === "refrigerated" && s.requires_refrigeration)) &&
      matches(search, s.name_en, s.name_ar, s.generic_name, s.drug_code, s.batch_number, s.atc_code)),
    [stock, search, status, form, flagFilter],
  );

  const columns: Column<PharmacyStock>[] = [
    {
      key: "drug", header: "Drug", headerAr: "الدواء",
      sortValue: (s) => s.name_en,
      cell: (s) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-body font-medium text-foreground">{ar ? (s.name_ar ?? s.name_en) : s.name_en}</span>
            {s.controlled_schedule && <Pill tone="warning" icon={Lock}>{s.controlled_schedule}</Pill>}
            {s.high_alert && <Pill tone="critical" icon={ShieldAlert}>{ar ? "عالي الخطورة" : "High-alert"}</Pill>}
            {s.requires_refrigeration && <Pill tone="info" icon={Snowflake}>{ar ? "تبريد" : "Cold chain"}</Pill>}
          </div>
          <div className="text-micro text-muted-foreground">
            {s.generic_name ?? "—"} · {s.drug_code} · {s.form} {s.strength}
          </div>
        </div>
      ),
    },
    {
      key: "batch", header: "Batch / expiry", headerAr: "الدفعة / الصلاحية",
      sortValue: (s) => s.expiry_date,
      cell: (s) => {
        const d = daysUntil(s.expiry_date);
        const tone: Tone = d < 0 ? "critical" : d <= 90 ? "warning" : "neutral";
        return (
          <div className="min-w-0">
            <div className="text-body text-foreground tabular-nums">{s.batch_number}</div>
            <Pill tone={tone}>{fmtDate(s.expiry_date, ar)}{d < 0 ? ` · ${ar ? "منتهي" : "expired"}` : ""}</Pill>
          </div>
        );
      },
    },
    {
      key: "quantity", header: "On hand vs reorder", headerAr: "المتوفر مقابل حد الطلب",
      sortValue: (s) => s.quantity_on_hand - s.reorder_level,
      cell: (s) => {
        const low = s.quantity_on_hand < s.reorder_level;
        return (
          <div className="min-w-[140px]">
            <div className={`text-body tabular-nums font-medium ${low ? "text-warning" : "text-foreground"}`}>
              {s.quantity_on_hand} {s.unit}
              <span className="text-micro text-muted-foreground font-normal"> / {s.reorder_level}</span>
            </div>
            <Meter value={s.quantity_on_hand} max={Math.max(s.reorder_level * 2, s.quantity_on_hand, 1)} tone={low ? "warning" : "success"} />
            {s.quantity_reserved > 0 && (
              <div className="text-micro text-muted-foreground tabular-nums">{s.quantity_reserved} {ar ? "محجوز" : "reserved"}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "cost", header: "Unit cost", headerAr: "تكلفة الوحدة", hideBelow: "md", align: "end",
      sortValue: (s) => s.unit_cost,
      cell: (s) => <span className="text-body text-muted-foreground tabular-nums">{fmtMoney(s.unit_cost, undefined, ar)}</span>,
    },
    {
      key: "location", header: "Location", headerAr: "الموقع", hideBelow: "lg",
      cell: (s) => <span className="text-body text-muted-foreground">{s.location}</span>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (s) => <StatusPill map={STOCK_STATUS} value={s.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Drug Stock"
        titleAr="مخزون الأدوية"
        subtitle="Inventory by batch — expiry, reorder level and cold-chain / controlled-drug flags."
        subtitleAr="المخزون حسب الدفعة — الصلاحية، حد إعادة الطلب، وأدوية سلسلة التبريد أو الخاضعة للرقابة."
        meta={[
          { label: "Below reorder level", labelAr: "دون حد الطلب", value: String(belowReorder.length), tone: belowReorder.length > 0 ? "warning" : "success" },
          { label: "Expiring within 90 days", labelAr: "تنتهي خلال 90 يوماً", value: String(expiringSoon.length), tone: expiringSoon.length > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="SKUs (batches)" labelAr="عدد الدفعات" value={stock.length} icon={Package} tone="brand" />
        <StatTile
          label="Below reorder level" labelAr="دون حد إعادة الطلب" value={belowReorder.length}
          icon={AlertTriangle} tone={belowReorder.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Expiring within 90 days" labelAr="تنتهي خلال 90 يوماً" value={expiringSoon.length}
          icon={Snowflake} tone={expiringSoon.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="High-alert drugs" labelAr="أدوية عالية الخطورة" value={highAlert.length}
          sub="Require two-nurse check" subAr="تتطلب تحقق ممرضتين"
          icon={ShieldAlert} tone={highAlert.length > 0 ? "warning" : "neutral"}
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Drug name, generic, code, batch or ATC"
          searchPlaceholderAr="اسم الدواء أو الاسم العلمي أو الرمز أو الدفعة"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(STOCK_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "form", value: form, onChange: setForm,
              allLabel: "All forms", allLabelAr: "كل الأشكال",
              options: forms,
            },
            {
              key: "flag", value: flagFilter, onChange: setFlagFilter,
              allLabel: "All drugs", allLabelAr: "كل الأدوية",
              options: [
                { value: "controlled", en: "Controlled only", ar: "خاضعة للرقابة فقط" },
                { value: "high_alert", en: "High-alert only", ar: "عالية الخطورة فقط" },
                { value: "refrigerated", en: "Cold chain only", ar: "سلسلة التبريد فقط" },
              ],
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "دفعة" : filtered.length === 1 ? "batch" : "batches"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "quantity", ascending: true }} />
      </Section>
    </Page>
  );
}
