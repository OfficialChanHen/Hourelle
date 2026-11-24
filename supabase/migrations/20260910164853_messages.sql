-- Steps 6–7 follow-up: chat leaves the event document.
-- Until now every message lived inside events.data, so every save carried the whole
-- chat — and two people writing at once overwrote each other. A message is the
-- natural first thing to normalize: it is append-only, it never needs the rest of
-- the document to make sense, and it is exactly where collisions happen.

create table public.messages (
  id             uuid primary key,                 -- minted by the client, so its own
                                                   -- realtime echo is recognised
  event_id       text not null references public.events (id) on delete cascade,
  participant_id text not null,                    -- who wrote it: a participant id
  name           text not null,                    -- their name at the time — a roster
                                                   -- rename must not rewrite history
  body           text not null,
  system         boolean not null default false,   -- "Sam joined": the room speaking
  at             bigint not null,                  -- epoch ms, the shape the UI keeps
  created_at     timestamptz not null default now()
);

create index messages_event_at_idx on public.messages (event_id, at);

-- Same deal as the event itself: the link is the permission. Anyone holding it may
-- read the room and add to it. Nobody edits or deletes a message — there are no
-- update or delete policies, so those verbs are simply refused.
alter table public.messages enable row level security;

create policy "anyone with the link may read the chat"
on public.messages for select
using (true);

create policy "anyone with the link may post"
on public.messages for insert
with check (true);

alter publication supabase_realtime add table public.messages;

-- Move what is already in the documents into rows, then empty the documents. This
-- runs as direct SQL, so the events trigger lets it through.
insert into public.messages (id, event_id, participant_id, name, body, system, at)
select
  gen_random_uuid(),
  e.id,
  coalesce(m->>'id', 'unknown'),
  coalesce(m->>'name', 'Someone'),
  coalesce(m->>'text', ''),
  coalesce((m->>'system')::boolean, false),
  coalesce((m->>'at')::bigint, (extract(epoch from e.created_at) * 1000)::bigint)
from public.events e, jsonb_array_elements(coalesce(e.data->'messages', '[]'::jsonb)) m;

update public.events
set data = jsonb_set(data, '{messages}', '[]'::jsonb)
where jsonb_array_length(coalesce(data->'messages', '[]'::jsonb)) > 0;
