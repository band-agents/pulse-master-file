/**
 * Dashboard storage.
 *
 * Saved tiles are a per-browser convenience, not hospital data: they live in
 * localStorage so a person's own layout survives a reload, and nothing here
 * is shared, audited or relied upon clinically. When dashboards need to be
 * shared between people they move to a table behind the repository, and this
 * module becomes the cache in front of it — which is why the read and write
 * paths are already narrow functions rather than direct storage access.
 */

import { storageKey } from "@/platform/lib/brand";
import type { Label } from "@/modules/types";
import type { QuerySpec } from "./query";
import type { VisualKind } from "./visuals";

export interface DashboardTile {
  id: string;
  title: Label;
  visual: VisualKind;
  spec: QuerySpec;
  /** Grid width in columns, 1–3. Defaults to 1. */
  span?: 1 | 2 | 3;
}

const KEY = storageKey("dashboard_tiles");

/** Read the pinned tiles. Never throws — a corrupt value yields an empty board. */
export function loadTiles(): DashboardTile[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DashboardTile[]) : [];
  } catch {
    return [];
  }
}

function persist(tiles: DashboardTile[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tiles));
  } catch {
    // Storage full or blocked. The tile is lost, but nothing else should break.
  }
}

export function saveTile(tile: DashboardTile): DashboardTile[] {
  const next = [...loadTiles(), tile];
  persist(next);
  return next;
}

export function removeTile(id: string): DashboardTile[] {
  const next = loadTiles().filter((t) => t.id !== id);
  persist(next);
  return next;
}

export function setTileSpan(id: string, span: 1 | 2 | 3): DashboardTile[] {
  const next = loadTiles().map((t) => (t.id === id ? { ...t, span } : t));
  persist(next);
  return next;
}

/** Move a tile one place earlier or later, for manual arrangement. */
export function moveTile(id: string, direction: -1 | 1): DashboardTile[] {
  const tiles = loadTiles();
  const i = tiles.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= tiles.length) return tiles;
  const next = [...tiles];
  [next[i], next[j]] = [next[j], next[i]];
  persist(next);
  return next;
}

export function clearTiles(): DashboardTile[] {
  persist([]);
  return [];
}
