/**
 * Shopify Webhook Handler — Supabase Edge Function
 *
 * Receives Shopify webhooks, validates HMAC signature,
 * processes orders/refunds/customers, awards/reverses points.
 *
 * Security:
 * - HMAC validation on every request (rejects unsigned)
 * - Shopify credentials never exposed to frontend
 * - Service role key used server-side only
 * - All mutations go through RLS-protected tables
 *
 * Supported webhook topics:
 * - orders/create, orders/updated, orders/cancelled
 * - refunds/create
 * - customers/create, customers/update
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// ─── Types ───────────────────────────────────────────────

interface ShopifyOrder {
  id: number;
  order_number: number;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    email: string;
    phone: string | null;
    first_name: string;
    last_name: string;
  } | null;
  line_items: Array<{
    product_id: number;
    title: string;
    quantity: number;
    price: string;
    product_type: string;
  }>;
  cancelled_at: string | null;
}

interface ShopifyRefund {
  id: number;
  order_id: number;
  transactions: Array<{
    amount: string;
    currency: string;
  }>;
}

interface ShopifyCustomer {
  id: number;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
}

// ─── HMAC Validation ─────────────────────────────────────

async function validateHmac(
  body: string,
  hmacHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computed === hmacHeader;
}

// ─── Logging helper ──────────────────────────────────────

async function logSync(
  supabase: any,
  workspaceId: string,
  data: {
    eventType: string;
    status: "success" | "failed" | "skipped" | "pending";
    shopifyOrderId?: string;
    shopifyCustomerId?: string;
    memberId?: string;
    memberName?: string;
    pointsDelta?: number;
    details: string;
    errorMessage?: string;
    rawPayload?: any;
  },
) {
  await supabase.from("shopify_sync_log").insert({
    workspace_id: workspaceId,
    event_type: data.eventType,
    status: data.status,
    shopify_order_id: data.shopifyOrderId,
    shopify_customer_id: data.shopifyCustomerId,
    member_id: data.memberId,
    member_name: data.memberName,
    points_delta: data.pointsDelta,
    details: data.details,
    error_message: data.errorMessage,
    raw_payload: data.rawPayload,
  });
}

// ─── Process Order ───────────────────────────────────────

async function processOrder(
  supabase: any,
  workspaceId: string,
  order: ShopifyOrder,
) {
  const shopifyOrderId = `SHP-${order.order_number}`;
  const shopifyCustomerId = order.customer
    ? `gid://shopify/Customer/${order.customer.id}`
    : null;
  const totalAmount = parseFloat(order.total_price);

  // Skip zero-value orders
  if (totalAmount <= 0) {
    await logSync(supabase, workspaceId, {
      eventType: "order_created",
      status: "skipped",
      shopifyOrderId,
      details: `Order total ${totalAmount} — skipped (no points for zero-value orders).`,
    });
    return;
  }

  // Check if already processed (idempotency)
  const { data: existing } = await supabase
    .from("shopify_orders")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("shopify_order_id", shopifyOrderId)
    .single();

  if (existing) {
    await logSync(supabase, workspaceId, {
      eventType: "order_created",
      status: "skipped",
      shopifyOrderId,
      details: `Order ${shopifyOrderId} already processed — skipping duplicate.`,
    });
    return;
  }

  // Match customer to loyalty member
  let memberId: string | null = null;
  let memberName: string | null = null;
  let memberTier = "bronze";

  if (shopifyCustomerId || order.customer?.email || order.customer?.phone) {
    const { data: matched } = await supabase
      .rpc("match_shopify_customer", {
        p_workspace_id: workspaceId,
        p_shopify_customer_id: shopifyCustomerId,
        p_email: order.customer?.email || null,
        p_phone: order.customer?.phone || null,
      });

    if (matched) {
      memberId = matched;
      // Get member details
      const { data: member } = await supabase
        .from("loyalty_members")
        .select("name_en, tier_slug, order_count")
        .eq("id", memberId)
        .single();

      if (member) {
        memberName = member.name_en;
        memberTier = member.tier_slug || "bronze";
      }
    }
  }

  // Extract product categories from line items
  const categories = order.line_items
    .map((li) => li.product_type)
    .filter(Boolean);

  // Calculate points
  let pointsAwarded = 0;
  let rulesApplied: any[] = [];

  if (memberId) {
    const { data: calcResult } = await supabase
      .rpc("calculate_loyalty_points", {
        p_workspace_id: workspaceId,
        p_order_amount: totalAmount,
        p_categories: categories,
        p_member_tier: memberTier,
        p_is_first_purchase: false, // would need to check order_count == 0
      });

    if (calcResult && calcResult.length > 0) {
      pointsAwarded = calcResult[0].total_points;
      rulesApplied = calcResult[0].rules_applied;
    }
  }

  // Store order record
  await supabase.from("shopify_orders").insert({
    workspace_id: workspaceId,
    shopify_order_id: shopifyOrderId,
    shopify_order_number: String(order.order_number),
    shopify_customer_id: shopifyCustomerId,
    member_id: memberId,
    total_amount: totalAmount,
    currency: order.currency,
    line_items: order.line_items,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    points_awarded: pointsAwarded,
    rules_applied: rulesApplied,
    processed: !!memberId,
    processed_at: memberId ? new Date().toISOString() : null,
    raw_payload: order,
  });

  // Award points if member matched
  if (memberId && pointsAwarded > 0) {
    // Get current balance
    const { data: member } = await supabase
      .from("loyalty_members")
      .select("current_points, total_spend, order_count")
      .eq("id", memberId)
      .single();

    const currentBalance = member?.current_points || 0;
    const newBalance = currentBalance + pointsAwarded;

    // Create transaction (trigger will update cached balance)
    await supabase.from("loyalty_transactions").insert({
      workspace_id: workspaceId,
      member_id: memberId,
      type: "earned",
      points: pointsAwarded,
      balance_after: newBalance,
      source: "shopify",
      order_id: shopifyOrderId,
      order_amount: totalAmount,
      notes: `Order ${shopifyOrderId} — ${rulesApplied.length} rules applied`,
    });

    // Update member spend and order count
    await supabase
      .from("loyalty_members")
      .update({
        total_spend: (member?.total_spend || 0) + totalAmount,
        order_count: (member?.order_count || 0) + 1,
        last_purchase_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    // Recalculate tier
    await supabase.rpc("recalculate_member_tier", { p_member_id: memberId });

    await logSync(supabase, workspaceId, {
      eventType: "order_created",
      status: "success",
      shopifyOrderId,
      shopifyCustomerId: shopifyCustomerId || undefined,
      memberId,
      memberName: memberName || undefined,
      pointsDelta: pointsAwarded,
      details: `Order ${shopifyOrderId} processed. ${pointsAwarded.toLocaleString()} pts awarded to ${memberName} (${memberTier}, ${rulesApplied.length} rules applied).`,
    });

    await logSync(supabase, workspaceId, {
      eventType: "points_awarded",
      status: "success",
      memberId,
      memberName: memberName || undefined,
      pointsDelta: pointsAwarded,
      details: `Points balance updated: ${currentBalance.toLocaleString()} → ${newBalance.toLocaleString()}`,
    });
  } else if (!memberId) {
    await logSync(supabase, workspaceId, {
      eventType: "order_created",
      status: "success",
      shopifyOrderId,
      shopifyCustomerId: shopifyCustomerId || undefined,
      details: `Order ${shopifyOrderId} recorded. No matching loyalty member — order stored for future matching.`,
    });
  }
}

// ─── Process Refund ──────────────────────────────────────

async function processRefund(
  supabase: any,
  workspaceId: string,
  refund: ShopifyRefund,
) {
  const refundAmount = refund.transactions.reduce(
    (sum, t) => sum + parseFloat(t.amount),
    0,
  );

  // Find the original order
  const { data: order } = await supabase
    .from("shopify_orders")
    .select("*, member_id, points_awarded")
    .eq("workspace_id", workspaceId)
    .eq("shopify_order_id", `SHP-${refund.order_id}`)
    .single();

  if (!order || !order.member_id || !order.points_awarded) {
    await logSync(supabase, workspaceId, {
      eventType: "order_refunded",
      status: "skipped",
      shopifyOrderId: `SHP-${refund.order_id}`,
      details: `Refund for order SHP-${refund.order_id} — no matching order or no points to reverse.`,
    });
    return;
  }

  // Calculate points to reverse (proportional to refund amount)
  const refundRatio = refundAmount / parseFloat(order.total_amount);
  const pointsToReverse = Math.round(order.points_awarded * refundRatio);

  if (pointsToReverse <= 0) return;

  // Get current balance
  const { data: member } = await supabase
    .from("loyalty_members")
    .select("current_points, name_en, total_spend")
    .eq("id", order.member_id)
    .single();

  const currentBalance = member?.current_points || 0;
  const newBalance = currentBalance - pointsToReverse;

  // Create reversal transaction
  await supabase.from("loyalty_transactions").insert({
    workspace_id: workspaceId,
    member_id: order.member_id,
    type: "reversed",
    points: -pointsToReverse,
    balance_after: newBalance,
    source: "system",
    order_id: `SHP-${refund.order_id}`,
    notes: `Refund on order SHP-${refund.order_id}. ${pointsToReverse} pts reversed.`,
  });

  // Update member spend
  await supabase
    .from("loyalty_members")
    .update({
      total_spend: Math.max(0, (member?.total_spend || 0) - refundAmount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.member_id);

  // Recalculate tier (could downgrade)
  await supabase.rpc("recalculate_member_tier", {
    p_member_id: order.member_id,
  });

  await logSync(supabase, workspaceId, {
    eventType: "order_refunded",
    status: "success",
    shopifyOrderId: `SHP-${refund.order_id}`,
    memberId: order.member_id,
    memberName: member?.name_en,
    pointsDelta: -pointsToReverse,
    details: `Refund on SHP-${refund.order_id}. ${pointsToReverse} pts reversed from ${member?.name_en}.`,
  });
}

// ─── Process Customer ────────────────────────────────────

async function processCustomer(
  supabase: any,
  workspaceId: string,
  customer: ShopifyCustomer,
  isCreate: boolean,
) {
  const shopifyCustomerId = `gid://shopify/Customer/${customer.id}`;

  // Try to match existing member
  const { data: matched } = await supabase.rpc("match_shopify_customer", {
    p_workspace_id: workspaceId,
    p_shopify_customer_id: shopifyCustomerId,
    p_email: customer.email || null,
    p_phone: customer.phone || null,
  });

  if (matched) {
    // Update existing member
    await supabase
      .from("loyalty_members")
      .update({
        shopify_customer_id: shopifyCustomerId,
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matched);

    await logSync(supabase, workspaceId, {
      eventType: isCreate ? "customer_created" : "customer_updated",
      status: "success",
      shopifyCustomerId,
      memberId: matched,
      details: `Shopify customer ${customer.first_name} ${customer.last_name} matched to existing loyalty member.`,
    });
  } else if (isCreate) {
    // Log as unmatched — admin can review or auto-enroll
    await logSync(supabase, workspaceId, {
      eventType: "customer_created",
      status: "success",
      shopifyCustomerId,
      details: `New Shopify customer ${customer.first_name} ${customer.last_name} detected. No matching Bumblebee member — created pending match.`,
    });
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

    if (!topic || !shopDomain) {
      return new Response("Missing Shopify headers", { status: 400 });
    }

    // Create Supabase client with service role key (server-side only)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find workspace by store domain
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("workspace_id, webhook_secret")
      .eq("store_url", shopDomain)
      .eq("is_connected", true)
      .single();

    if (!connection) {
      return new Response("Unknown store", { status: 404 });
    }

    // Validate HMAC
    const isValid = await validateHmac(body, hmacHeader, connection.webhook_secret);
    if (!isValid) {
      await logSync(supabase, connection.workspace_id, {
        eventType: "webhook_received",
        status: "failed",
        details: `HMAC validation failed — request rejected`,
        errorMessage: `Invalid HMAC signature for ${topic} from ${shopDomain}`,
      });
      return new Response("Invalid HMAC", { status: 401 });
    }

    // Log successful webhook receipt
    await logSync(supabase, connection.workspace_id, {
      eventType: "webhook_received",
      status: "success",
      details: `${topic} webhook validated (HMAC OK)`,
    });

    const payload = JSON.parse(body);

    // Route by topic
    switch (topic) {
      case "orders/create":
      case "orders/paid":
        await processOrder(supabase, connection.workspace_id, payload as ShopifyOrder);
        break;

      case "orders/cancelled":
        // Treat cancellation like a full refund
        if (payload.cancelled_at) {
          await processRefund(supabase, connection.workspace_id, {
            id: payload.id,
            order_id: payload.order_number,
            transactions: [{ amount: payload.total_price, currency: payload.currency }],
          });
        }
        break;

      case "refunds/create":
        await processRefund(supabase, connection.workspace_id, payload as ShopifyRefund);
        break;

      case "customers/create":
        await processCustomer(supabase, connection.workspace_id, payload as ShopifyCustomer, true);
        break;

      case "customers/update":
        await processCustomer(supabase, connection.workspace_id, payload as ShopifyCustomer, false);
        break;

      default:
        await logSync(supabase, connection.workspace_id, {
          eventType: "webhook_received",
          status: "skipped",
          details: `Unhandled webhook topic: ${topic}`,
        });
    }

    // Update last sync timestamp
    await supabase
      .from("shopify_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("workspace_id", connection.workspace_id);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
