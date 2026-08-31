/**
 * Biomedical Assets — الأجهزة الطبية
 *
 * The equipment register. Preventive maintenance dates matter more than any
 * other field here — a ventilator whose PM lapsed is a bed you cannot safely
 * fill, so overdue PM and out-of-service counts lead the stat row.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { HeartPulse, AlertTriangle, Wrench, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  useCollection, matches, fmtDate, fmtDuration, type Column, type StatusMap, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type BiomedAsset = Database["public"]["Tables"]["biomed_assets"]["Row"];

const ASSET_STATUS: StatusMap = {
  in_service:        { en: "In service",       ar: "قيد الخدمة",       tone: "success" },
  under_maintenance: { en: "Under maintenance", ar: "قيد الصيانة",      tone: "warning" },
  awaiting_parts:    { en: "Awaiting parts",    ar: "بانتظار قطع غيار", tone: "warning" },
  out_of_service:    { en: "Out of service",    ar: "خارج الخدمة",      tone: "critical" },
  retired:           { en: "Retired",           ar: "متقاعد",           tone: "neutral" },
  on_loan:           { en: "On loan",           ar: "معار",             tone: "info" },
};

const CATEGORY_LABEL: Record<string, { en: string; ar: string }> = {
  ventilator:     { en: "Ventilator", ar: "جهاز تنفس" },
  defibrillator:  { en: "Defibrillator", ar: "جهاز صدمات" },
  infusion_pump:  { en: "Infusion pump", ar: "مضخة تسريب" },
  monitor:        { en: "Monitor", ar: "شاشة مراقبة" },
  imaging:        { en: "Imaging", ar: "تصوير" },
  anaesthesia:    { en: "Anaesthesia", ar: "تخدير" },
  dialysis:       { en: "Dialysis", ar: "غسيل كلى" },
  surgical:       { en: "Surgical", ar: "جراحي" },
  laboratory:     { en: "Laboratory", ar: "مختبر" },
  sterilisation:  { en: "Sterilisation", ar: "تعقيم" },
  other:          { en: "Other", ar: "أخرى" },
};

const RISK_TONE: Record<string, Tone> = { high: "critical", medium: "warning", low: "neutral" };

export default function BiomedAssets() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("biomed_assets");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort()
      .map((c) => ({ value: c, en: CATEGORY_LABEL[c]?.en ?? c, ar: CATEGORY_LABEL[c]?.ar ?? c })),
    [rows],
  );
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status))].sort()
      .map((s) => ({ value: s, en: ASSET_STATUS[s]?.en ?? s, ar: ASSET_STATUS[s]?.ar ?? s })),
    [rows],
  );
  const risks = [
    { value: "high", en: "High", ar: "مرتفع" },
    { value: "medium", en: "Medium", ar: "متوسط" },
    { value: "low", en: "Low", ar: "منخفض" },
  ];

  const filtered = useMemo(
    () => rows.filter((r) =>
      matches(search, r.name_en, r.name_ar, r.asset_tag, r.manufacturer, r.model, r.serial_number, r.location)
      && (!categoryFilter || r.category === categoryFilter)
      && (!statusFilter || r.status === statusFilter)
      && (!riskFilter || r.risk_class === riskFilter)),
    [rows, search, categoryFilter, statusFilter, riskFilter],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const inService = rows.filter((r) => r.status === "in_service").length;
    const outOrAwaiting = rows.filter((r) => r.status === "out_of_service" || r.status === "awaiting_parts").length;
    const pmOverdue = rows.filter((r) => r.next_pm_due && new Date(r.next_pm_due).getTime() < now).length;
    const highRisk = rows.filter((r) => r.risk_class === "high").length;
    return { inService, outOrAwaiting, pmOverdue, highRisk };
  }, [rows]);

  const columns: Column<BiomedAsset>[] = [
    {
      key: "asset",
      header: "Asset",
      headerAr: "الجهاز",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground truncate">{ar ? (r.name_ar ?? r.name_en) : r.name_en}</div>
          <div className="text-micro text-muted-foreground tabular-nums">{r.asset_tag}</div>
        </div>
      ),
      sortValue: (r) => ar ? (r.name_ar ?? r.name_en) : r.name_en,
    },
    {
      key: "category",
      header: "Category",
      headerAr: "الفئة",
      cell: (r) => <Pill tone="neutral">{ar ? (CATEGORY_LABEL[r.category]?.ar ?? r.category) : (CATEGORY_LABEL[r.category]?.en ?? r.category)}</Pill>,
      sortValue: (r) => r.category,
    },
    {
      key: "manufacturer",
      header: "Manufacturer / Model",
      headerAr: "الشركة المصنعة / الطراز",
      cell: (r) => (
        <div className="text-caption text-muted-foreground">
          {r.manufacturer ?? "—"}{r.model ? ` · ${r.model}` : ""}
        </div>
      ),
      hideBelow: "md",
    },
    {
      key: "location",
      header: "Location",
      headerAr: "الموقع",
      cell: (r) => r.location ?? "—",
      hideBelow: "sm",
    },
    {
      key: "status",
      header: "Status",
      headerAr: "الحالة",
      cell: (r) => <StatusPill map={ASSET_STATUS} value={r.status} />,
      sortValue: (r) => r.status,
    },
    {
      key: "next_pm_due",
      header: "Next PM due",
      headerAr: "الصيانة الوقائية القادمة",
      cell: (r) => {
        if (!r.next_pm_due) return "—";
        const overdue = new Date(r.next_pm_due).getTime() < Date.now();
        const soon = !overdue && new Date(r.next_pm_due).getTime() - Date.now() < 7 * 86_400_000;
        return (
          <span className={overdue ? "text-destructive font-medium" : soon ? "text-warning" : "text-foreground"}>
            {fmtDate(r.next_pm_due, ar)}
          </span>
        );
      },
      sortValue: (r) => r.next_pm_due ?? "",
      hideBelow: "md",
    },
    {
      key: "downtime",
      header: "Downtime YTD",
      headerAr: "التوقف هذا العام",
      cell: (r) => fmtDuration(Math.round(r.downtime_hours_ytd * 60), ar),
      sortValue: (r) => r.downtime_hours_ytd,
      align: "end",
      hideBelow: "lg",
    },
    {
      key: "risk",
      header: "Risk",
      headerAr: "المخاطر",
      cell: (r) => r.risk_class ? <Pill tone={RISK_TONE[r.risk_class]}>{ar ? risks.find((k) => k.value === r.risk_class)?.ar : risks.find((k) => k.value === r.risk_class)?.en}</Pill> : "—",
      sortValue: (r) => r.risk_class ?? "",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Biomedical Assets"
        titleAr="الأجهزة الطبية"
        subtitle="The equipment registry — service status, PM schedule and risk classification."
        subtitleAr="سجل الأجهزة الطبية مع حالة الخدمة وجدول الصيانة الوقائية وتصنيف المخاطر."
        meta={[
          { label: "PM overdue", labelAr: "صيانة وقائية متأخرة", value: String(stats.pmOverdue), tone: stats.pmOverdue > 0 ? "warning" : "success" },
        ]}
        actions={
          <Link
            href="/biomed/maintenance"
            className="inline-flex items-center gap-2 h-9 rounded-xl border border-border/60 bg-background text-body font-medium px-4 hover:bg-muted/50 transition-colors"
          >
            <Wrench size={14} /> {ar ? "طلبات الصيانة" : "Maintenance orders"}
          </Link>
        }
      />

      <StatGrid cols={4}>
        <StatTile label="In service" labelAr="قيد الخدمة" value={stats.inService} icon={HeartPulse} tone="success" />
        <StatTile label="Out of service / awaiting parts" labelAr="خارج الخدمة / بانتظار قطع" value={stats.outOrAwaiting} icon={AlertTriangle} tone={stats.outOrAwaiting > 0 ? "critical" : "success"} />
        <StatTile label="PM overdue" labelAr="صيانة وقائية متأخرة" value={stats.pmOverdue} icon={Wrench} tone={stats.pmOverdue > 0 ? "warning" : "success"} href="/biomed/maintenance" />
        <StatTile label="High risk class" labelAr="فئة مخاطر مرتفعة" value={stats.highRisk} icon={ShieldAlert} tone={stats.highRisk > 0 ? "warning" : "neutral"} />
      </StatGrid>

      <Section title="Equipment Registry" titleAr="سجل الأجهزة">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search assets, tags, serials"
          searchPlaceholderAr="بحث عن جهاز أو رقم أو مسلسل"
          filters={[
            { key: "category", value: categoryFilter, onChange: setCategoryFilter, options: categories, allLabel: "All categories", allLabelAr: "كل الفئات" },
            { key: "status", value: statusFilter, onChange: setStatusFilter, options: statuses, allLabel: "All statuses", allLabelAr: "كل الحالات" },
            { key: "risk", value: riskFilter, onChange: setRiskFilter, options: risks, allLabel: "All risk levels", allLabelAr: "كل مستويات المخاطر" },
          ]}
        />
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "next_pm_due", ascending: true }} />
      </Section>
    </Page>
  );
}
