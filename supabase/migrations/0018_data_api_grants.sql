-- Step 19: API grants written down for the tables made before 2026-10-30.
--
-- Until 2026-10-30 Supabase granted every new table in public to anon, authenticated
-- and service_role on its own. The live database got those grants that way, so this
-- file changes nothing there. It is for a database rebuilt from these files (a new
-- project, a preview branch, `supabase db reset`), which would otherwise come up
-- with the tables out of reach of supabase-js and answer "permission denied".
--
-- The grants match what the live tables already hold. Row level security is still
-- what decides who sees and writes which rows, as it always has: guests write
-- availability, votes and messages as anon through the share-link policies, so anon
-- needs write grants on those, not only select.
--
-- Every table made from now on grants in its own migration (see 0017).
-- Safe to run more than once.

grant select, insert, update, delete on
  public.events,
  public.profiles,
  public.messages,
  public.feedback,
  public.email_log,
  public.availability,
  public.votes
to anon, authenticated, service_role;
