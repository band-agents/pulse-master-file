/**
 * Housekeeping — النظافة
 *
 * This board directly gates bed turnover: a discharge clean sitting in
 * "pending" is a bed the admissions team cannot fill. Average turnaround is
 * the number that matters more than any single task's status.
 */

import { useState, useMemo } from "react";
import { SprayCan, AlertTriangle, Clock, DoorOpen } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  useCollection, matches, fmtAgo, fmtDuration, type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type HousekeepingTask = Database["public"]["Tables"]["housekeeping_tasks"]["Row"];

const TASK_STATUS: StatusMap = {
  pending:     { en: "Pending",     ar: "معلّقة",       tone: "neutral" },
  assigned:    { en: "Assigned",    ar: "مسندة",        tone: "info" },
  in_progress: { en: "In progress", ar: "قيد التنفيذ",  tone: "warning" },
  completed:   { en: "Completed",   ar: "مكتملة",       tone: "success" },
  verified:    { en: "Verified",    ar: "تم التحقق",    tone: "success" },
  cancelled:   { en: "Cancelled",   ar: "ملغاة",        tone: "neutral" },
};

const TASK_TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  discharge_clean: { en: "Discharge clean", ar: "تنظيف بعد الخروج" },
  daily_clean:     { en: "Daily clean", ar: "تنظيف يومي" },
  terminal_clean:  { en: "Terminal clean", ar: "تنظيف نهائي" },
  spill:           { en: "Spill", ar: "انسكاب" },
  isolation_clean: { en: "Isolation clean", ar: "تنظيف عزل" },
  linen_change:    { en: "Linen change", ar: "تغيير مفروشات" },
  deep_clean:      { en: "Deep clean", ar: "تنظيف عميق" },
};

const PRIORITY_TONE: Record<string, Tone> = { urgent: "critical", high: "warning", normal: "neutral", low: "neutral" };
const PRIORITY_LABEL: Record<string, { en: string; ar: string }> = {
  urgent: { en: "Urgent", ar: "عاجلة" },
  high:   { en: "High", ar: "عالية" },
  normal: { en: "Normal", ar: "عادية" },
  low:    { en: "Low", ar: "منخفضة" },
};

