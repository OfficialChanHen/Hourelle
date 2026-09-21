-- Step 14: Hourelle Plus becomes a real thing.
--
-- 0012 added `plan` and `plan_interest_at` and nothing ever wrote to them. This
-- adds what a subscription needs: where the plan came from, who the account is at
-- Stripe, and when the current period runs out. The app keeps working with none of
-- it configured: with no Stripe keys every account reads as Free and no button to
-- pay is shown.
--
-- Safe to run more than once.

alter table public.profiles
  add column if not exists plan_source text not null default 'none',   -- none | stripe | comped
  add column if not exists plan_until timestamptz,                     -- end of the paid period, or when a comp expires
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists profiles_stripe_customer_idx on public.profiles (stripe_customer_id);

-- ── who may change a plan ──
-- Nobody, from a browser. The existing "accounts may update their own profile"
-- policy would otherwise let anyone set plan = 'plus' on themselves with one line
-- in the console. The plan columns are the server's alone: Stripe's webhook and
-- the comp route both use the service key, which bypasses row-level security.
create or replace function public.guard_plan_columns()
returns trigger
language plpgsql
as $$
begin
  -- direct SQL and the service key carry no JWT: those callers are trusted
  if current_setting('request.jwt.claims', true) is null then
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.plan_source is distinct from old.plan_source
     or new.plan_until is distinct from old.plan_until
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'A plan is set by the server, not by the browser';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_plan on public.profiles;
create trigger profiles_guard_plan
  before update on public.profiles
  for each row execute function public.guard_plan_columns();

-- ── giving Plus away ──
-- Run this in the SQL editor to comp an account, which is the same thing the
-- /api/admin/plan route does with the admin secret:
--
--   update public.profiles set plan = 'plus', plan_source = 'comped', plan_until = null
--   where email = 'someone@example.com';
--
-- and to take it back:
--
--   update public.profiles set plan = 'free', plan_source = 'none', plan_until = null
--   where email = 'someone@example.com';
