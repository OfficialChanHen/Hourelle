-- Phase 4, step 1: the first table.
-- One row per event, the whole AppEvent stored as a jsonb document. This mirrors
-- localStorage exactly (the UI's shapes stay the source of truth), which is what
-- makes the backend a swap instead of a rewrite. Later steps normalize hot pieces
-- (messages first) into their own tables when realtime needs per-row granularity.

create table public.events (
  id         text primary key,                -- the share slug the app already mints
  data       jsonb not null,                  -- the AppEvent, verbatim
  -- generated columns: read-only projections of the document, so SQL can filter
  -- and index without the app writing the same fact twice
  title      text generated always as (data->>'title') stored,
  status     text generated always as (coalesce(data->>'status', 'planning')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at honest on every write, in the database where it can't be forgotten
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger events_touch
before update on public.events
for each row execute function public.touch_updated_at();

-- Row-level security is ON from day one, with a deliberately open policy:
-- possession of the link is the whole permission model today, same as the UI.
-- Step 5 of the roadmap replaces this with real per-person rules (host edits
-- budget, guests can't) — the point now is that the switch is a policy change,
-- not an app change.
alter table public.events enable row level security;

create policy "anyone with the anon key"
on public.events for all
using (true)
with check (true);

-- let the realtime channel broadcast row changes for this table
alter publication supabase_realtime add table public.events;
