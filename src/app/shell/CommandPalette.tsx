/**
 * Command palette.
 *
 * With no persistent sidebar, this is the primary way a power user moves
 * around: ⌘K (or Ctrl+K) from anywhere, type two or three letters, Enter.
 *
 * It searches module names, view names and the Arabic labels together, so a
 * bilingual user gets one list rather than having to think about which
 * language the system is currently displaying.
 */

import { useEffect, useMemo, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { ALL_VIEWS } from "@/modules/registry";
import { MODULE_GROUPS } from "@/modules/types";
import { serif } from "@/platform/ui";

interface PaletteContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used inside CommandPaletteProvider");
  return ctx;
}

interface Entry {
  path: string;
  title: string;
  titleAr: string;
  context: string;
  contextAr: string;
  icon: React.ElementType;
  group: string;
  /** Concatenated haystack, both languages, matched case-insensitively. */
  haystack: string;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const value = useMemo(
    () => ({ open: () => setOpen(true), close: () => setOpen(false), isOpen }),
    [isOpen],
  );

  // ⌘K / Ctrl+K anywhere, and Escape to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteContext.Provider value={value}>
      {children}
      {isOpen && <Palette onClose={() => setOpen(false)} />}
    </PaletteContext.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries: Entry[] = useMemo(
    () => ALL_VIEWS
      // Detail routes need a record to open; they are not destinations.
      .filter(({ view }) => !view.hidden)
      .map(({ module, view, path }) => ({
        path,
        title: view.name.en,
        titleAr: view.name.ar,
        context: module.name.en,
        contextAr: module.name.ar,
        icon: view.icon ?? module.icon,
        group: module.group,
        haystack: [
          view.name.en, view.name.ar, module.name.en, module.name.ar, path,
        ].join(" ").toLowerCase(),
      })),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 40);
    const terms = q.split(/\s+/);
    return entries
      .filter((e) => terms.every((t) => e.haystack.includes(t)))
      // A match on the view's own name beats a match on its module.
      .sort((a, b) => {
        const aDirect = a.title.toLowerCase().startsWith(q) || a.titleAr.startsWith(q) ? 0 : 1;
        const bDirect = b.title.toLowerCase().startsWith(q) || b.titleAr.startsWith(q) ? 0 : 1;
        return aDirect - bDirect;
      })
      .slice(0, 40);
  }, [entries, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setCursor(0); }, [query]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    document.getElementById(`palette-row-${cursor}`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = results[cursor];
      if (target) { navigate(target.path); onClose(); }
    }
  }

  const groupLabel = (id: string) =>
    MODULE_GROUPS.find((g) => g.id === id)?.[ar ? "ar" : "en"] ?? id;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="relative w-full max-w-[560px] rounded-xl border border-border/60 bg-popover shadow-2xl overflow-hidden"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border/40">
          <Search size={15} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? "ابحث عن شاشة أو قسم…" : "Search screens and departments…"}
            className="flex-1 bg-transparent text-body-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="text-micro text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-body text-muted-foreground">
              {ar ? "لا توجد نتائج" : "Nothing matches that"}
            </p>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon;
              const active = i === cursor;
              return (
                <button
                  key={r.path}
                  id={`palette-row-${i}`}
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { navigate(r.path); onClose(); }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-start transition-colors
                    ${active ? "bg-brand-wash" : "hover:bg-muted/50"}`}
                >
                  <Icon size={15} className={active ? "text-brand-ink shrink-0" : "text-muted-foreground shrink-0"} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-body truncate ${active ? "text-brand-ink font-medium" : "text-foreground"}`}>
                      {ar ? r.titleAr : r.title}
                    </span>
                    <span className="block text-micro text-muted-foreground truncate">
                      {ar ? r.contextAr : r.context} · {groupLabel(r.group)}
                    </span>
                  </span>
                  {active && <CornerDownLeft size={12} className="text-brand-ink shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 px-4 h-9 border-t border-border/40 text-micro text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} />{ar ? "تنقل" : "navigate"}</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft size={10} />{ar ? "فتح" : "open"}</span>
          <span className="ms-auto tabular-nums" style={serif}>{results.length}</span>
        </div>
      </div>
    </div>
  );
}
