-- The rest of the plan's host-only fields, checked at the database too.
--
-- 0015 made the grid's settings host-only after a guest was found able to change them
-- for everyone. The same gap was still open for everything else the app shows only to
-- the host (and co-hosts): the screen hid the control, but a guest holding the anon
-- key could write the field straight into the document. The one that mattered most
-- is the meeting link, which goes out in every reminder: a guest could swap it for
-- an address of their own. Now refused for anyone who does not run the plan:
--   * who the host is shown as (`hostName`, `hostKind`); the host alone, like the
--     co-host list, since a co-host does not rename the host either
--   * the poll's days and rows (`days`, `times`), which move with the dates
--   * the cover and the card's detail (`image`, `imageFit`, `imagePos`, `keepsake`)
--   * how the place is answered and the online link (`location` apart from its
--     places, which guests add when the host lets them)
--   * the itinerary (`itinStops`, `itinDwell`, `itinRank`, `itinStartMin`,
--     `travelModes`)
--
-- The location is compared as the app reads it: a plan saved before 'set' existed
-- stores a fixed venue as mode 'vote' plus `settled`, and the app folds that into
-- 'set' before it writes, so a guest's save must not count as changing it. Absent
-- and empty read the same way for the link and the switches, since the app writes
-- them out in full.
--
-- The server's own writes pass again. Every guard since 0003 let a caller through
-- when `request.jwt.claims` was null, on the belief that the service key carries no
-- JWT. It does: PostgREST sets the claims for every request, the service key's
-- included (`"role": "service_role"`). So the server was judged like a guest:
-- deleting an account that co-hosts someone's plan failed on the co-host check (it
-- takes their flag off that plan), and 0014's plan guard refused the Stripe webhook
-- and the comp route. `trusted_caller()` now says yes to direct SQL (claims unset,
-- or empty on a pooled connection after an earlier request) and to the service
-- role (by the role the request runs as, or its claims); both guards ask it. A browser's claims are signed and say anon or
-- authenticated, so it cannot pass itself off as the server.
--
-- 0022's function with these checks added, so it keeps every rule 0020 (repeating
-- plans), 0021 (co-hosts) and 0022 (length unknown) made. Run it after them; it
-- defines 0021's helper too. Safe to run more than once.
--
-- includes: 0020_repeating_plans.sql

-- direct SQL (the dashboard editor, migrations) or the server's service key
create or replace function public.trusted_caller()
returns boolean
language sql
stable
as $$
  select current_user = 'service_role'
    or coalesce(current_setting('request.jwt.claims', true), '') = ''
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
$$;

-- 0014's guard, asking the same question
create or replace function public.guard_plan_columns()
returns trigger
language plpgsql
as $$
begin
  if public.trusted_caller() then
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.plan_source is distinct from old.plan_source
     or new.plan_until is distinct from old.plan_until
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'A plan is set by the server, not by the browser';
  end if;
  return new;
end $$;

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

-- the parts of a document's `location` only those who run the plan may change, as
-- the app reads them
create or replace function public.event_location_setup(doc jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'mode', case
      when loc->>'mode' = 'vote' and loc->>'settled' = 'true' then 'set'
      else loc->>'mode'
    end,
    'planMode', coalesce(loc->>'planMode', 'vote'),
    'meetingLink', coalesce(loc->>'meetingLink', ''),
    'platform', coalesce(loc->>'platform', ''),
    'hybrid', coalesce(loc->>'hybrid', 'false') = 'true',
    'guestsCanSuggest', coalesce(loc->>'guestsCanSuggest', 'false') = 'true'
  )
  from (select coalesce(doc->'location', '{}'::jsonb) as loc) l
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
  -- direct SQL and the server's service key are trusted by definition and pass
  -- straight through; every browser request is judged below
  if public.trusted_caller() then
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

  -- the name the plan shows as its host's is the host's own
  if new.data->>'hostName' is distinct from old.data->>'hostName'
     or new.data->>'hostKind' is distinct from old.data->>'hostKind' then
    raise exception 'Only the host can change who hosts';
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
     or new.data->>'timezone' is distinct from old.data->>'timezone'
     or new.data->'days' is distinct from old.data->'days'
     or new.data->'times' is distinct from old.data->'times' then
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

  -- the cover and the detail on the plan's card
  if new.data->>'image' is distinct from old.data->>'image'
     or new.data->>'imageFit' is distinct from old.data->>'imageFit'
     or new.data->'imagePos' is distinct from old.data->'imagePos'
     or new.data->>'keepsake' is distinct from old.data->>'keepsake' then
    raise exception 'Only the host can change the cover';
  end if;

  -- how the place is answered and the link to join online; the places themselves
  -- stay open, for guests the host lets add them
  if public.event_location_setup(new.data) is distinct from public.event_location_setup(old.data) then
    raise exception 'Only the host can change how the place is decided';
  end if;

  -- the itinerary: its stops, their order and length, when it starts, how people travel
  if new.data->'itinStops' is distinct from old.data->'itinStops'
     or new.data->'itinDwell' is distinct from old.data->'itinDwell'
     or new.data->'itinRank' is distinct from old.data->'itinRank'
     or new.data->>'itinStartMin' is distinct from old.data->>'itinStartMin'
     or new.data->'travelModes' is distinct from old.data->'travelModes' then
    raise exception 'Only the host can change the itinerary';
  end if;

  -- a repeating plan (0020): whether it repeats and which plan it came from are
  -- written by the host's app alone
  if new.data->'repeat' is distinct from old.data->'repeat'
     or new.data->>'repeatOf' is distinct from old.data->>'repeatOf' then
    raise exception 'Only the host can change how this event repeats';
  end if;

  -- availability, votes, messages, participants, places and expenses are deliberately
  -- absent from this list: that is the collaboration the app exists for
  return new;
end $$;

-- the trigger itself is unchanged; replacing the function is enough
