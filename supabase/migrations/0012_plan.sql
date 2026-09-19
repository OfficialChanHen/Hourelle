-- Step 13: which plan an account is on, and who asked to hear when Plus goes on
-- sale. Everyone is on Free until there is a checkout; the interest note is written
-- by the browser, best effort, and the app keeps working without these columns.
alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists plan_interest_at timestamptz;
