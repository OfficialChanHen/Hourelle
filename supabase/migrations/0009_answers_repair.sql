-- Step 12: put back what the documents lost, and pick up anything 0008 missed.
--
-- 0008 moved availability, the ballot and "none of these days work" out of the event
-- document and into rows. The client cut those three fields out of every document it
-- wrote from the same release — but it cut them whether or not the rows existed, and
-- on a database where 0008 had not been applied by hand yet that meant writing them
-- nowhere. The ballot and the explicit empty reply went with it; availability survived
-- only as `avail`, the per-cell view, where a block that ran to 8:20 reads as the whole
-- 8:00 slot. That is why a carefully set partial time came back filling its box.
--
-- The client no longer cuts them until the database has actually confirmed the rows are
-- there. This migration repairs what the earlier build wrote, and is safe to run whether
-- or not 0008 has been: every insert is idempotent and no existing row is overwritten.

-- ── 1. catch up on anything still sitting in a document ──
-- Same three passes as 0008. An event written since then may have picked the fields
-- back up, and on a database where 0008 never ran they are all still here.

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

-- ── 2. recover what is left only in `avail` ──
-- For anyone with no row at all, the per-cell grid is the only surviving copy of their
-- answer. It is coarser than what they marked — a slot is either theirs or not — but a
-- whole slot is far closer to the truth than nothing, and it is what the client has
-- been reading from that grid all along. One interval per marked slot; the client
-- coalesces touching ones as it reads, so they need no merging here.
--
-- `on conflict do nothing` is the whole safety of this pass: a participant who already
-- has a row keeps it, exact minutes and all. Only the ones with nothing are filled in.
with grid as (
  select
    e.id as event_id,
    d.day_key,
    x.pid,
    (c.ti - 1) * step.mins as s_min,
    c.ti * step.mins as e_min
  from public.events e
    cross join lateral (
      select case coalesce(e.data->>'granularity', '30')
               when 'day' then 1440
               when '15' then 15
               when '60' then 60
               else 30
             end as mins
    ) as step
    cross join lateral jsonb_each(
      case when jsonb_typeof(e.data->'avail') = 'object' then e.data->'avail' else '{}'::jsonb end
    ) as d(day_key, cells)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.cells) = 'array' then d.cells else '[]'::jsonb end
    ) with ordinality as c(ids, ti)
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(c.ids) = 'array' then c.ids else '[]'::jsonb end
    ) as x(pid)
),
per_day as (
  select event_id, pid, day_key,
         jsonb_agg(jsonb_build_object('s', s_min, 'e', e_min) order by s_min) as ivs
  from grid
  group by event_id, pid, day_key
)
insert into public.availability (event_id, participant_id, intervals)
select event_id, pid, jsonb_object_agg(day_key, ivs)
from per_day
group by event_id, pid
on conflict (event_id, participant_id) do nothing;

-- ── 3. and out of the documents again ──
-- Now that every answer has a row of its own, the document copies are redundant. The
-- client will not write them back while the rows keep answering; if the tables ever go
-- away it starts keeping them again, which is the point.
update public.events
set data = data - 'availIv' - 'votes' - 'unavailableIds'
where data ?| array['availIv', 'votes', 'unavailableIds'];
