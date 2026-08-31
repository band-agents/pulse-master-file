import { lazy } from "react";
import { UserCog, CalendarDays, Shield } from "lucide-react";
import type { ModuleManifest } from "../types";

export const workforceModule: ModuleManifest = {
  id: "workforce",
  base: "/workforce",
  name: { en: "Workforce", ar: "القوى العاملة" },
  summary: {
    en: "Staff directory, shift cover and clinical credentialing.",
    ar: "دليل الموظفين وتغطية المناوبات والاعتماد المهني السريري.",
  },
  icon: UserCog,
  group: "administration",
  roles: ["workforce", "executive", "admin"],
  datasets: ["staff", "attendance", "leave_requests", "providers"],
  views: [
    {
      id: "roster", segment: "",
      name: { en: "Roster & cover", ar: "الجدول والتغطية" }, icon: CalendarDays,
      Component: lazy(() => import("./pages/Roster")),
    },
    {
      id: "directory", segment: "directory",
      name: { en: "Staff directory", ar: "دليل الموظفين" }, icon: UserCog,
      Component: lazy(() => import("./pages/StaffDirectory")),
    },
    {
      id: "credentialing", segment: "credentialing",
      name: { en: "Credentialing", ar: "الاعتماد المهني" }, icon: Shield,
      Component: lazy(() => import("./pages/Credentialing")),
    },
  ],
  metrics: (s) => {
    const today = new Date().toISOString().slice(0, 10);
    const away = s.leave.filter(
      (l) => l.status === "approved" && l.start_date <= today && l.end_date >= today,
    ).length;
    const pending = s.leave.filter((l) => l.status === "pending").length;
    // A lapsed licence blocks ordering outright, so it is the headline risk.
    const lapsed = s.providers.filter(
      (p) => p.credential_status === "expired" || p.credential_status === "suspended" || !p.can_prescribe,
    ).length;
    return [
      { label: { en: "Active staff", ar: "موظفون نشطون" }, value: s.staff.filter((x) => x.status === "active").length, tone: "info" },
      { label: { en: "Away today", ar: "غائبون اليوم" }, value: away, tone: away > 0 ? "warning" : "success" },
      {
        label: { en: "Credentials lapsed", ar: "اعتمادات منتهية" },
        value: lapsed,
        tone: lapsed > 0 ? "critical" : "success",
        note: { en: "Prescribing blocked", ar: "الوصف موقوف" },
      },
    ];
  },
};
