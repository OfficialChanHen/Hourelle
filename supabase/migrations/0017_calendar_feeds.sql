-- Step 18: your locked-in plans as one calendar you subscribe to.
--
-- Each account can have one secret feed address. Google Calendar, Outlook or Apple
-- Calendar fetch it on their own schedule and show every locked-in plan you are on.
-- A plan that locks again moves there, and one that reopens or that you said you
-- cannot make leaves on their next fetch.
--
-- The token is the whole permission: anyone holding the address can read the titles,
-- times and places in it, the same way a share link reads one plan. So it is long and
-- random, it can be reset (the old address stops answering at once), and nobody can
-- read this table from a browser. The server mints, rotates and looks it up with the
-- service key; there are no browser policies on purpose.
--
-- Safe to run more than once.

create table if not exists public.calendar_feeds (
  user_id    uuid primary key references auth.users on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;
