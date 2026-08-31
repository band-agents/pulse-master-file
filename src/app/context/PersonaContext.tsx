/**
 * Persona — who is using the system, and therefore which of the three
 * applications they are in.
 *
 * Al-Madinah is not one interface with three skins. It is three genuinely
 * different applications — a hospital system, a clinician workspace and a
 * patient portal — over one shared record. They are different because the
 * three jobs are different: a ward clerk needs breadth, a physician needs
 * their own patients ranked by how sick they are, and a patient needs four
 * things in large type. Giving all three the same screen would serve none of
 * them.
 *
 * What they share is the store. A booking made in the portal is not copied to
 * the hospital system; it IS the row the hospital system reads. That is what
 * "connected" has to mean, and it is why the persona lives here rather than
 * inside any one of the three shells.
 *
 * The switcher is a demonstration and testing device, not an authentication
 * mechanism. In a real deployment the persona comes from the signed-in
 * identity — a patient cannot elect to become a cardiologist. That boundary is
 * enforced server-side by row-level security; this context only decides which
 * front door opens.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storageKey } from "@/platform/lib/brand";

export type PersonaKind = "staff" | "clinician" | "patient";

export interface Persona {
  kind: PersonaKind;
  /** Provider id when clinician, patient id when patient, null for staff. */
  id: string | null;
}

/** Where each persona's application lives. */
export const PERSONA_HOME: Record<PersonaKind, string> = {
  staff: "/",
  clinician: "/clinic",
  patient: "/portal",
};

export const PERSONA_LABEL: Record<PersonaKind, { en: string; ar: string }> = {
  staff: { en: "Hospital system", ar: "نظام المستشفى" },
  clinician: { en: "Clinician workspace", ar: "مساحة الطبيب" },
  patient: { en: "Patient portal", ar: "بوابة المريض" },
};

const KEY = storageKey("persona");
const DEFAULT: Persona = { kind: "staff", id: null };

function load(): Persona {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Persona>;
    if (parsed.kind !== "staff" && parsed.kind !== "clinician" && parsed.kind !== "patient") {
      return DEFAULT;
    }
    return { kind: parsed.kind, id: typeof parsed.id === "string" ? parsed.id : null };
  } catch {
    return DEFAULT;
  }
}

interface PersonaState {
  persona: Persona;
  setPersona: (p: Persona) => void;
  /** True while the current persona is anything other than hospital staff. */
  isStaff: boolean;
}

const Ctx = createContext<PersonaState | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setState] = useState<Persona>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(persona));
    } catch {
      // Storage blocked. The persona still holds for this session.
    }
  }, [persona]);

  const value = useMemo<PersonaState>(
    () => ({ persona, setPersona: setState, isStaff: persona.kind === "staff" }),
    [persona],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePersona(): PersonaState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePersona must be used inside PersonaProvider");
  return ctx;
}
