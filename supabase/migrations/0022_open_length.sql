-- Step 22: "length unknown" is the host's to set, like the length itself.
--
-- A plan can say its length is unknown (`openLength` in the event document): the
-- best time is then the start the most people can make and hold longest. It sits
-- beside `durationMin` in the grid's settings, which 0015 made host-only at the
-- database; this adds `openLength` to the same list, so a guest cannot change how the
-- best time is found for everyone. Co-hosts may change it, as they may the length.
--
-- 0020 (repeating plans) and 0021 (co-hosts) each replace the same function. This is
-- 0021's version with 0020's repeat check and the `openLength` check added, so it
-- keeps everything both of them do. Run it after 0020 and 0021; if either is run
-- again later, run this one again after it. It also defines 0021's helper, so it
-- works on a database where 0021 has not run yet. Safe to run more than once.

-- the ids flagged `flag` in a document's participants, sorted, as one jsonb array
create or replace function public.event_flagged_ids(doc jsonb, flag text)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(p->>'id' order by p->>'id'), '[]'::jsonb)
  from jsonb_array_elements(coalesce(doc->'participants', '[]'::jsonb)) p
  where p->>flag = 'true'
$$;

create or replace function public.enforce_event_rules()
returns trigger
language plpgsql
as $$
declare
  me text := auth.uid()::text;
  is_host boolean := old.host_id is not null and auth.uid() = old.host_id;
  ownerless boolean := old.host_id is null;
  is_cohost boolean := false;
  old_co jsonb;
  new_co jsonb;
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

  -- who hosts and who co-hosts is the host's call. Your own co-host flag may leave
  -- with you; nothing else on either list may change.
  if public.event_flagged_ids(new.data, 'host') is distinct from public.event_flagged_ids(old.data, 'host') then
    raise exception 'Only the host can change who hosts';
  end if;
  old_co := public.event_flagged_ids(old.data, 'cohost');
  new_co := public.event_flagged_ids(new.data, 'cohost');
  if new_co is distinct from old_co
     and (new_co - coalesce(me, '')) is distinct from (old_co - coalesce(me, ''))
     then
    raise exception 'Only the host can choose co-hosts';
  end if;
  if me is not null and not (old_co ? me) and (new_co ? me) then
    raise exception 'Only the host can choose co-hosts';
  end if;

  -- the budget is the host's alone, co-hosts included
  if new.data->>'budget' is distinct from old.data->>'budget'
     or new.data->>'budgetMode' is distinct from old.data->>'budgetMode' then
    raise exception 'Only the host can change the budget';
  end if;

  is_cohost := me is not null and old_co ? me;
  -- a co-host runs the rest of the plan the way the host does
  if is_cohost then
    return new;
  end if;

  -- everyone else may only touch the collaborative parts of the document
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

  -- how the question itself is set up: the length the plan needs, what the best
  -- window favours, the size of the room, how many votes each person gets, whether
  -- the ballot is secret, and the dates the host set to have things answered by
  if new.data->>'durationMin' is distinct from old.data->>'durationMin'
     or new.data->>'bestMode' is distinct from old.data->>'bestMode'
     or new.data->>'openLength' is distinct from old.data->>'openLength'
     or new.data->>'granularity' is distinct from old.data->>'granularity'
     or new.data->>'quorum' is distinct from old.data->>'quorum'
     or new.data->>'capacity' is distinct from old.data->>'capacity'
     or new.data->>'maxVotes' is distinct from old.data->>'maxVotes'
     or new.data->>'hideVoters' is distinct from old.data->>'hideVoters'
     or new.data->>'voteDeadline' is distinct from old.data->>'voteDeadline'
     or new.data->>'planDeadline' is distinct from old.data->>'planDeadline'
     or new.data->>'rsvpDeadline' is distinct from old.data->>'rsvpDeadline' then
    raise exception 'Only the host can change how this event is set up';
  end if;

  -- a repeating plan (0020): whether it repeats and which plan it came from are
  -- written by the host's app alone
  if new.data->'repeat' is distinct from old.data->'repeat'
     or new.data->>'repeatOf' is distinct from old.data->>'repeatOf' then
    raise exception 'Only the host can change how this event repeats';
  end if;

  -- availability, votes, messages, participants and the itinerary are deliberately
  -- absent from this list: that is the collaboration the app exists for
  return new;
end $$;

-- the trigger itself is unchanged; replacing the function is enough
