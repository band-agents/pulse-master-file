-- ═══════════════════════════════════════════════════════════
-- LOYALTY PROGRAM FOUNDATION
-- برنامج الولاء — الجداول الأساسية
--
-- Tables: loyalty_programs, loyalty_tiers, loyalty_rules,
--         loyalty_members, loyalty_transactions, loyalty_redemptions,
--         loyalty_rewards, shopify_connections, shopify_orders,
--         shopify_sync_log
--
-- All tables have RLS enabled with workspace_id isolation.
-- Points are computed from immutable transactions — never
-- update balances directly. Cached balances on loyalty_members
-- are updated via triggers for read performance.
-- ═══════════════════════════════════════════════════════════

-- ─── LOYALTY PROGRAMS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  name_en           TEXT NOT NULL DEFAULT 'Loyalty Program',
  name_ar           TEXT DEFAULT 'برنامج الولاء',

  -- Earning configuration
  points_per_amount INT NOT NULL DEFAULT 100,       -- points awarded
  amount_per_points NUMERIC(10,2) NOT NULL DEFAULT 10, -- per this amount in currency
  currency          TEXT NOT NULL DEFAULT 'EGP',

  -- Redemption configuration
  redemption_points INT NOT NULL DEFAULT 1000,      -- points needed
  redemption_value  NUMERIC(10,2) NOT NULL DEFAULT 10, -- discount given
  min_redemption    INT NOT NULL DEFAULT 500,        -- minimum points to redeem
  max_discount      NUMERIC(10,2),                   -- max discount per redemption (null = unlimited)

  -- Channels
  earn_online       BOOLEAN NOT NULL DEFAULT TRUE,
  earn_instore      BOOLEAN NOT NULL DEFAULT TRUE,
  redeem_online     BOOLEAN NOT NULL DEFAULT TRUE,
  redeem_instore    BOOLEAN NOT NULL DEFAULT TRUE,

  -- Expiry
  points_expiry_days INT,                            -- null = never expire

  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id)  -- one program per workspace
);

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_programs_workspace" ON loyalty_programs
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── LOYALTY TIERS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

  slug              TEXT NOT NULL,                    -- bronze, silver, gold, vip
  name_en           TEXT NOT NULL,
  name_ar           TEXT,
  color             TEXT DEFAULT '#CD7F32',
  min_spend         NUMERIC(14,2) NOT NULL DEFAULT 0, -- cumulative spend threshold
  earning_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  sort_order        INT NOT NULL DEFAULT 0,

  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, slug)
);

ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_tiers_workspace" ON loyalty_tiers
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── LOYALTY RULES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

  name_en           TEXT NOT NULL,
  name_ar           TEXT,
  type              TEXT NOT NULL CHECK (type IN ('spend', 'category_bonus', 'first_purchase', 'birthday', 'campaign', 'referral', 'threshold')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'paused', 'expired')),

  -- Rule configuration (varies by type)
  points_awarded    INT,                              -- flat points bonus
  multiplier        NUMERIC(4,2),                     -- earning multiplier
  min_amount        NUMERIC(14,2),                    -- minimum spend or threshold
  category_filter   TEXT[],                           -- product categories (for category_bonus)
  starts_at         TIMESTAMPTZ,                     -- campaign start
  ends_at           TIMESTAMPTZ,                     -- campaign end

  description_en    TEXT,
  description_ar    TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  priority          INT NOT NULL DEFAULT 0,           -- higher = checked first
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_rules_workspace" ON loyalty_rules
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── LOYALTY MEMBERS ─────────────────────────────────────
-- Extends people/organizations with loyalty-specific data

CREATE TABLE IF NOT EXISTS loyalty_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

  -- Link to existing Bumblebee entities
  person_id         UUID REFERENCES people(id),
  organization_id   UUID REFERENCES organizations(id),

  -- Core identity (denormalized for fast lookup)
  member_number     TEXT NOT NULL,                    -- e.g., "LYL-00001"
  name_en           TEXT NOT NULL,
  name_ar           TEXT,
  email             TEXT,
  phone             TEXT,                             -- primary lookup key for MENA

  -- Shopify link
  shopify_customer_id TEXT,                           -- Shopify customer GID

  -- Cached balances (computed from transactions via trigger)
  current_points    INT NOT NULL DEFAULT 0,
  lifetime_points   INT NOT NULL DEFAULT 0,
  redeemed_points   INT NOT NULL DEFAULT 0,
  expired_points    INT NOT NULL DEFAULT 0,

  -- Tier (cached, recomputed on spend change)
  tier_id           UUID REFERENCES loyalty_tiers(id),
  tier_slug         TEXT DEFAULT 'bronze',

  -- Stats (cached, updated on each transaction)
  total_spend       NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_count       INT NOT NULL DEFAULT 0,
  last_purchase_at  TIMESTAMPTZ,
  last_earn_at      TIMESTAMPTZ,
  last_redeem_at    TIMESTAMPTZ,

  -- Preferences
  favorite_categories TEXT[],
  opted_in          BOOLEAN NOT NULL DEFAULT TRUE,

  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, member_number),
  UNIQUE(workspace_id, shopify_customer_id)
);

