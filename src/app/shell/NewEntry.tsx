/**
 * The New button, and the panel behind it.
 *
 * This exists because the system had a real problem: you could open every
 * screen in the hospital and not find anywhere to record anything. The data
 * was all there, so it looked finished, but it was a photograph — nothing a
 * clinician typed went anywhere.
 *
 * The fix is one obvious, always-present control. Not a plus sign hidden in
 * the corner of each list, not a "…" menu: a filled button that says New,
 * sits next to the search box in every one of the three applications, and
 * opens the complete catalogue of everything this hospital can record.
 *
 * The catalogue is filtered by persona rather than by role. A patient sees
 * the two things a patient may create; a clinician sees the clinical set. That
 * is a display decision, not a security boundary — the boundary is in the
 * store's row-level rules, and it must not be inferred from what a menu
 * happens to show.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Search, X, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { usePersona } from "@/app/context/PersonaContext";
import { entriesForPersona, entryById } from "@/platform/forms/entries";
import { ENTRY_GROUPS, type EntryForm, type Values } from "@/platform/forms/types";
import { EntryFormView, EntryFormHeader } from "@/platform/forms/EntryForm";
import { serif } from "@/platform/ui";

interface OpenOpts {
  /** Values the caller already knows — the patient whose chart is open. */
  fixed?: Values;
  onDone?: (saved: Record<string, unknown>) => void;
}

interface NewEntryState {
  /** Open the catalogue, or jump straight to one form. */
  open: (formId?: string, opts?: OpenOpts) => void;
  close: () => void;
}

const Ctx = createContext<NewEntryState | null>(null);

export function NewEntryProvider({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [opts, setOpts] = useState<OpenOpts>({});

  const open = useCallback((id?: string, o: OpenOpts = {}) => {
    setFormId(id ?? null);
    setOpts(o);
    setShowing(true);
  }, []);

  const close = useCallback(() => {
    setShowing(false);
    setFormId(null);
    setOpts({});
  }, []);

  const value = useMemo<NewEntryState>(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {showing && (
        <EntryPanel
          formId={formId}
          fixed={opts.fixed}
          onPick={setFormId}
          onBack={() => setFormId(null)}
          onDone={(saved) => { opts.onDone?.(saved); close(); }}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}

export function useNewEntry(): NewEntryState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNewEntry must be used inside NewEntryProvider");
  return ctx;
}

// ─── The button ────────────────────────────────────────────

export function NewEntryButton({ compact = false }: { compact?: boolean }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { open } = useNewEntry();

  return (
    <button
      type="button"
      onClick={() => open()}
      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-caption font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
      title={ar ? "تسجيل بيانات جديدة" : "Record something new"}
    >
      <Plus size={14} strokeWidth={2.4} />
      {!compact && <span className="hidden sm:block">{ar ? "جديد" : "New"}</span>}
    </button>
  );
}

// ─── The panel ─────────────────────────────────────────────

function EntryPanel({
  formId, fixed, onPick, onBack, onDone, onClose,
}: {
  formId: string | null;
  fixed?: Values;
  onPick: (id: string) => void;
  onBack: () => void;
  onDone: (saved: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { persona } = usePersona();
  const [term, setTerm] = useState("");

  const available = useMemo(() => entriesForPersona(persona.kind), [persona.kind]);
  const spec = formId ? entryById(formId) : null;

  // Escape closes the form, then the panel — a single key that never traps
  // someone mid-entry with no visible way out.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (formId) onBack();
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formId, onBack, onClose]);

  const t = term.trim().toLowerCase();
  const matching = t
    ? available.filter((f) =>
        `${f.name.en} ${f.name.ar} ${f.summary.en} ${f.summary.ar}`.toLowerCase().includes(t))
    : available;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 sm:p-6 md:pt-[8vh]"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-[620px] max-h-[84vh] flex flex-col rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
        {spec ? (
          <>
            <div className="flex items-start">
              <div className="flex-1 min-w-0">
                <EntryFormHeader spec={spec} />
              </div>
              <div className="flex items-center gap-1 p-3 shrink-0">
                <PanelIcon onClick={onBack} label={ar ? "رجوع" : "Back"}>
                  <ArrowLeft size={15} className="rtl:rotate-180" />
                </PanelIcon>
                <PanelIcon onClick={onClose} label={ar ? "إغلاق" : "Close"}>
                  <X size={15} />
                </PanelIcon>
              </div>
            </div>
            <EntryFormView spec={spec} fixed={fixed} onDone={onDone} onCancel={onBack} />
          </>
        ) : (
          <>
            <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-title font-semibold text-foreground" style={serif}>
                    {ar ? "تسجيل بيانات جديدة" : "Record something new"}
                  </h2>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    {ar
                      ? "كل ما يمكن تسجيله في المستشفى، في قائمة واحدة."
                      : "Everything this hospital can record, in one list."}
                  </p>
                </div>
                <PanelIcon onClick={onClose} label={ar ? "إغلاق" : "Close"}>
                  <X size={15} />
                </PanelIcon>
              </div>

              <div className="mt-3 flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-background">
                <Search size={13} className="text-muted-foreground shrink-0" />
                <input
                  autoFocus value={term} onChange={(e) => setTerm(e.target.value)}
                  placeholder={ar ? "ابحث — مريض، موعد، وصفة…" : "Search — patient, appointment, prescription…"}
                  className="flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {matching.length === 0 && (
                <p className="px-5 py-8 text-caption text-muted-foreground text-center">
                  {ar ? "لا يوجد ما يطابق البحث." : "Nothing matches that."}
                </p>
              )}

              {ENTRY_GROUPS.map((group) => {
                const inGroup = matching.filter((f) => f.group === group.id);
                if (inGroup.length === 0) return null;
                return (
                  <section key={group.id} className="py-1.5">
                    <p className="px-5 py-1 text-micro font-semibold uppercase tracking-wide text-muted-foreground/70">
                      {ar ? group.ar : group.en}
                    </p>
                    {inGroup.map((f) => (
                      <EntryRow key={f.id} form={f} onClick={() => onPick(f.id)} />
                    ))}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EntryRow({ form, onClick }: { form: EntryForm; onClick: () => void }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const Icon = form.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-2.5 text-start hover:bg-muted/60 transition-colors group"
    >
      <span className="w-8 h-8 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0 group-hover:bg-brand-wash group-hover:text-brand-ink transition-colors">
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-lg font-medium text-foreground group-hover:text-brand-ink transition-colors">
          {ar ? form.name.ar : form.name.en}
        </span>
        <span className="block text-micro text-muted-foreground leading-snug mt-0.5">
          {ar ? form.summary.ar : form.summary.en}
        </span>
      </span>
    </button>
  );
}

function PanelIcon({
  onClick, label, children,
}: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label}
      className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {children}
    </button>
  );
}
