/**
 * Top bar.
 *
 * The only permanent chrome in the application. It stays slim because in this
 * shell the module owns the viewport — every pixel of height here is taken
 * from a ward list or a theatre schedule that someone is reading all day.
 *
 * It carries four things and no more: where you are, how to get anywhere
 * (the palette), who you are working as, and what is on fire.
 */

import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, ChevronDown, Bell, Languages, Sun, Moon, LayoutGrid, Check, AlertTriangle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/app/context/LanguageContext";
import { Logo } from "@/app/components/Logo";
import { moduleForPath, viewForPath } from "@/modules/registry";
import { useRole } from "./RoleContext";
import { usePalette } from "./CommandPalette";
import { serif, TONE_PILL } from "@/platform/ui";
import { BRAND } from "@/platform/lib/brand";

export function TopBar({ alertCount = 0 }: { alertCount?: number }) {
  const { lang, setLang } = useLanguage();
  const ar = lang === "ar";
  const { theme, setTheme } = useTheme();
  const { role, setRole, roles } = useRole();
  const { open } = usePalette();
  const [location] = useLocation();
  const [roleOpen, setRoleOpen] = useState(false);

  const activeModule = useMemo(() => moduleForPath(location), [location]);
  const activeView = useMemo(
    () => (activeModule ? viewForPath(activeModule, location) : undefined),
    [activeModule, location],
  );

  const roleLabel = roles.find((r) => r.id === role);

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 md:px-4 bg-sidebar border-b border-sidebar-border">
      {/* Identity — always the way back to the Hub. */}
      <Link href="/" className="flex items-center gap-2 shrink-0 group" title={ar ? BRAND.nameAr : BRAND.name}>
        <Logo variant="mark" size={22} />
        <span
          className="hidden sm:block text-body-lg font-semibold text-sidebar-foreground group-hover:text-brand-ink transition-colors"
          style={serif}
        >
          {ar ? BRAND.shortNameAr : BRAND.shortName}
        </span>
      </Link>

      {/* Location. On the Hub there is nothing to say, so it says nothing. */}
      {activeModule && (
        <nav className="hidden md:flex items-center gap-1.5 min-w-0" aria-label={ar ? "المسار" : "Breadcrumb"}>
          <span className="text-muted-foreground/50" aria-hidden>/</span>
          <Link
            href={activeModule.base}
            className="text-body text-sidebar-foreground/80 hover:text-brand-ink transition-colors truncate"
          >
            {ar ? activeModule.name.ar : activeModule.name.en}
          </Link>
          {activeView && activeView.segment !== "" && (
            <>
              <span className="text-muted-foreground/50" aria-hidden>/</span>
              <span className="text-body text-sidebar-foreground font-medium truncate">
                {ar ? activeView.name.ar : activeView.name.en}
              </span>
            </>
          )}
        </nav>
      )}

      {/* Palette. The primary navigation in this shell, so it is a real
          control rather than an icon people have to discover. */}
      <button
        type="button"
        onClick={open}
        className="ms-auto flex items-center gap-2 h-8 px-2.5 rounded-lg border border-sidebar-border bg-background/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors min-w-0"
      >
        <Search size={13} className="shrink-0" />
        <span className="hidden sm:block text-caption truncate">
          {ar ? "بحث في النظام" : "Search the system"}
        </span>
        <kbd className="hidden md:block text-micro border border-border/60 rounded px-1 ms-1 shrink-0">⌘K</kbd>
      </button>

      {/* Role */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setRoleOpen((v) => !v)}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-caption font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-expanded={roleOpen}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${TONE_PILL.brand.includes("brand") ? "bg-primary" : "bg-primary"}`} aria-hidden />
          <span className="hidden sm:block max-w-[110px] truncate">
            {ar ? roleLabel?.ar : roleLabel?.en}
          </span>
          <ChevronDown size={12} className={roleOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>

        {roleOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRoleOpen(false)} />
            <div className="absolute end-0 top-full mt-1 z-50 w-56 rounded-xl border border-border/60 bg-popover shadow-xl py-1.5">
              <p className="px-3 py-1.5 text-micro text-muted-foreground">
                {ar
                  ? "يغيّر ما تعرضه الصفحة الرئيسية فقط — لا يمنح صلاحيات."
                  : "Changes what the Hub shows. It does not grant permissions."}
              </p>
              <div className="max-h-[300px] overflow-y-auto">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRole(r.id); setRoleOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-start text-body transition-colors
                      ${r.id === role ? "text-brand-ink font-medium bg-brand-wash" : "text-foreground hover:bg-muted/50"}`}
                  >
                    <span className="flex-1 truncate">{ar ? r.ar : r.en}</span>
                    {r.id === role && <Check size={13} className="shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Alerts */}
      <Link
        href="/orders/decision-support"
        className="relative shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        title={ar ? "التنبيهات النشطة" : "Active alerts"}
      >
        {alertCount > 0 ? <AlertTriangle size={15} /> : <Bell size={15} />}
        {alertCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold grid place-items-center tabular-nums">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </Link>

      {/* Hub */}
      <Link
        href="/"
        className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        title={ar ? "الصفحة الرئيسية" : "Hub"}
      >
        <LayoutGrid size={15} />
      </Link>

      {/* Language */}
      <button
        type="button"
        onClick={() => setLang(ar ? "en" : "ar")}
        className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        title={ar ? "English" : "العربية"}
      >
        <Languages size={15} />
      </button>

      {/* Theme */}
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        title={ar ? "تبديل المظهر" : "Toggle theme"}
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </header>
  );
}
