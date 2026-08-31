/**
 * Maintenance — الصيانة
 *
 * Work orders for the biomed team. Open and assigned orders are the queue;
 * a critical-priority order sitting open is the one that turns into a bed
 * closure, so it leads the stat row alongside average downtime.
 */

import { useState, useMemo } from "react";
import { Wrench, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  useCollection, matches, fmtDate, fmtDuration, fmtMoney,
  type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type MaintenanceOrder = Database["public"]["Tables"]["maintenance_orders"]["Row"];

const ORDER_STATUS: StatusMap = {
  open:            { en: "Open",            ar: "مفتوح",         tone: "neutral" },
  assigned:        { en: "Assigned",        ar: "مسند",          tone: "info" },
  in_progress:     { en: "In progress",     ar: "قيد التنفيذ",   tone: "warning" },
  awaiting_parts:  { en: "Awaiting parts",  ar: "بانتظار قطع",   tone: "warning" },
  completed:       { en: "Completed",       ar: "مكتمل",         tone: "success" },
  verified:        { en: "Verified",        ar: "تم التحقق",     tone: "success" },
  cancelled:       { en: "Cancelled",       ar: "ملغى",          tone: "neutral" },
};

const TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  preventive:   { en: "Preventive", ar: "وقائية" },
  corrective:   { en: "Corrective", ar: "تصحيحية" },
  calibration:  { en: "Calibration", ar: "معايرة" },
  safety_test:  { en: "Safety test", ar: "فحص سلامة" },
  inspection:   { en: "Inspection", ar: "تفتيش" },
  upgrade:      { en: "Upgrade", ar: "ترقية" },
};

const PRIORITY_TONE: Record<string, Tone> = { critical: "critical", high: "warning", medium: "neutral", low: "neutral" };
const PRIORITY_LABEL: Record<string, { en: string; ar: string }> = {
  critical: { en: "Critical", ar: "حرجة" },
  high:     { en: "High", ar: "عالية" },
  medium:   { en: "Medium", ar: "متوسطة" },
  low:      { en: "Low", ar: "منخفضة" },
};

