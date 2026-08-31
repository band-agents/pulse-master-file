import { lazy } from "react";
import { Boxes, ShoppingCart, Wrench, ClipboardList } from "lucide-react";
import type { ModuleManifest } from "../types";

export const supplyModule: ModuleManifest = {
  id: "supply",
  base: "/supply",
  name: { en: "Supply & Equipment", ar: "الإمداد والأجهزة" },
  summary: {
    en: "Medical stores, procurement, biomedical assets and maintenance.",
    ar: "المخازن الطبية والمشتريات والأجهزة الطبية والصيانة.",
  },
  icon: Boxes,
  group: "operations",
  roles: ["supply", "executive", "admin"],
  datasets: ["supply_items", "procurement_orders", "biomed_assets", "maintenance_orders"],
  views: [
    {
      id: "stores", segment: "",
      name: { en: "Medical stores", ar: "المخازن الطبية" }, icon: Boxes,
      Component: lazy(() => import("./pages/Supplies")),
    },
    {
      id: "procurement", segment: "procurement",
      name: { en: "Procurement", ar: "المشتريات" }, icon: ShoppingCart,
      Component: lazy(() => import("./pages/Purchasing")),
    },
    {
      id: "assets", segment: "assets",
      name: { en: "Biomedical assets", ar: "الأجهزة الطبية" }, icon: Wrench,
      Component: lazy(() => import("./pages/BiomedAssets")),
    },
    {
      id: "maintenance", segment: "maintenance",
      name: { en: "Maintenance", ar: "الصيانة" }, icon: ClipboardList,
      Component: lazy(() => import("./pages/Maintenance")),
    },
  ],
  metrics: (s) => {
    const down = s.biomedAssets.filter(
      (a) => a.status === "out_of_service" || a.status === "awaiting_parts",
    ).length;
    const pmOverdue = s.biomedAssets.filter(
      (a) => a.next_pm_due && new Date(a.next_pm_due).getTime() < Date.now(),
    ).length;
    const belowReorder = s.stockItems.filter((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return meta.below_reorder === true;
    }).length;
    return [
      {
        label: { en: "Devices out of service", ar: "أجهزة خارج الخدمة" },
        value: down,
        tone: down > 0 ? "critical" : "success",
      },
      {
        label: { en: "Maintenance overdue", ar: "صيانة متأخرة" },
        value: pmOverdue,
        tone: pmOverdue > 0 ? "warning" : "success",
      },
      {
        label: { en: "Lines below reorder", ar: "أصناف تحت حد الطلب" },
        value: belowReorder,
        tone: belowReorder > 0 ? "warning" : "success",
      },
    ];
  },
};
