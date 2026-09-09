-- Phase 4, step 4: accounts.
-- Supabase owns the `auth.users` table: it holds emails, hashed passwords, and
-- OAuth links, and the app may not write to it. What the app needs on top of that
-- is a display name and an avatar color, so we keep a `profiles` row per user in
-- our own schema, joined by the same id. This is the standard Supabase shape:
-- auth.users for credentials, public.profiles for everything the UI shows.

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null default 'Someone',
  color      text not null default 'purple',   -- a PersonColor key from src/lib/colors.ts
  email      text,
  created_at timestamptz not null default now()
);

-- Names are public inside an event — every roster, avatar, and chat line shows one —
-- so reads are open. Writes are not: the two policies below are the first real use
-- of auth.uid(), the id of whoever is making the request, taken from their signed
-- session token rather than from anything the client typed.
alter table public.profiles enable row level security;

create policy "profiles are readable by anyone"
on public.profiles for select
using (true);

create policy "you may only create your own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "you may only edit your own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- A profile should exist the moment an account does, whether it was born from a
-- Google sign-in or an email sign-up — so the database mints it, not the app.
-- `security definer` lets this function write to a table the new user has no
-- rights to yet; pinning search_path is the standard safety measure that goes
-- with it, so the function can't be tricked into calling someone else's tables.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, color)
  values (
    new.id,
    -- Google sends a name in the OAuth payload; an email sign-up sends whatever the
    -- form collected; if both are missing, the part of the email before the @ does
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(coalesce(new.email, 'someone@'), '@', 1)
    ),
    new.email,
    (array['purple','teal','coral','blue','amber','pink','green','gray'])[1 + floor(random() * 8)]
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
