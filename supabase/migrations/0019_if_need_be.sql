-- Step 19: if-need-be marks on availability
--
-- A second, lighter mark for "I can make it if I have to". Like availIv, needIv
-- is stored apart from the event document (migration 0008). One person's two marks
-- never share a minute: availIv is "free", needIv is "if need be", and every read
-- takes the union.
--
-- The column is added to availability with a default empty object, so old rows work
-- without change. New rows upserted (from the client) carry both. The client turns
-- availIv writes into intervals updates here; needIv writes become if_need_be updates.

-- Safe to run twice. availability_event_idx already exists from 0008.
alter table public.availability
add column if not exists if_need_be jsonb not null default '{}'::jsonb;
