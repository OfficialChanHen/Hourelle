-- Phase 9: email.
-- Two small additions so invites, nudges and reminders can go out without ever
-- going out twice, and so an account can say which reminders it wants.

/* ── 1. every email the app sends leaves a row ── */

-- The key is the whole story of a send: event, person, kind, and (for anything
-- scheduled) the day it belongs to. It is unique, so a second attempt to send the
-- same thing is refused by the database before any mail is sent — which is what
-- makes the reminder job safe to run as often as you like.
create table public.email_log (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,        -- "<event>:<participant>:<kind>[:<day>]"
  event_id       text not null,               -- not a foreign key: a deleted event keeps its history
  participant_id text not null,
  kind           text not null,               -- invite | nudge | event-eve | event-day | plan-eve | plan-day | vote-eve | vote-day | rsvp-eve | rsvp-day
  to_email       text not null,
  ok             boolean not null default false,
  error          text,
  sent_at        timestamptz not null default now()
);

create index email_log_event_idx on public.email_log (event_id);

-- Only the server writes here, with the service key, and nobody reads it from a
-- browser: RLS on with no policies at all closes it to the anon key entirely.
alter table public.email_log enable row level security;

/* ── 2. which reminders an account wants ── */

-- The Settings switches used to live only in localStorage. The reminder job runs on
-- a server with no access to anyone's browser, so the choice has to live where the
-- job can read it. Same shape as NotifyPrefs in src/lib/prefs.ts.
alter table public.profiles
  add column reminders jsonb not null default '{"eventDay": true, "deadlines": true, "replies": false}'::jsonb;
