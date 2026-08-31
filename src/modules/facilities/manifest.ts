import { lazy } from "react";
import { Utensils, SprayCan, Shirt, Building2 } from "lucide-react";
import type { ModuleManifest } from "../types";

export const facilitiesModule: ModuleManifest = {
  id: "facilities",
  base: "/facilities",
  name: { en: "Support Services", ar: "الخدمات المساندة" },
  summary: {
    en: "Dietary, housekeeping and bed turnaround, linen, and the hospital sites.",
    ar: "التغذية والنظافة ودوران الأسرة والمفروشات ومواقع المستشفى.",
  },
  icon: SprayCan,
  group: "operations",
  roles: ["supply", "nurse", "admin"],
  datasets: ["diet_orders", "meal_services", "housekeeping_tasks", "linen_cycles"],
  views: [
    {
      id: "housekeeping", segment: "",
      name: { en: "Housekeeping", ar: "النظافة" }, icon: SprayCan,
      Component: lazy(() => import("./pages/Housekeeping")),
    },
    {
      id: "dietary", segment: "dietary",
      name: { en: "Dietary", ar: "التغذية" }, icon: Utensils,
      Component: lazy(() => import("./pages/Dietary")),
    },
    {
      id: "linen", segment: "linen",
      name: { en: "Linen", ar: "المفروشات" }, icon: Shirt,
      Component: lazy(() => import("./pages/Linen")),
    },
    {
      id: "sites", segment: "sites",
      name: { en: "Sites", ar: "المواقع" }, icon: Building2,
      Component: lazy(() => import("./pages/Branches")),
    },
  ],
  metrics: (s) => {
    const pendingCleans = s.housekeeping.filter(
      (t) => t.status === "pending" || t.status === "assigned",
    ).length;
    const done = s.housekeeping.filter((t) => t.turnaround_minutes !== null);
    const meanTurnaround = done.length > 0
      ? Math.round(done.reduce((sum, t) => sum + (t.turnaround_minutes ?? 0), 0) / done.length)
      : null;
    const shortfalls = s.linen.filter((l) => l.status === "shortfall").length;
    return [
      {
        label: { en: "Cleans outstanding", ar: "تنظيفات قائمة" },
        value: pendingCleans,
        tone: pendingCleans > 3 ? "warning" : "success",
      },
      {
        label: { en: "Mean bed turnaround", ar: "متوسط دوران السرير" },
        value: meanTurnaround !== null ? `${meanTurnaround}m` : "—",
        tone: meanTurnaround !== null && meanTurnaround > 120 ? "warning" : "success",
      },
      {
        label: { en: "Linen shortfalls", ar: "نقص في المفروشات" },
        value: shortfalls,
        tone: shortfalls > 0 ? "warning" : "success",
      },
    ];
  },
};
