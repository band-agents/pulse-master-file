import { lazy } from "react";
import { Scan, Radio } from "lucide-react";
import type { ModuleManifest } from "../types";

export const imagingModule: ModuleManifest = {
  id: "imaging",
  base: "/imaging",
  name: { en: "Imaging", ar: "الأشعة" },
  summary: {
    en: "Radiology worklist, reporting queue and the PACS study archive.",
    ar: "قائمة عمل الأشعة وطابور التقارير وأرشيف الصور الطبية.",
  },
  icon: Scan,
  group: "diagnostics",
  roles: ["imaging", "physician", "nurse"],
  datasets: ["imaging_orders"],
  views: [
    {
      id: "worklist", segment: "",
      name: { en: "Worklist", ar: "قائمة العمل" }, icon: Scan,
      Component: lazy(() => import("./pages/Radiology")),
    },
    {
      id: "studies", segment: "studies",
      name: { en: "Studies & PACS", ar: "الدراسات والأرشيف" }, icon: Radio,
      Component: lazy(() => import("./pages/ImagingStudies")),
    },
  ],
  metrics: (s) => {
    const pending = s.imagingOrders.filter((o) =>
      ["ordered", "scheduled", "arrived", "in_progress"].includes(o.status)).length;
    const unreported = s.imagingOrders.filter((o) => o.status === "acquired").length;
    const criticals = s.imagingOrders.filter((o) => o.critical_finding && !o.critical_notified_at).length;
    return [
      { label: { en: "Awaiting scan", ar: "بانتظار التصوير" }, value: pending, tone: "info" },
      {
        label: { en: "Awaiting a report", ar: "بانتظار التقرير" },
        value: unreported,
        tone: unreported > 0 ? "warning" : "success",
      },
      {
        label: { en: "Critical findings unreported", ar: "نتائج حرجة دون إبلاغ" },
        value: criticals,
        tone: criticals > 0 ? "critical" : "success",
      },
    ];
  },
};
