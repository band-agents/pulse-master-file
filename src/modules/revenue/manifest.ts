import { lazy } from "react";
import { Receipt, FileText, CreditCard } from "lucide-react";
import type { ModuleManifest } from "../types";

export const revenueModule: ModuleManifest = {
  id: "revenue",
  base: "/revenue",
  name: { en: "Revenue Cycle", ar: "الدورة الإيرادية" },
  summary: {
    en: "Patient billing, payer claims, denials and eligibility.",
    ar: "فوترة المرضى ومطالبات جهات الدفع والرفض والأهلية.",
  },
  icon: Receipt,
  group: "administration",
  roles: ["rcm", "reception", "executive"],
  datasets: ["charge_items", "claims", "insurance_policies"],
  views: [
    {
      id: "billing", segment: "",
      name: { en: "Billing", ar: "الفوترة" }, icon: Receipt,
      Component: lazy(() => import("./pages/Billing")),
    },
    {
      id: "claims", segment: "claims",
      name: { en: "Claims", ar: "المطالبات" }, icon: FileText,
      Component: lazy(() => import("./pages/Claims")),
    },
    {
      id: "coverage", segment: "coverage",
      name: { en: "Coverage", ar: "التغطية التأمينية" }, icon: CreditCard,
      Component: lazy(() => import("./pages/Insurance")),
    },
  ],
  metrics: (s) => {
    const denied = s.claims.filter((c) => c.status === "denied").length;
    const outstanding = s.claims
      .filter((c) => !["paid", "written_off", "denied"].includes(c.status))
      .reduce((sum, c) => sum + Number(c.claimed_amount ?? 0), 0);
    const unposted = s.charges.filter((c) => !c.posted).length;
    const denialRate = s.claims.length > 0 ? Math.round((denied / s.claims.length) * 100) : 0;
    return [
      {
        label: { en: "Outstanding with payers", ar: "مستحق من جهات الدفع" },
        value: `${Math.round(outstanding / 1000)}k`,
        tone: "info",
        note: { en: "SAR, submitted and unpaid", ar: "ريال، مقدمة وغير مدفوعة" },
      },
      {
        label: { en: "Denial rate", ar: "نسبة الرفض" },
        value: `${denialRate}%`,
        tone: denialRate > 10 ? "critical" : denialRate > 5 ? "warning" : "success",
      },
      {
        label: { en: "Charges unposted", ar: "رسوم غير مرحّلة" },
        value: unposted,
        tone: unposted > 0 ? "warning" : "success",
      },
    ];
  },
};