export default function Maintenance() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("maintenance_orders");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const types = useMemo(
    () => [...new Set(rows.map((r) => r.maintenance_type))].sort()
      .map((t) => ({ value: t, en: TYPE_LABEL[t]?.en ?? t, ar: TYPE_LABEL[t]?.ar ?? t })),
    [rows],
  );
  const priorities = ["critical", "high", "medium", "low"].map((p) => ({ value: p, en: PRIORITY_LABEL[p].en, ar: PRIORITY_LABEL[p].ar }));
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status))].sort()
      .map((s) => ({ value: s, en: ORDER_STATUS[s]?.en ?? s, ar: ORDER_STATUS[s]?.ar ?? s })),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) =>
      matches(search, r.work_order_number, r.asset_tag, r.asset_name, r.assigned_to, r.fault_description_en)
      && (!typeFilter || r.maintenance_type === typeFilter)
      && (!priorityFilter || r.priority === priorityFilter)
      && (!statusFilter || r.status === statusFilter)),
    [rows, search, typeFilter, priorityFilter, statusFilter],
  );

  const stats = useMemo(() => {
    const openish = rows.filter((r) => r.status === "open" || r.status === "assigned").length;
    const criticalOpen = rows.filter((r) => r.priority === "critical" && r.status !== "completed" && r.status !== "verified" && r.status !== "cancelled").length;
    const downtimes = rows.filter((r) => r.downtime_minutes !== null).map((r) => r.downtime_minutes!);
    const avgDowntime = downtimes.length ? Math.round(downtimes.reduce((a, b) => a + b, 0) / downtimes.length) : null;
    const completed = rows.filter((r) => r.status === "completed" || r.status === "verified").length;
    return { openish, criticalOpen, avgDowntime, completed };
  }, [rows]);

  const columns: Column<MaintenanceOrder>[] = [
    {
      key: "work_order",
      header: "Work order",
      headerAr: "أمر الشغل",
      cell: (r) => <span className="font-medium text-foreground tabular-nums">{r.work_order_number}</span>,
      sortValue: (r) => r.work_order_number,
    },
    {
      key: "asset",
      header: "Asset",
      headerAr: "الجهاز",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate">{r.asset_name}</div>
          <div className="text-micro text-muted-foreground tabular-nums">{r.asset_tag}</div>
        </div>
      ),
      sortValue: (r) => r.asset_name,
    },
    {
      key: "type",
      header: "Type",
      headerAr: "النوع",
      cell: (r) => <Pill tone="neutral">{ar ? (TYPE_LABEL[r.maintenance_type]?.ar ?? r.maintenance_type) : (TYPE_LABEL[r.maintenance_type]?.en ?? r.maintenance_type)}</Pill>,
      sortValue: (r) => r.maintenance_type,
      hideBelow: "sm",
    },
    {
      key: "priority",
      header: "Priority",
      headerAr: "الأولوية",
      cell: (r) => <Pill tone={PRIORITY_TONE[r.priority]}>{ar ? PRIORITY_LABEL[r.priority].ar : PRIORITY_LABEL[r.priority].en}</Pill>,
      sortValue: (r) => r.priority,
    },
    {
      key: "status",
      header: "Status",
      headerAr: "الحالة",
      cell: (r) => <StatusPill map={ORDER_STATUS} value={r.status} />,
      sortValue: (r) => r.status,
    },
    {
      key: "assigned_to",
      header: "Assigned to",
      headerAr: "مسند إلى",
      cell: (r) => r.assigned_to ?? "—",
      hideBelow: "md",
    },
    {
      key: "reported_at",
      header: "Reported",
      headerAr: "تاريخ البلاغ",
      cell: (r) => fmtDate(r.reported_at, ar),
      sortValue: (r) => r.reported_at,
      hideBelow: "md",
    },
    {
      key: "downtime",
      header: "Downtime",
      headerAr: "مدة التوقف",
      cell: (r) => fmtDuration(r.downtime_minutes, ar),
      sortValue: (r) => r.downtime_minutes ?? -1,
      align: "end",
      hideBelow: "lg",
    },
    {
      key: "cost",
      header: "Cost",
      headerAr: "التكلفة",
      cell: (r) => fmtMoney(r.cost, "SAR", ar),
      sortValue: (r) => r.cost ?? 0,
      align: "end",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Maintenance"
        titleAr="الصيانة"
        subtitle="Biomed work orders — preventive, corrective, calibration and safety testing."
        subtitleAr="أوامر شغل الصيانة الطبية — وقائية وتصحيحية ومعايرة وفحوصات سلامة."
        meta={[
          { label: "Critical open", labelAr: "حرجة مفتوحة", value: String(stats.criticalOpen), tone: stats.criticalOpen > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Open + assigned" labelAr="مفتوح ومسند" value={stats.openish} icon={Wrench} tone="brand" />
        <StatTile label="Critical priority, open" labelAr="حرجة ومفتوحة" value={stats.criticalOpen} icon={AlertTriangle} tone={stats.criticalOpen > 0 ? "critical" : "success"} />
        <StatTile label="Avg downtime" labelAr="متوسط التوقف" value={stats.avgDowntime !== null ? fmtDuration(stats.avgDowntime, ar) : "—"} icon={Clock} tone="neutral" />
        <StatTile label="Completed" labelAr="مكتملة" value={stats.completed} icon={CheckCircle2} tone="success" />
      </StatGrid>

      <Section title="Work Orders" titleAr="أوامر الشغل">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search work orders, assets"
          searchPlaceholderAr="بحث عن أمر شغل أو جهاز"
          filters={[
            { key: "type", value: typeFilter, onChange: setTypeFilter, options: types, allLabel: "All types", allLabelAr: "كل الأنواع" },
            { key: "priority", value: priorityFilter, onChange: setPriorityFilter, options: priorities, allLabel: "All priorities", allLabelAr: "كل الأولويات" },
            { key: "status", value: statusFilter, onChange: setStatusFilter, options: statuses, allLabel: "All statuses", allLabelAr: "كل الحالات" },
          ]}
        />
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "reported_at", ascending: false }} />
      </Section>
    </Page>
  );
}
