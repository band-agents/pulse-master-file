import { lazy } from "react";
import { CalendarDays, Stethoscope, Building2 } from "lucide-react";
import type { ModuleManifest } from "../types";

export const schedulingModule: ModuleManifest = {
  id: "scheduling",
  base: "/scheduling",
  name: { en: "Scheduling", ar: "المواعيد" },
  summary: {
    en: "Outpatient booking, clinic capacity, providers and departments.",
    ar: "حجز العيادات الخارجية وسعة العيادات ومقدمو الخدمة والأقسام.",
  },
  icon: CalendarDays,
  group: "care",
  roles: ["reception", "physician", "nurse", "executive"],
  datasets: ["appointments", "providers", "departments"],
  views: [
    {
      id: "appointments", segment: "",
      name: { en: "Appointments", ar: "المواعيد" }, icon: CalendarDays,
      Component: lazy(() => import("./pages/Appointments")),
    },
    {
      id: "providers", segment: "providers",
      name: { en: "Providers", ar: "مقدمو الخدمة" }, icon: Stethoscope,
      Component: lazy(() => import("./pages/Providers")),
    },
    {
      id: "departments", segment: "departments",
      name: { en: "Departments", ar: "الأقسام" }, icon: Building2,
      Component: lazy(() => import("./pages/Departments")),
    },
  ],
  metrics: (s) => {
    const upcoming = s.appointments.filter(
      (a) => a.status === "booked" || a.status === "confirmed",
    ).length;
    const noShows = s.appointments.filter((a) => a.status === "no_show").length;
    const total = s.appointments.length;
    const rate = total > 0 ? Math.round((noShows / total) * 100) : 0;
    const unconfirmed = s.appointments.filter(
      (a) => a.status === "booked" && !a.confirmed_at,
    ).length;
    return [
      { label: { en: "Upcoming", ar: "مواعيد قادمة" }, value: upcoming, tone: "info" },
      {
        label: { en: "Unconfirmed", ar: "غير مؤكدة" },
        value: unconfirmed,
        tone: unconfirmed > 0 ? "warning" : "success",
      },
      {
        label: { en: "No-show rate", ar: "نسبة عدم الحضور" },
        value: `${rate}%`,
        tone: rate > 10 ? "warning" : "success",
      },
    ];
  },
};
