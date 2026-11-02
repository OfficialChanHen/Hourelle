-- Step 20: repeating plans are the host's to set.
--
-- A host can turn on "Repeat every week" on a locked plan; once it is over, the
-- host's app opens next week's plan and records it on this one (`repeat.nextId`).
-- The new plan carries `repeatOf` and `lastAnswers`, everyone's answers from the
-- week before, offered on the grid as a starting point. All three live in the event
-- document, so no column is needed; this adds them to the fields only a host may
-- change, so a guest cannot stop a club's series or rewrite what it offers.
--
-- The function is 0015's with that one check added. Safe to run more than once.

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

  -- a weekly series: whether it repeats, which plan it came from, and the last
  -- answers it offers each person are written by the host's app alone
  if new.data->'repeat' is distinct from old.data->'repeat'
     or new.data->>'repeatOf' is distinct from old.data->>'repeatOf'
     or new.data->'lastAnswers' is distinct from old.data->'lastAnswers' then
    raise exception 'Only the host can change how this event repeats';
  end if;

  -- availability, votes, messages, participants and the itinerary are deliberately
  -- absent from this list: that is the collaboration the app exists for
  return new;
end $$;

-- the trigger itself is unchanged; replacing the function is enough
