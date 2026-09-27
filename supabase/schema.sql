-- =============================================================================
-- Hakiki — Supabase schema (PostgreSQL / Supabase SQL Editor ready)
-- =============================================================================
-- Safe to re-run: fresh installs get everything from the CREATE TABLE blocks;
-- existing installs get the new columns/table via the ALTER/CREATE IF NOT
-- EXISTS statements below.
--
-- Notes:
--   * gen_random_uuid() / gen_random_bytes() require pgcrypto (built into PG13+).
--   * The payment trigger is SECURITY DEFINER so its internal UPDATE on
--     `transactions` is not blocked by RLS (there is no client UPDATE policy).
--   * `payments` and `audit_events` have no INSERT/UPDATE/DELETE policies, so
--     only the service role (Edge Functions) can write to them — clients may
--     only SELECT their own rows.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. transactions
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                     uuid primary key default gen_random_uuid(),
  seller_id              uuid not null references auth.users (id) on delete cascade,
  item_name              text not null,
  item_description       text,
  item_photo_url         text,
  total_amount           numeric not null check (total_amount >= 0),
  -- Structured order lines, e.g. [{"name":"Black Hoodie","quantity":2,"unit_price":1500}].
  -- Kept as jsonb (not a separate table) — this is a single order per link, not
  -- a multi-order cart, so a relational items table would add joins with no
  -- real benefit at this scale.
  items                  jsonb not null default '[]'::jsonb,
  delivery_fee           numeric not null default 0 check (delivery_fee >= 0),
  -- The merchant's original conversational input, if the order was created via
  -- AI extraction (FR2). Null when the order was entered manually.
  raw_order_text         text,
  ai_extracted           boolean not null default false,
  -- buyer phone is stored encrypted (app-layer or pgp_pub_encrypt) + last4 only
  buyer_phone_encrypted  text not null,
  buyer_phone_last4      text not null check (char_length(buyer_phone_last4) = 4),
  buyer_verified         boolean not null default false,
  buyer_verified_at      timestamptz,
  status                 text not null default 'awaiting_verification'
                           check (status in (
                             'awaiting_verification',
                             'verified',
                             'partially_paid',
                             'fully_paid',
                             'expired',
                             'cancelled'
                           )),
  link_token             text not null unique default gen_random_uuid()::text,
  link_expires_at        timestamptz not null,
  transaction_hash       text,
  blockchain_tx_id       text,
  -- Set by complete-payment when a payment doesn't cleanly reconcile against
  -- the order (FR7/FR12). Flag, never silently reject or auto-accuse.
  payment_mismatch       boolean not null default false,
  anomaly_flags          jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now()
);

-- Upgrade path for installs created before this schema version.
alter table public.transactions add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.transactions add column if not exists delivery_fee numeric not null default 0;
alter table public.transactions add column if not exists raw_order_text text;
alter table public.transactions add column if not exists ai_extracted boolean not null default false;
alter table public.transactions add column if not exists payment_mismatch boolean not null default false;
alter table public.transactions add column if not exists anomaly_flags jsonb not null default '[]'::jsonb;

create index if not exists idx_transactions_seller_id
  on public.transactions (seller_id);
create index if not exists idx_transactions_link_token
  on public.transactions (link_token);
create index if not exists idx_transactions_status
  on public.transactions (status);

-- -----------------------------------------------------------------------------
-- 2. payments (append-only ledger)
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  transaction_id    uuid not null references public.transactions (id) on delete cascade,
  amount            numeric not null check (amount >= 0),
  loop_reference_id text not null,
  status            text not null
                      check (status in ('pending', 'completed', 'failed')),
  payment_hash      text,
  blockchain_tx_id  text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_payments_transaction_id
  on public.payments (transaction_id);
create index if not exists idx_payments_status
  on public.payments (status);

-- -----------------------------------------------------------------------------
-- 3. audit_events — accountability trail (FR8)
-- -----------------------------------------------------------------------------
-- One append-only row per meaningful thing that happened to a transaction:
-- order_created, ai_extracted, buyer_verified, payment_verified,
-- anomaly_flagged, hash_recorded, cancelled, etc. Written only by Edge
-- Functions (service role) so the trail can't be edited by a client.
create table if not exists public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions (id) on delete cascade,
  event_type      text not null,
  message         text,
  meta            jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_events_transaction_id
  on public.audit_events (transaction_id);

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------

