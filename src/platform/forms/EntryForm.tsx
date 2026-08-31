/**
 * The form engine.
 *
 * Renders any spec from the entry catalogue, validates it, writes it, and
 * reports what happened. One implementation, so every form in the hospital
 * behaves the same way: the same keyboard behaviour, the same error placement,
 * the same confirmation, the same handling of a save that fails halfway.
 *
 * Two decisions worth stating, because both go against the usual habit:
 *
 * Errors appear on submit, not on keystroke. A clinician typing a dose into a
 * half-filled form does not need to be told the field below is empty; showing
 * them is how people learn to ignore red.
 *
 * Nothing is disabled while it is incomplete. A greyed-out save button gives
 * no reason, so the reader has to hunt for what is missing. The button stays
 * live, and pressing it says exactly what is wrong and moves focus there.
 */

import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertCircle, Search, X, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { usePersona } from "@/app/context/PersonaContext";
import { useSnapshot, type Snapshot } from "@/platform/data/snapshot";
import { getDataSource } from "@/platform/data/repository";
import { formatAge } from "@/platform/clinical/scores";
import { inputCls, labelCls, btnPrimary, btnGhost, serif } from "@/platform/ui";
import type { EntryForm as Spec, FieldSpec, FieldOption, Values, FormContext } from "./types";

interface Props {
  spec: Spec;
  /** Values fixed by the caller — a chart page opening "record vitals" for
   *  the patient already on screen. Rendered read-only. */
  fixed?: Values;
  onDone?: (saved: Record<string, unknown>) => void;
  onCancel?: () => void;
}

export function EntryFormView({ spec, fixed, onDone, onCancel }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { workspace } = useAuth();
  const { persona } = usePersona();
  const { snapshot } = useSnapshot();
  const [, navigate] = useLocation();

  const ctx = useMemo<FormContext>(() => {
    const provider = snapshot.providers.find((p) => p.id === persona.id);
    return {
      providerId: persona.kind === "clinician" ? persona.id : null,
      providerName: persona.kind === "clinician" ? provider?.name_en ?? "" : "",
      patientId: persona.kind === "patient" ? persona.id : null,
      workspaceId: workspace?.id ?? "demo",
    };
  }, [persona, snapshot.providers, workspace]);

  const [values, setValues] = useState<Values>(() => {
    const init: Values = {};
    for (const f of spec.fields) {
      const d = typeof f.default === "function" ? f.default(snapshot, ctx) : f.default;
      if (d !== undefined) init[f.name] = d;
    }
    // The portal never asks a patient which patient they are.
    if (ctx.patientId) init.patient_id = ctx.patientId;
    return { ...init, ...fixed };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const visible = spec.fields.filter((f) => !f.visibleWhen || f.visibleWhen(values));

  function set(name: string, value: Values[string]) {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: "" }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const f of visible) {
      const raw = values[f.name];
      const empty = raw === undefined || raw === null || raw === "";
      if (f.required && empty && f.kind !== "checkbox") {
        next[f.name] = ar ? "هذا الحقل مطلوب." : "This is required.";
        continue;
      }
      if (!empty && f.validate) {
        const msg = f.validate(raw, values, snapshot);
        if (msg) next[f.name] = ar ? msg.ar : msg.en;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = Object.keys(next)[0];
      setFormError(
        ar
          ? `${Object.keys(next).length} حقل يحتاج إلى مراجعة.`
          : `${Object.keys(next).length} field${Object.keys(next).length === 1 ? "" : "s"} need attention.`,
      );
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] textarea, [data-field="${first}"] select, [data-field="${first}"] button`)?.focus();
      return false;
    }
    const cross = spec.validate?.(values, snapshot);
    if (cross) {
      setFormError(ar ? cross.ar : cross.en);
      return false;
    }
    setFormError(null);
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const ds = getDataSource();
      const row = spec.build(values, snapshot, ctx);
      const adapter = ds[spec.table] as {
        create: (w: string, d: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
        update: (w: string, id: string, d: Record<string, unknown>) => Promise<unknown>;
      };
      const saved = (await adapter.create(ctx.workspaceId, row)) ?? row;

      // Side effects run after the main row exists, and each is reported on its
      // own. An admission whose bed update fails is still an admission — the
      // patient is in the building — so it must not be rolled back silently.
      for (const effect of spec.effects?.(values, snapshot, ctx, saved) ?? []) {
        try {
          const target = ds[effect.table] as {
            update: (w: string, id: string, d: Record<string, unknown>) => Promise<unknown>;
            create: (w: string, d: Record<string, unknown>) => Promise<unknown>;
          };
          const { id, ...rest } = effect.row as { id?: string } & Record<string, unknown>;
          if (id) await target.update(ctx.workspaceId, id, rest);
          else await target.create(ctx.workspaceId, effect.row);
        } catch (err) {
          toast.warning(
            ar ? "تم الحفظ، لكن خطوة تابعة فشلت." : "Saved, but a follow-on step failed.",
            { description: err instanceof Error ? err.message : String(err) },
          );
        }
      }

      const msg = spec.done(saved);
      toast.success(ar ? msg.ar : msg.en);

      onDone?.(saved);
      const to = spec.next?.(saved);
      if (to) navigate(to);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {formError && (
          <div role="alert" className="mb-4 rounded-xl bg-destructive/10 px-3.5 py-3 flex items-start gap-2.5">
            <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-caption text-foreground/85">{formError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          {visible.map((f) => (
            <div
              key={f.name}
              data-field={f.name}
              className={f.full || f.kind === "textarea" ? "col-span-2" : "col-span-2 sm:col-span-1"}
            >
              <FieldControl
                field={f}
                value={values[f.name]}
                values={values}
                snapshot={snapshot}
                error={errors[f.name]}
                locked={fixed ? f.name in fixed : false}
                onChange={(v) => set(f.name, v)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 px-5 py-3 flex items-center gap-2 bg-card">
        <button type="submit" className={`${btnPrimary} h-10 px-4`} disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {ar ? "حفظ" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${btnGhost} h-10 px-4`}>
            {ar ? "إلغاء" : "Cancel"}
          </button>
        )}
        <p className="text-micro text-muted-foreground ms-auto hidden sm:block">
          {ar ? "يظهر فوراً لكل من يحتاجه." : "Visible immediately to everyone who needs it."}
        </p>
      </div>
    </form>
  );
}

