import { lazy } from "react";
import { Siren, Ambulance } from "lucide-react";
import type { ModuleManifest } from "../types";
import { edLive, minutesSince } from "@/platform/data/snapshot";
import { isTriageBreached } from "@/platform/clinical/scores";

export const emergencyModule: ModuleManifest = {
  id: "emergency",
  base: "/emergency",
  name: { en: "Emergency", ar: "الطوارئ" },
  summary: {
    en: "Live department board, triage queue and breach tracking.",
    ar: "لوحة القسم المباشرة وطابور الفرز ومتابعة تجاوز الأهداف.",
  },
  icon: Siren,
  group: "care",
  roles: ["emergency", "physician", "nurse", "executive"],
  datasets: ["ed_visits", "encounters"],
  views: [
    {
      id: "tracker", segment: "",
      name: { en: "Department board", ar: "لوحة القسم" }, icon: Siren,
      Component: lazy(() => import("./pages/EDTracker")),
    },
    {
      id: "triage", segment: "triage",
      name: { en: "Triage queue", ar: "طابور الفرز" }, icon: Ambulance,
      Component: lazy(() => import("./pages/TriageBoard")),
    },
  ],
  metrics: (s) => {
    const live = edLive(s);
    const waiting = live.filter((v) => v.status === "waiting");
    const breaches = waiting.filter((v) => isTriageBreached(v.triage_level, minutesSince(v.arrival_at)));
    const boarding = live.filter((v) => v.boarding_since);
    return [
      { label: { en: "In department", ar: "داخل القسم" }, value: live.length, tone: "info" },
      {
        label: { en: "Past triage target", ar: "تجاوز هدف الفرز" },
        value: breaches.length,
        tone: breaches.length > 0 ? "critical" : "success",
      },
      {
        label: { en: "Awaiting a bed", ar: "بانتظار سرير" },
        value: boarding.length,
        tone: boarding.length > 0 ? "warning" : "success",
      },
    ];
  },
};
