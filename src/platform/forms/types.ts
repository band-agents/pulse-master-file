/**
 * Data-entry contract.
 *
 * Every place the hospital records something new is described here as a spec
 * rather than written as a screen. Twelve hand-built forms would be twelve
 * copies of the same validation, submit, error and toast logic, and they would
 * drift — one would forget to trim the MRN, another would let a future date of
 * birth through, and the difference would only show up in the data months
 * later.
 *
 * A spec says what is being recorded, what has to be known to record it, and
 * how those answers become a row. The engine owns everything else.
 */

import type { LucideIcon } from "lucide-react";
import type { Snapshot } from "@/platform/data/snapshot";
import type { DataSource } from "@/platform/data/repository";
import type { Label } from "@/modules/types";

/** Tables an entry form may write to. */
export type WritableTable = keyof DataSource & string;

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "checkbox"
  | "patient"
  | "provider"
  | "encounter"
  | "department";

export interface FieldOption {
  value: string;
  en: string;
  ar: string;
}

export interface FieldSpec {
  name: string;
  label: Label;
  kind: FieldKind;
  required?: boolean;
  /** Half-width by default; `full` spans the grid. */
  full?: boolean;
  placeholder?: Label;
  /** Helper text under the control — units, ranges, what the value is for. */
  hint?: Label;
  options?: FieldOption[];
  /** Options that depend on other answers (a ward's beds, a patient's visits). */
  optionsFrom?: (s: Snapshot, values: Values) => FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  /** Prefilled when the form opens. */
  default?: string | number | boolean | ((s: Snapshot, ctx: FormContext) => string | number | boolean);
  /** Hide unless this predicate passes — contrast checks, PRN reasons. */
  visibleWhen?: (values: Values) => boolean;
  /** Field-level check. Return a message to block submission. */
  validate?: (value: unknown, values: Values, s: Snapshot) => Label | null;
}

export type Values = Record<string, string | number | boolean | null>;

/** What the engine knows about who is filling the form in. */
export interface FormContext {
  /** Provider id when a clinician is signed in, else null. */
  providerId: string | null;
  providerName: string;
  /** Patient id when the portal is filling the form in, else null. */
  patientId: string | null;
  workspaceId: string;
}

/** One extra row written alongside the main one — an order and its lab request. */
export interface SideEffect {
  table: WritableTable;
  row: Record<string, unknown>;
}

export interface EntryForm {
  id: string;
  /** The table the main row lands in. */
  table: WritableTable;
  name: Label;
  /** One line under the title saying what recording this actually does. */
  summary: Label;
  icon: LucideIcon;
  group: EntryGroup;
  /** Which personas may open this form. */
  personas: ("staff" | "clinician" | "patient")[];
  fields: FieldSpec[];
  /** Turn answers into the row to insert. */
  build: (values: Values, s: Snapshot, ctx: FormContext) => Record<string, unknown>;
  /** Rows to write besides the main one, e.g. an order plus its lab request. */
  effects?: (values: Values, s: Snapshot, ctx: FormContext, saved: Record<string, unknown>) => SideEffect[];
  /** Where to go after saving. Receives the saved row. */
  next?: (saved: Record<string, unknown>) => string | null;
  /** Cross-field check, run after every field-level one passes. */
  validate?: (values: Values, s: Snapshot) => Label | null;
  /** Confirmation line shown in the success toast. */
  done: (saved: Record<string, unknown>) => Label;
}

export type EntryGroup =
  | "registration"
  | "clinical"
  | "orders"
  | "diagnostics"
  | "scheduling"
  | "communication";

export const ENTRY_GROUPS: { id: EntryGroup; en: string; ar: string }[] = [
  { id: "registration",  en: "Registration & admission", ar: "التسجيل والدخول" },
  { id: "clinical",      en: "Clinical record",          ar: "السجل السريري" },
  { id: "orders",        en: "Orders & prescribing",     ar: "الأوامر والوصفات" },
  { id: "diagnostics",   en: "Diagnostics",              ar: "التشخيص" },
  { id: "scheduling",    en: "Scheduling",               ar: "المواعيد" },
  { id: "communication", en: "Communication",            ar: "المراسلات" },
];
