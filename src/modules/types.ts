/**
 * Module contract.
 *
 * Al-Madinah is assembled from self-describing modules rather than a central
 * route table and a hand-maintained navigation tree. A module declares its
 * own identity, its views, who it is for, and the handful of numbers that
 * represent it on the Hub — and the shell, the router, the command palette
 * and the role filter are all derived from those declarations.
 *
 * The practical consequence: adding a department to the hospital is one new
 * folder with one manifest. Nothing else in the application needs editing,
 * and nothing can drift out of sync, because there is only one description.
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/platform/ui";
import type { Snapshot } from "@/platform/data/snapshot";

/** Where a module sits in the hospital, used to group the Hub. */
export type ModuleGroup =
  | "care"          // direct patient care
  | "diagnostics"   // lab, imaging, blood
  | "operations"    // supply, estates, support services
  | "administration"// revenue, workforce, access
  | "intelligence"; // analytics and connectivity

export const MODULE_GROUPS: { id: ModuleGroup; en: string; ar: string }[] = [
  { id: "care",           en: "Patient care",   ar: "رعاية المرضى" },
  { id: "diagnostics",    en: "Diagnostics",    ar: "التشخيص" },
  { id: "operations",     en: "Operations",     ar: "التشغيل" },
  { id: "administration", en: "Administration", ar: "الإدارة" },
  { id: "intelligence",   en: "Intelligence",   ar: "المعلومات" },
];

/**
 * Job roles, used to personalise the Hub. A role is not a permission — access
 * control lives in `platform/lib/permissions`. This only decides what a person
 * sees first, and everything stays reachable through the command palette.
 */
export type Role =
  | "physician" | "nurse" | "emergency" | "theatre"
  | "lab" | "imaging" | "pharmacy"
  | "reception" | "rcm" | "supply" | "workforce"
  | "executive" | "admin";

export const ROLES: { id: Role; en: string; ar: string }[] = [
  { id: "physician", en: "Physician",       ar: "طبيب" },
  { id: "nurse",     en: "Nurse",           ar: "ممرض" },
  { id: "emergency", en: "Emergency",       ar: "الطوارئ" },
  { id: "theatre",   en: "Theatres",        ar: "العمليات" },
  { id: "lab",       en: "Laboratory",      ar: "المختبر" },
  { id: "imaging",   en: "Imaging",         ar: "الأشعة" },
  { id: "pharmacy",  en: "Pharmacy",        ar: "الصيدلية" },
  { id: "reception", en: "Reception",       ar: "الاستقبال" },
  { id: "rcm",       en: "Revenue cycle",   ar: "الدورة الإيرادية" },
  { id: "supply",    en: "Supply chain",    ar: "سلسلة الإمداد" },
  { id: "workforce", en: "Workforce",       ar: "القوى العاملة" },
  { id: "executive", en: "Executive",       ar: "الإدارة التنفيذية" },
  { id: "admin",     en: "System admin",    ar: "مسؤول النظام" },
];

/** A bilingual string. Used everywhere rather than a translation key, because
 *  the two languages sit side by side in the source and cannot drift apart. */
export interface Label {
  en: string;
  ar: string;
}

/** One headline number on a module's Hub card. */
export interface HubMetric {
  label: Label;
  value: string | number;
  tone?: Tone;
  /** Secondary line, for context the number alone does not carry. */
  note?: Label;
}

/** A screen inside a module. */
export interface ModuleView {
  id: string;
  /**
   * Path segment below the module base. "" is the module's landing view.
   * May carry a wouter parameter, e.g. ":id".
   */
  segment: string;
  name: Label;
  icon?: LucideIcon;
  /** Detail routes: routable, but not shown in the module's tab bar. */
  hidden?: boolean;
  Component: ComponentType;
}

export interface ModuleManifest {
  id: string;
  /** Route base, e.g. "/emergency". Must be unique and start with a slash. */
  base: string;
  name: Label;
  /** One line on the Hub card, saying what the module is for. */
  summary: Label;
  icon: LucideIcon;
  group: ModuleGroup;
  /** Roles that see this module promoted on their Hub. */
  roles: Role[];
  views: ModuleView[];
  /**
   * Numbers for the Hub card, derived from one shared snapshot so that
   * sixteen cards cost one load rather than sixteen.
   */
  metrics?: (s: Snapshot) => HubMetric[];
  /** Datasets this module contributes to the analytics layer. */
  datasets?: string[];
}

/** Absolute path for a view — the single place route strings are built. */
export function viewPath(m: ModuleManifest, v: ModuleView): string {
  return v.segment ? `${m.base}/${v.segment}` : m.base;
}

/** The view a bare module path should land on. */
export function landingView(m: ModuleManifest): ModuleView | undefined {
  return m.views.find((v) => v.segment === "") ?? m.views.find((v) => !v.hidden);
}
