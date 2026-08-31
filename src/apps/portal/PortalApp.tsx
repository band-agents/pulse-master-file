/**
 * The patient portal.
 *
 * The third application, and the one that is least like the other two. A
 * clinician reads dense screens all day and wants information per square inch;
 * a patient opens this perhaps twice a month, on a phone, possibly anxious,
 * possibly in a second language. So this application inverts every density
 * decision the other two make: bigger type, fewer things per screen, one
 * obvious action per card, and no abbreviation anywhere.
 *
 * Navigation is a bottom bar on a phone and a top bar on a desktop, with four
 * destinations and no more, because a portal with a menu is a portal nobody
 * finds anything in.
 */

import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import {
  Home, CalendarDays, Pill, FlaskConical, MessageSquare, Loader2,
  Languages, Building2,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { usePersona } from "@/app/context/PersonaContext";
import { Logo } from "@/app/components/Logo";
import { RouteErrorBoundary } from "@/app/components/RouteErrorBoundary";
import { PersonaSwitcher } from "@/app/shell/PersonaSwitcher";
import { serif } from "@/platform/ui";
import { usePortal } from "./usePortal";

const PortalHome = lazy(() => import("./pages/Home"));
const Visits = lazy(() => import("./pages/Visits"));
const Medicines = lazy(() => import("./pages/Medicines"));
const Results = lazy(() => import("./pages/Results"));
const Messages = lazy(() => import("./pages/Messages"));

const NAV = [
  { href: "/portal",           icon: Home,          en: "Home",      ar: "الرئيسية" },
  { href: "/portal/visits",    icon: CalendarDays,  en: "Visits",    ar: "المواعيد" },
  { href: "/portal/medicines", icon: Pill,          en: "Medicines", ar: "الأدوية" },
  { href: "/portal/results",   icon: FlaskConical,  en: "Results",   ar: "النتائج" },
  { href: "/portal/messages",  icon: MessageSquare, en: "Messages",  ar: "الرسائل" },
];

export default function PortalApp() {
  const [location] = useLocation();
  const { persona, setPersona } = usePersona();
  const { patient } = usePortal();

  // Being in the portal IS being a patient. When someone arrives here as
  // staff, the portal falls back to showing a patient's record — and the
  // persona has to follow, or anything they record from these screens is
  // attributed to the hospital rather than to the person whose record it is.
  useEffect(() => {
    if (persona.kind === "patient" || !patient) return;
    setPersona({ kind: "patient", id: patient.id });
  }, [persona.kind, patient, setPersona]);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <PortalBar />
      <main className="flex-1 min-h-0 overflow-auto pb-[68px] md:pb-0">
        <RouteErrorBoundary resetKey={location}>
          <Suspense fallback={<Loading />}>
            <Switch>
              <Route path="/portal" component={PortalHome} />
              <Route path="/portal/visits" component={Visits} />
              <Route path="/portal/medicines" component={Medicines} />
              <Route path="/portal/results" component={Results} />
              <Route path="/portal/messages" component={Messages} />
            </Switch>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

function PortalBar() {
  const { lang, setLang } = useLanguage();
  const ar = lang === "ar";
  const [location] = useLocation();
  const { patient, unreadCount } = usePortal();

  return (
    <header className="shrink-0 bg-sidebar border-b border-sidebar-border">
      <div className="h-14 flex items-center gap-3 px-4 max-w-[900px] mx-auto w-full">
        <Link href="/portal" className="flex items-center gap-2.5 shrink-0">
          <Logo variant="mark" size={26} />
          <span className="flex flex-col leading-none">
            <span className="text-body-lg font-semibold text-sidebar-foreground" style={serif}>
              {ar ? "بوابة المريض" : "Patient portal"}
            </span>
            {patient && (
              <span className="text-micro text-muted-foreground mt-0.5 truncate max-w-[190px]">
                {ar ? patient.name_ar || patient.name_en : patient.name_en}
              </span>
            )}
          </span>
        </Link>

        <div className="ms-auto flex items-center gap-1.5">
          <PersonaSwitcher compact />
          <Link
            href="/"
            title={ar ? "نظام المستشفى" : "Hospital system"}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Building2 size={16} />
          </Link>
          <button
            type="button" onClick={() => setLang(ar ? "en" : "ar")}
            title={ar ? "English" : "العربية"}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Languages size={16} />
          </button>
        </div>
      </div>

      {/* Desktop navigation. On a phone this is the bottom bar instead. */}
      <nav className="hidden md:block border-t border-sidebar-border/60">
        <div className="max-w-[900px] mx-auto w-full px-4 flex items-center gap-1">
          {NAV.map((n) => {
            const active = location === n.href;
            const Icon = n.icon;
            const badge = n.href === "/portal/messages" ? unreadCount : 0;
            return (
              <Link
                key={n.href} href={n.href}
                className={`inline-flex items-center gap-2 px-3 h-10 text-body-lg whitespace-nowrap border-b-2 -mb-px transition-colors
                  ${active
                    ? "border-primary text-brand-ink font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                {ar ? n.ar : n.en}
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center tabular-nums">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function BottomNav() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [location] = useLocation();
  const { unreadCount } = usePortal();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t border-sidebar-border">
      <div className="flex items-stretch">
        {NAV.map((n) => {
          const active = location === n.href;
          const Icon = n.icon;
          const badge = n.href === "/portal/messages" ? unreadCount : 0;
          return (
            <Link
              key={n.href} href={n.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative transition-colors
                ${active ? "text-brand-ink" : "text-muted-foreground"}`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                {badge > 0 && (
                  <span className="absolute -top-1 -end-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center tabular-nums">
                    {badge}
                  </span>
                )}
              </span>
              <span className={`text-micro ${active ? "font-semibold" : ""}`}>
                {ar ? n.ar : n.en}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Loading() {
  const { lang } = useLanguage();
  return (
    <div className="h-full min-h-[50vh] grid place-items-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-body" style={serif}>
          {lang === "ar" ? "جاري التحميل" : "Loading"}
        </span>
      </div>
    </div>
  );
}

/** Shared page frame for the portal — wider gutters, capped measure. */
export function PortalPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[900px] mx-auto w-full px-4 py-5 md:py-7 space-y-5">
      {children}
    </div>
  );
}
