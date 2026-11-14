-- Step 23: the link is the permission, and only the link.
--
-- Until now the share-link tables said `using (true)`: the comment was "an event id
-- is not guessable", and an id minted since 0003 is not. But `using (true)` never
-- asked for the id. Anyone holding the public anon key (every browser has it) could
-- ask PostgREST for `events?select=*` and get every plan, guest emails included, and
-- the same for the chat, the answers and the ballot. The open update and delete
-- policies on availability and votes let one request clear every plan's marks.
--
-- Now a row is reachable only by naming it:
--   * the browser sends the plan ids it is asking about in an `x-event-ids` header
--     (comma separated; lib/remote.ts adds it to every query), and a policy admits
--     an event only when its id is in that list. Knowing the id is still the
--     permission, as it always was meant to be, but nothing can be listed;
--   * a signed-in account also reaches the plans it hosts or is on, by account id
--     or by its verified email, without naming them;
--   * answers, votes and chat are reachable only through an event the caller can
--     reach (event_reachable, which reads events under the caller's own policies).
--
-- Live updates move off postgres_changes, which carried whole documents, onto a
-- public broadcast topic per plan, `ev:<id>`, carrying only "this table changed".
-- The browser fetches what changed through the scoped queries above. A topic is as
-- secret as the id in its name, and a ping holds nothing worth stealing or faking.
--
-- Order matters: deploy the app that sends the header first, then run this. A
-- browser still on the old app would see no plans until it reloads.
-- Safe to run more than once.

/* ── which plans this request names ── */
create or replace function public.linked_event_ids()
returns text[]
language sql
stable
as $$
  select coalesce(
    string_to_array(
      nullif(nullif(current_setting('request.headers', true), '')::json->>'x-event-ids', ''),
      ','
    ),
    '{}'::text[]
  )
$$;

/* ── the account's own plans: hosted, or on the list by id or by email ── */
create or replace function public.event_is_mine(host uuid, doc jsonb)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null and (
    host = auth.uid()
    or doc->'participants' @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
    or (
      coalesce(auth.email(), '') <> ''
      and doc->'participants' @> jsonb_build_array(jsonb_build_object('email', lower(auth.email())))
    )
  )
$$;

/* ── an event the caller may see, judged by the events policies themselves ──
   security invoker on purpose: the lookup runs under the caller's own row level
   security, so "reachable" means exactly "the select policy on events admits it". */
create or replace function public.event_reachable(eid text)
returns boolean
language sql
stable
security invoker
as $$
  select exists (select 1 from public.events e where e.id = eid)
$$;

/* ── events ── */
drop policy if exists "anyone with the link may read" on public.events;
drop policy if exists "named or yours may be read" on public.events;
create policy "named or yours may be read"
on public.events for select
using (id = any(public.linked_event_ids()) or public.event_is_mine(host_id, data));

-- The trigger (enforce_event_rules) still decides which parts a non-host may change.
drop policy if exists "anyone with the link may edit the collaborative parts" on public.events;
drop policy if exists "named or yours may be edited" on public.events;
create policy "named or yours may be edited"
on public.events for update
using (id = any(public.linked_event_ids()) or public.event_is_mine(host_id, data))
with check (true);

-- An ownerless event (made signed out) has no host to check, so whoever holds its
-- link may delete it; before, anyone could delete every ownerless event at once.
drop policy if exists "only the host may delete" on public.events;
drop policy if exists "the host, or a named ownerless event, may be deleted" on public.events;
create policy "the host, or a named ownerless event, may be deleted"
on public.events for delete
using (
  (host_id is not null and auth.uid() = host_id)
  or (host_id is null and id = any(public.linked_event_ids()))
);

/* ── chat ── */
drop policy if exists "anyone with the link may read the chat" on public.messages;
drop policy if exists "anyone with the link may post" on public.messages;
drop policy if exists "a reachable plan's chat may be read" on public.messages;
drop policy if exists "a reachable plan's chat may be posted to" on public.messages;
create policy "a reachable plan's chat may be read"
on public.messages for select using (public.event_reachable(event_id));
create policy "a reachable plan's chat may be posted to"
on public.messages for insert with check (public.event_reachable(event_id));

/* ── availability ── */
drop policy if exists "anyone with the link may read availability" on public.availability;
drop policy if exists "anyone with the link may mark their times" on public.availability;
drop policy if exists "anyone with the link may change their times" on public.availability;
drop policy if exists "anyone with the link may clear their times" on public.availability;
drop policy if exists "a reachable plan's times may be read" on public.availability;
drop policy if exists "a reachable plan's times may be marked" on public.availability;
drop policy if exists "a reachable plan's times may be changed" on public.availability;
drop policy if exists "a reachable plan's times may be cleared" on public.availability;
create policy "a reachable plan's times may be read"
on public.availability for select using (public.event_reachable(event_id));
create policy "a reachable plan's times may be marked"
on public.availability for insert with check (public.event_reachable(event_id));
create policy "a reachable plan's times may be changed"
on public.availability for update using (public.event_reachable(event_id)) with check (public.event_reachable(event_id));
create policy "a reachable plan's times may be cleared"
on public.availability for delete using (public.event_reachable(event_id));

/* ── votes ── */
drop policy if exists "anyone with the link may read the ballot" on public.votes;
drop policy if exists "anyone with the link may vote" on public.votes;
drop policy if exists "anyone with the link may take a vote back" on public.votes;
drop policy if exists "a reachable plan's ballot may be read" on public.votes;
drop policy if exists "a reachable plan's ballot may be voted on" on public.votes;
drop policy if exists "a reachable plan's votes may be taken back" on public.votes;
create policy "a reachable plan's ballot may be read"
on public.votes for select using (public.event_reachable(event_id));
create policy "a reachable plan's ballot may be voted on"
on public.votes for insert with check (public.event_reachable(event_id));
create policy "a reachable plan's votes may be taken back"
on public.votes for delete using (public.event_reachable(event_id));

/* ── feedback goes through /api/feedback only ──
   The route writes with the service key after checking who is asking and how
   often. Left open, the anon key could fill the table directly, past both. */
drop policy if exists "anyone may file feedback" on public.feedback;

/* ── pings: "something on this plan changed", and nothing else ──
   security definer so the trigger may write to realtime.messages whoever made the
   change. A failed send (realtime not ready, a partition not made yet) must never
   fail the write that caused it, so it is swallowed. */
create or replace function public.ping_event_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  eid text := case when tg_table_name = 'events' then rec->>'id' else rec->>'event_id' end;
  body jsonb := jsonb_build_object('t', tg_table_name, 'op', tg_op);
begin
  begin
    perform realtime.send(body, 'change', 'ev:' || eid, false);
  exception when others then
    null;
  end;
  return null;
end $$;

revoke all on function public.ping_event_change() from public, anon, authenticated;

drop trigger if exists events_ping on public.events;
create trigger events_ping after insert or update or delete on public.events
for each row execute function public.ping_event_change();
drop trigger if exists messages_ping on public.messages;
create trigger messages_ping after insert or delete on public.messages
for each row execute function public.ping_event_change();
drop trigger if exists availability_ping on public.availability;
create trigger availability_ping after insert or update or delete on public.availability
for each row execute function public.ping_event_change();
drop trigger if exists votes_ping on public.votes;
create trigger votes_ping after insert or update or delete on public.votes
for each row execute function public.ping_event_change();

/* ── the old whole-row channel is no longer listened to ── */
do $$
declare t text;
begin
  foreach t in array array['events', 'messages', 'availability', 'votes'] loop
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
