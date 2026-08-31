import { lazy } from "react";
import { Users, HeartPulse } from "lucide-react";
import type { ModuleManifest } from "../types";

export const patientsModule: ModuleManifest = {
  id: "patients",
  base: "/patients",
  name: { en: "Patients", ar: "المرضى" },
  summary: {
    en: "Master patient index and the complete clinical record.",
    ar: "الفهرس الرئيسي للمرضى والسجل الطبي الكامل.",
  },
  icon: Users,
  group: "care",
  roles: ["physician", "nurse", "reception", "emergency"],
  datasets: ["patients", "encounters", "diagnoses", "allergies"],
  views: [
    {
      id: "registry", segment: "",
      name: { en: "Registry", ar: "السجل" }, icon: Users,
      Component: lazy(() => import("./pages/PatientRegistry")),
    },
    {
      id: "chart", segment: ":id",
      name: { en: "Chart", ar: "الملف الطبي" }, icon: HeartPulse, hidden: true,
      Component: lazy(() => import("./pages/PatientChart")),
    },
  ],
  metrics: (s) => {
    const active = s.patients.filter((p) => p.status === "active").length;
    const inHospital = new Set(
      s.encounters
        .filter((e) => e.status === "in_progress" || e.status === "arrived")
        .map((e) => e.patient_id),
    ).size;
    const highRisk = new Set(
      s.allergies
        .filter((a) => a.status === "active" && (a.severity === "severe" || a.severity === "fatal"))
        .map((a) => a.patient_id),
    ).size;
    return [
      { label: { en: "Active records", ar: "سجلات نشطة" }, value: active, tone: "info" },
      { label: { en: "Currently in hospital", ar: "داخل المستشفى" }, value: inHospital, tone: "brand" },
      {
        label: { en: "High-risk allergies", ar: "حساسية عالية الخطورة" },
        value: highRisk,
        tone: highRisk > 0 ? "warning" : "success",
      },
    ];
  },
};
