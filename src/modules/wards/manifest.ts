import { lazy } from "react";
import { BedDouble, Building2, ClipboardCheck, ClipboardList } from "lucide-react";
import type { ModuleManifest } from "../types";
import { bedSummary, latestVitalsByEncounter } from "@/platform/data/snapshot";
import { computeNews2 } from "@/platform/clinical/scores";

export const wardsModule: ModuleManifest = {
  id: "wards",
  base: "/wards",
  name: { en: "Wards & Beds", ar: "الأجنحة والأسرة" },
  summary: {
    en: "Occupancy, admissions and transfers, and the nursing round.",
    ar: "الإشغال والدخول والنقل وجولة التمريض.",
  },
  icon: BedDouble,
  group: "care",
  roles: ["nurse", "physician", "reception", "executive"],
  datasets: ["beds", "encounters", "vitals"],
  views: [
    {
      id: "beds", segment: "",
      name: { en: "Bed board", ar: "لوحة الأسرة" }, icon: BedDouble,
      Component: lazy(() => import("./pages/BedManagement")),
    },
    {
      id: "nursing", segment: "nursing",
      name: { en: "Nursing round", ar: "جولة التمريض" }, icon: ClipboardCheck,
      Component: lazy(() => import("./pages/NursingCare")),
    },
    {
      id: "admissions", segment: "admissions",
      name: { en: "Admissions & ADT", ar: "الدخول والحركة" }, icon: ClipboardList,
      Component: lazy(() => import("./pages/Admissions")),
    },
    {
      id: "register", segment: "register",
      name: { en: "Ward register", ar: "سجل الأجنحة" }, icon: Building2,
      Component: lazy(() => import("./pages/Wards")),
    },
  ],
  metrics: (s) => {
    const b = bedSummary(s);
    const escalating = [...latestVitalsByEncounter(s).values()].filter((v) => {
      const band = computeNews2(v).band;
      return band === "medium" || band === "high";
    }).length;
    return [
      {
        label: { en: "Occupancy", ar: "الإشغال" },
        value: `${b.pct}%`,
        tone: b.pct >= 95 ? "critical" : b.pct >= 85 ? "warning" : "success",
        note: {
          en: `${b.available} free, ${b.cleaning} cleaning`,
          ar: `${b.available} شاغر، ${b.cleaning} قيد التنظيف`,
        },
      },
      { label: { en: "Inpatients", ar: "المنومون" }, value: b.occupied, tone: "info" },
      {
        label: { en: "Needing escalation", ar: "بحاجة لتصعيد" },
        value: escalating,
        tone: escalating > 0 ? "critical" : "success",
      },
    ];
  },
};
