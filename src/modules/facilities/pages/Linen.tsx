/**
 * Linen & Laundry — المفروشات والغسيل
 *
 * Each cycle tracks what left the ward against what came back. A shortfall
 * — returned plus condemned short of issued — is stock that has simply
 * vanished, so it is the number the stat row leads with.
 */

import { useState, useMemo } from "react";
import { Shirt, AlertTriangle, Package, Ban } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  useCollection, matches, fmtDate, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type LinenCycle = Database["public"]["Tables"]["linen_cycles"]["Row"];

const CYCLE_STATUS: StatusMap = {
  issued:    { en: "Issued",    ar: "صُرفت",   tone: "info" },
  collected: { en: "Collected", ar: "جُمعت",   tone: "neutral" },
  washing:   { en: "Washing",   ar: "قيد الغسيل", tone: "info" },
  returned:  { en: "Returned",  ar: "أُعيدت",  tone: "success" },
  shortfall: { en: "Shortfall", ar: "عجز",     tone: "critical" },
};

const CATEGORY_LABEL: Record<string, { en: string; ar: string }> = {
  bed_sheets:     { en: "Bed sheets", ar: "ملاءات" },
  pillow_cases:   { en: "Pillow cases", ar: "أكياس وسائد" },
  blankets:       { en: "Blankets", ar: "بطانيات" },
  towels:         { en: "Towels", ar: "مناشف" },
  gowns:          { en: "Gowns", ar: "أثواب" },
  scrubs:         { en: "Scrubs", ar: "زي طبي" },
  theatre_drapes: { en: "Theatre drapes", ar: "شراشف عمليات" },
  curtains:       { en: "Curtains", ar: "ستائر" },
};

function isShortfall(r: LinenCycle): boolean {
  return r.status === "shortfall" || (r.quantity_returned + r.quantity_condemned) < r.quantity_issued;
}

export default function Linen() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("linen_cycles");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort()
      .map((c) => ({ value: c, en: CATEGORY_LABEL[c]?.en ?? c, ar: CATEGORY_LABEL[c]?.ar ?? c })),
    [rows],
  );
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status))].sort()
      .map((s) => ({ value: s, en: CYCLE_STATUS[s]?.en ?? s, ar: CYCLE_STATUS[s]?.ar ?? s })),
    [rows],
  );
  const wards = useMemo(
    () => [...new Set(rows.map((r) => r.ward_name))].sort().map((w) => ({ value: w, en: w, ar: w })),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) =>
      matches(search, r.cycle_number, r.ward_name, r.handled_by)
      && (!categoryFilter || r.category === categoryFilter)
      && (!statusFilter || r.status === statusFilter)
      && (!wardFilter || r.ward_name === wardFilter)),
    [rows, search, categoryFilter, statusFilter, wardFilter],
  );

  const stats = useMemo(() => {
    const shortfalls = rows.filter(isShortfall).length;
    const totalIssued = rows.reduce((s, r) => s + r.quantity_issued, 0);
    const totalCondemned = rows.reduce((s, r) => s + r.quantity_condemned, 0);
    return { cycles: rows.length, shortfalls, totalIssued, totalCondemned };
  }, [rows]);

  const columns: Column<LinenCycle>[] = [
    {
      key: "cycle_number",
      header: "Cycle",
      headerAr: "الدورة",
      cell: (r) => <span className="font-medium text-foreground tabular-nums">{r.cycle_number}</span>,
      sortValue: (r) => r.cycle_number,
    },
    {
      key: "ward_name",
      header: "Ward",
      headerAr: "الجناح",
      cell: (r) => r.ward_name,
      sortValue: (r) => r.ward_name,
    },
    {
      key: "category",
      header: "Category",
      headerAr: "الفئة",
      cell: (r) => <Pill tone="neutral">{ar ? CATEGORY_LABEL[r.category]?.ar ?? r.category : CATEGORY_LABEL[r.category]?.en ?? r.category}</Pill>,
      sortValue: (r) => r.category,
    },
    {
      key: "cycle_date",
      header: "Date",
      headerAr: "التاريخ",
      cell: (r) => fmtDate(r.cycle_date, ar),
      sortValue: (r) => r.cycle_date,
      hideBelow: "sm",
    },
    {
      key: "quantities",
      header: "Issued / Returned / Condemned",
      headerAr: "صُرف / أُعيد / أُتلف",
      cell: (r) => (
        <span className="tabular-nums text-caption">
          <span className="text-foreground font-medium">{r.quantity_issued}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-success">{r.quantity_returned}</span>
          <span className="text-muted-foreground"> / </span>
          <span className={r.quantity_condemned > 0 ? "text-warning" : "text-muted-foreground"}>{r.quantity_condemned}</span>
        </span>
      ),
      sortValue: (r) => r.quantity_issued,
      align: "end",
    },
    {
      key: "status",
      header: "Status",
      headerAr: "الحالة",
      cell: (r) => <StatusPill map={CYCLE_STATUS} value={r.status} icon={isShortfall(r) ? Ban : undefined} />,
      sortValue: (r) => r.status,
    },
    {
      key: "handled_by",
      header: "Handled by",
      headerAr: "المسؤول",
      cell: (r) => r.handled_by ?? "—",
      hideBelow: "md",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Linen & Laundry"
        titleAr="المفروشات والغسيل"
        subtitle="Issue-to-return cycles by ward, with shortfalls flagged."
        subtitleAr="دورات الصرف والإعادة حسب الجناح مع رصد حالات العجز."
        meta={[
          { label: "Shortfalls", labelAr: "حالات عجز", value: String(stats.shortfalls), tone: stats.shortfalls > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Cycles this period" labelAr="دورات هذه الفترة" value={stats.cycles} icon={Shirt} tone="brand" />
        <StatTile label="Shortfalls" labelAr="حالات عجز" value={stats.shortfalls} icon={AlertTriangle} tone={stats.shortfalls > 0 ? "critical" : "success"} />
        <StatTile label="Total issued" labelAr="إجمالي المصروف" value={stats.totalIssued} icon={Package} tone="neutral" />
        <StatTile label="Total condemned" labelAr="إجمالي التالف" value={stats.totalCondemned} tone={stats.totalCondemned > 0 ? "warning" : "success"} />
      </StatGrid>

      <Section title="Linen Cycles" titleAr="دورات المفروشات">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search cycle, ward, staff"
          searchPlaceholderAr="بحث عن دورة أو جناح أو موظف"
          filters={[
            { key: "category", value: categoryFilter, onChange: setCategoryFilter, options: categories, allLabel: "All categories", allLabelAr: "كل الفئات" },
            { key: "status", value: statusFilter, onChange: setStatusFilter, options: statuses, allLabel: "All statuses", allLabelAr: "كل الحالات" },
            { key: "ward", value: wardFilter, onChange: setWardFilter, options: wards, allLabel: "All wards", allLabelAr: "كل الأجنحة" },
          ]}
        />
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "cycle_date", ascending: false }} />
      </Section>
    </Page>
  );
}
