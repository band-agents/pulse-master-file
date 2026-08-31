import { lazy } from "react";
import { FlaskConical, TestTube2, Droplet } from "lucide-react";
import type { ModuleManifest } from "../types";
import { minutesSince } from "@/platform/data/snapshot";

/** Turnaround target by priority, in minutes. Mirrors the worklist screen. */
const TAT_TARGET: Record<string, number> = { stat: 60, urgent: 120, routine: 240 };

export const laboratoryModule: ModuleManifest = {
  id: "laboratory",
  base: "/laboratory",
  name: { en: "Laboratory", ar: "المختبر" },
  summary: {
    en: "Specimen worklist, results with reference ranges, and the blood bank.",
    ar: "قائمة العينات والنتائج بنطاقاتها المرجعية وبنك الدم.",
  },
  icon: FlaskConical,
  group: "diagnostics",
  roles: ["lab", "physician", "nurse"],
  datasets: ["lab_orders", "lab_results", "blood_units"],
  views: [
    {
      id: "worklist", segment: "",
      name: { en: "Worklist", ar: "قائمة العمل" }, icon: FlaskConical,
      Component: lazy(() => import("./pages/LabWorklist")),
    },
    {
      id: "results", segment: "results",
      name: { en: "Results", ar: "النتائج" }, icon: TestTube2,
      Component: lazy(() => import("./pages/LabResults")),
    },
    {
      id: "blood", segment: "blood-bank",
      name: { en: "Blood bank", ar: "بنك الدم" }, icon: Droplet,
      Component: lazy(() => import("./pages/BloodBank")),
    },
  ],
  metrics: (s) => {
    const pending = s.labOrders.filter((o) =>
      ["ordered", "collected", "received", "in_progress"].includes(o.status));
    const breaching = pending.filter((o) => minutesSince(o.ordered_at) > (TAT_TARGET[o.priority] ?? 240));
    const unnotified = s.labResults.filter(
      (r) => (r.flag === "critical_low" || r.flag === "critical_high") && !r.critical_notified_at,
    ).length;
    return [
      { label: { en: "In progress", ar: "قيد التنفيذ" }, value: pending.length, tone: "info" },
      {
        label: { en: "Past turnaround target", ar: "تجاوزت زمن الإنجاز" },
        value: breaching.length,
        tone: breaching.length > 0 ? "critical" : "success",
      },
      {
        label: { en: "Criticals not notified", ar: "قيم حرجة دون إبلاغ" },
        value: unnotified,
        tone: unnotified > 0 ? "critical" : "success",
      },
    ];
  },
};
