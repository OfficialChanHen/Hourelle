-- Step 17: profiles stop being readable by anyone.
--
-- Safe to run more than once, and it expects to be: it was applied in pieces on
-- 2026-09-22 and then folded back into one file. Every statement below either
-- replaces what is there or drops it first, so running this against a database that
-- already has it changes nothing except the one grant that was wrong.
--
-- ── what was open ──
-- `profiles` carried "readable by anyone" from 0002, written when the row held a
-- name and a colour and that was the whole of it. The row grew: the email address,
-- then the terms version (0011), the plan and the Plus waiting-list stamp (0012),
-- the Stripe customer (0014). The policy never grew with it. The anon key that
-- unlocks the REST endpoint ships in every browser bundle, because that is what an
-- anon key is for and row level security is meant to be the thing standing behind
-- it, so `GET /rest/v1/profiles?select=email` answered with every address on the
-- service to anyone who asked.
--
-- The other `using (true)` policies (events, messages, availability, votes) are the
-- share-link model and are meant to be open. This one was not.
--
-- ── what replaces it ──
-- Exactly two lookups need somebody else's row from the browser, so each gets a
-- function instead of the table. `security definer` runs them as the owner, so they
-- see what the caller no longer can; pinning `search_path` is the guard that goes
-- with that, so neither can be pointed at someone else's tables.

-- Does an address already have an account? The sign-up form asks before it creates
-- anything, because Supabase hides a duplicate sign-up behind a pretend success and
-- sends the person off to wait for a mail that never comes. This answers callers
-- without a session, since that is exactly when the form asks, and it gives back
-- nothing but yes or no. It tells an outsider whether an address is registered,
-- which the old table read did too; the difference is that it is now one bit
-- instead of a row.
create or replace function public.email_has_account(addr text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where email = lower(btrim(addr))
  );
$$;

-- The account behind an address, for inviting by email, so a person who already has
-- an account joins under their own name rather than one made up from their address.
-- Exact matches only, no browsing, and the email and the plan never come back out.
create or replace function public.profile_by_email(addr text)
returns table (id uuid, name text, color text, color_set boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.color, p.color_set
  from public.profiles p
  where p.email = lower(btrim(addr))
  limit 1;
$$;

-- ── who may call them ──
-- Revoking from PUBLIC is not enough on its own. Supabase ships a default privilege
-- in this schema that grants execute on every new function straight to `anon` and
-- `authenticated`, by name, and a grant held by name is not touched by revoking from
-- PUBLIC. That is how `profile_by_email` first went live callable without a session.
-- So each role that should not have it is named.
revoke all on function public.email_has_account(text) from public;
grant execute on function public.email_has_account(text) to anon, authenticated;

revoke all on function public.profile_by_email(text) from public;
revoke execute on function public.profile_by_email(text) from anon;
grant execute on function public.profile_by_email(text) to authenticated;

-- ── and the table closes ──
-- Nothing else in the browser wants another person's row: names on a roster come
-- from the event's own JSON, not from here. Everything server side carries the
-- service key, which row level security does not apply to, so the reminder mailer,
-- the Stripe webhook, the admin plan endpoint and account deletion are unaffected.
-- The insert and update policies from 0002 were already scoped to the owner and are
-- left alone.
drop policy if exists "profiles are readable by anyone" on public.profiles;
drop policy if exists "you may only read your own profile" on public.profiles;

create policy "you may only read your own profile"
on public.profiles for select
using (auth.uid() = id);
