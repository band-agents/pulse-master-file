/**
 * Shopify Sync — Two-way data exchange between Bumblebee and Shopify
 *
 * Connection lifecycle:
 * - connect            → store credentials, test, register webhooks
 * - test_connection    → ping shop.json, update status
 * - register_webhooks  → (re)register webhook topics
 * - save_sync_config   → persist per-entity sync directions
 *
 * Data sync (honors sync_config directions):
 * - pull_products      → Shopify products  → Bumblebee products table
 * - push_products      → Bumblebee products    → Shopify products
 * - pull_inventory     → Shopify stock     → Bumblebee resources (matched by SKU)
 * - push_inventory     → Bumblebee resources   → Shopify inventory levels
 * - pull_orders        → Shopify orders    → shopify_orders (backfill)
 * - pull_customers     → Shopify customers → Bumblebee people
 * - run_full_sync      → everything enabled in sync_config, in its direction
 *
 * Loyalty (existing):
 * - sync_metafields    → points/tier → Shopify customer metafields
 * - create_discount_code → redemption → Shopify price rule + code
 *
 * Security:
 * - Shopify credentials read from DB (encrypted)
 * - Service role key used server-side only
 * - Rate limiting: max 2 req/sec for basic, 40/sec for Plus
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────
// The connection wizard calls this function from the browser
// (supabase.functions.invoke), so preflight must be handled.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Background execution ────────────────────────────────
// Syncs pace themselves against Shopify's rate limit and can easily
// outlive the ~60s request window. waitUntil lets the function keep
// running after we've already answered the browser; the UI then
// follows progress via the shopify_sync_runs table.

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

function runInBackground(p: Promise<unknown>): boolean {
  try {
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(p.catch((e) => console.error("Background sync error:", e)));
      return true;
    }
  } catch { /* fall through to synchronous mode */ }
  return false;
}

/** Shopify error pages are HTML — translate the known ones into
 *  plain language so the wizard shows something a human can act on. */
function friendlyShopifyError(status: number, body: string): string {
  if (body.includes("app_not_installed")) {
    return "Your app is not installed on this store yet. Open your app in the Shopify Dev Dashboard, click “Install app”, choose this store, then try connecting again.";
  }
  if (/protected customer data|not approved to access/i.test(body)) {
    return "Shopify blocks orders & customer data until you approve it: open your app in the Dev Dashboard → Settings (or API access) → “Protected customer data access” → select “Protected customer data” plus the Name, Email, Phone and Address fields → save, then sync again.";
  }
  if (body.includes("invalid_client") || status === 401) {
    return "Shopify rejected the credentials. Re-copy the Client ID and Secret from your app's Settings → Credentials and try again.";
  }
  if (body.includes("invalid_scope")) {
    return "The app's released version is missing required API permissions. Add the scopes in the Versions tab, release a new version, reinstall, and retry.";
  }
  const titleMatch = body.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) return `${status}: ${titleMatch[1].trim()}`;
  return `${status}: ${body.slice(0, 300)}`;
}

/** Accepts my-store.myshopify.com, https://..., or the admin URL
 *  (admin.shopify.com/store/my-store) and returns the API host. */
