/**
 * My Dashboards — لوحاتي
 *
 * Tiles pinned from the explorer, arranged by the person who pinned them.
 * Layouts are per-browser rather than shared — see `platform/analytics/
 * dashboards.ts` for why that is deliberate at this stage.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  LayoutGrid, Trash2, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  TrendingUp, RotateCcw,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, EmptyState, LoadingRow, btnGhost, btnPrimary,
} from "@/platform/ui";
import { useSnapshot } from "@/platform/data/snapshot";
import { getDataset } from "@/platform/analytics/datasets";
import { runQuery } from "@/platform/analytics/query";
import { Visual, VisualCard } from "@/platform/analytics/visuals";
import {
  loadTiles, removeTile, moveTile, setTileSpan, clearTiles, type DashboardTile,
} from "@/platform/analytics/dashboards";

const SPAN_CLASS: Record<number, string> = {
  1: "", 2: "lg:col-span-2", 3: "lg:col-span-3",
};

export default function Dashboards() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { snapshot, loading } = useSnapshot();
  const [tiles, setTiles] = useState<DashboardTile[]>(() => loadTiles());
  const [focus, setFocus] = useState<string | null>(null);

  const hasTiles = tiles.length > 0;

  if (loading) return <Page><PageHeader title="My Dashboards" titleAr="لوحاتي" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="My Dashboards"
        titleAr="لوحاتي"
        subtitle="Tiles you pinned from the explorer. Arrangement is saved in this browser only."
        subtitleAr="التجانب التي ثبّتها من المستكشف. الترتيب محفوظ في هذا المتصفح فقط."
        meta={[{ label: "Pinned tiles", labelAr: "تجانب مثبتة", value: String(tiles.length), tone: "data" }]}
        actions={
          <>
            {hasTiles && (
              <button
                type="button"
                onClick={() => setTiles(clearTiles())}
                className={btnGhost}
              >
                <RotateCcw size={14} /> {ar ? "إفراغ" : "Clear all"}
              </button>
            )}
            <Link href="/analytics/explorer" className={btnPrimary}>
              <TrendingUp size={14} /> {ar ? "المستكشف" : "Explorer"}
            </Link>
          </>
        }
      />

      {!hasTiles ? (
        <Section>
          <EmptyState
            icon={LayoutGrid}
            title="No tiles pinned yet"
            titleAr="لا توجد تجانب مثبتة بعد"
            hint="Build a question in the explorer, then use Pin to dashboard to keep it here."
            hintAr="ابنِ سؤالاً في المستكشف ثم استخدم «تثبيت في لوحة» للاحتفاظ به هنا."
            action={
              <Link href="/analytics/explorer" className={btnPrimary}>
                <TrendingUp size={14} /> {ar ? "افتح المستكشف" : "Open the explorer"}
              </Link>
            }
          />
        </Section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {tiles.map((tile, i) => {
            const dataset = getDataset(tile.spec.datasetId);
            if (!dataset) return null;
            const result = runQuery(dataset, dataset.rows(snapshot), tile.spec);
            const span = tile.span ?? 1;
            return (
              <VisualCard
                key={tile.id}
                className={SPAN_CLASS[span]}
                title={ar ? tile.title.ar : tile.title.en}
                subtitle={ar ? dataset.name.ar : dataset.name.en}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => setTiles(moveTile(tile.id, -1))}
                      disabled={i === 0}
                      aria-label={ar ? "تحريك لليسار" : "Move earlier"}
                      className="p-1 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft size={12} className="rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTiles(moveTile(tile.id, 1))}
                      disabled={i === tiles.length - 1}
                      aria-label={ar ? "تحريك لليمين" : "Move later"}
                      className="p-1 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight size={12} className="rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTiles(setTileSpan(tile.id, span === 1 ? 2 : span === 2 ? 3 : 1))}
                      aria-label={ar ? "تغيير العرض" : "Resize"}
                      className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                    >
                      {span === 3 ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTiles(removeTile(tile.id))}
                      aria-label={ar ? "حذف" : "Remove"}
                      className="p-1 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                }
              >
                <Visual
                  kind={tile.visual}
                  result={result}
                  agg={tile.spec.agg}
                  selected={focus}
                  onSelect={(c) => setFocus((cur) => (cur === c ? null : c))}
                  height={span > 1 ? 260 : 200}
                />
              </VisualCard>
            );
          })}
        </div>
      )}
    </Page>
  );
}
