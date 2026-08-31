import { lazy } from "react";
import { Settings, Shield, Hash, Database } from "lucide-react";
import type { ModuleManifest } from "../types";

export const adminModule: ModuleManifest = {
  id: "admin",
  base: "/admin",
  name: { en: "Administration", ar: "إدارة النظام" },
  summary: {
    en: "Users and access, numbering rules, configuration and data tools.",
    ar: "المستخدمون والصلاحيات وقواعد الترقيم والإعدادات وأدوات البيانات.",
  },
  icon: Settings,
  group: "administration",
  roles: ["admin"],
  views: [
    {
      id: "users", segment: "",
      name: { en: "Users & access", ar: "المستخدمون والصلاحيات" }, icon: Shield,
      Component: lazy(() => import("./pages/UsersAccess")),
    },
    {
      id: "settings", segment: "settings",
      name: { en: "Settings", ar: "الإعدادات" }, icon: Settings,
      Component: lazy(() => import("./pages/AdminSettings")),
    },
    {
      id: "codes", segment: "codes",
      name: { en: "Numbering", ar: "الترقيم" }, icon: Hash,
      Component: lazy(() => import("./pages/CodeSettings")),
    },
    {
      id: "data", segment: "data",
      name: { en: "Data tools", ar: "أدوات البيانات" }, icon: Database,
      Component: lazy(() => import("./pages/DataManagement")),
    },
  ],
  metrics: (s) => [
    { label: { en: "Sites", ar: "المواقع" }, value: s.facilities.length, tone: "neutral" },
    { label: { en: "Departments", ar: "الأقسام" }, value: s.departments.length, tone: "neutral" },
    { label: { en: "Staff on record", ar: "الموظفون المسجلون" }, value: s.staff.length, tone: "neutral" },
  ],
};