// ─── Controls ──────────────────────────────────────────────

function FieldControl({
  field, value, values, snapshot, error, locked, onChange,
}: {
  field: FieldSpec;
  value: Values[string];
  values: Values;
  snapshot: Snapshot;
  error?: string;
  locked?: boolean;
  onChange: (v: Values[string]) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const id = `f-${field.name}`;
  const label = ar ? field.label.ar : field.label.en;
  const hint = field.hint ? (ar ? field.hint.ar : field.hint.en) : null;
  const placeholder = field.placeholder ? (ar ? field.placeholder.ar : field.placeholder.en) : undefined;
  const cls = `${inputCls} h-10 ${error ? "border-destructive/60" : ""}`;

  const control = (() => {
    switch (field.kind) {
      case "textarea":
        return (
          <textarea
            id={id} rows={3} value={String(value ?? "")} placeholder={placeholder}
            disabled={locked} onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} py-2 min-h-[76px] resize-y ${error ? "border-destructive/60" : ""}`}
          />
        );

      case "checkbox":
        return (
          <label className="flex items-start gap-2.5 cursor-pointer select-none py-1">
            <input
              id={id} type="checkbox" checked={Boolean(value)} disabled={locked}
              onChange={(e) => onChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-input accent-[hsl(var(--primary))] shrink-0"
            />
            <span className="min-w-0">
              <span className="block text-body-lg text-foreground">{label}</span>
              {hint && <span className="block text-micro text-muted-foreground mt-0.5 leading-snug">{hint}</span>}
            </span>
          </label>
        );

      case "select": {
        const options = field.optionsFrom
          ? field.optionsFrom(snapshot, values)
          : field.options ?? [];
        return (
          <select
            id={id} value={String(value ?? "")} disabled={locked}
            onChange={(e) => onChange(e.target.value)} className={cls}
          >
            <option value="">{ar ? "— اختر —" : "— Select —"}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
            ))}
          </select>
        );
      }

      case "patient":
        return <RecordPicker
          id={id} kind="patient" value={String(value ?? "")} disabled={locked}
          snapshot={snapshot} onChange={onChange} error={Boolean(error)}
        />;

      case "provider":
        return <RecordPicker
          id={id} kind="provider" value={String(value ?? "")} disabled={locked}
          snapshot={snapshot} onChange={onChange} error={Boolean(error)}
        />;

      case "department":
        return <RecordPicker
          id={id} kind="department" value={String(value ?? "")} disabled={locked}
          snapshot={snapshot} onChange={onChange} error={Boolean(error)}
        />;

      case "number":
        return (
          <input
            id={id} type="number" inputMode="decimal" dir="ltr"
            value={value === null || value === undefined ? "" : String(value)}
            min={field.min} max={field.max} step={field.step ?? 1}
            placeholder={placeholder} disabled={locked}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={`${cls} tabular-nums`}
          />
        );

      case "date":
      case "datetime":
      case "time":
        return (
          <input
            id={id}
            type={field.kind === "datetime" ? "datetime-local" : field.kind}
            dir="ltr" value={String(value ?? "")} disabled={locked}
            onChange={(e) => onChange(e.target.value)} className={cls}
          />
        );

      default:
        return (
          <input
            id={id} type="text" value={String(value ?? "")} placeholder={placeholder}
            disabled={locked} onChange={(e) => onChange(e.target.value)} className={cls}
          />
        );
    }
  })();

  if (field.kind === "checkbox") {
    return <div>{control}{error && <ErrorLine msg={error} />}</div>;
  }

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {field.required && <span className="text-destructive ms-0.5" aria-hidden>*</span>}
      </label>
      {control}
      {hint && !error && <p className="text-micro text-muted-foreground mt-1 leading-snug">{hint}</p>}
      {error && <ErrorLine msg={error} />}
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p role="alert" className="text-micro text-destructive mt-1 flex items-center gap-1">
      <AlertCircle size={11} className="shrink-0" /> {msg}
    </p>
  );
}

// ─── Record picker ─────────────────────────────────────────

/**
 * Searchable picker over people and places.
 *
 * A plain `<select>` of two hundred patients is unusable and, worse, is how
 * the wrong patient gets picked — the entire class of wrong-patient errors
 * starts with a list where two similar names sit next to each other. So every
 * row shows a second identifier (an MRN, a speciality) and the list must be
 * searched rather than scrolled.
 */
function RecordPicker({
  id, kind, value, snapshot, disabled, error, onChange,
}: {
  id: string;
  kind: "patient" | "provider" | "department";
  value: string;
  snapshot: Snapshot;
  disabled?: boolean;
  error?: boolean;
  onChange: (v: string) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const rows = useMemo<{ id: string; title: string; sub: string }[]>(() => {
    if (kind === "patient") {
      return snapshot.patients
        .filter((p) => p.status === "active")
        .map((p) => ({
          id: p.id,
          title: ar ? p.name_ar || p.name_en : p.name_en,
          sub: `${p.mrn} · ${formatAge(p.date_of_birth, ar)}`,
        }));
    }
    if (kind === "provider") {
      return snapshot.providers
        .filter((p) => p.status === "active")
        .map((p) => ({
          id: p.id,
          title: ar ? p.name_ar || p.name_en : p.name_en,
          sub: (ar ? p.speciality_ar || p.speciality_en : p.speciality_en) ?? p.provider_type,
        }));
    }
    return snapshot.departments.map((d) => ({
      id: d.id,
      title: ar ? d.name_ar || d.name_en : d.name_en,
      sub: d.code ?? "",
    }));
  }, [kind, snapshot, ar]);

  const selected = rows.find((r) => r.id === value);
  const t = term.trim().toLowerCase();
  const filtered = t
    ? rows.filter((r) => r.title.toLowerCase().includes(t) || r.sub.toLowerCase().includes(t))
    : rows;

  return (
    <div className="relative">
      <button
        type="button" id={id} disabled={disabled}
        onClick={() => { setOpen((v) => !v); setTerm(""); }}
        aria-expanded={open}
        className={`${inputCls} h-10 flex items-center gap-2 text-start ${error ? "border-destructive/60" : ""} ${disabled ? "opacity-70" : ""}`}
      >
        <span className="flex-1 min-w-0 truncate">
          {selected
            ? <><span className="text-foreground">{selected.title}</span>
                <span className="text-muted-foreground"> · {selected.sub}</span></>
            : <span className="text-muted-foreground">{ar ? "ابحث واختر…" : "Search and select…"}</span>}
        </span>
        {selected && !disabled && (
          <span
            role="button" tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </span>
        )}
        <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute start-0 end-0 top-full mt-1 z-50 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border/40">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                autoFocus value={term} onChange={(e) => setTerm(e.target.value)}
                placeholder={ar ? "اكتب للبحث" : "Type to search"}
                className="flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-caption text-muted-foreground text-center">
                  {ar ? "لا نتائج." : "No matches."}
                </p>
              )}
              {filtered.slice(0, 60).map((r) => (
                <button
                  key={r.id} type="button"
                  onClick={() => { onChange(r.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-start transition-colors
                    ${r.id === value ? "bg-brand-wash" : "hover:bg-muted/60"}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className={`block text-body truncate ${r.id === value ? "text-brand-ink font-semibold" : "text-foreground"}`}>
                      {r.title}
                    </span>
                    <span className="block text-micro text-muted-foreground truncate font-mono">{r.sub}</span>
                  </span>
                  {r.id === value && <Check size={13} className="text-brand-ink shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Title block for a form shown inside a panel. */
export function EntryFormHeader({ spec }: { spec: Spec }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const Icon = spec.icon;
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border/40">
      <span className="w-9 h-9 rounded-xl bg-brand-wash text-brand-ink grid place-items-center shrink-0">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <h2 className="text-title font-semibold text-foreground" style={serif}>
          {ar ? spec.name.ar : spec.name.en}
        </h2>
        <p className="text-caption text-muted-foreground mt-0.5 leading-snug">
          {ar ? spec.summary.ar : spec.summary.en}
        </p>
      </div>
    </div>
  );
}
