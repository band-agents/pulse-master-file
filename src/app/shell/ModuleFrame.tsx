/**
 * Module frame.
 *
 * A module takes the whole viewport. Its own views sit on a tab strip inside
 * the frame rather than in a global sidebar, which is what lets a bed board or
 * a theatre list use the full width of a ward workstation.
 *
 * The strip disappears for single-view modules — a row of one tab is chrome
 * that tells the reader nothing.
 */

import { Suspense, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { moduleForPath, viewForPath } from "@/modules/registry";
import { viewPath, type ModuleManifest } from "@/modules/types";
import { serif } from "@/platform/ui";

export function ModuleFrame({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const module = useMemo(() => moduleForPath(location), [location]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {module && <ModuleTabs module={module} location={location} />}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<ViewLoading />}>{children}</Suspense>
      </div>
    </div>
  );
}

function ModuleTabs({ module, location }: { module: ModuleManifest; location: string }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const active = viewForPath(module, location);
  const tabs = module.views.filter((v) => !v.hidden);

  // A detail view (a patient chart) belongs to no tab. Rather than leaving the
  // strip with nothing lit, the frame offers the way back to the list.
  const onDetail = active?.hidden === true;

  if (tabs.length <= 1 && !onDetail) return null;

  return (
    <div className="shrink-0 border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 flex items-center gap-1 overflow-x-auto">
        {onDetail && (
          <Link
            href={module.base}
            className="inline-flex items-center gap-1.5 px-2.5 h-10 text-caption text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={13} className="rtl:rotate-180" />
            {ar ? module.name.ar : module.name.en}
          </Link>
        )}
        {tabs.map((v) => {
          const path = viewPath(module, v);
          const isActive = active?.id === v.id;
          const Icon = v.icon;
          return (
            <Link
              key={v.id}
              href={path}
              className={`inline-flex items-center gap-2 px-3 h-10 text-body whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0
                ${isActive
                  ? "border-primary text-brand-ink font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {Icon && <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />}
              {ar ? v.name.ar : v.name.en}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ViewLoading() {
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
