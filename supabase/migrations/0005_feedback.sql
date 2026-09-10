-- Bug reports and ideas from the Help page.
-- Every report is kept here whether or not an email goes out, so nothing is lost
-- to a mail outage or a missing key. Anyone may file one; nobody but the dashboard
-- (or a service key) may read them — there is no select policy on purpose.

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('bug', 'idea', 'question')),
  message     text not null check (char_length(message) between 1 and 4000),
  email       text,                                -- optional, for a reply
  page        text,                                -- where they were when they wrote it
  user_agent  text,
  account_id  uuid references auth.users on delete set null,
  emailed     boolean not null default false,      -- did a copy reach the inbox
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "anyone may file feedback"
on public.feedback for insert
with check (true);
