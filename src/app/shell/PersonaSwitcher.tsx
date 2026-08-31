/**
 * Persona switcher.
 *
 * The one control that appears in all three applications, and the only way to
 * see that they are connected rather than merely consistent. Switch from the
 * hospital system to Dr. Haddad and the ward you were looking at becomes her
 * rounding list; switch to the patient in bed 12 and it becomes his discharge
 * date and his prescriptions.
 *
 * Deliberately explicit about what it is. A control that silently changes
 * which human being the software thinks you are would be a security hole in a
 * clinical system, so it says on its face that it is a demonstration device
 * and that real access comes from signing in.
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronDown, Building2, Stethoscope, User, ArrowRightLeft } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { usePersona, PERSONA_HOME, PERSONA_LABEL, type PersonaKind } from "@/app/context/PersonaContext";
import { useCollection } from "@/platform/ui";
import { formatAge } from "@/platform/clinical/scores";

const KIND_ICON: Record<PersonaKind, typeof Building2> = {
  staff: Building2,
  clinician: Stethoscope,
  patient: User,
};

export function PersonaSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [, navigate] = useLocation();
  const { persona, setPersona } = usePersona();
  const [open, setOpen] = useState(false);

  const { rows: providers } = useCollection("providers");
  const { rows: patients } = useCollection("patients");

  // Only clinicians who may actually sign orders can be impersonated as a
  // clinician — a radiographer has no rounding list, and offering one would
  // teach the wrong thing about how the workspace is scoped.
  const doctors = useMemo(
    () =>
      providers
        .filter((p) => p.can_prescribe && p.status === "active")
        .slice(0, 12),
    [providers],
  );

  const activePatients = useMemo(
    () => patients.filter((p) => p.status === "active").slice(0, 12),
    [patients],
  );

  const current = useMemo(() => {
    if (persona.kind === "clinician") {
      const p = providers.find((x) => x.id === persona.id);
      return p ? (ar ? p.name_ar || p.name_en : p.name_en) : PERSONA_LABEL.clinician[ar ? "ar" : "en"];
    }
    if (persona.kind === "patient") {
      const p = patients.find((x) => x.id === persona.id);
      return p ? (ar ? p.name_ar || p.name_en : p.name_en) : PERSONA_LABEL.patient[ar ? "ar" : "en"];
    }
    return PERSONA_LABEL.staff[ar ? "ar" : "en"];
  }, [persona, providers, patients, ar]);

  function pick(kind: PersonaKind, id: string | null) {
    setPersona({ kind, id });
    setOpen(false);
    navigate(PERSONA_HOME[kind]);
  }

  const Icon = KIND_ICON[persona.kind];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/60 bg-background text-caption font-medium text-foreground hover:bg-muted transition-colors"
        title={ar ? "تبديل المستخدم" : "Switch user"}
      >
        <Icon size={13} className="text-brand-ink shrink-0" />
        {!compact && <span className="hidden sm:block max-w-[140px] truncate">{current}</span>}
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full mt-1.5 z-50 w-[290px] rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border/40 bg-muted/40">
              <p className="text-caption font-semibold text-foreground flex items-center gap-1.5">
                <ArrowRightLeft size={12} /> {ar ? "تبديل التطبيق" : "Switch application"}
              </p>
              <p className="text-micro text-muted-foreground mt-0.5 leading-snug">
                {ar
                  ? "الثلاثة يقرؤون نفس السجل. أداة عرض واختبار — الصلاحيات الحقيقية من تسجيل الدخول."
                  : "All three read one record. A demonstration device — real access comes from signing in."}
              </p>
            </div>

            <div className="max-h-[380px] overflow-y-auto py-1">
              <Group label={ar ? "المستشفى" : "Hospital"}>
                <Row
                  active={persona.kind === "staff"}
                  icon={Building2}
                  title={PERSONA_LABEL.staff[ar ? "ar" : "en"]}
                  sub={ar ? "كل الأقسام والوحدات" : "Every department and module"}
                  onClick={() => pick("staff", null)}
                />
              </Group>

              <Group label={ar ? "الأطباء" : "Clinicians"}>
                {doctors.map((d) => (
                  <Row
                    key={d.id}
                    active={persona.kind === "clinician" && persona.id === d.id}
                    icon={Stethoscope}
                    title={ar ? d.name_ar || d.name_en : d.name_en}
                    sub={(ar ? d.speciality_ar || d.speciality_en : d.speciality_en) ?? d.provider_type}
                    onClick={() => pick("clinician", d.id)}
                  />
                ))}
              </Group>

              <Group label={ar ? "المرضى" : "Patients"}>
                {activePatients.map((p) => (
                  <Row
                    key={p.id}
                    active={persona.kind === "patient" && persona.id === p.id}
                    icon={User}
                    title={ar ? p.name_ar || p.name_en : p.name_en}
                    sub={`${p.mrn} · ${formatAge(p.date_of_birth, ar)}`}
                    onClick={() => pick("patient", p.id)}
                  />
                ))}
              </Group>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-micro font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  active, icon: Icon, title, sub, onClick,
}: {
  active: boolean;
  icon: typeof Building2;
  title: string;
  sub?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-start transition-colors
        ${active ? "bg-brand-wash" : "hover:bg-muted/60"}`}
    >
      <Icon size={13} className={`shrink-0 ${active ? "text-brand-ink" : "text-muted-foreground"}`} />
      <span className="flex-1 min-w-0">
        <span className={`block text-body truncate ${active ? "text-brand-ink font-semibold" : "text-foreground"}`}>
          {title}
        </span>
        {sub && <span className="block text-micro text-muted-foreground truncate">{sub}</span>}
      </span>
      {active && <Check size={13} className="text-brand-ink shrink-0" />}
    </button>
  );
}
