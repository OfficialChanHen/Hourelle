-- Step 15: the host's answers are the host's alone, at the database too.
--
-- 0003 taught the events trigger which parts of a document only a host may change:
-- the title, the dates, the budget, the lock-in. A few host decisions were never on
-- that list, and the grid's settings panel offered two of them to everybody: how
-- long the event needs, and what the "best" window should favour. A guest changing
-- either of those changed the plan for everyone, and nothing refused it.
--
-- The panel now shows them to the host only, and this makes that true rather than
-- merely displayed. Availability, votes, messages, participants and the itinerary
-- stay deliberately absent: that is the collaboration the app exists for.
--
-- Safe to run more than once.

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

  -- how the question itself is set up: the length the plan needs, what the best
  -- window favours, the size of the room, how many votes each person gets, whether
  -- the ballot is secret, and the dates the host set to have things answered by
  if new.data->>'durationMin' is distinct from old.data->>'durationMin'
     or new.data->>'bestMode' is distinct from old.data->>'bestMode'
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

  -- availability, votes, messages, participants and the itinerary are deliberately
  -- absent from this list: that is the collaboration the app exists for
  return new;
end $$;

-- the trigger itself is unchanged; replacing the function is enough
