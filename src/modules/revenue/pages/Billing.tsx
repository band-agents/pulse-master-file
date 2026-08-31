/**
 * Billing — الفوترة
 *
 * The itemised charge sheet an invoice is assembled from. Charges start
 * unposted (still editable, not yet on a bill) and get posted once locked
 * in — that boundary is the thing this screen exists to make visible.
 */

import { useState, useMemo } from "react";
import { Receipt, FileEdit, CheckCircle2, Wallet, Tag } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill, PatientCell,
  useCollection, matches, fmtDateTime, fmtMoney, serif, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type ChargeItem = Database["public"]["Tables"]["charge_items"]["Row"];

const CATEGORY_STATUS: StatusMap = {
  consultation: { en: "Consultation", ar: "استشارة", tone: "info" },
  procedure: { en: "Procedure", ar: "إجراء", tone: "brand" },
  medication: { en: "Medication", ar: "دواء", tone: "success" },
  lab: { en: "Lab", ar: "مختبر", tone: "info" },
  imaging: { en: "Imaging", ar: "أشعة", tone: "info" },
  bed: { en: "Bed", ar: "سرير", tone: "neutral" },
  theatre: { en: "Theatre", ar: "عمليات", tone: "brand" },
  consumable: { en: "Consumable", ar: "مستهلكات", tone: "neutral" },
  nursing: { en: "Nursing", ar: "تمريض", tone: "neutral" },
  other: { en: "Other", ar: "أخرى", tone: "neutral" },
};

const SOURCE_STATUS: StatusMap = {
  clinical_order: { en: "Clinical order", ar: "طلب سريري", tone: "neutral" },
  lab_order: { en: "Lab order", ar: "طلب مختبر", tone: "neutral" },
  imaging_order: { en: "Imaging order", ar: "طلب أشعة", tone: "neutral" },
  dispense: { en: "Dispense", ar: "صرف", tone: "neutral" },
  ot_case: { en: "OT case", ar: "حالة عمليات", tone: "neutral" },
  encounter: { en: "Encounter", ar: "زيارة", tone: "neutral" },
  manual: { en: "Manual", ar: "يدوي", tone: "neutral" },
};

const POSTED_STATUS: StatusMap = {
  true: { en: "Posted", ar: "مُرحّلة", tone: "success" },
  false: { en: "Draft", ar: "مسودة", tone: "neutral" },
};

