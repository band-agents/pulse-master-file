/**
 * The clinician workspace.
 *
 * A separate application, not a filtered view of the hospital system. The
 * difference is the point: the hospital system is organised by DEPARTMENT,
 * because that is how a hospital is run, and this is organised by PATIENT and
 * by WHAT IS WAITING FOR ME, because that is how a doctor's day is run. A
 * physician has no use for a housekeeping board or a procurement queue, and
 * making them navigate past those to reach their rounding list is the cost
 * that gets paid a hundred times a shift.
 *
 * Three tabs, in the order the day is worked: who is sick (Rounds), what is
 * waiting for me (Inbox), who is coming (Clinic). Everything else is reached
 * through a patient.
 */

import { lazy, Suspense } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import {
  Stethoscope, Inbox as InboxIcon, CalendarDays, Loader2, Languages, Sun, Moon, Building2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/app/context/LanguageContext";
import { Logo } from "@/app/components/Logo";
import { RouteErrorBoundary } from "@/app/components/RouteErrorBoundary";
import { PersonaSwitcher } from "@/app/shell/PersonaSwitcher";
import { NewEntryButton } from "@/app/shell/NewEntry";
import { serif } from "@/platform/ui";
import { useClinician } from "./useClinician";

const Rounds = lazy(() => import("./pages/Rounds"));
const ClinicianInbox = lazy(() => import("./pages/Inbox"));
const Clinic = lazy(() => import("./pages/Clinic"));
const PatientView = lazy(() => import("./pages/PatientView"));

export default function ClinicianApp() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <ClinicianBar />
      <main className="flex-1 min-h-0 overflow-auto">
        <RouteErrorBoundary resetKey={location}>
          <Suspense fallback={<Loading />}>
            <Switch>
              <Route path="/clinic" component={Rounds} />
              <Route path="/clinic/inbox" component={ClinicianInbox} />
              <Route path="/clinic/schedule" component={Clinic} />
              <Route path="/clinic/:id" component={PatientView} />
            </Switch>
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </div>
  );
}

function ClinicianBar() {
  const { lang, setLang } = useLanguage();
  const ar = lang === "ar";
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();
  const { provider, rounds, inbox } = useClinician();

  // Counts that change the decision to click, not vanity totals: how many
  // patients need looking at now, and how much of the inbox is critical.
  const needsReview = rounds.filter(
    (r) => r.criticalResults > 0 || (r.news2?.band === "high" || r.news2?.band === "medium"),
  ).length;
  const criticalInbox = inbox.filter((i) => i.tone === "critical").length;

  const tabs = [
    { href: "/clinic", icon: Stethoscope, en: "Rounds", ar: "الجولة", badge: needsReview, tone: "critical" as const },
    { href: "/clinic/inbox", icon: InboxIcon, en: "Inbox", ar: "الوارد", badge: criticalInbox || inbox.length, tone: criticalInbox > 0 ? "critical" as const : "neutral" as const },
    { href: "/clinic/schedule", icon: CalendarDays, en: "Clinic", ar: "العيادة", badge: 0, tone: "neutral" as const },
  ];

  return (
    <header className="shrink-0 bg-sidebar border-b border-sidebar-border">
      <div className="h-12 flex items-center gap-3 px-3 md:px-4">
        <Link href="/clinic" className="flex items-center gap-2 shrink-0 group">
          <Logo variant="mark" size={22} />
          <span className="hidden sm:flex flex-col leading-none">
            <span className="text-body-lg font-semibold text-sidebar-foreground group-hover:text-brand-ink transition-colors" style={serif}>
              {ar ? "مساحة الطبيب" : "Clinician"}
            </span>
            <span className="text-micro text-muted-foreground mt-0.5 truncate max-w-[180px]">
              {provider ? (ar ? provider.name_ar || provider.name_en : provider.name_en) : ar ? "كل المرضى" : "All patients"}
            </span>
          </span>
        </Link>

        <div className="ms-auto flex items-center gap-1.5">
          <NewEntryButton />
          <PersonaSwitcher />

          <Link
            href="/"
            title={ar ? "نظام المستشفى" : "Hospital system"}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Building2 size={15} />
          </Link>
          <button
            type="button" onClick={() => setLang(ar ? "en" : "ar")}
            title={ar ? "English" : "العربية"}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Languages size={15} />
          </button>
          <button
            type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={ar ? "تبديل المظهر" : "Toggle theme"}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      <nav className="px-3 md:px-4 flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = location === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href} href={t.href}
              className={`inline-flex items-center gap-2 px-3 h-9 text-body whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0
                ${active
                  ? "border-primary text-brand-ink font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
              {ar ? t.ar : t.en}
              {t.badge > 0 && (
                <span
                  className={`min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold grid place-items-center tabular-nums
                    ${t.tone === "critical"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground"}`}
                >
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function Loading() {
  const { lang } = useLanguage();
  return (
    <div className="h-full min-h-[50vh] grid place-items-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-caption" style={serif}>
          {lang === "ar" ? "جاري التحميل" : "Loading"}
        </span>
      </div>
    </div>
  );
}
