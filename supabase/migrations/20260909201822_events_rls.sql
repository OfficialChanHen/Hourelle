-- Phase 4, step 5: real rules on events.
-- Until now one policy said `using (true)` for everything, which was honest about
-- the app's model (whoever has the link is in) but enforced nothing. Now that
-- accounts exist, the host's powers become database rules instead of TypeScript
-- conventions — so they hold even against someone using the anon key by hand.
--
-- Two mechanisms, doing two different jobs:
--   * a POLICY decides which ROWS you may read, insert, update or delete
--   * a TRIGGER decides which FIELDS inside a row you may change
-- A policy alone cannot express the second, because its `with check` sees only the
-- new row and never the old one. That is why "only the host edits the budget" needs
-- a trigger, where OLD and NEW sit side by side.

/* ── 1. the host becomes a real column ── */

-- It lived inside the jsonb document as the participant flagged `host`, which is
-- unreachable from a policy without digging. A column can be indexed, constrained,
-- and compared to auth.uid() directly — the promotion predicted in the last doc.
alter table public.events add column host_id uuid references auth.users on delete set null;
create index events_host_id_idx on public.events (host_id);

-- Backfill from the document for events that already have a signed-in host. Events
-- made before accounts existed keep a null host_id and stay open to anyone with the
-- link, exactly as they are today.
update public.events e
set host_id = sub.hid
from (
  select ev.id, (p->>'id')::uuid as hid
  from public.events ev, jsonb_array_elements(ev.data->'participants') p
  where p->>'host' = 'true'
    and p->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
) sub
where e.id = sub.id;

/* ── 2. row policies: who may touch which rows ── */

drop policy if exists "anyone with the anon key" on public.events;

-- Reading stays open: the share link is the invitation, and guests have no account
-- to check. Unguessable slugs are what make this safe, which is why the roadmap
-- replaces title-derived ids with real tokens in the guest-sessions step.
create policy "anyone with the link may read"
on public.events for select
using (true);

-- You may only create events you host. Signed out, host_id is null and the event is
-- ownerless — the same deal the app has always offered people without accounts.
create policy "you may only create your own events"
on public.events for insert
with check (host_id is null or auth.uid() = host_id);

-- Anyone with the link may attempt an update, because that is how guests mark
-- availability, vote and chat. What they may actually change is the trigger's job.
create policy "anyone with the link may edit the collaborative parts"
on public.events for update
using (true)
with check (true);

-- Deleting is final and belongs to the host alone. (Guests "leave" an event, which
-- only removes their own copy and never touches this table.)
create policy "only the host may delete"
on public.events for delete
using (host_id is null or auth.uid() = host_id);

/* ── 3. the field rules, where OLD and NEW meet ── */

create or replace function public.enforce_event_rules()
returns trigger
language plpgsql
as $$
declare
  is_host boolean := old.host_id is not null and auth.uid() = old.host_id;
  ownerless boolean := old.host_id is null;
begin
  -- Direct SQL (the dashboard editor, migrations, a service-role key) carries no
  -- JWT, so there is no "who" to check. Those callers are trusted by definition and
  -- pass straight through; every browser request has claims and is judged below.
  if current_setting('request.jwt.claims', true) is null then
    return new;
  end if;

  -- an event's host may only ever be set by that host
  if new.host_id is distinct from old.host_id and not is_host and not ownerless then
    raise exception 'Only the host can hand over an event';
  end if;

  -- the host, and anyone editing an ownerless event, may change anything
  if is_host or ownerless then
    return new;
  end if;

  -- everyone else may only touch the collaborative parts of the document
  if new.data->>'budget' is distinct from old.data->>'budget'
     or new.data->>'budgetMode' is distinct from old.data->>'budgetMode' then
    raise exception 'Only the host can change the budget';
  end if;

  if new.data->>'title' is distinct from old.data->>'title'
     or new.data->>'description' is distinct from old.data->>'description'
     or new.data->>'startDate' is distinct from old.data->>'startDate'
     or new.data->>'endDate' is distinct from old.data->>'endDate'
     or new.data->>'timezone' is distinct from old.data->>'timezone' then
    raise exception 'Only the host can change the event details';
  end if;

  if new.data->'confirmed' is distinct from old.data->'confirmed'
     or new.data->>'status' is distinct from old.data->>'status' then
    raise exception 'Only the host can lock in or reopen the plan';
  end if;

  -- availability, votes, messages, participants and the itinerary are deliberately
  -- absent from this list: that is the collaboration the app exists for
  return new;
end $$;

create trigger events_enforce_rules
before update on public.events
for each row execute function public.enforce_event_rules();
