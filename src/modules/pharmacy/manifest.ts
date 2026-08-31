import { lazy } from "react";
import { Pill, Package } from "lucide-react";
import type { ModuleManifest } from "../types";

export const pharmacyModule: ModuleManifest = {
  id: "pharmacy",
  base: "/pharmacy",
  name: { en: "Pharmacy", ar: "الصيدلية" },
  summary: {
    en: "Dispensing queue, drug stock, batches and expiry control.",
    ar: "طابور الصرف ومخزون الأدوية والتشغيلات ومراقبة الصلاحية.",
  },
  icon: Pill,
  group: "diagnostics",
  roles: ["pharmacy", "physician", "nurse"],
  datasets: ["pharmacy_stock", "dispenses", "prescriptions"],
  views: [
    {
      id: "queue", segment: "",
      name: { en: "Dispensing queue", ar: "طابور الصرف" }, icon: Pill,
      Component: lazy(() => import("./pages/PharmacyQueue")),
    },
    {
      id: "stock", segment: "stock",
      name: { en: "Drug stock", ar: "مخزون الأدوية" }, icon: Package,
      Component: lazy(() => import("./pages/PharmacyStock")),
    },
  ],
  metrics: (s) => {
    const awaiting = s.dispenses.filter((d) => d.status === "pending" || d.status === "verified").length;
    const belowReorder = s.pharmacyStock.filter(
      (p) => p.status === "active" && p.quantity_on_hand <= p.reorder_level,
    ).length;
    const expiring = s.pharmacyStock.filter(
      (p) => p.status === "active" && new Date(p.expiry_date).getTime() - Date.now() < 60 * 86_400_000,
    ).length;
    return [
      { label: { en: "Awaiting dispensing", ar: "بانتظار الصرف" }, value: awaiting, tone: awaiting > 0 ? "info" : "success" },
      {
        label: { en: "Below reorder level", ar: "تحت حد إعادة الطلب" },
        value: belowReorder,
        tone: belowReorder > 0 ? "warning" : "success",
      },
      {
        label: { en: "Expiring within 60 days", ar: "تنتهي خلال ٦٠ يوماً" },
        value: expiring,
        tone: expiring > 0 ? "warning" : "success",
      },
    ];
  },
};
