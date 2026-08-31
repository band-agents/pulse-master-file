/**
 * Medical Supplies — المستلزمات الطبية
 *
 * The generic reusable-resource table, repurposed here for PPE, consumables
 * and kits. "Utilization" is a stock-consumption rate rather than a staffing
 * one — an item running above 80% is the one that runs out first.
 */

import { useState, useMemo } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, Meter,
  useCollection, matches, type Column, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Resource = Database["public"]["Tables"]["supply_items"]["Row"];

export default function Supplies() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("supply_items");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const types = useMemo(
    () => [...new Set(rows.map((r) => r.type))].sort().map((t) => ({ value: t, en: t, ar: t })),
    [rows],
  );
  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter((d): d is string => Boolean(d)))].sort()
      .map((d) => ({ value: d, en: d, ar: d })),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) =>
      matches(search, r.name_en, r.name_ar, r.type, r.department)
      && (!typeFilter || r.type === typeFilter)
      && (!deptFilter || r.department === deptFilter)),
    [rows, search, typeFilter, deptFilter],
  );

  const stats = useMemo(() => {
    const highUtil = rows.filter((r) => r.utilization > 80).length;
    const depts = new Set(rows.map((r) => r.department).filter(Boolean)).size;
    const avgUtil = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.utilization, 0) / rows.length)
      : 0;
    return { total: rows.length, highUtil, depts, avgUtil };
  }, [rows]);

  const columns: Column<Resource>[] = [
    {
      key: "name",
      header: "Item",
      headerAr: "الصنف",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground truncate">{ar ? (r.name_ar ?? r.name_en) : r.name_en}</div>
        </div>
      ),
      sortValue: (r) => (ar ? (r.name_ar ?? r.name_en) : r.name_en),
    },
    {
      key: "type",
      header: "Type",
      headerAr: "النوع",
      cell: (r) => <Pill tone="neutral">{r.type}</Pill>,
      sortValue: (r) => r.type,
    },
    {
      key: "department",
      header: "Department",
      headerAr: "القسم",
      cell: (r) => r.department ?? "—",
      sortValue: (r) => r.department ?? "",
      hideBelow: "sm",
    },
    {
      key: "utilization",
      header: "Utilization",
      headerAr: "معدل الاستهلاك",
      cell: (r) => {
        const tone: Tone = r.utilization > 80 ? "warning" : "brand";
        return <Meter value={r.utilization} max={100} tone={tone} />;
      },
      sortValue: (r) => r.utilization,
    },
    {
      key: "skills",
      header: "Tags",
      headerAr: "الوسوم",
      cell: (r) =>
        r.skills && r.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.skills.map((s) => (
              <Pill key={s} tone="neutral" className="text-micro">{s}</Pill>
            ))}
          </div>
        ) : null,
      hideBelow: "md",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Medical Supplies"
        titleAr="المستلزمات الطبية"
        subtitle="Tracked consumables, PPE and kits, with live stock utilization."
        subtitleAr="المستلزمات الاستهلاكية ومعدات الوقاية والأطقم المتابَعة مع معدل استهلاك المخزون."
        meta={[
          { label: "Running low", labelAr: "على وشك النفاد", value: String(stats.highUtil), tone: stats.highUtil > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Tracked items" labelAr="أصناف متابَعة" value={stats.total} tone="brand" />
        <StatTile label="Running low" labelAr="على وشك النفاد" value={stats.highUtil} sub="Above 80% utilization" subAr="فوق 80% معدل استهلاك" tone={stats.highUtil > 0 ? "warning" : "success"} />
        <StatTile label="Departments" labelAr="الأقسام" value={stats.depts} tone="neutral" />
        <StatTile label="Average utilization" labelAr="متوسط الاستهلاك" value={`${stats.avgUtil}%`} tone={stats.avgUtil > 80 ? "warning" : "success"} />
      </StatGrid>

      <Section title="Supply Inventory" titleAr="مخزون المستلزمات">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search supplies"
          searchPlaceholderAr="بحث عن مستلزم"
          filters={[
            { key: "type", value: typeFilter, onChange: setTypeFilter, options: types, allLabel: "All types", allLabelAr: "كل الأنواع" },
            { key: "department", value: deptFilter, onChange: setDeptFilter, options: departments, allLabel: "All departments", allLabelAr: "كل الأقسام" },
          ]}
        />
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "utilization", ascending: false }} />
      </Section>
    </Page>
  );
}
