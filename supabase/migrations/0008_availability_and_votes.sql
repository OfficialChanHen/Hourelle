-- Step 11: availability and the ballot leave the event document.
--
-- Chat went first (0004) and the reasoning here is the same, only sharper. Until now
-- a person marking their times rewrote events.data whole — their answer AND everyone
-- else's — so two people answering in the same moment overwrote each other and the
-- one who saved second won, silently. Live updates narrowed the window. A narrow
-- race is still a race.
--
-- One row per person per event is the shape that ends it: you only ever write your
-- own row, so there is nothing to collide with. The ballot is the same idea one
-- level finer — a row is "this person voted for this place", inserted and deleted
-- rather than rewritten.

create table public.availability (
  event_id       text not null references public.events (id) on delete cascade,
  participant_id text not null,   -- an account id, or a guest's device-local id
  -- dayKey -> [{s, e}], minutes from the top of the grid: exactly the shape the
  -- client already keeps. One person's answer, whole. Nobody else's is in here.
  intervals      jsonb not null default '{}'::jsonb,
  -- the explicit empty reply, "none of these days work" — not the same fact as
  -- silence, so it needs somewhere of its own to live
  unavailable    boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (event_id, participant_id)
);
create index availability_event_idx on public.availability (event_id);

create table public.votes (
  event_id       text not null references public.events (id) on delete cascade,
  place_id       text not null,
  participant_id text not null,
  created_at     timestamptz not null default now(),
  primary key (event_id, place_id, participant_id)
);
create index votes_event_idx on public.votes (event_id);

-- The link is the permission, the same bargain the event and the chat already make.
-- A guest has no account for the database to check, so these rules cannot say "only
-- your own row" without inventing an identity that does not exist; what protects a
-- row is that an event id is not guessable. Unlike the chat these are edits rather
-- than appends, so update and delete are open too.
alter table public.availability enable row level security;
alter table public.votes enable row level security;

create policy "anyone with the link may read availability"
on public.availability for select using (true);
create policy "anyone with the link may mark their times"
on public.availability for insert with check (true);
create policy "anyone with the link may change their times"
on public.availability for update using (true) with check (true);
create policy "anyone with the link may clear their times"
on public.availability for delete using (true);

create policy "anyone with the link may read the ballot"
on public.votes for select using (true);
create policy "anyone with the link may vote"
on public.votes for insert with check (true);
create policy "anyone with the link may take a vote back"
on public.votes for delete using (true);

alter publication supabase_realtime add table public.availability;
alter publication supabase_realtime add table public.votes;

-- A delete sends only the primary key unless the row is published whole, and the
-- client needs the event id to know which cached event a vanished vote belongs to.
alter table public.availability replica identity full;
alter table public.votes replica identity full;

-- ── move what is already in the documents into rows ──
-- Direct SQL carries no JWT, so the events trigger lets the emptying through.

-- availIv is dayKey -> participantId -> intervals; a row is per participant, so the
-- two inner keys swap places on the way in.
insert into public.availability (event_id, participant_id, intervals)
select e.id, p.pid, jsonb_object_agg(d.day_key, p.ivs)
from public.events e
  cross join lateral jsonb_each(
    case when jsonb_typeof(e.data->'availIv') = 'object' then e.data->'availIv' else '{}'::jsonb end
  ) as d(day_key, by_pid)
  cross join lateral jsonb_each(
    case when jsonb_typeof(d.by_pid) = 'object' then d.by_pid else '{}'::jsonb end
  ) as p(pid, ivs)
group by e.id, p.pid
on conflict (event_id, participant_id) do nothing;

-- "none of these days work" can name someone with no intervals at all, so it runs
-- as its own pass and updates the row the first pass may already have made
insert into public.availability (event_id, participant_id, unavailable)
select e.id, u.pid, true
from public.events e
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(e.data->'unavailableIds') = 'array' then e.data->'unavailableIds' else '[]'::jsonb end
  ) as u(pid)
on conflict (event_id, participant_id) do update set unavailable = true;

insert into public.votes (event_id, place_id, participant_id)
select e.id, v.place_id, x.pid
from public.events e
  cross join lateral jsonb_each(
    case when jsonb_typeof(e.data->'votes') = 'object' then e.data->'votes' else '{}'::jsonb end
  ) as v(place_id, pids)
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(v.pids) = 'array' then v.pids else '[]'::jsonb end
  ) as x(pid)
on conflict (event_id, place_id, participant_id) do nothing;

-- ── and out of the documents, so nothing writes them by accident again ──
-- `avail` deliberately stays. It is the pre-minute-precision per-cell view, and on an
-- event old enough to have only that, it is the only copy of those answers. The
-- client treats it as the floor: a participant with a row uses the row, a participant
-- without one still reads from `avail`. Nothing writes it any more, so it ages out as
-- people answer again.
update public.events
set data = data - 'availIv' - 'votes' - 'unavailableIds'
where data ?| array['availIv', 'votes', 'unavailableIds'];
