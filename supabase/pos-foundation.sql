-- POS Foundation Migration
-- Adds the 4 POS tables missing from the live project (present in schema.sql
-- clean-install but never applied): pos_registers, pos_transactions,
-- pos_transaction_items, branch_inventory.
-- Idempotent — safe to re-run. Paste into the Supabase dashboard SQL editor.

-- ─── pos_registers ────────────────────────────────────────
create table if not exists pos_registers (
  id            uuid        primary key default uuid_generate_v4(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  branch_id     uuid        not null references branches(id) on delete cascade,
  register_code text        not null,
  name          text        not null,
  name_ar       text,
  status        text        not null default 'active'
                            check (status in ('active','inactive','maintenance')),
  opened_by     uuid,
  opened_at     timestamptz,
  closed_at     timestamptz,
  float_amount  numeric     not null default 0,
  current_cash  numeric     not null default 0,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pos_registers_workspace_idx on pos_registers(workspace_id);
create index if not exists pos_registers_branch_idx    on pos_registers(branch_id);

-- ─── pos_transactions ─────────────────────────────────────
create table if not exists pos_transactions (
  id                      uuid        primary key default uuid_generate_v4(),
  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  branch_id               uuid        not null references branches(id) on delete cascade,
  register_id             uuid        not null references pos_registers(id) on delete cascade,
  transaction_number      text        not null,
  customer_id             uuid,
  customer_name           text,
  customer_phone          text,
  loyalty_card_number     text,
  subtotal                numeric     not null default 0,
  discount_amount         numeric     not null default 0,
  discount_percent        numeric     not null default 0,
  tax_amount              numeric     not null default 0,
  tax_rate                numeric     not null default 15,
  total                   numeric     not null default 0,
  currency                text        not null default 'SAR',
  payment_method          text        not null default 'cash'
                            check (payment_method in ('cash','card','mobile_wallet','loyalty_points','split')),
  payment_details         jsonb       not null default '{}',
  status                  text        not null default 'completed'
                            check (status in ('completed','voided','refunded','pending')),
  cashier_name            text        not null,
  notes                   text,
  receipt_printed         boolean     not null default false,
  loyalty_points_earned   integer     not null default 0,
  loyalty_points_redeemed integer     not null default 0,
  metadata                jsonb       not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pos_transactions_workspace_idx on pos_transactions(workspace_id);
create index if not exists pos_transactions_branch_idx    on pos_transactions(branch_id);
create index if not exists pos_transactions_register_idx  on pos_transactions(register_id);
create index if not exists pos_transactions_created_idx   on pos_transactions(workspace_id, created_at desc);
create index if not exists pos_transactions_status_idx    on pos_transactions(workspace_id, status);

-- ─── pos_transaction_items ────────────────────────────────
create table if not exists pos_transaction_items (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  transaction_id  uuid        not null references pos_transactions(id) on delete cascade,
  product_id      uuid,
  product_name    text        not null,
  product_name_ar text,
  sku             text,
  quantity        numeric     not null default 1,
  unit_price      numeric     not null default 0,
  discount_amount numeric     not null default 0,
  discount_percent numeric    not null default 0,
  total           numeric     not null default 0,
  cost_price      numeric     not null default 0,
  branch_id       uuid        not null references branches(id) on delete cascade,
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pos_transaction_items_workspace_idx on pos_transaction_items(workspace_id);
create index if not exists pos_transaction_items_txn_idx       on pos_transaction_items(transaction_id);

-- ─── branch_inventory ─────────────────────────────────────
create table if not exists branch_inventory (
  id                uuid        primary key default uuid_generate_v4(),
  workspace_id      uuid        not null references workspaces(id) on delete cascade,
  branch_id         uuid        not null references branches(id) on delete cascade,
  product_id        uuid        not null,
  product_name      text        not null,
  sku               text,
  quantity          integer     not null default 0,
  reserved_quantity integer     not null default 0,
  reorder_level     integer     not null default 5,
  unit_cost         numeric     not null default 0,
  unit_price        numeric     not null default 0,
  last_restocked_at timestamptz,
  metadata          jsonb       not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists branch_inventory_workspace_idx on branch_inventory(workspace_id);
create index if not exists branch_inventory_branch_idx    on branch_inventory(branch_id);
create index if not exists branch_inventory_product_idx   on branch_inventory(product_id);

-- ─── updated_at triggers ──────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'pos_registers','pos_transactions','pos_transaction_items','branch_inventory'
  ] loop
    execute format('drop trigger if exists set_updated_at on %I;', t);
    execute format('
      create trigger set_updated_at
        before update on %I
        for each row execute function update_updated_at();
    ', t);
  end loop;
end $$;

-- ─── RLS (universal workspace-isolation pattern) ──────────
alter table pos_registers         enable row level security;
alter table pos_transactions      enable row level security;
alter table pos_transaction_items enable row level security;
alter table branch_inventory      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'pos_registers','pos_transactions','pos_transaction_items','branch_inventory'
  ] loop
    execute format('drop policy if exists "workspace_select" on %I;', t);
    execute format('drop policy if exists "workspace_insert" on %I;', t);
    execute format('drop policy if exists "workspace_update" on %I;', t);
    execute format('drop policy if exists "workspace_delete" on %I;', t);
    execute format('
      create policy "workspace_select" on %I
        for select using (is_workspace_member(workspace_id));
      create policy "workspace_insert" on %I
        for insert with check (is_workspace_member(workspace_id));
      create policy "workspace_update" on %I
        for update using (is_workspace_member(workspace_id));
      create policy "workspace_delete" on %I
        for delete using (is_workspace_admin(workspace_id));
    ', t, t, t, t);
  end loop;
end $$;

-- ─── Grants (belt-and-braces; default privileges normally cover this) ──
grant all on pos_registers, pos_transactions, pos_transaction_items, branch_inventory
  to anon, authenticated, service_role;
