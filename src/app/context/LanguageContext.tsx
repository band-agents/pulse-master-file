/**
 * Language — اللغة
 *
 * Which of the two languages the interface is in, and the document direction
 * that follows from it.
 *
 * This used to read `bumblebee_onboarding` — a key belonging to the ERP this
 * system was branched from, written by an onboarding wizard that no longer
 * exists. Nothing had written that key since the wizard was removed, so the
 * effect was that switching to Arabic worked until you reloaded and then
 * silently reverted to English. In a hospital where a majority of staff work
 * in Arabic, a language toggle that forgets is worse than none: people stop
 * trusting it and start compensating.
 *
 * The choice is now persisted under the system's own key, and migrated from
 * the old prefixes by `migrateLegacyStorage` so nobody loses a preference
 * across the rename.
 */

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react";
import { storageKey } from "@/platform/lib/brand";

type Language = "en" | "ar";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isRtl: boolean;
}

const KEY = storageKey("lang");

/**
 * Read the stored choice synchronously, during the first render.
 *
 * Doing this in an effect instead — as the previous version did — renders the
 * whole application in English for one frame and then flips it, which on a
 * slow ward terminal is a visible flash of the wrong language and, worse, a
 * visible flip of the entire layout from LTR to RTL.
 */
function load(): Language {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "ar" || saved === "en") return saved;

    // A deployment upgraded from the branched ERP may still hold the choice
    // inside the old onboarding blob. Read it once, then let the write below
    // move it to its own key.
    const legacy = window.localStorage.getItem("bumblebee_onboarding");
    if (legacy) {
      const parsed = JSON.parse(legacy) as { language?: unknown };
      if (parsed.language === "ar" || parsed.language === "en") return parsed.language;
    }
  } catch {
    // Storage blocked, or a malformed legacy blob. English is the safe default.
  }
  return "en";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(load);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Private mode. The choice still holds for this session.
    }
  }, []);

  const isRtl = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang, isRtl]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
