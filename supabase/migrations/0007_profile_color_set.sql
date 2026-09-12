-- Phase 10 follow-up: a colour the person picked, as opposed to the one they were dealt.
--
-- Every profile is dealt a random avatar colour at sign-up (see handle_new_user in
-- 0002). That is fine as a default, but the app now hands each new face on an event
-- a colour nobody near them wears, and a dealt colour must not win over that. A
-- colour the person chose in their profile does win, everywhere, every time.
-- This flag is what tells the two apart. It is set by the profile page and read
-- into the account cache; nothing else touches it.
alter table public.profiles
  add column if not exists color_set boolean not null default false;
