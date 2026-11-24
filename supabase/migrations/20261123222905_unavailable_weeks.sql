-- Step 24: "can't make this week" on availability
--
-- On a poll that runs over several weeks, a person can say one week is out and still
-- mark the others. Like `unavailable` ("none of these days work"), it lives on the
-- person's own availability row. Each entry names a week by its Sunday as an ISO day
-- ('2026-10-18'), the same weeks the grid pages by.
--
-- Old rows get an empty list. Until this runs the client saves answers without the
-- column, and a week said out stays on that device only.

-- Safe to run twice.
alter table public.availability
add column if not exists unavailable_weeks text[] not null default '{}';