export default function Billing() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("charge_items");
  const { rows: patients } = useCollection("patients");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [postedFilter, setPostedFilter] = useState("");

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const totalCharges = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const unposted = useMemo(() => rows.filter((r) => !r.posted), [rows]);
  const unpostedValue = useMemo(() => unposted.reduce((s, r) => s + r.total, 0), [unposted]);
  const postedTotal = useMemo(() => rows.filter((r) => r.posted).reduce((s, r) => s + r.total, 0), [rows]);
  const avgCharge = rows.length > 0 ? totalCharges / rows.length : 0;

  const filtered = useMemo(
    () => rows.filter((r) => {
      const p = patientMap.get(r.patient_id);
      return (!categoryFilter || r.category === categoryFilter)
        && (!sourceFilter || r.source_type === sourceFilter)
        && (!postedFilter || String(r.posted) === postedFilter)
        && matches(search, r.description_en, r.description_ar, r.cpt_code, p?.name_en, p?.name_ar);
    }),
    [rows, categoryFilter, sourceFilter, postedFilter, search, patientMap],
  );

  const columns: Column<ChargeItem>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      cell: (r) => {
        const p = patientMap.get(r.patient_id);
        return (
          <PatientCell
            name={p ? (ar ? (p.name_ar ?? p.name_en) : p.name_en) : r.patient_id}
            mrn={p?.mrn}
            href={`/chart/${r.patient_id}`}
          />
        );
      },
    },
    {
      key: "description", header: "Description", headerAr: "الوصف",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate max-w-[220px]">{ar ? (r.description_ar ?? r.description_en) : r.description_en}</div>
          {r.cpt_code && <div className="text-micro text-muted-foreground tabular-nums">{r.cpt_code}</div>}
        </div>
      ),
    },
    {
      key: "category", header: "Category", headerAr: "الفئة",
      cell: (r) => <StatusPill map={CATEGORY_STATUS} value={r.category} />,
    },
    {
      key: "qty_price", header: "Qty × Price", headerAr: "الكمية × السعر", align: "end", hideBelow: "md",
      cell: (r) => (
        <span className="text-caption text-muted-foreground tabular-nums whitespace-nowrap">
          {r.quantity} × {fmtMoney(r.unit_price, undefined, ar)}
        </span>
      ),
      sortValue: (r) => r.unit_price * r.quantity,
    },
    {
      key: "discount", header: "Discount", headerAr: "الخصم", align: "end", hideBelow: "lg",
      cell: (r) => r.discount_amount > 0
        ? <span className="text-destructive tabular-nums whitespace-nowrap">-{fmtMoney(r.discount_amount, undefined, ar)}</span>
        : <span className="text-muted-foreground">—</span>,
      sortValue: (r) => r.discount_amount,
    },
    {
      key: "total", header: "Total", headerAr: "الإجمالي", align: "end",
      cell: (r) => <span className="font-semibold text-foreground tabular-nums whitespace-nowrap" style={serif}>{fmtMoney(r.total, undefined, ar)}</span>,
      sortValue: (r) => r.total,
    },
    {
      key: "source", header: "Source", headerAr: "المصدر", hideBelow: "lg",
      cell: (r) => r.source_type ? <StatusPill map={SOURCE_STATUS} value={r.source_type} /> : <span className="text-micro text-muted-foreground">—</span>,
    },
    {
      key: "posted", header: "Status", headerAr: "الحالة",
      cell: (r) => <StatusPill map={POSTED_STATUS} value={String(r.posted)} />,
    },
    {
      key: "charged_at", header: "Charged", headerAr: "تاريخ الشحن", hideBelow: "md",
      cell: (r) => <span className="text-caption text-muted-foreground tabular-nums whitespace-nowrap">{fmtDateTime(r.charged_at, ar)}</span>,
      sortValue: (r) => new Date(r.charged_at).getTime(),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Billing"
        titleAr="الفوترة"
        subtitle="Itemised charges — the sheet every invoice is assembled from."
        subtitleAr="الرسوم التفصيلية — الكشف الذي تُبنى منه كل فاتورة."
        meta={[
          { label: "Unposted", labelAr: "غير مُرحّلة", value: String(unposted.length), tone: unposted.length > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Total charges" labelAr="إجمالي الرسوم" value={fmtMoney(totalCharges, undefined, ar)} icon={Receipt} tone="brand" />
        <StatTile
          label="Unposted charges" labelAr="رسوم غير مُرحّلة"
          value={fmtMoney(unpostedValue, undefined, ar)}
          sub={`${unposted.length} ${ar ? "بند" : "item(s)"}`} subAr={`${unposted.length} بند`}
          icon={FileEdit} tone={unposted.length > 0 ? "warning" : "success"}
        />
        <StatTile label="Posted total" labelAr="إجمالي المُرحّل" value={fmtMoney(postedTotal, undefined, ar)} icon={CheckCircle2} tone="success" />
        <StatTile label="Average charge" labelAr="متوسط الرسم" value={fmtMoney(Math.round(avgCharge), undefined, ar)} icon={Tag} tone="neutral" />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Description, CPT code or patient"
          searchPlaceholderAr="الوصف أو الكود أو المريض"
          filters={[
            {
              key: "category", value: categoryFilter, onChange: setCategoryFilter,
              allLabel: "All categories", allLabelAr: "كل الفئات",
              options: Object.entries(CATEGORY_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "source", value: sourceFilter, onChange: setSourceFilter,
              allLabel: "All sources", allLabelAr: "كل المصادر",
              options: Object.entries(SOURCE_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "posted", value: postedFilter, onChange: setPostedFilter,
              allLabel: "Posted & draft", allLabelAr: "الكل",
              options: [
                { value: "true", en: "Posted", ar: "مُرحّلة" },
                { value: "false", en: "Draft", ar: "مسودة" },
              ],
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "بند" : filtered.length === 1 ? "charge" : "charges"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          initialSort={{ key: "charged_at", ascending: false }}
        />
      </Section>
    </Page>
  );
}
