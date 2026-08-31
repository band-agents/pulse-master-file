/**
 * Dietary & Kitchen — التغذية والمطبخ
 *
 * Two lifecycles, kept apart. A diet order is a standing instruction that
 * lasts days; a meal service is one tray, three times a day. Merging them
 * into one table would hide the number that actually matters at ward round:
 * how many trays went out today, and how many came back untouched.
 */

import { useState, useMemo } from "react";
import { CheckCircle2, Circle, Utensils, AlertTriangle, Ban } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  PatientCell, useCollection, matches, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type DietOrder = Database["public"]["Tables"]["diet_orders"]["Row"];
type MealService = Database["public"]["Tables"]["meal_services"]["Row"];

const DIET_STATUS: StatusMap = {
  active:    { en: "Active",    ar: "نشط",    tone: "success" },
  on_hold:   { en: "On hold",   ar: "معلّق",  tone: "warning" },
  completed: { en: "Completed", ar: "مكتمل",  tone: "neutral" },
  cancelled: { en: "Cancelled", ar: "ملغى",   tone: "neutral" },
};

const MEAL_STATUS: StatusMap = {
  planned:   { en: "Planned",   ar: "مخطط",     tone: "neutral" },
  prepared:  { en: "Prepared",  ar: "تم التحضير", tone: "info" },
  dispatched:{ en: "Dispatched",ar: "تم الإرسال", tone: "info" },
  delivered: { en: "Delivered", ar: "تم التسليم", tone: "success" },
  refused:   { en: "Refused",   ar: "رُفضت",     tone: "warning" },
  returned:  { en: "Returned",  ar: "أُعيدت",     tone: "warning" },
  cancelled: { en: "Cancelled", ar: "ملغاة",     tone: "neutral" },
};

const DIET_TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  regular:      { en: "Regular", ar: "عادي" },
  diabetic:     { en: "Diabetic", ar: "سكري" },
  renal:        { en: "Renal", ar: "كلوي" },
  cardiac:      { en: "Cardiac", ar: "قلبي" },
  low_sodium:   { en: "Low sodium", ar: "منخفض الصوديوم" },
  high_protein: { en: "High protein", ar: "عالي البروتين" },
  soft:         { en: "Soft", ar: "لين" },
  pureed:       { en: "Pureed", ar: "مهروس" },
  liquid:       { en: "Liquid", ar: "سائل" },
  npo:          { en: "NPO", ar: "ممنوع الفم" },
  enteral:      { en: "Enteral", ar: "أنبوبي" },
  paediatric:   { en: "Paediatric", ar: "أطفال" },
};

