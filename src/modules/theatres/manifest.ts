import { lazy } from "react";
import { Scissors, CalendarDays } from "lucide-react";
import type { ModuleManifest } from "../types";

export const theatresModule: ModuleManifest = {
  id: "theatres",
  base: "/theatres",
  name: { en: "Theatres", ar: "غرف العمليات" },
  summary: {
    en: "Surgical lists, utilisation, safety checklists and the live case board.",
    ar: "قوائم الجراحة والاستغلال وقوائم السلامة ولوحة الحالات المباشرة.",
  },
  icon: Scissors,
  group: "care",
  roles: ["theatre", "physician", "nurse", "executive"],
  datasets: ["ot_cases"],
  views: [
    {
      id: "schedule", segment: "",
      name: { en: "Schedule", ar: "الجدول" }, icon: CalendarDays,
      Component: lazy(() => import("./pages/TheatreSchedule")),
    },
    {
      id: "cases", segment: "cases",
      name: { en: "Case board", ar: "لوحة الحالات" }, icon: Scissors,
      Component: lazy(() => import("./pages/CaseBoard")),
    },
  ],
  metrics: (s) => {
    const today = s.otCases.filter(
      (c) => Math.abs(new Date(c.scheduled_start).getTime() - Date.now()) < 36 * 3_600_000,
    );
    const inTheatre = today.filter((c) => c.status === "in_theatre").length;
    const cancelled = s.otCases.filter((c) => c.status === "cancelled").length;
    const rate = s.otCases.length > 0 ? Math.round((cancelled / s.otCases.length) * 100) : 0;
    return [
      { label: { en: "Cases listed", ar: "عمليات مجدولة" }, value: today.length, tone: "info" },
      { label: { en: "In theatre now", ar: "جارية الآن" }, value: inTheatre, tone: inTheatre > 0 ? "brand" : "neutral" },
      {
        label: { en: "Cancellation rate", ar: "نسبة الإلغاء" },
        value: `${rate}%`,
        tone: rate > 10 ? "warning" : "success",
      },
    ];
  },
};
