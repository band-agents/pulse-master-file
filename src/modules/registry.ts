/**
 * Module registry.
 *
 * The one list of what this hospital runs. Routing, the Hub, the command
 * palette and the role filter all read from here, so a module that is not
 * registered simply does not exist — there is no second place to update and
 * therefore no way for navigation to drift from reality.
 */

import type { ModuleManifest, Role, ModuleGroup, ModuleView } from "./types";
import { viewPath } from "./types";

import { emergencyModule } from "./emergency/manifest";
import { wardsModule } from "./wards/manifest";
import { patientsModule } from "./patients/manifest";
import { ordersModule } from "./orders/manifest";
import { theatresModule } from "./theatres/manifest";
import { schedulingModule } from "./scheduling/manifest";
import { laboratoryModule } from "./laboratory/manifest";
import { imagingModule } from "./imaging/manifest";
import { pharmacyModule } from "./pharmacy/manifest";
import { revenueModule } from "./revenue/manifest";
import { supplyModule } from "./supply/manifest";
import { facilitiesModule } from "./facilities/manifest";
import { workforceModule } from "./workforce/manifest";
import { connectModule } from "./connect/manifest";
import { analyticsModule } from "./analytics/manifest";
import { adminModule } from "./admin/manifest";

/** Declaration order is the order the Hub shows them within a group. */
export const MODULES: ModuleManifest[] = [
  // Care
  emergencyModule,
  wardsModule,
  patientsModule,
  ordersModule,
  theatresModule,
  schedulingModule,
  // Diagnostics
  laboratoryModule,
  imagingModule,
  pharmacyModule,
  // Operations
  supplyModule,
  facilitiesModule,
  // Administration
  revenueModule,
  workforceModule,
  adminModule,
  // Intelligence
  analyticsModule,
  connectModule,
];

export function moduleById(id: string): ModuleManifest | undefined {
  return MODULES.find((m) => m.id === id);
}

/** The module owning a path, longest base first so /wards/nursing beats /wards. */
export function moduleForPath(path: string): ModuleManifest | undefined {
  return [...MODULES]
    .sort((a, b) => b.base.length - a.base.length)
    .find((m) => path === m.base || path.startsWith(`${m.base}/`));
}

/** The active view within a module, matching parameterised segments too. */
export function viewForPath(m: ModuleManifest, path: string): ModuleView | undefined {
  const rest = path.slice(m.base.length).replace(/^\//, "");
  if (rest === "") return m.views.find((v) => v.segment === "");

  const exact = m.views.find((v) => v.segment === rest);
  if (exact) return exact;

  // ":id" style segments: same number of parts, literals must match.
  const parts = rest.split("/");
  return m.views.find((v) => {
    if (!v.segment.includes(":")) return false;
    const seg = v.segment.split("/");
    if (seg.length !== parts.length) return false;
    return seg.every((piece, i) => piece.startsWith(":") || piece === parts[i]);
  });
}

export function modulesForRole(role: Role): ModuleManifest[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function modulesInGroup(group: ModuleGroup): ModuleManifest[] {
  return MODULES.filter((m) => m.group === group);
}

/** Every routable view, flattened — what the router and palette iterate. */
export interface RegisteredView {
  module: ModuleManifest;
  view: ModuleView;
  path: string;
}

export const ALL_VIEWS: RegisteredView[] = MODULES.flatMap((module) =>
  module.views.map((view) => ({ module, view, path: viewPath(module, view) })),
);

/**
 * Routes ordered for a first-match router: longest and most literal first,
 * so "/patients/registry" is never swallowed by "/patients/:id".
 */
export const ROUTED_VIEWS: RegisteredView[] = [...ALL_VIEWS].sort((a, b) => {
  const aParam = a.view.segment.includes(":") ? 1 : 0;
  const bParam = b.view.segment.includes(":") ? 1 : 0;
  if (aParam !== bParam) return aParam - bParam;
  return b.path.length - a.path.length;
});