const MEAL_LABEL: Record<string, { en: string; ar: string }> = {
  breakfast: { en: "Breakfast", ar: "فطور" },
  lunch:     { en: "Lunch", ar: "غداء" },
  dinner:    { en: "Dinner", ar: "عشاء" },
  snack_am:  { en: "AM snack", ar: "وجبة خفيفة صباحية" },
  snack_pm:  { en: "PM snack", ar: "وجبة خفيفة مسائية" },
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function Dietary() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: dietOrders, loading: loadingOrders } = useCollection("diet_orders");
  const { rows: mealServices, loading: loadingMeals } = useCollection("meal_services");

  const [orderSearch, setOrderSearch] = useState("");
  const [dietTypeFilter, setDietTypeFilter] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");

  const [mealSearch, setMealSearch] = useState("");
  const [mealFilter, setMealFilter] = useState("");
  const [mealStatusFilter, setMealStatusFilter] = useState("");

  const dietTypes = useMemo(
    () => [...new Set(dietOrders.map((r) => r.diet_type))].sort()
      .map((t) => ({ value: t, en: DIET_TYPE_LABEL[t]?.en ?? t, ar: DIET_TYPE_LABEL[t]?.ar ?? t })),
    [dietOrders],
  );
  const orderStatuses = useMemo(
    () => [...new Set(dietOrders.map((r) => r.status))].sort()
      .map((s) => ({ value: s, en: DIET_STATUS[s]?.en ?? s, ar: DIET_STATUS[s]?.ar ?? s })),
    [dietOrders],
  );

  const filteredOrders = useMemo(
    () => dietOrders.filter((r) =>
      matches(orderSearch, r.patient_name, r.ward_name, r.bed_label)
      && (!dietTypeFilter || r.diet_type === dietTypeFilter)
      && (!orderStatusFilter || r.status === orderStatusFilter)),
    [dietOrders, orderSearch, dietTypeFilter, orderStatusFilter],
  );

  const meals = useMemo(
    () => [...new Set(mealServices.map((r) => r.meal))].sort()
      .map((m) => ({ value: m, en: MEAL_LABEL[m]?.en ?? m, ar: MEAL_LABEL[m]?.ar ?? m })),
    [mealServices],
  );
  const mealStatuses = useMemo(
    () => [...new Set(mealServices.map((r) => r.status))].sort()
      .map((s) => ({ value: s, en: MEAL_STATUS[s]?.en ?? s, ar: MEAL_STATUS[s]?.ar ?? s })),
    [mealServices],
  );

  const todaysMeals = useMemo(() => {
    const today = mealServices.filter((m) => isToday(m.service_date));
    return today.length > 0 ? today : mealServices;
  }, [mealServices]);

  const filteredMeals = useMemo(
    () => [...todaysMeals]
      .filter((r) =>
        matches(mealSearch, r.patient_name, r.ward_name, r.menu_en)
        && (!mealFilter || r.meal === mealFilter)
        && (!mealStatusFilter || r.status === mealStatusFilter))
      .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime()),
    [todaysMeals, mealSearch, mealFilter, mealStatusFilter],
  );

  const stats = useMemo(() => {
    const active = dietOrders.filter((r) => r.status === "active").length;
    const special = dietOrders.filter((r) => r.status === "active" && r.diet_type !== "regular").length;
    const deliveredToday = mealServices.filter((m) => isToday(m.service_date) && m.status === "delivered").length;
    const refusedToday = mealServices.filter((m) => isToday(m.service_date) && (m.status === "refused" || m.status === "returned")).length;
    return { active, special, deliveredToday, refusedToday };
  }, [dietOrders, mealServices]);

  const orderColumns: Column<DietOrder>[] = [
    {
      key: "patient",
      header: "Patient",
      headerAr: "المريض",
      cell: (r) => <PatientCell name={r.patient_name} href={`/chart/${r.patient_id}`} />,
      sortValue: (r) => r.patient_name,
    },
    {
      key: "ward",
      header: "Ward / Bed",
      headerAr: "الجناح / السرير",
      cell: (r) => <span className="text-caption text-muted-foreground">{r.ward_name ?? "—"}{r.bed_label ? ` · ${r.bed_label}` : ""}</span>,
      hideBelow: "sm",
    },
    {
      key: "diet_type",
      header: "Diet",
      headerAr: "نوع التغذية",
      cell: (r) => <Pill tone={r.diet_type === "regular" ? "neutral" : "info"}>{ar ? DIET_TYPE_LABEL[r.diet_type]?.ar ?? r.diet_type : DIET_TYPE_LABEL[r.diet_type]?.en ?? r.diet_type}</Pill>,
      sortValue: (r) => r.diet_type,
    },
    {
      key: "texture",
      header: "Texture / Fluids",
      headerAr: "القوام / السوائل",
      cell: (r) => (
        <span className="text-caption text-muted-foreground">
          {[r.texture, r.fluid_consistency].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "allergens",
      header: "Allergens",
      headerAr: "المسببات للحساسية",
      cell: (r) =>
        r.allergens_to_avoid && r.allergens_to_avoid.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.allergens_to_avoid.map((a) => (
              <Pill key={a} tone="warning" icon={AlertTriangle}>{a}</Pill>
            ))}
          </div>
        ) : null,
      hideBelow: "md",
    },
    {
      key: "cultural",
      header: "Preference",
      headerAr: "التفضيل",
      cell: (r) => (r.cultural_preference && r.cultural_preference !== "none" ? r.cultural_preference : "—"),
      hideBelow: "lg",
    },
    {
      key: "reviewed",
      header: "Reviewed",
      headerAr: "روجعت",
      cell: (r) => r.dietitian_reviewed
        ? <CheckCircle2 size={14} className="text-success" />
        : <Circle size={14} className="text-muted-foreground/50" />,
    },
    {
      key: "status",
      header: "Status",
      headerAr: "الحالة",
      cell: (r) => <StatusPill map={DIET_STATUS} value={r.status} />,
      sortValue: (r) => r.status,
    },
  ];

  const mealColumns: Column<MealService>[] = [
    {
      key: "patient",
      header: "Patient",
      headerAr: "المريض",
      cell: (r) => <PatientCell name={r.patient_name} href={`/chart/${r.patient_id}`} />,
      sortValue: (r) => r.patient_name,
    },
    {
      key: "ward",
      header: "Ward / Bed",
      headerAr: "الجناح / السرير",
      cell: (r) => <span className="text-caption text-muted-foreground">{r.ward_name}{r.bed_label ? ` · ${r.bed_label}` : ""}</span>,
      hideBelow: "sm",
    },
    {
      key: "meal",
      header: "Meal",
      headerAr: "الوجبة",
      cell: (r) => <Pill tone="neutral">{ar ? MEAL_LABEL[r.meal]?.ar ?? r.meal : MEAL_LABEL[r.meal]?.en ?? r.meal}</Pill>,
      sortValue: (r) => r.meal,
    },
    {
      key: "menu",
      header: "Menu",
      headerAr: "القائمة",
      cell: (r) => <span className="text-caption text-muted-foreground truncate">{ar ? (r.menu_ar ?? r.menu_en ?? "—") : (r.menu_en ?? "—")}</span>,
      hideBelow: "md",
    },
    {
      key: "status",
      header: "Status",
      headerAr: "الحالة",
      cell: (r) => <StatusPill map={MEAL_STATUS} value={r.status} icon={r.status === "refused" || r.status === "returned" ? Ban : undefined} />,
      sortValue: (r) => r.status,
    },
    {
      key: "intake",
      header: "Intake",
      headerAr: "الاستهلاك",
      cell: (r) => (r.intake_percent === null ? "—" : `${r.intake_percent}%`),
      sortValue: (r) => r.intake_percent ?? -1,
      align: "end",
      hideBelow: "lg",
    },
    {
      key: "delivered_by",
      header: "Delivered by",
      headerAr: "سلّمها",
      cell: (r) => r.delivered_by ?? "—",
      hideBelow: "lg",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Dietary & Kitchen"
        titleAr="التغذية والمطبخ"
        subtitle="Standing diet orders alongside today's meal service, tray by tray."
        subtitleAr="أوامر التغذية القائمة إلى جانب خدمة الوجبات اليوم، وجبة بوجبة."
        meta={[
          { label: "Refused / returned today", labelAr: "مرفوضة / معادة اليوم", value: String(stats.refusedToday), tone: stats.refusedToday > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Active diet orders" labelAr="أوامر تغذية نشطة" value={stats.active} icon={Utensils} tone="brand" />
        <StatTile label="Special diets" labelAr="أنظمة خاصة" value={stats.special} sub="Non-regular, active" subAr="غير عادي ونشط" tone="info" />
        <StatTile label="Delivered today" labelAr="سُلّمت اليوم" value={stats.deliveredToday} tone="success" />
        <StatTile label="Refused / returned today" labelAr="مرفوضة / معادة اليوم" value={stats.refusedToday} tone={stats.refusedToday > 0 ? "warning" : "success"} />
      </StatGrid>

      <Section title="Active Diet Orders" titleAr="أوامر التغذية النشطة">
        <FilterBar
          search={orderSearch}
          onSearch={setOrderSearch}
          searchPlaceholder="Search patient, ward"
          searchPlaceholderAr="بحث عن مريض أو جناح"
          filters={[
            { key: "diet_type", value: dietTypeFilter, onChange: setDietTypeFilter, options: dietTypes, allLabel: "All diet types", allLabelAr: "كل أنواع التغذية" },
            { key: "status", value: orderStatusFilter, onChange: setOrderStatusFilter, options: orderStatuses, allLabel: "All statuses", allLabelAr: "كل الحالات" },
          ]}
        />
        <DataTable rows={filteredOrders} columns={orderColumns} loading={loadingOrders} initialSort={{ key: "status", ascending: true }} />
      </Section>

      <Section title="Today's Meal Service" titleAr="خدمة الوجبات اليوم">
        <FilterBar
          search={mealSearch}
          onSearch={setMealSearch}
          searchPlaceholder="Search patient, menu"
          searchPlaceholderAr="بحث عن مريض أو قائمة طعام"
          filters={[
            { key: "meal", value: mealFilter, onChange: setMealFilter, options: meals, allLabel: "All meals", allLabelAr: "كل الوجبات" },
            { key: "status", value: mealStatusFilter, onChange: setMealStatusFilter, options: mealStatuses, allLabel: "All statuses", allLabelAr: "كل الحالات" },
          ]}
        />
        <DataTable rows={filteredMeals} columns={mealColumns} loading={loadingMeals} initialSort={{ key: "meal", ascending: true }} />
      </Section>
    </Page>
  );
}
