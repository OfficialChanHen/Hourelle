-- Step 17: the two questions the browser has to ask about somebody else's account,
-- answered by a function instead of by reading the table.
--
-- profiles has been readable by anyone since 0002, when the table held a name and a
-- colour and that was all of it. It holds an email address as well now, and since
-- then the plan, the Plus waiting-list stamp and the terms version have moved in
-- beside it. The anon key that unlocks all of that ships in every browser bundle, so
-- `using (true)` means anyone can ask the REST endpoint for every address on the
-- service. 0017 closes the table; this migration first gives the two lookups that
-- genuinely need another person's row a door each, so nothing breaks when it does.
--
-- `security definer` runs these as the function's owner, so they can still see a
-- table the caller no longer can. Pinning `search_path` is the standard guard that
-- goes with that, so neither can be tricked into reading someone else's tables.

-- Does an address already have an account? The sign-up form asks before it creates
-- anything, because Supabase hides a duplicate sign-up behind a pretend success and
-- sends the person off to wait for a mail that never arrives. It answers for callers
-- without a session, since that is exactly when the sign-up form asks, and it gives
-- back nothing but yes or no.
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

-- The account behind an address, for inviting by email: a person who already has an
-- account should join under their own name and colour rather than a name made up
-- from their address. Exact matches only, no browsing, and never the email or the
-- plan back out. Signed-in callers only, since inviting is something a host does.
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

-- a function is executable by everyone unless it is told otherwise, so say it
revoke all on function public.email_has_account(text) from public;
grant execute on function public.email_has_account(text) to anon, authenticated;

revoke all on function public.profile_by_email(text) from public;
grant execute on function public.profile_by_email(text) to authenticated;
