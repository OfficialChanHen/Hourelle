-- Profiles for accounts that have none.
--
-- 0002 mints a profile for every new auth.users row through a trigger. An account
-- that was created before that trigger existed on this database (or while it was
-- missing) has no profile, so the app falls back to the part of the email before
-- the @ for the name, sign-up cannot tell that the address is taken, and invite
-- lookups by email find nobody. This puts the trigger in place (again, harmlessly
-- if it is already there) and then writes the rows that are missing. Safe to run
-- more than once.

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
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(coalesce(new.email, 'someone@'), '@', 1)
    ),
    new.email,
    (array['purple','teal','coral','blue','amber','pink','green','gray'])[1 + floor(random() * 8)]
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- the backfill: one profile per account that has none
insert into public.profiles (id, name, email, color)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(u.email, 'someone@'), '@', 1)
  ),
  u.email,
  (array['purple','teal','coral','blue','amber','pink','green','gray'])[1 + floor(random() * 8)]
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- profiles whose email was never filled in (or has since changed) follow auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;