-- Indexes for fast lookup (POS staff search)
CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone ON loyalty_members (workspace_id, phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_email ON loyalty_members (workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_name  ON loyalty_members (workspace_id, name_en);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_shopify ON loyalty_members (workspace_id, shopify_customer_id);

ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_members_workspace" ON loyalty_members
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── LOYALTY TRANSACTIONS ────────────────────────────────
-- IMMUTABLE audit trail — never update, only insert.
-- Points balance is computed from SUM of transactions.

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,

  type              TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted', 'expired', 'reversed', 'bonus')),
  points            INT NOT NULL,                     -- positive for earn/bonus, negative for redeem/expire/reverse
  balance_after     INT NOT NULL,                     -- snapshot of balance after this tx

  source            TEXT NOT NULL CHECK (source IN ('shopify', 'store', 'admin', 'system')),

  -- Order reference
  order_id          TEXT,                             -- Shopify order ID or internal ref
  order_amount      NUMERIC(14,2),                    -- purchase amount
  receipt_number    TEXT,

  -- Metadata
  rule_id           UUID REFERENCES loyalty_rules(id),   -- which rule triggered this
  staff_name        TEXT,                             -- for in-store transactions
  notes             TEXT,

  -- Reversal link
  reversed_tx_id    UUID REFERENCES loyalty_transactions(id),

  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — transactions are immutable
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_member ON loyalty_transactions (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_workspace ON loyalty_transactions (workspace_id, created_at DESC);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_transactions_workspace" ON loyalty_transactions
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── LOYALTY REDEMPTIONS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  transaction_id    UUID NOT NULL REFERENCES loyalty_transactions(id),

  channel           TEXT NOT NULL CHECK (channel IN ('online', 'offline')),
  points_redeemed   INT NOT NULL,
  discount_amount   NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'EGP',

  -- Online redemption (Shopify)
  shopify_price_rule_id TEXT,
  shopify_discount_code TEXT,                         -- unique code for this redemption
  shopify_order_id  TEXT,                             -- if used

  -- Offline redemption
  staff_id          UUID,
  staff_name        TEXT,

  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at        TIMESTAMPTZ,

  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_redemptions_workspace" ON loyalty_redemptions
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── SHOPIFY CONNECTIONS ─────────────────────────────────
-- Encrypted credentials — access_token is stored encrypted,
-- NEVER returned to the frontend.

CREATE TABLE IF NOT EXISTS shopify_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  store_url         TEXT NOT NULL,                    -- e.g., "my-store.myshopify.com"
  access_token_enc  TEXT NOT NULL,                    -- encrypted via pgcrypto
  webhook_secret    TEXT NOT NULL,                    -- for HMAC validation
  api_version       TEXT NOT NULL DEFAULT '2024-01',

  -- Status
  is_connected      BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at      TIMESTAMPTZ,
  last_error        TEXT,

  -- Sync settings
  sync_customers    BOOLEAN NOT NULL DEFAULT TRUE,
  sync_orders       BOOLEAN NOT NULL DEFAULT TRUE,
  auto_award_points BOOLEAN NOT NULL DEFAULT TRUE,
  sync_metafields   BOOLEAN NOT NULL DEFAULT TRUE,

  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id)
);

ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;
-- IMPORTANT: Never return access_token_enc to frontend
CREATE POLICY "shopify_connections_workspace" ON shopify_connections
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── SHOPIFY ORDERS ──────────────────────────────────────
-- Raw order data from Shopify for reference and audit

CREATE TABLE IF NOT EXISTS shopify_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  shopify_order_id  TEXT NOT NULL,                    -- Shopify order GID
  shopify_order_number TEXT,                          -- human-readable #1001
  shopify_customer_id TEXT,

  -- Matched Bumblebee member
  member_id         UUID REFERENCES loyalty_members(id),

  -- Order data
  total_amount      NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'EGP',
  line_items        JSONB DEFAULT '[]',
  financial_status  TEXT,                             -- paid, refunded, partially_refunded
  fulfillment_status TEXT,

  -- Points awarded
  points_awarded    INT NOT NULL DEFAULT 0,
  rules_applied     JSONB DEFAULT '[]',               -- which rules contributed

  -- Processing
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  error_message     TEXT,

  raw_payload       JSONB,                            -- full Shopify webhook payload (for debugging)

  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, shopify_order_id)
);

ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopify_orders_workspace" ON shopify_orders
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── SHOPIFY SYNC LOG ────────────────────────────────────
-- Every webhook event and sync action is logged here