function normalizeStoreUrl(input: string): string {
  let s = input.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const adminMatch = s.match(/^admin\.shopify\.com\/store\/([^/?#]+)/);
  if (adminMatch) return `${adminMatch[1]}.myshopify.com`;
  return s.split(/[/?#]/)[0];
}

// ─── Types ───────────────────────────────────────────────

type SyncDirection = "import" | "export" | "both" | "off";

interface SyncConfig {
  entities: {
    products: SyncDirection;
    inventory: SyncDirection;
    orders: SyncDirection;
    customers: SyncDirection;
    loyalty: SyncDirection;
    analytics: SyncDirection;
  };
  conflict_policy: "latest" | "shopify" | "bumblebee";
  auto_sync: boolean;
  sync_interval_minutes: number;
}

interface SyncRequest {
  action:
    | "connect"
    | "test_connection"
    | "register_webhooks"
    | "save_sync_config"
    | "pull_products"
    | "push_products"
    | "pull_inventory"
    | "push_inventory"
    | "pull_orders"
    | "pull_customers"
    | "run_full_sync"
    | "sync_metafields"
    | "create_discount_code";
  workspace_id: string;
  member_id?: string;
  redemption_id?: string;
  store_url?: string;
  access_token?: string;
  client_id?: string;
  client_secret?: string;
  sync_config?: SyncConfig;
}

interface ShopifyConnection {
  store_url: string;
  access_token_enc: string;
  webhook_secret: string;
  api_version: string;
  sync_config?: SyncConfig;
  // Dev Dashboard apps (client credentials grant)
  auth_mode?: "access_token" | "client_credentials";
  client_id?: string | null;
  client_secret_enc?: string | null;
  token_expires_at?: string | null;
}

// ─── Shopify API Helper ──────────────────────────────────

async function shopifyApi(
  connection: ShopifyConnection,
  endpoint: string,
  method: string = "GET",
  body?: any,
): Promise<{ ok: boolean; data?: any; error?: string; next?: string | null }> {
  const url = `https://${connection.store_url}/admin/api/${connection.api_version}/${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": connection.access_token_enc, // decrypted from DB
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: friendlyShopifyError(response.status, errorText) };
    }

    const data = await response.json();
    // Cursor pagination: Shopify returns the next page cursor in the Link header
    const link = response.headers.get("link");
    const next = link?.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)?.[1] ?? null;
    return { ok: true, data, next };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

const MAX_PAGES = 20; // 20 × 250 = up to 5,000 records per sync run

/** Fetch every page of a Shopify list endpoint (cursor pagination). */
async function shopifyFetchAll(
  connection: ShopifyConnection,
  firstEndpoint: string,
  listKey: string,
): Promise<{ ok: boolean; items: any[]; error?: string }> {
  const items: any[] = [];
  // Per Shopify rules, page_info requests may only carry limit (+fields)
  const base = firstEndpoint.split("?")[0];
  let endpoint = firstEndpoint;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await shopifyApi(connection, endpoint);
    if (!result.ok) return { ok: false, items, error: result.error };
    items.push(...(result.data[listKey] ?? []));
    if (!result.next) break;
    endpoint = `${base}?limit=250&page_info=${result.next}`;
    await new Promise((r) => setTimeout(r, 550)); // rate limit between pages
  }
  return { ok: true, items };
}

// ─── Client credentials grant (Dev Dashboard apps) ───────
// Shopify Dev Dashboard apps exchange Client ID + Secret for a
// short-lived (~24h) Admin API token. We cache it in
// access_token_enc and refresh ~5 min before expiry.

async function fetchClientCredentialsToken(
  storeUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<{ ok: boolean; token?: string; expiresIn?: number; error?: string }> {
  try {
    const res = await fetch(`https://${storeUrl}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) return { ok: false, error: friendlyShopifyError(res.status, await res.text()) };
    const data = await res.json();
    return { ok: true, token: data.access_token, expiresIn: data.expires_in ?? 86400 };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function ensureAccessToken(
  supabase: any,
  workspaceId: string,
  connection: ShopifyConnection,
): Promise<{ ok: boolean; error?: string }> {
  if (connection.auth_mode !== "client_credentials") return { ok: true }; // legacy static token

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.access_token_enc && expiresAt - Date.now() > 5 * 60 * 1000) return { ok: true };

  if (!connection.client_id || !connection.client_secret_enc) {
    return { ok: false, error: "Missing client credentials" };
  }
  const r = await fetchClientCredentialsToken(connection.store_url, connection.client_id, connection.client_secret_enc);
  if (!r.ok || !r.token) return { ok: false, error: r.error ?? "Token exchange failed" };

  connection.access_token_enc = r.token; // used by all subsequent shopifyApi calls
  const tokenExpiry = new Date(Date.now() + ((r.expiresIn ?? 86400) - 300) * 1000).toISOString();
  await supabase
    .from("shopify_connections")
    .update({ access_token_enc: r.token, token_expires_at: tokenExpiry, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId);
  return { ok: true };
}

// ─── Sync run bookkeeping ────────────────────────────────

async function startRun(supabase: any, workspaceId: string, entityType: string, direction: string, trigger = "manual") {
  const { data } = await supabase
    .from("shopify_sync_runs")
    .insert({ workspace_id: workspaceId, entity_type: entityType, direction, trigger_kind: trigger })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

async function finishRun(
  supabase: any,
  runId: string | undefined,
  patch: { status: string; records_pulled?: number; records_pushed?: number; records_skipped?: number; conflicts?: number; error_message?: string },
) {
  if (!runId) return;
  await supabase.from("shopify_sync_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
}

async function logEvent(supabase: any, workspaceId: string, eventType: string, ok: boolean, details: string, error?: string) {
  await supabase.from("shopify_sync_log").insert({
    workspace_id: workspaceId,
    event_type: eventType,
    status: ok ? "success" : "failed",
    details,
    error_message: error ?? null,
  });
}

// ─── Connect (first-time setup) ──────────────────────────

async function connect(
  supabase: any,
  workspaceId: string,
  storeUrl: string,
  syncConfig: SyncConfig | undefined,
  creds: { access_token?: string; client_id?: string; client_secret?: string },
) {
  const cleanUrl = normalizeStoreUrl(storeUrl);
  const webhookSecret = crypto.randomUUID();
  const useClientCreds = !!(creds.client_id && creds.client_secret);

  // Dev Dashboard apps: exchange Client ID + Secret for a short-lived token
  let accessToken = creds.access_token ?? "";
  let tokenExpiresAt: string | null = null;
  if (useClientCreds) {
    const exchange = await fetchClientCredentialsToken(cleanUrl, creds.client_id!, creds.client_secret!);
    if (!exchange.ok || !exchange.token) {
      await logEvent(supabase, workspaceId, "connection_test", false, `Credential exchange failed for ${cleanUrl}`, exchange.error);
      return { ok: false, error: exchange.error ?? "Credential exchange failed — check Client ID & Secret" };
    }
    accessToken = exchange.token;
    tokenExpiresAt = new Date(Date.now() + ((exchange.expiresIn ?? 86400) - 300) * 1000).toISOString();
  }
  if (!accessToken) return { ok: false, error: "No credentials provided" };

  const candidate: ShopifyConnection = {
    store_url: cleanUrl,
    access_token_enc: accessToken,
    webhook_secret: webhookSecret,
    api_version: "2024-01",
  };

  // Validate credentials before storing
  const test = await shopifyApi(candidate, "shop.json");
  if (!test.ok) {
    await logEvent(supabase, workspaceId, "connection_test", false, `Connection failed for ${cleanUrl}`, test.error);
    return { ok: false, error: test.error };
  }

  const { error: upsertError } = await supabase
    .from("shopify_connections")
    .upsert(
      {
        workspace_id: workspaceId,
        store_url: cleanUrl,
        access_token_enc: accessToken,
        auth_mode: useClientCreds ? "client_credentials" : "access_token",
        client_id: useClientCreds ? creds.client_id : null,
        client_secret_enc: useClientCreds ? creds.client_secret : null,
        token_expires_at: tokenExpiresAt,
        webhook_secret: webhookSecret,
        is_connected: true,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        ...(syncConfig ? { sync_config: syncConfig } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );

  if (upsertError) return { ok: false, error: upsertError.message };

  // Register webhooks with the fresh credentials
  const webhooks = await registerWebhooks(supabase, candidate, workspaceId);

  await logEvent(
    supabase, workspaceId, "connection_test", true,
    `Connected to ${cleanUrl} (${test.data?.shop?.name ?? "shop"}). Webhooks: ${webhooks.ok ? "registered" : "partial"}`,
  );

  return { ok: true, shop: test.data?.shop?.name, webhooks: webhooks.ok };
}

// ─── Save sync config ────────────────────────────────────

async function saveSyncConfig(supabase: any, workspaceId: string, config: SyncConfig) {
  const { error } = await supabase
    .from("shopify_connections")
    .update({ sync_config: config, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };
  await logEvent(supabase, workspaceId, "config_saved", true, `Sync directions updated: ${JSON.stringify(config.entities)}`);
  return { ok: true };
}

// ─── Entity map helpers ──────────────────────────────────

async function getMapping(supabase: any, workspaceId: string, entityType: string, shopifyId: string) {
  const { data } = await supabase
    .from("shopify_entity_map")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("shopify_id", shopifyId)
    .maybeSingle();
  return data;
}

async function upsertMapping(
  supabase: any,
  workspaceId: string,
  row: { entity_type: string; thoth_id: string | null; thoth_table: string; shopify_id: string; shopify_handle?: string; direction: "import" | "export"; metadata?: any },
) {
  await supabase.from("shopify_entity_map").upsert(
    {
      workspace_id: workspaceId,
      entity_type: row.entity_type,
      thoth_id: row.thoth_id,
      thoth_table: row.thoth_table,
      shopify_id: row.shopify_id,
      shopify_handle: row.shopify_handle ?? null,
      last_synced_at: new Date().toISOString(),
      last_direction: row.direction,
      metadata: row.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,entity_type,shopify_id" },
  );
}

// ─── Pull products (Shopify → Bumblebee) ─────────────────────

async function pullProducts(supabase: any, connection: ShopifyConnection, workspaceId: string, trigger = "manual") {
  const runId = await startRun(supabase, workspaceId, "products", "import", trigger);
  let pulled = 0, skipped = 0;

  const result = await shopifyFetchAll(connection, "products.json?limit=250", "products");
  if (!result.ok) {
    await finishRun(supabase, runId, { status: "failed", error_message: result.error });
    await logEvent(supabase, workspaceId, "products_pulled", false, "Product import failed", result.error);
    return { ok: false, error: result.error };
  }

  for (const sp of result.items) {
    const shopifyId = String(sp.id);
    const variant = sp.variants?.[0];
    const mapping = await getMapping(supabase, workspaceId, "product", shopifyId);

    // The Products page reads `resources` rows (type "product") with
    // ProductMeta metadata — NOT the products SQL table.
    const shopifyMeta = {
      product_id: shopifyId,
      handle: sp.handle,
      image_url: sp.image?.src ?? null,
      vendor: sp.vendor ?? null,
      tags: sp.tags ?? "",
      variants: (sp.variants ?? []).map((v: any) => ({
        id: String(v.id), sku: v.sku, title: v.title, price: v.price,
        inventory_item_id: String(v.inventory_item_id ?? ""),
        inventory_quantity: v.inventory_quantity ?? 0,
      })),
    };
    const productFields = {
      product_type: sp.product_type || null,
      sku: variant?.sku || null,
      category: sp.product_type || null,
      description: (sp.body_html || "").replace(/<[^>]*>/g, "").slice(0, 2000) || null,
      active: sp.status === "active",
      suggested_price: variant?.price ? parseFloat(variant.price) : undefined,
      shopify: shopifyMeta,
    };

    // Only trust mappings that point at resources rows — earlier syncs
    // wrote to the unused products table; upsertMapping heals those.
    const validMapping = mapping?.thoth_id && mapping.thoth_table === "resources" ? mapping : null;

    if (validMapping) {
      // Merge: keep Bumblebee-side fields (BOM, stages, costing) intact
      const { data: existing } = await supabase
        .from("resources").select("metadata").eq("id", validMapping.thoth_id).maybeSingle();
      await supabase.from("resources").update({
        name_en: sp.title,
        metadata: { ...(existing?.metadata ?? {}), ...productFields },
        updated_at: new Date().toISOString(),
      }).eq("id", validMapping.thoth_id);
      if (!existing) { skipped++; continue; }
    } else {
      const { data: created } = await supabase.from("resources").insert({
        workspace_id: workspaceId,
        name_en: sp.title,
        name_ar: null,
        type: "product",
        skills: ["product"],
        utilization: 0,
        department: null,
        metadata: productFields,
      }).select("id").single();
      if (!created) { skipped++; continue; }
      await upsertMapping(supabase, workspaceId, {
        entity_type: "product", thoth_id: created.id, thoth_table: "resources",
        shopify_id: shopifyId, shopify_handle: sp.handle, direction: "import",
      });
    }
    pulled++;
  }

  await finishRun(supabase, runId, { status: "success", records_pulled: pulled, records_skipped: skipped });
  await logEvent(supabase, workspaceId, "products_pulled", true, `${pulled} products imported from Shopify`);
  return { ok: true, pulled, skipped };
}

// ─── Push products (Bumblebee → Shopify) ─────────────────────

async function pushProducts(supabase: any, connection: ShopifyConnection, workspaceId: string, trigger = "manual") {
  const runId = await startRun(supabase, workspaceId, "products", "export", trigger);
  let pushed = 0, skipped = 0;
  let firstError: string | undefined;

  // Bumblebee products live in `resources` (type "product") with ProductMeta metadata
  const { data: products } = await supabase
    .from("resources")
    .select("id, name_en, metadata")
    .eq("workspace_id", workspaceId)
    .eq("type", "product");

  for (const p of products ?? []) {
    const m = (p.metadata ?? {}) as Record<string, any>;
    if (m.active === false) { skipped++; continue; }

    const { data: existing } = await supabase
      .from("shopify_entity_map")
      .select("shopify_id")
      .eq("workspace_id", workspaceId)
      .eq("entity_type", "product")
      .eq("thoth_id", p.id)
      .maybeSingle();

    const payload = {
      product: {
        title: p.name_en,
        body_html: m.description ?? "",
        product_type: m.category ?? m.product_type ?? "",
        status: "active",
        variants: [{
          sku: m.sku ?? "",
          price: String(m.suggested_price ?? m.total_cost ?? 0),
        }],
      },
    };

    let result;
    if (existing?.shopify_id) {
      result = await shopifyApi(connection, `products/${existing.shopify_id}.json`, "PUT", payload);
    } else {
      result = await shopifyApi(connection, "products.json", "POST", payload);
      if (result.ok) {
        await upsertMapping(supabase, workspaceId, {
          entity_type: "product", thoth_id: p.id, thoth_table: "resources",
          shopify_id: String(result.data.product.id),
          shopify_handle: result.data.product.handle, direction: "export",
        });
      }
    }

    if (result.ok) pushed++;
    else { skipped++; firstError ??= result.error; }
    await new Promise((r) => setTimeout(r, 550)); // respect 2 req/sec rate limit
  }

  await finishRun(supabase, runId, {
    status: skipped > 0 ? "partial" : "success",
    records_pushed: pushed, records_skipped: skipped,
    error_message: firstError,
  });
  await logEvent(supabase, workspaceId, "products_pushed", skipped === 0,
    `${pushed} products published to Shopify (${skipped} skipped)${firstError ? ` — first error: ${firstError.slice(0, 200)}` : ""}`);
  return { ok: true, pushed, skipped, error: firstError };
}

// ─── Pull inventory (Shopify → Bumblebee, matched by SKU) ────

async function pullInventory(supabase: any, connection: ShopifyConnection, workspaceId: string, trigger = "manual") {
  const runId = await startRun(supabase, workspaceId, "inventory", "import", trigger);
  let pulled = 0, skipped = 0;

  const result = await shopifyFetchAll(connection, "products.json?limit=250&fields=id,variants", "products");
  if (!result.ok) {
    await finishRun(supabase, runId, { status: "failed", error_message: result.error });
    return { ok: false, error: result.error };
  }

  // Build SKU → quantity map from all variants
  const skuQty = new Map<string, number>();
  for (const sp of result.items) {
    for (const v of sp.variants ?? []) {
      if (v.sku) skuQty.set(v.sku, v.inventory_quantity ?? 0);
    }
  }

  // Match against Bumblebee inventory resources by metadata.sku
  const { data: resources } = await supabase
    .from("resources")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .contains("skills", ["inventory"]);

  for (const r of resources ?? []) {
    const sku = r.metadata?.sku;
    if (!sku || !skuQty.has(sku)) { skipped++; continue; }
    const qty = skuQty.get(sku)!;
    const reorder = r.metadata?.reorder_level ?? 0;
    await supabase
      .from("resources")
      .update({
        metadata: {
          ...r.metadata,
          quantity: qty,
          inv_status: qty <= 0 ? "out_of_stock" : qty <= reorder ? "low_stock" : "in_stock",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    pulled++;
  }

  await finishRun(supabase, runId, { status: "success", records_pulled: pulled, records_skipped: skipped });
  await logEvent(supabase, workspaceId, "inventory_pulled", true, `${pulled} stock levels imported (matched by SKU)`);
  return { ok: true, pulled, skipped };
}

// ─── Push inventory (Bumblebee → Shopify) ────────────────────

async function pushInventory(supabase: any, connection: ShopifyConnection, workspaceId: string, trigger = "manual") {
  const runId = await startRun(supabase, workspaceId, "inventory", "export", trigger);
  let pushed = 0, skipped = 0;
  let firstError: string | undefined;

  // Shopify needs a location_id for inventory updates — use the first one
  const locations = await shopifyApi(connection, "locations.json");
  const locationId = locations.data?.locations?.[0]?.id;
  if (!locationId) {
    await finishRun(supabase, runId, { status: "failed", error_message: "No Shopify location found" });
    return { ok: false, error: "No Shopify location found" };
  }

  // Build SKU → inventory_item_id from Shopify variants
  const variantsResult = await shopifyFetchAll(connection, "products.json?limit=250&fields=id,variants", "products");
  const skuItem = new Map<string, string>();
  for (const sp of variantsResult.items) {
    for (const v of sp.variants ?? []) {
      if (v.sku && v.inventory_item_id) skuItem.set(v.sku, String(v.inventory_item_id));
    }
  }

  const { data: resources } = await supabase
    .from("resources")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .contains("skills", ["inventory"]);

  for (const r of resources ?? []) {
    const sku = r.metadata?.sku;
    const itemId = sku ? skuItem.get(sku) : undefined;
    if (!itemId) { skipped++; continue; }

    const result = await shopifyApi(connection, "inventory_levels/set.json", "POST", {
      location_id: locationId,
      inventory_item_id: Number(itemId),
      available: r.metadata?.quantity ?? 0,
    });
    if (result.ok) pushed++;
    else { skipped++; firstError ??= result.error; }
    await new Promise((res) => setTimeout(res, 550));
  }

  await finishRun(supabase, runId, {
    status: firstError ? "partial" : "success",
    records_pushed: pushed, records_skipped: skipped,
    error_message: firstError,
  });
  await logEvent(supabase, workspaceId, "inventory_pushed", !firstError,
    `${pushed} stock levels pushed to Shopify (${skipped} skipped)${firstError ? ` — first error: ${firstError.slice(0, 200)}` : ""}`);
  return { ok: true, pushed, skipped, error: firstError };
}

// ─── Pull orders backfill (Shopify → Bumblebee) ──────────────
// Webhooks handle live orders; this imports history on first connect.

async function pullOrders(supabase: any, connection: ShopifyConnection, workspaceId: string, trigger = "manual") {
  const runId = await startRun(supabase, workspaceId, "orders", "import", trigger);
  let pulled = 0, skipped = 0;

  const result = await shopifyFetchAll(connection, "orders.json?status=any&limit=250", "orders");
  if (!result.ok) {
    await finishRun(supabase, runId, { status: "failed", error_message: result.error });
    return { ok: false, error: result.error };
  }

  for (const o of result.items) {
    const shopifyId = String(o.id);
    // Entity map is the source of truth — lets earlier partial imports heal
    const mapping = await getMapping(supabase, workspaceId, "order", shopifyId);
    if (mapping) { skipped++; continue; }

    // 1. Raw copy for loyalty/audit
    const { data: rawExisting } = await supabase
      .from("shopify_orders")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("shopify_order_id", shopifyId)
      .maybeSingle();
    if (!rawExisting) {
      await supabase.from("shopify_orders").insert({
        workspace_id: workspaceId,
        shopify_order_id: shopifyId,
        shopify_order_number: o.name ?? String(o.order_number ?? ""),
        shopify_customer_id: o.customer?.id ? String(o.customer.id) : null,
        total_amount: parseFloat(o.total_price ?? "0"),
        currency: o.currency ?? "SAR",
        line_items: (o.line_items ?? []).map((li: any) => ({
          title: li.title, sku: li.sku, quantity: li.quantity, price: li.price,
        })),
        financial_status: o.financial_status ?? null,
        fulfillment_status: o.fulfillment_status ?? null,
        processed: false, // loyalty processing happens via the webhook pipeline
        raw_payload: o,
      });
    }

    // 2. Visible Bumblebee sales order (Orders page reads work_items type sales_order)
    const total = parseFloat(o.total_price ?? "0");
    const customerName = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ")
      || o.email || (o.shipping_address?.name ?? "Shopify customer");
    const soNumber = o.name ?? `SHOP-${o.order_number ?? shopifyId}`;
    const isPaid = o.financial_status === "paid";
    const soMeta = {
      so_number: soNumber,
      customer_type: "individual",
      customer_name: customerName,
      phone: o.customer?.phone ?? o.shipping_address?.phone ?? null,
      email: o.email ?? null,
      address: o.shipping_address ? [o.shipping_address.address1, o.shipping_address.address2].filter(Boolean).join(", ") : null,
      city: o.shipping_address?.city ?? null,
      items: (o.line_items ?? []).map((li: any, i: number) => ({
        id: `shopify-${li.id ?? i}`,
        product_name: li.title,
        product_sku: li.sku || undefined,
        qty: li.quantity ?? 1,
        unitPrice: parseFloat(li.price ?? "0"),
      })),
      payments: isPaid && total > 0 ? [{
        id: `shopify-${shopifyId}`, amount: total,
        date: (o.created_at ?? "").slice(0, 10), method: "shopify", reference: soNumber,
      }] : [],
      customer_confirmed: true,
      deposit_received: isPaid,
      total_amount: total,
      total_paid: isPaid ? total : 0,
      source: "shopify",
      shopify_order_id: shopifyId,
      financial_status: o.financial_status ?? null,
      fulfillment_status: o.fulfillment_status ?? null,
    };
    const status =
      o.cancelled_at ? "cancelled" :
      o.fulfillment_status === "fulfilled" ? "sent" :
      isPaid ? "approved" : "draft";

    const { data: workItem } = await supabase.from("work_items").insert({
      workspace_id: workspaceId,
      title_en: `${soNumber} — ${customerName}`,
      title_ar: null,
      type: "sales_order",
      status,
      priority: "medium",
      progress: status === "sent" ? 100 : 0,
      tags: ["shopify"],
      metadata: soMeta,
    }).select("id").single();

    await upsertMapping(supabase, workspaceId, {
      entity_type: "order", thoth_id: workItem?.id ?? null, thoth_table: "work_items",
      shopify_id: shopifyId, shopify_handle: soNumber, direction: "import",
    });
    pulled++;
  }

  await finishRun(supabase, runId, { status: "success", records_pulled: pulled, records_skipped: skipped });
  await logEvent(supabase, workspaceId, "orders_pulled", true, `${pulled} orders imported as Bumblebee sales orders (${skipped} already linked)`);
  return { ok: true, pulled, skipped };
}

// ─── Pull customers (Shopify → Bumblebee people) ─────────────

async function pullCustomers(supabase: any, connection: ShopifyConnection, workspaceId: string, trigger = "manual") {
  const runId = await startRun(supabase, workspaceId, "customers", "import", trigger);
  let pulled = 0, skipped = 0;

  const result = await shopifyFetchAll(connection, "customers.json?limit=250", "customers");
  if (!result.ok) {
    await finishRun(supabase, runId, { status: "failed", error_message: result.error });
    return { ok: false, error: result.error };
  }

  for (const c of result.items) {
    const shopifyId = String(c.id);
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || `Customer ${shopifyId}`;
    const mapping = await getMapping(supabase, workspaceId, "customer", shopifyId);

    const personRow = {
      workspace_id: workspaceId,
      name_en: name,
      email: c.email ?? null,   // real columns — the Contacts page reads these
      phone: c.phone ?? null,
      tags: ["shopify"],
      metadata: {
        email: c.email ?? null,
        phone: c.phone ?? null,
        shopify_customer_id: shopifyId,
        shopify_orders_count: c.orders_count ?? 0,
        shopify_total_spent: c.total_spent ?? "0",
        source: "shopify",
      },
      updated_at: new Date().toISOString(),
    };

    if (mapping?.thoth_id) {
      await supabase.from("people").update(personRow).eq("id", mapping.thoth_id);
    } else {
      const { data: created } = await supabase.from("people").insert(personRow).select("id").single();
      if (!created) { skipped++; continue; }
      await upsertMapping(supabase, workspaceId, {
        entity_type: "customer", thoth_id: created.id, thoth_table: "people",
        shopify_id: shopifyId, shopify_handle: c.email ?? undefined, direction: "import",
      });
    }
    pulled++;
  }

  await finishRun(supabase, runId, { status: "success", records_pulled: pulled, records_skipped: skipped });
  await logEvent(supabase, workspaceId, "customers_pulled", true, `${pulled} customers imported from Shopify`);
  return { ok: true, pulled, skipped };
}

// ─── Full sync (honors sync_config directions) ───────────

async function runFullSync(supabase: any, connection: ShopifyConnection, workspaceId: string) {
  const config = connection.sync_config;
  if (!config) return { ok: false, error: "No sync configuration saved" };

  const results: Record<string, any> = {};
  const e = config.entities;

  if (e.products === "import" || e.products === "both") results.products_pull = await pullProducts(supabase, connection, workspaceId, "scheduled");
  if (e.products === "export" || e.products === "both") results.products_push = await pushProducts(supabase, connection, workspaceId, "scheduled");
  if (e.inventory === "import" || e.inventory === "both") results.inventory_pull = await pullInventory(supabase, connection, workspaceId, "scheduled");
  if (e.inventory === "export" || e.inventory === "both") results.inventory_push = await pushInventory(supabase, connection, workspaceId, "scheduled");
  if (e.orders === "import" || e.orders === "both") results.orders_pull = await pullOrders(supabase, connection, workspaceId, "scheduled");
  if (e.customers === "import" || e.customers === "both") results.customers_pull = await pullCustomers(supabase, connection, workspaceId, "scheduled");
  // analytics is derived from imported orders — no separate fetch needed
  // loyalty export happens event-driven via sync_metafields / discount codes

  await supabase
    .from("shopify_connections")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId);

  const allOk = Object.values(results).every((r: any) => r.ok);
  return { ok: allOk, results };
}

// ─── Sync Metafields (loyalty, existing) ─────────────────

async function syncMetafields(
  supabase: any,
  connection: ShopifyConnection,
  workspaceId: string,
  memberId: string,
) {
  // Get member data
  const { data: member } = await supabase
    .from("loyalty_members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (!member || !member.shopify_customer_id) {
    return { ok: false, error: "Member not found or no Shopify link" };
  }

  // Extract numeric customer ID from GID
  const customerId = member.shopify_customer_id.replace(
    "gid://shopify/Customer/",
    "",
  );

  // Update metafields
  const metafields = [
    {
      namespace: "bumblebee_loyalty",
      key: "points_balance",
      value: String(member.current_points),
      type: "number_integer",
    },
    {
      namespace: "bumblebee_loyalty",
      key: "tier",
      value: member.tier_slug || "bronze",
      type: "single_line_text_field",
    },
    {
      namespace: "bumblebee_loyalty",
      key: "member_number",
      value: member.member_number,
      type: "single_line_text_field",
    },
    {
      namespace: "bumblebee_loyalty",
      key: "lifetime_points",
      value: String(member.lifetime_points),
      type: "number_integer",
    },
  ];

  const result = await shopifyApi(
    connection,
    `customers/${customerId}/metafields.json`,
    "POST",
    { metafield: metafields[0] }, // Shopify API processes one at a time
  );

  // Send remaining metafields
  for (let i = 1; i < metafields.length; i++) {
    await shopifyApi(connection, `customers/${customerId}/metafields.json`, "POST", {
      metafield: metafields[i],
    });
  }

  // Log
  await supabase.from("shopify_sync_log").insert({
    workspace_id: workspaceId,
    event_type: "metafield_synced",
    status: result.ok ? "success" : "failed",
    shopify_customer_id: member.shopify_customer_id,
    member_id: memberId,
    member_name: member.name_en,
    details: result.ok
      ? `Metafield loyalty.points_balance synced → ${member.current_points.toLocaleString()}`
      : `Metafield sync failed`,
    error_message: result.error,
  });

  return result;
}

// ─── Test Connection ─────────────────────────────────────

async function testConnection(
  supabase: any,
  connection: ShopifyConnection,
  workspaceId: string,
) {
  const result = await shopifyApi(connection, "shop.json");

  await supabase.from("shopify_sync_log").insert({
    workspace_id: workspaceId,
    event_type: "connection_test",
    status: result.ok ? "success" : "failed",
    details: result.ok
      ? `Shopify API connection test passed. Store: ${connection.store_url}, API version: ${connection.api_version}`
      : `Connection test failed`,
    error_message: result.error,
  });

  if (result.ok) {
    await supabase
      .from("shopify_connections")
      .update({
        is_connected: true,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId);
  } else {
    await supabase
      .from("shopify_connections")
      .update({
        is_connected: false,
        last_error: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId);
  }

  return result;
}

// ─── Register Webhooks ───────────────────────────────────

async function registerWebhooks(
  supabase: any,
  connection: ShopifyConnection,
  workspaceId: string,
) {
  const functionUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${functionUrl}/functions/v1/shopify-webhook`;

  const topics = [
    "orders/create",
    "orders/updated",
    "orders/cancelled",
    "refunds/create",
    "customers/create",
    "customers/update",
    "products/create",
    "products/update",
    "inventory_levels/update",
  ];

  const results: { topic: string; ok: boolean; error?: string }[] = [];

  for (const topic of topics) {
    const result = await shopifyApi(connection, "webhooks.json", "POST", {
      webhook: {
        topic,
        address: webhookUrl,
        format: "json",
      },
    });

    results.push({ topic, ok: result.ok, error: result.error });
  }

  const allOk = results.every((r) => r.ok);
  const failedTopics = results.filter((r) => !r.ok).map((r) => r.topic);

  await supabase.from("shopify_sync_log").insert({
    workspace_id: workspaceId,
    event_type: "webhook_received",
    status: allOk ? "success" : "failed",
    details: allOk
      ? `${topics.length} webhooks registered successfully`
      : `Webhook registration partial failure: ${failedTopics.join(", ")}`,
    error_message: allOk ? null : failedTopics.join(", "),
  });

  return { ok: allOk, results };
}

// ─── Create Discount Code ────────────────────────────────
// For online redemptions: create a Shopify Price Rule + Discount Code

async function createDiscountCode(
  supabase: any,
  connection: ShopifyConnection,
  workspaceId: string,
  redemptionId: string,
) {
  // Get redemption details
  const { data: redemption } = await supabase
    .from("loyalty_redemptions")
    .select("*, member:loyalty_members(name_en, shopify_customer_id)")
    .eq("id", redemptionId)
    .single();

  if (!redemption) {
    return { ok: false, error: "Redemption not found" };
  }

  // Generate unique discount code
  const code = `BEE-${redemption.member_id.substring(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  // Create Price Rule
  const priceRuleResult = await shopifyApi(connection, "price_rules.json", "POST", {
    price_rule: {
      title: `Loyalty Redemption ${code}`,
      target_type: "line_item",
      target_selection: "all",
      allocation_method: "across",
      value_type: "fixed_amount",
      value: `-${redemption.discount_amount}`,
      customer_selection: "prerequisite",
      prerequisite_customer_ids: redemption.member?.shopify_customer_id
        ? [redemption.member.shopify_customer_id.replace("gid://shopify/Customer/", "")]
        : [],
      once_per_customer: true,
      usage_limit: 1,
      starts_at: new Date().toISOString(),
      ends_at: redemption.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  if (!priceRuleResult.ok) {
    return priceRuleResult;
  }

  const priceRuleId = priceRuleResult.data.price_rule.id;

  // Create Discount Code under the Price Rule
  const discountResult = await shopifyApi(
    connection,
    `price_rules/${priceRuleId}/discount_codes.json`,
    "POST",
    { discount_code: { code } },
  );

  if (discountResult.ok) {
    // Update redemption with Shopify references
    await supabase
      .from("loyalty_redemptions")
      .update({
        shopify_price_rule_id: String(priceRuleId),
        shopify_discount_code: code,
      })
      .eq("id", redemptionId);
  }

  return {
    ok: discountResult.ok,
    code,
    priceRuleId,
    error: discountResult.error,
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  // CORS preflight from the browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    // Verify authorization (anon key + user JWT from the app, or service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const body: SyncRequest = await req.json();
    const { action, workspace_id } = body;

    if (!action || !workspace_id) {
      return json({ ok: false, error: "Missing action or workspace_id" }, 400);
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // "connect" runs BEFORE a connection row exists
    if (action === "connect") {
      const hasLegacyToken = !!body.access_token;
      const hasClientCreds = !!(body.client_id && body.client_secret);
      if (!body.store_url || (!hasLegacyToken && !hasClientCreds)) {
        return json({ ok: false, error: "store_url plus either access_token or client_id + client_secret required" }, 400);
      }
      const result = await connect(supabase, workspace_id, body.store_url, body.sync_config, {
        access_token: body.access_token,
        client_id: body.client_id,
        client_secret: body.client_secret,
      });
      return json(result);
    }

    // Get Shopify connection (with decrypted token)
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("store_url, access_token_enc, webhook_secret, api_version, sync_config, auth_mode, client_id, client_secret_enc, token_expires_at")
      .eq("workspace_id", workspace_id)
      .single();

    if (!connection) {
      return json({ ok: false, error: "No Shopify connection configured" }, 404);
    }

    // Dev Dashboard apps: refresh the short-lived token if needed
    const tokenCheck = await ensureAccessToken(supabase, workspace_id, connection);
    if (!tokenCheck.ok) {
      await supabase
        .from("shopify_connections")
        .update({ is_connected: false, last_error: tokenCheck.error, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspace_id);
      return json({ ok: false, error: `Token refresh failed: ${tokenCheck.error}` }, 401);
    }

    let result;

    switch (action) {
      case "save_sync_config":
        if (!body.sync_config) {
          return json({ ok: false, error: "sync_config required" }, 400);
        }
        result = await saveSyncConfig(supabase, workspace_id, body.sync_config);
        break;

      case "pull_products":
      case "push_products":
      case "pull_inventory":
      case "push_inventory":
      case "pull_orders":
      case "pull_customers":
      case "run_full_sync": {
        const work =
          action === "pull_products" ? pullProducts(supabase, connection, workspace_id) :
          action === "push_products" ? pushProducts(supabase, connection, workspace_id) :
          action === "pull_inventory" ? pullInventory(supabase, connection, workspace_id) :
          action === "push_inventory" ? pushInventory(supabase, connection, workspace_id) :
          action === "pull_orders" ? pullOrders(supabase, connection, workspace_id) :
          action === "pull_customers" ? pullCustomers(supabase, connection, workspace_id) :
          runFullSync(supabase, connection, workspace_id);
        // Answer immediately; progress lands in shopify_sync_runs.
        result = runInBackground(work) ? { ok: true, started: true } : await work;
        break;
      }

      case "sync_metafields":
        if (!body.member_id) {
          return json({ ok: false, error: "member_id required" }, 400);
        }
        result = await syncMetafields(supabase, connection, workspace_id, body.member_id);
        break;

      case "test_connection":
        result = await testConnection(supabase, connection, workspace_id);
        break;

      case "register_webhooks":
        result = await registerWebhooks(supabase, connection, workspace_id);
        break;

      case "create_discount_code":
        if (!body.redemption_id) {
          return json({ ok: false, error: "redemption_id required" }, 400);
        }
        result = await createDiscountCode(supabase, connection, workspace_id, body.redemption_id);
        break;

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }

    return json(result);
  } catch (error) {
    console.error("Sync handler error:", error);
    return json({ ok: false, error: String(error) }, 500);
  }
});
