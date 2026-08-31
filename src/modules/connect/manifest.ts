import { lazy } from "react";
import { Share2, Smartphone, Video, Network, ScrollText } from "lucide-react";
import type { ModuleManifest } from "../types";

export const connectModule: ModuleManifest = {
  id: "connect",
  base: "/connect",
  name: { en: "Patient Access & Interop", ar: "خدمات المرضى والتكامل" },
  summary: {
    en: "Patient portal, telehealth, and the HL7 / FHIR interface engine.",
    ar: "بوابة المرضى والطب عن بعد ومحرك التكامل HL7 و FHIR.",
  },
  icon: Share2,
  group: "intelligence",
  roles: ["admin", "reception", "physician"],
  datasets: ["portal_messages", "telehealth_sessions", "interface_messages", "interface_endpoints"],
  views: [
    {
      id: "portal", segment: "",
      name: { en: "Patient portal", ar: "بوابة المرضى" }, icon: Smartphone,
      Component: lazy(() => import("./pages/PatientPortal")),
    },
    {
      id: "telehealth", segment: "telehealth",
      name: { en: "Telehealth", ar: "الطب عن بعد" }, icon: Video,
      Component: lazy(() => import("./pages/Telehealth")),
    },
    {
      id: "engine", segment: "interfaces",
      name: { en: "Interface engine", ar: "محرك التكامل" }, icon: Network,
      Component: lazy(() => import("./pages/InterfaceEngine")),
    },
    {
      id: "messages", segment: "messages",
      name: { en: "Message log", ar: "سجل الرسائل" }, icon: ScrollText,
      Component: lazy(() => import("./pages/InterfaceMessages")),
    },
  ],
  metrics: (s) => {
    const down = s.interfaceEndpoints.filter(
      (e) => e.status === "down" || e.status === "degraded",
    ).length;
    const deadLetter = s.interfaceMessages.filter(
      (m) => m.status === "dead_letter" || m.status === "error",
    ).length;
    const unread = s.portalMessages.filter(
      (m) => m.direction === "inbound" && m.status === "unread",
    ).length;
    return [
      {
        label: { en: "Interfaces degraded", ar: "واجهات متدهورة" },
        value: down,
        tone: down > 0 ? "critical" : "success",
      },
      {
        label: { en: "Messages in error", ar: "رسائل فاشلة" },
        value: deadLetter,
        tone: deadLetter > 0 ? "warning" : "success",
      },
      {
        label: { en: "Unread from patients", ar: "رسائل مرضى غير مقروءة" },
        value: unread,
        tone: unread > 0 ? "warning" : "success",
      },
    ];
  },
};
