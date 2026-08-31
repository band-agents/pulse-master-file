/**
 * Paged data fetching (H2) — TanStack Query over the adapter's listPaged.
 *
 * Why Query and not useEffect+useState: cached pages survive navigation,
 * page flips keep the previous rows on screen (no spinner flash), and a
 * background refetch after mutations is one invalidateQueries call.
 *
 * Failures throw DataError (H1) — Query exposes it via `error`, and the
 * page can render an error state instead of a fake-empty list.
 */
import { useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/app/context/AuthContext";
import { getDataSource, type DataSource, type EntityAdapter, type PageOpts } from "@/platform/data/repository";
import { isDataError, toastDataError } from "@/platform/lib/errors";

type TableKey = Exclude<keyof DataSource, "mode">;

export function usePagedList<T>(table: TableKey, opts: PageOpts = {}) {
  const { workspace } = useAuth();
  const wid = workspace?.id || "demo";

  const q = useQuery({
    // opts participates in the key: page flips / filter changes = new entry.
    queryKey: ["paged", table, wid, opts],
    queryFn: () => (getDataSource()[table] as EntityAdapter<T>).listPaged(wid, opts),
    placeholderData: keepPreviousData,
  });

  // Query captures rejections into state, so the H1 global surface never
  // sees them — keep failures loud by toasting here.
  useEffect(() => {
    if (q.error && isDataError(q.error)) toastDataError(q.error);
  }, [q.error]);

  return {
    rows: q.data?.rows ?? [],
    total: q.data?.total ?? 0,
    /** True only on the very first load (no cached page yet). */
    loading: q.isPending,
    /** True during page flips / background refetches too. */
    fetching: q.isFetching,
    error: q.error,
    refetch: q.refetch,
  };
}

/** Query-key prefix for invalidating every cached page of a table. */
export function pagedKey(table: TableKey) {
  return ["paged", table] as const;
}