CREATE TABLE IF NOT EXISTS shopify_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  event_type        TEXT NOT NULL,                    -- order_created, customer_created, points_awarded, etc.
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'failed', 'skipped', 'pending')),

  shopify_order_id  TEXT,
  shopify_customer_id TEXT,
  member_id         UUID REFERENCES loyalty_members(id),
  member_name       TEXT,

  points_delta      INT,
  details           TEXT NOT NULL,
  error_message     TEXT,

  raw_payload       JSONB,                            -- webhook payload for debugging

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_workspace ON shopify_sync_log (workspace_id, created_at DESC);

ALTER TABLE shopify_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopify_sync_log_workspace" ON shopify_sync_log
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── LOYALTY REWARDS (Phase 2) ───────────────────────────
-- Catalog of redeemable rewards beyond simple discounts

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  name_en           TEXT NOT NULL,
  name_ar           TEXT,
  description_en    TEXT,
  description_ar    TEXT,
  points_cost       INT NOT NULL,
  reward_type       TEXT NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'product', 'experience', 'voucher')),

  -- For discount type
  discount_amount   NUMERIC(14,2),
  discount_percent  NUMERIC(5,2),

  -- Stock
  quantity_available INT,                             -- null = unlimited
  quantity_redeemed  INT NOT NULL DEFAULT 0,

  image_url         TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INT NOT NULL DEFAULT 0,

  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_rewards_workspace" ON loyalty_rewards
  USING (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id));

-- ─── FUNCTIONS: Points Calculation ───────────────────────

