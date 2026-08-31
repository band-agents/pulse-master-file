/**
 * Al-Obour General Hospital — single source of truth for the system's identity.
 *
 * Anywhere the application names itself, builds a storage key, names an export
 * or stamps a code, it comes from here. No bare name literals anywhere else:
 * the system this was branched from carried 311 scattered ones across 79
 * files, which is why renaming it was a project rather than an edit.
 */

export const BRAND = {
  /** Display name, English. */
  name: "Al-Obour General Hospital",
  /** Display name, Arabic. */
  nameAr: "مستشفى العبور العام",

  /** Short form, for tight chrome like the top bar and browser tab. */
  shortName: "Al-Obour",
  shortNameAr: "العبور",

  /** What the system is, for titles and sign-in surfaces. */
  tagline: "Hospital Information System",
  taglineAr: "نظام معلومات المستشفى",

  /** The clinical assistant. Sanad — سند, "support". */
  assistant: "Sanad",
  assistantAr: "سند",

  /** Prefix for localStorage keys — `alobour_role`, etc. */
  storagePrefix: "alobour_",
  /** Prefix for generated downloads — `alobour-claims-2026-08-31.csv`. */
  exportPrefix: "alobour-",
  /** Prefix for generated patient-facing codes — `AOG-A1B2-X4Y5Z6`. */
  codePrefix: "AOG",
  /** Console prefix, so logs are greppable. */
  logPrefix: "[Al-Obour]",
} as const;

/** `storageKey("role")` -> `"alobour_role"` */
export function storageKey(name: string): string {
  return `${BRAND.storagePrefix}${name}`;
}

/** `exportName("claims")` -> `"alobour-claims-2026-08-31"` */
export function exportName(entity: string, date = new Date()): string {
  return `${BRAND.exportPrefix}${entity}-${date.toISOString().slice(0, 10)}`;
}

/**
 * Storage keys written under an earlier identity. Values already in a
 * browser must survive a rename — losing someone's saved dashboard layout
 * because the system was renamed is not an acceptable trade.
 */
const LEGACY_PREFIXES = ["pulse_", "bumblebee_", "thoth_"] as const;

const MIGRATED_KEYS = [
  "onboarding", "pending_invite", "saved_reports", "recent_pages",
  "command_history", "code_settings", "code_counters", "role",
  "dashboards", "loadtest",
] as const;

/**
 * One-time copy of legacy keys onto their `alobour_` names. Idempotent, and
 * never overwrites a value that already exists under the new key. Called once
 * at boot, before anything reads storage.
 */
export function migrateLegacyStorage(): void {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return; // private mode or storage blocked — nothing to migrate
  }

  for (const name of MIGRATED_KEYS) {
    const to = `${BRAND.storagePrefix}${name}`;
    try {
      if (storage.getItem(to) !== null) continue; // already migrated
      for (const prefix of LEGACY_PREFIXES) {
        const value = storage.getItem(`${prefix}${name}`);
        if (value === null) continue;
        storage.setItem(to, value);
        storage.removeItem(`${prefix}${name}`);
        break;
      }
    } catch {
      // Quota or serialisation trouble on one key must not block the rest.
    }
  }
}
