import { lazy } from "react";
import { ScrollText, Syringe, FileText, ShieldAlert } from "lucide-react";
import type { ModuleManifest } from "../types";

export const ordersModule: ModuleManifest = {
  id: "orders",
  base: "/orders",
  name: { en: "Orders & Medicines", ar: "الأوامر والأدوية" },
  summary: {
    en: "Order entry with decision support, the medication record and prescribing.",
    ar: "إدخال الأوامر مع دعم القرار وسجل الأدوية والوصفات.",
  },
  icon: ScrollText,
  group: "care",
  roles: ["physician", "nurse", "pharmacy"],
  datasets: ["clinical_orders", "med_administrations", "prescriptions", "cdss_alerts"],
  views: [
    {
      id: "entry", segment: "",
      name: { en: "Order entry", ar: "إدخال الأوامر" }, icon: ScrollText,
      Component: lazy(() => import("./pages/OrderEntry")),
    },
    {
      id: "mar", segment: "mar",
      name: { en: "Medication record", ar: "سجل الدواء" }, icon: Syringe,
      Component: lazy(() => import("./pages/MedicationRecord")),
    },
    {
      id: "rx", segment: "prescribing",
      name: { en: "Prescribing", ar: "الوصفات" }, icon: FileText,
      Component: lazy(() => import("./pages/Prescribing")),
    },
    {
      id: "cdss", segment: "decision-support",
      name: { en: "Decision support", ar: "دعم القرار" }, icon: ShieldAlert,
      Component: lazy(() => import("./pages/DecisionSupport")),
    },
  ],
  metrics: (s) => {
    const stat = s.orders.filter(
      (o) => o.priority === "stat" && (o.status === "active" || o.status === "in_progress"),
    ).length;
    const unanswered = s.alerts.filter((a) => a.status === "active").length;
    const missed = s.medAdministrations.filter((m) => m.status === "missed").length;
    return [
      { label: { en: "STAT outstanding", ar: "أوامر عاجلة قائمة" }, value: stat, tone: stat > 0 ? "critical" : "success" },
      { label: { en: "Unanswered alerts", ar: "تنبيهات دون رد" }, value: unanswered, tone: unanswered > 0 ? "warning" : "success" },
      { label: { en: "Missed doses", ar: "جرعات فائتة" }, value: missed, tone: missed > 0 ? "critical" : "success" },
    ];
  },
};
