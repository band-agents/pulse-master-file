/**
 * PagerBar (H2) — compact bilingual pagination footer for paged lists.
 * Renders nothing when everything fits on one page.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PagerBar({ page, pageSize, total, onPage, ar, fetching }: {
  page: number;        // 0-based
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  ar: boolean;
  fetching?: boolean;
}) {
  if (total <= pageSize) return null;

  const pages = Math.ceil(total / pageSize);
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const fmt = (n: number) => n.toLocaleString(ar ? "ar-EG" : "en");
  const Prev = ar ? ChevronRight : ChevronLeft;
  const Next = ar ? ChevronLeft : ChevronRight;

  const btn = "w-7 h-7 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className={`flex items-center justify-between gap-3 px-1 py-3 text-micro text-muted-foreground ${fetching ? "opacity-60" : ""}`}>
      <span className="tabular-nums">
        {ar ? `${fmt(from)}–${fmt(to)} من ${fmt(total)}` : `${fmt(from)}–${fmt(to)} of ${fmt(total)}`}
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={ar ? "السابق" : "Previous page"}>
          <Prev size={13} />
        </button>
        <span className="tabular-nums px-1">
          {ar ? `صفحة ${fmt(page + 1)} / ${fmt(pages)}` : `${fmt(page + 1)} / ${fmt(pages)}`}
        </span>
        <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={ar ? "التالي" : "Next page"}>
          <Next size={13} />
        </button>
      </div>
    </div>
  );
}
