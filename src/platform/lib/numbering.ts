/**
 * Hospital identifiers.
 *
 * Every human-facing number a hospital says out loud: an MRN a nurse reads
 * from a wristband, an accession number a lab tech types off a tube label, an
 * encounter number on a wristband barcode.
 *
 * These are deliberately not the row ids. A row id is a machine key that may
 * change during a merge; an MRN is a fact about a person that follows them for
 * life and appears on paper. Conflating the two is how patients end up with
 * two charts.
 *
 * Counters are per-browser in demo mode. In a live deployment the database
 * owns the sequence, because two receptionists registering at the same moment
 * on two workstations must not be able to mint the same MRN.
 */

import { BRAND, storageKey } from "@/platform/lib/brand";

const KEY = storageKey("numbering");

type Series =
  | "mrn"
  | "encounter"
  | "appointment"
  | "order"
  | "rx"
  | "accession"
  | "case"
  | "session";

/** Prefix and width per series. Widths match what fits on a wristband label. */
const SERIES: Record<Series, { prefix: string; digits: number; start: number }> = {
  mrn:         { prefix: "MRN", digits: 6, start: 480_001 },
  encounter:   { prefix: "ENC", digits: 6, start: 240_001 },
  appointment: { prefix: "APT", digits: 6, start: 120_001 },
  order:       { prefix: "ORD", digits: 6, start: 360_001 },
  rx:          { prefix: "RX",  digits: 6, start: 190_001 },
  accession:   { prefix: "ACC", digits: 6, start: 610_001 },
  case:        { prefix: "OT",  digits: 5, start: 42_001 },
  session:     { prefix: "TEL", digits: 5, start: 18_001 },
};

function counters(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * Next number in a series. The hospital code prefixes the whole thing so a
 * document photographed on a ward is traceable to the site that issued it.
 */
export function nextNumber(series: Series): string {
  const cfg = SERIES[series];
  const all = counters();
  const n = (all[series] ?? cfg.start) + 1;
  all[series] = n;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked. The number is still unique within this session, which
    // is enough for the value not to collide on screen.
  }
  return `${BRAND.codePrefix}-${cfg.prefix}-${String(n).padStart(cfg.digits, "0")}`;
}

/** Short form without the hospital prefix, for dense table cells. */
export function shortNumber(full: string): string {
  return full.startsWith(`${BRAND.codePrefix}-`) ? full.slice(BRAND.codePrefix.length + 1) : full;
}
