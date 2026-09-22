-- Step 18: profiles stop being public.
--
-- Run this only once 0016 is applied AND the app that uses its two functions is
-- deployed. In between, the old bundle would be reading a table it can no longer
-- see, and the sign-up form would stop noticing that an address is already taken.
--
-- Nothing else needs another person's row from the browser. Names on a roster come
-- from the event's own JSON, not from here, and everything on the server side runs
-- with the service key, which RLS does not apply to: the reminder mailer, the Stripe
-- webhook, the admin plan endpoint and account deletion all carry on unchanged.

drop policy if exists "profiles are readable by anyone" on public.profiles;

create policy "you may only read your own profile"
on public.profiles for select
using (auth.uid() = id);