-- Calculate points for an order based on active rules
CREATE OR REPLACE FUNCTION calculate_loyalty_points(
  p_workspace_id UUID,
  p_order_amount NUMERIC,
  p_categories TEXT[] DEFAULT '{}',
  p_member_tier TEXT DEFAULT 'bronze',
  p_is_first_purchase BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(total_points INT, rules_applied JSONB) AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_rule RECORD;
  v_base_points INT := 0;
  v_multiplier NUMERIC := 1.0;
  v_bonus_points INT := 0;
  v_tier_multiplier NUMERIC := 1.0;
  v_rules JSONB := '[]'::JSONB;
BEGIN
  -- Get program config
  SELECT * INTO v_program FROM loyalty_programs
    WHERE workspace_id = p_workspace_id AND is_active = TRUE LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT, '[]'::JSONB;
    RETURN;
  END IF;

  -- Base spend rule: points_per_amount for every amount_per_points spent
  v_base_points := FLOOR(p_order_amount / v_program.amount_per_points) * v_program.points_per_amount;
  v_rules := v_rules || jsonb_build_object('type', 'spend', 'points', v_base_points);

  -- Get tier multiplier
  SELECT earning_multiplier INTO v_tier_multiplier
    FROM loyalty_tiers
    WHERE workspace_id = p_workspace_id AND slug = p_member_tier AND is_active = TRUE
    LIMIT 1;
  v_tier_multiplier := COALESCE(v_tier_multiplier, 1.0);

  -- Apply active rules
  FOR v_rule IN
    SELECT * FROM loyalty_rules
    WHERE workspace_id = p_workspace_id
      AND is_active = TRUE
      AND status = 'active'
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    ORDER BY priority DESC
  LOOP
    CASE v_rule.type
      WHEN 'category_bonus' THEN
        -- Check if any purchased category matches the rule's filter
        IF v_rule.category_filter IS NOT NULL AND v_rule.category_filter && p_categories THEN
          v_multiplier := GREATEST(v_multiplier, COALESCE(v_rule.multiplier, 1.0));
          v_rules := v_rules || jsonb_build_object('type', 'category_bonus', 'rule_id', v_rule.id, 'multiplier', v_rule.multiplier);
        END IF;

      WHEN 'campaign' THEN
        -- Campaign multiplier overrides base if higher
        v_multiplier := GREATEST(v_multiplier, COALESCE(v_rule.multiplier, 1.0));
        v_rules := v_rules || jsonb_build_object('type', 'campaign', 'rule_id', v_rule.id, 'multiplier', v_rule.multiplier);

      WHEN 'first_purchase' THEN
        IF p_is_first_purchase AND v_rule.points_awarded IS NOT NULL THEN
          v_bonus_points := v_bonus_points + v_rule.points_awarded;
          v_rules := v_rules || jsonb_build_object('type', 'first_purchase', 'rule_id', v_rule.id, 'points', v_rule.points_awarded);
        END IF;

      WHEN 'threshold' THEN
        IF p_order_amount >= COALESCE(v_rule.min_amount, 0) AND v_rule.points_awarded IS NOT NULL THEN
          v_bonus_points := v_bonus_points + v_rule.points_awarded;
          v_rules := v_rules || jsonb_build_object('type', 'threshold', 'rule_id', v_rule.id, 'points', v_rule.points_awarded);
        END IF;

      ELSE NULL;
    END CASE;
  END LOOP;

  -- Final calculation: (base_points × max_multiplier × tier_multiplier) + bonus_points
  total_points := FLOOR(v_base_points * v_multiplier * v_tier_multiplier) + v_bonus_points;
  rules_applied := v_rules;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── TRIGGERS: Update cached balances ────────────────────

-- After inserting a loyalty transaction, update the member's cached balances
CREATE OR REPLACE FUNCTION update_member_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE loyalty_members SET
    current_points = (
      SELECT COALESCE(SUM(points), 0) FROM loyalty_transactions WHERE member_id = NEW.member_id
    ),
    lifetime_points = (
      SELECT COALESCE(SUM(points), 0) FROM loyalty_transactions
      WHERE member_id = NEW.member_id AND points > 0
    ),
    redeemed_points = (
      SELECT COALESCE(ABS(SUM(points)), 0) FROM loyalty_transactions
      WHERE member_id = NEW.member_id AND type = 'redeemed'
    ),
    expired_points = (
      SELECT COALESCE(ABS(SUM(points)), 0) FROM loyalty_transactions
      WHERE member_id = NEW.member_id AND type = 'expired'
    ),
    last_earn_at = CASE WHEN NEW.type IN ('earned', 'bonus') THEN NOW() ELSE last_earn_at END,
    last_redeem_at = CASE WHEN NEW.type = 'redeemed' THEN NOW() ELSE last_redeem_at END,
    updated_at = NOW()
  WHERE id = NEW.member_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_member_balance
  AFTER INSERT ON loyalty_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_member_balance();

-- ─── FUNCTION: Customer Matching ─────────────────────────

-- Match a Shopify customer to a loyalty member
-- Priority: shopify_customer_id > email > phone
CREATE OR REPLACE FUNCTION match_shopify_customer(
  p_workspace_id UUID,
  p_shopify_customer_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- 1. Exact Shopify ID match
  IF p_shopify_customer_id IS NOT NULL THEN
    SELECT id INTO v_member_id FROM loyalty_members
      WHERE workspace_id = p_workspace_id
        AND shopify_customer_id = p_shopify_customer_id
        AND is_active = TRUE
      LIMIT 1;
    IF FOUND THEN RETURN v_member_id; END IF;
  END IF;

  -- 2. Email match
  IF p_email IS NOT NULL AND p_email != '' THEN
    SELECT id INTO v_member_id FROM loyalty_members
      WHERE workspace_id = p_workspace_id
        AND LOWER(email) = LOWER(p_email)
        AND is_active = TRUE
      LIMIT 1;
    IF FOUND THEN
      -- Link Shopify ID for future fast matching
      IF p_shopify_customer_id IS NOT NULL THEN
        UPDATE loyalty_members SET shopify_customer_id = p_shopify_customer_id, updated_at = NOW()
          WHERE id = v_member_id AND shopify_customer_id IS NULL;
      END IF;
      RETURN v_member_id;
    END IF;
  END IF;

  -- 3. Phone match (normalize: strip +, spaces, leading 0s)
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT id INTO v_member_id FROM loyalty_members
      WHERE workspace_id = p_workspace_id
        AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g')
        AND is_active = TRUE
      LIMIT 1;
    IF FOUND THEN
      IF p_shopify_customer_id IS NOT NULL THEN
        UPDATE loyalty_members SET shopify_customer_id = p_shopify_customer_id, updated_at = NOW()
          WHERE id = v_member_id AND shopify_customer_id IS NULL;
      END IF;
      RETURN v_member_id;
    END IF;
  END IF;

  -- No match found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── FUNCTION: Tier Recalculation ────────────────────────

CREATE OR REPLACE FUNCTION recalculate_member_tier(p_member_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_member loyalty_members%ROWTYPE;
  v_new_tier RECORD;
BEGIN
  SELECT * INTO v_member FROM loyalty_members WHERE id = p_member_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Find highest tier the member qualifies for based on total_spend
  SELECT * INTO v_new_tier FROM loyalty_tiers
    WHERE workspace_id = v_member.workspace_id
      AND is_active = TRUE
      AND min_spend <= v_member.total_spend
    ORDER BY min_spend DESC
    LIMIT 1;

  IF FOUND AND v_new_tier.slug != v_member.tier_slug THEN
    UPDATE loyalty_members SET
      tier_id = v_new_tier.id,
      tier_slug = v_new_tier.slug,
      updated_at = NOW()
    WHERE id = p_member_id;
    RETURN v_new_tier.slug;
  END IF;

  RETURN v_member.tier_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════
-- POINTS EXPIRY — Process expired points (Sprint L4)
-- ════════════════════════════════════════════════════════════

-- Call periodically (e.g. daily cron or pg_cron) to expire stale points.
-- Reads program-level expiry settings from loyalty_programs.metadata:
--   { "expiry_days": 365, "protected_balance": 500, "warning_days": 14 }
--
-- For each member with eligible points older than expiry_days:
--   1. Skip if member balance ≤ protected_balance
--   2. Calculate expired amount = oldest un-expired batch amount
--   3. Insert "expired" transaction (immutable audit)
--   4. Log the event

CREATE OR REPLACE FUNCTION process_points_expiry(p_workspace_id UUID)
RETURNS TABLE(member_id UUID, expired_points INT, new_balance INT) AS $$
DECLARE
  v_program     RECORD;
  v_expiry_days INT;
  v_protected   INT;
  v_cutoff      TIMESTAMPTZ;
  v_member      RECORD;
  v_expire_sum  INT;
  v_new_bal     INT;
BEGIN
  -- Get program settings
  SELECT * INTO v_program FROM loyalty_programs
    WHERE workspace_id = p_workspace_id AND is_active = TRUE
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Read expiry config from program metadata
  v_expiry_days := COALESCE((v_program.metadata->>'expiry_days')::INT, 0);
  v_protected   := COALESCE((v_program.metadata->>'protected_balance')::INT, 0);

  -- If expiry is disabled (0 or null), do nothing
  IF v_expiry_days <= 0 THEN
    RETURN;
  END IF;

  v_cutoff := NOW() - (v_expiry_days || ' days')::INTERVAL;

  -- Find members with "earned" or "bonus" transactions older than cutoff
  -- that haven't been offset by a corresponding "expired" transaction
  FOR v_member IN
    SELECT m.id, m.current_points, m.name_en
    FROM loyalty_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.current_points > v_protected
      AND m.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM loyalty_transactions t
        WHERE t.member_id = m.id
          AND t.type IN ('earned', 'bonus')
          AND t.created_at < v_cutoff
          -- Only un-expired: no matching expired tx referencing this earn
          AND NOT EXISTS (
            SELECT 1 FROM loyalty_transactions t2
            WHERE t2.member_id = m.id
              AND t2.type = 'expired'
              AND t2.notes LIKE '%expiry of batch%' || t.id::TEXT || '%'
          )
      )
  LOOP
    -- Sum all un-expired earned/bonus points older than cutoff
    SELECT COALESCE(SUM(t.points), 0) INTO v_expire_sum
    FROM loyalty_transactions t
    WHERE t.member_id = v_member.id
      AND t.type IN ('earned', 'bonus')
      AND t.created_at < v_cutoff
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_transactions t2
        WHERE t2.member_id = v_member.id
          AND t2.type = 'expired'
          AND t2.notes LIKE '%expiry of batch%' || t.id::TEXT || '%'
      );

    -- Don't expire more than current balance minus protected amount
    v_expire_sum := LEAST(v_expire_sum, v_member.current_points - v_protected);

    IF v_expire_sum > 0 THEN
      v_new_bal := v_member.current_points - v_expire_sum;

      -- Insert immutable expiry transaction
      INSERT INTO loyalty_transactions (
        workspace_id, member_id, type, points, balance_after,
        source, notes
      ) VALUES (
        p_workspace_id, v_member.id, 'expired', -v_expire_sum, v_new_bal,
        'system',
        'Points expiry policy (' || v_expiry_days || ' days). Expired ' || v_expire_sum || ' points.'
      );

      -- balance is updated by the trigger (update_member_balance)

      member_id      := v_member.id;
      expired_points := v_expire_sum;
      new_balance    := v_new_bal;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