export default function Housekeeping() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("housekeeping_tasks");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const types = useMemo(
    () => [...new Set(rows.map((r) => r.task_type))].sort()
      .map((t) => ({ value: t, en: TASK_TYPE_LABEL[t]?.en ?? t, ar: TASK_TYPE_LABEL[t]?.ar ?? t })),
    [rows],
  );
  const priorities = ["urgent", "high", "normal", "low"].map((p) => ({ value: p, en: PRIORITY_LABEL[p].en, ar: PRIORITY_LABEL[p].ar }));
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status))].sort()
      .map((s) => ({ value: s, en: TASK_STATUS[s]?.en ?? s, ar: TASK_STATUS[s]?.ar ?? s })),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) =>
      matches(search, r.task_number, r.location, r.ward_name, r.assigned_to)
      && (!typeFilter || r.task_type === typeFilter)
      && (!priorityFilter || r.priority === priorityFilter)
      && (!statusFilter || r.status === statusFilter)),
    [rows, search, typeFilter, priorityFilter, statusFilter],
  );

  const stats = useMemo(() => {
    const pendingOrAssigned = rows.filter((r) => r.status === "pending" || r.status === "assigned").length;
    const urgentOpen = rows.filter((r) => r.priority === "urgent" && r.status !== "completed" && r.status !== "verified" && r.status !== "cancelled").length;
    const turnarounds = rows.filter((r) => r.turnaround_minutes !== null).map((r) => r.turnaround_minutes!);
    const avgTurnaround = turnarounds.length ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : null;
    const dischargeInProgress = rows.filter((r) => r.task_type === "discharge_clean" && r.status === "in_progress").length;
    return { pendingOrAssigned, urgentOpen, avgTurnaround, dischargeInProgress };
  }, [rows]);

  const columns: Column<HousekeepingTask>[] = [
    {
      key: "task_number",
      header: "Task",
      headerAr: "المهمة",
      cell: (r) => <span className="font-medium text-foreground tabular-nums">{r.task_number}</span>,
      sortValue: (r) => r.task_number,
    },
    {
      key: "location",
      header: "Location",
      headerAr: "الموقع",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate">{r.location}</div>
          {r.ward_name && <div className="text-micro text-muted-foreground">{r.ward_name}</div>}
        </div>
      ),
      sortValue: (r) => r.location,
    },
    {
      key: "task_type",
      header: "Type",
      headerAr: "النوع",
      cell: (r) => (
        <Pill tone={r.task_type === "isolation_clean" ? "warning" : "neutral"} icon={r.task_type === "isolation_clean" ? AlertTriangle : undefined}>
          {ar ? TASK_TYPE_LABEL[r.task_type]?.ar ?? r.task_type : TASK_TYPE_LABEL[r.task_type]?.en ?? r.task_type}
        </Pill>
      ),
      sortValue: (r) => r.task_type,
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
      cell: (r) => <StatusPill map={TASK_STATUS} value={r.status} />,
      sortValue: (r) => r.status,
    },
    {
      key: "assigned_to",
      header: "Assigned to",
      headerAr: "مسندة إلى",
      cell: (r) => r.assigned_to ?? "—",
      hideBelow: "md",
    },
    {
      key: "requested_at",
      header: "Requested",
      headerAr: "وقت الطلب",
      cell: (r) => fmtAgo(r.requested_at, ar),
      sortValue: (r) => r.requested_at,
      hideBelow: "sm",
    },
    {
      key: "turnaround",
      header: "Turnaround",
      headerAr: "زمن الإنجاز",
      cell: (r) => {
        const long = r.turnaround_minutes !== null && r.turnaround_minutes > 90;
        return (
          <span className={long ? "text-warning font-medium" : "text-foreground"}>
            {fmtDuration(r.turnaround_minutes, ar)}
          </span>
        );
      },
      sortValue: (r) => r.turnaround_minutes ?? -1,
      align: "end",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Housekeeping"
        titleAr="النظافة"
        subtitle="Turnaround on every clean — the number that gates bed turnover."
        subtitleAr="زمن إنجاز كل تنظيف — الرقم الذي يتحكم في دوران الأسرة."
        meta={[
          { label: "Urgent open", labelAr: "عاجلة مفتوحة", value: String(stats.urgentOpen), tone: stats.urgentOpen > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Pending + assigned" labelAr="معلّقة ومسندة" value={stats.pendingOrAssigned} icon={SprayCan} tone="brand" href="/housekeeping" />
        <StatTile label="Urgent, open" labelAr="عاجلة ومفتوحة" value={stats.urgentOpen} icon={AlertTriangle} tone={stats.urgentOpen > 0 ? "critical" : "success"} />
        <StatTile label="Avg turnaround" labelAr="متوسط زمن الإنجاز" value={stats.avgTurnaround !== null ? fmtDuration(stats.avgTurnaround, ar) : "—"} sub="Requested to verified" subAr="من الطلب إلى التحقق" icon={Clock} tone={stats.avgTurnaround !== null && stats.avgTurnaround > 90 ? "warning" : "success"} />
        <StatTile label="Discharge cleans in progress" labelAr="تنظيف خروج قيد التنفيذ" value={stats.dischargeInProgress} icon={DoorOpen} tone="info" />
      </StatGrid>

      <Section title="Housekeeping Tasks" titleAr="مهام النظافة">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search tasks, location, staff"
          searchPlaceholderAr="بحث عن مهمة أو موقع أو موظف"
          filters={[
            { key: "type", value: typeFilter, onChange: setTypeFilter, options: types, allLabel: "All types", allLabelAr: "كل الأنواع" },
            { key: "priority", value: priorityFilter, onChange: setPriorityFilter, options: priorities, allLabel: "All priorities", allLabelAr: "كل الأولويات" },
            { key: "status", value: statusFilter, onChange: setStatusFilter, options: statuses, allLabel: "All statuses", allLabelAr: "كل الحالات" },
          ]}
        />
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "requested_at", ascending: true }} />
      </Section>
    </Page>
  );
}
