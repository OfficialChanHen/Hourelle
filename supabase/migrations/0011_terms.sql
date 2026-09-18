-- Step 12: when an account accepted the terms, and which version. Written by the
-- browser right after sign-up (or on the first session after a Google or Microsoft
-- sign-up), best effort: the app keeps working if this has not been applied yet.
alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;