-- transactions: sellers manage only their own rows
alter table public.transactions enable row level security;

drop policy if exists "sellers_select_own_transactions" on public.transactions;
create policy "sellers_select_own_transactions"
  on public.transactions
  for select
  using (seller_id = auth.uid());

drop policy if exists "sellers_insert_own_transactions" on public.transactions;
create policy "sellers_insert_own_transactions"
  on public.transactions
  for insert
  with check (seller_id = auth.uid());

drop policy if exists "sellers_update_own_transactions" on public.transactions;
create policy "sellers_update_own_transactions"
  on public.transactions
  for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- payments: sellers may only READ payments linked to their own transactions.
-- No INSERT/UPDATE/DELETE policies => clients cannot write; service role only.
alter table public.payments enable row level security;

drop policy if exists "sellers_select_own_payments" on public.payments;
create policy "sellers_select_own_payments"
  on public.payments
  for select
  using (
    exists (
      select 1
      from public.transactions t
      where t.id = payments.transaction_id
        and t.seller_id = auth.uid()
    )
  );

-- audit_events: same read model as payments.
alter table public.audit_events enable row level security;

drop policy if exists "sellers_select_own_audit_events" on public.audit_events;
create policy "sellers_select_own_audit_events"
  on public.audit_events
  for select
  using (
    exists (
      select 1
      from public.transactions t
      where t.id = audit_events.transaction_id
        and t.seller_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Automation: recompute transaction payment status from completed payments
-- -----------------------------------------------------------------------------
create or replace function public.update_transaction_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_paid  numeric;
begin
  -- Only act when a payment becomes 'completed' (insert or status transition).
  if (tg_op = 'INSERT' and new.status <> 'completed')
     or (tg_op = 'UPDATE' and old.status = new.status)
     or (tg_op = 'UPDATE' and new.status <> 'completed') then
    return new;
  end if;

  select t.total_amount
    into v_total
    from public.transactions t
   where t.id = new.transaction_id;

  if not found then
    return new;
  end if;

  select coalesce(sum(p.amount), 0)
    into v_paid
    from public.payments p
   where p.transaction_id = new.transaction_id
     and p.status = 'completed';

  -- Do not override terminal states (cancelled / expired).
  if v_paid <= 0 then
    -- nothing paid yet; leave status as-is
    return new;
  elsif v_paid < v_total then
    update public.transactions t
       set status = 'partially_paid'
     where t.id = new.transaction_id
       and t.status not in ('fully_paid', 'cancelled', 'expired');
  else
    update public.transactions t
       set status = 'fully_paid'
     where t.id = new.transaction_id
       and t.status not in ('cancelled', 'expired');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_update_transaction_payment_status on public.payments;
create trigger trg_update_transaction_payment_status
  after insert or update of status
  on public.payments
  for each row
  execute function public.update_transaction_payment_status();

-- -----------------------------------------------------------------------------
-- 6. Public, anonymous transaction lookup (buyer landing page)
-- -----------------------------------------------------------------------------
-- Anon buyers cannot SELECT `transactions` (RLS only allows the seller). This
-- SECURITY DEFINER RPC bypasses RLS AND intentionally returns a narrowed,
-- non-PII projection: it omits buyer_phone_encrypted / buyer_phone_last4 so the
-- buyer landing page never renders any buyer-identifying information. It also
-- inlines the sum of completed payments as `paid_amount`.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_transaction_by_token(token text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'id',                t.id,
    'item_name',         t.item_name,
    'item_description',  t.item_description,
    'item_photo_url',    t.item_photo_url,
    'items',             t.items,
    'delivery_fee',      t.delivery_fee,
    'total_amount',      t.total_amount,
    'status',            t.status,
    'link_expires_at',   t.link_expires_at,
    'transaction_hash',  t.transaction_hash,
    'paid_amount',       coalesce((
      select sum(p.amount)
      from public.payments p
      where p.transaction_id = t.id and p.status = 'completed'
    ), 0)
  )
  from public.transactions t
  where t.link_token = token;
$$;

grant execute on function public.get_public_transaction_by_token(text) to anon;
