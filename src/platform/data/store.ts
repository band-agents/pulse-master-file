/**
 * Local write store.
 *
 * The demo backing used to be read-only: `create` logged "ephemeral" and threw
 * the row away. That single fact made the whole system look like a picture of
 * a hospital rather than a hospital — you could open every screen and change
 * nothing, so there was no point putting a form on any of them.
 *
 * This is the overlay that fixes it. The seed arrays stay immutable and act as
 * the starting state of the hospital; everything anyone types lands here, in
 * localStorage, and is merged over the seed on every read. Three consequences
 * matter:
 *
 *   1. Writes survive a reload, so a booking made on Monday is still there.
 *   2. Writes are visible to EVERY surface at once. The patient portal, the
 *      clinician workspace and the hospital system are three front doors onto
 *      one store — a patient booking an appointment is the same row the doctor
 *      sees in their clinic list, because it is literally the same row.
 *   3. Writes cross browser tabs. The `storage` event means you can put the
 *      portal in one window and the ward board in another and watch a request
 *      arrive, which is the only honest way to demonstrate that the three
 *      applications are connected rather than merely similar.
 *
 * The overlay is a patch set, never a copy of the seed. Storing the whole
 * hospital would blow the ~5MB localStorage budget on the vitals table alone,
 * and would freeze the seed at whatever it looked like the day someone first
 * opened the app.
 */

import { storageKey } from "@/platform/lib/brand";

const KEY = storageKey("store");

/** Rows added, changed and removed for one table. */
interface TablePatch {
  /** Whole rows, newest first. */
  added: Record<string, unknown>[];
  /** Partial updates by row id, applied over the seed row or an added row. */
  changed: Record<string, Record<string, unknown>>;
  /** Ids removed. Tombstones, so a seed row can be deleted. */
  removed: string[];
}

type Patches = Record<string, TablePatch>;

function emptyPatch(): TablePatch {
  return { added: [], changed: {}, removed: [] };
}

// ─── Persistence ───────────────────────────────────────────

let cache: Patches | null = null;

function read(): Patches {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Patches) : {};
  } catch {
    // Corrupt JSON or storage blocked. An unreadable overlay must degrade to
    // "no local changes", never to a crash on boot.
    cache = {};
  }
  return cache;
}

function write(next: Patches): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Over quota or private mode. The in-memory cache still holds the write,
    // so the current session behaves correctly and only persistence is lost.
  }
  notify();
}

function patchFor(p: Patches, table: string): TablePatch {
  if (!p[table]) p[table] = emptyPatch();
  return p[table];
}

// ─── Change notification ───────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to any local write. Returns the unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // One bad listener must not stop the others from refreshing.
    }
  }
}

// Another tab wrote. Drop the cache so the next read picks up their change,
// then tell this tab's screens to reload. This is what makes a two-window
// demonstration — portal in one, ward board in the other — actually work.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cache = null;
    notify();
  });
}

// ─── Reads ─────────────────────────────────────────────────

/**
 * Merge one table's local writes over its seed rows.
 *
 * Added rows come first: someone who has just registered a patient expects to
 * find them at the top of the registry, not sorted into the middle of two
 * hundred existing records. Callers that need a different order sort anyway.
 */
export function applyPatch<T>(table: string, seed: readonly T[]): T[] {
  const patch = read()[table];
  if (!patch) return seed as T[];

  const removed = new Set(patch.removed);
  const { changed } = patch;

  const out: T[] = [];
  for (const row of patch.added) {
    const id = String((row as { id?: unknown }).id ?? "");
    if (removed.has(id)) continue;
    out.push((changed[id] ? { ...row, ...changed[id] } : row) as T);
  }
  for (const row of seed) {
    const id = String((row as { id?: unknown }).id ?? "");
    if (removed.has(id)) continue;
    out.push((changed[id] ? { ...row, ...changed[id] } : row) as T);
  }
  return out;
}

// ─── Writes ────────────────────────────────────────────────

let counter = 0;

/**
 * Id for a locally created row. Prefixed so anything written here is
 * identifiable at a glance in the console and in an export, and suffixed with
 * a counter because two rows created in the same millisecond — a triage
 * assessment and its first observation set — must not collide.
 */
export function localId(prefix = "loc"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Add a row. Returns it with `id` and `created_at` filled in if absent. */
export function insert<T extends Record<string, unknown>>(table: string, row: T): T {
  const now = new Date().toISOString();
  const full = {
    id: row.id ?? localId(table.slice(0, 4)),
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
    ...row,
  } as T;

  const next = { ...read() };
  const patch = { ...patchFor(next, table) };
  patch.added = [full as Record<string, unknown>, ...patch.added];
  next[table] = patch;
  write(next);
  return full;
}

/**
 * Change a row. Works on seed rows and added rows alike — the caller does not
 * need to know which kind it holds, which is the point of an overlay.
 */
export function patch(table: string, id: string, changes: Record<string, unknown>): void {
  const next = { ...read() };
  const p = { ...patchFor(next, table) };
  p.changed = {
    ...p.changed,
    [id]: { ...(p.changed[id] ?? {}), ...changes, updated_at: new Date().toISOString() },
  };
  next[table] = p;
  write(next);
}

/** Remove a row. A seed row leaves a tombstone; an added row is dropped. */
export function drop(table: string, id: string): void {
  const next = { ...read() };
  const p = { ...patchFor(next, table) };
  const wasAdded = p.added.some((r) => r.id === id);
  p.added = p.added.filter((r) => r.id !== id);
  if (!wasAdded) p.removed = [...p.removed, id];
  next[table] = p;
  write(next);
}

// ─── Housekeeping ──────────────────────────────────────────

/** Every local write, for the "reset demo" control and for diagnostics. */
export function summary(): { table: string; added: number; changed: number; removed: number }[] {
  return Object.entries(read())
    .map(([table, p]) => ({
      table,
      added: p.added.length,
      changed: Object.keys(p.changed).length,
      removed: p.removed.length,
    }))
    .filter((r) => r.added + r.changed + r.removed > 0)
    .sort((a, b) => b.added + b.changed + b.removed - (a.added + a.changed + a.removed));
}

/** Total local writes — what the "unsaved work" indicator counts. */
export function writeCount(): number {
  return summary().reduce((n, r) => n + r.added + r.changed + r.removed, 0);
}

/** Discard every local write and return the hospital to its seeded state. */
export function reset(): void {
  write({});
}
