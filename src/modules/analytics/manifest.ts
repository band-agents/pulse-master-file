import { lazy } from "react";
import { BarChart3, TrendingUp, ShieldCheck, LayoutGrid } from "lucide-react";
import type { ModuleManifest } from "../types";
import { DATASETS } from "@/platform/analytics/datasets";

export const analyticsModule: ModuleManifest = {
  id: "analytics",
  base: "/analytics",
  name: { en: "Analytics", ar: "التحليلات" },
  summary: {
    en: "Executive reporting, self-service exploration and the quality indicator set.",
    ar: "التقارير التنفيذية والاستكشاف الذاتي ومجموعة مؤشرات الجودة.",
  },
  icon: BarChart3,
  group: "intelligence",
  roles: ["executive", "rcm", "admin", "physician", "workforce"],
  datasets: DATASETS.map((d) => d.id),
  views: [
    {
      id: "overview", segment: "",
      name: { en: "Executive overview", ar: "النظرة التنفيذية" }, icon: BarChart3,
      Component: lazy(() => import("./pages/Overview")),
    },
    {
      id: "explorer", segment: "explorer",
      name: { en: "Data explorer", ar: "مستكشف البيانات" }, icon: TrendingUp,
      Component: lazy(() => import("./pages/Explorer")),
    },
    {
      id: "quality", segment: "quality",
      name: { en: "Quality & safety", ar: "الجودة والسلامة" }, icon: ShieldCheck,
      Component: lazy(() => import("./pages/Quality")),
    },
    {
      id: "dashboards", segment: "dashboards",
      name: { en: "My dashboards", ar: "لوحاتي" }, icon: LayoutGrid,
      Component: lazy(() => import("./pages/Dashboards")),
    },
  ],
  metrics: (s) => {
    const claimed = s.claims.reduce((sum, c) => sum + Number(c.claimed_amount ?? 0), 0);
    const paid = s.claims.reduce((sum, c) => sum + Number(c.paid_amount ?? 0), 0);
    const collection = claimed > 0 ? Math.round((paid / claimed) * 100) : 0;

    // Rows the analytics layer can currently see — the honest size of the
    // reportable estate, not a marketing number.
    const rows = DATASETS.reduce((sum, d) => sum + d.rows(s).length, 0);

    return [
      { label: { en: "Datasets", ar: "مجموعات البيانات" }, value: DATASETS.length, tone: "data" },
      { label: { en: "Rows reportable", ar: "سجلات قابلة للتحليل" }, value: rows.toLocaleString(), tone: "neutral" },
      {
        label: { en: "Collection rate", ar: "نسبة التحصيل" },
        value: `${collection}%`,
        tone: collection >= 85 ? "success" : collection >= 70 ? "warning" : "critical",
      },
    ];
  },
};
