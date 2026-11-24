-- Step 13: a host's own photo leaves the event document.
--
-- Until now a cover travelled inside events.data as a base64 data URL, which meant
-- it also sat in every browser's localStorage. A downscaled JPEG is about 300KB and
-- base64 adds a third, so fourteen events with photos came to 4.5MB of the roughly
-- 5MB a browser allows an origin. Past that, every write failed and nothing said so:
-- the app kept accepting answers it could no longer save, and a browser with no room
-- left came back signed out.
--
-- So covers move to Storage and the document keeps a URL, which is a couple of
-- hundred bytes. Preset scenes never had this problem (they are the string
-- 'preset:dusk' and the artwork is in the code), so they are untouched.
--
-- Reading is public, because a share link has to show the cover to somebody with no
-- account and no session. That is the same bargain the events table already makes:
-- holding the link is the permission, and the path carries 16 random characters so
-- a link cannot be guessed. Writing needs a session, because uploading is a host
-- action, and a file may only be written under a folder named for an event.
--
-- Safe to run more than once.

-- ── the bucket ──
-- public: anyone with the URL may read. 5MB ceiling per object, which is far above
-- what downscaleImage produces (longest side 1280, JPEG at 82%) and far below
-- anything that would be worth storing here by accident.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ── who may do what ──
-- Storage keeps its objects in storage.objects, which has row-level security on by
-- default; without policies the bucket is readable by nobody and writable by nobody.

drop policy if exists "covers are readable by anyone" on storage.objects;
create policy "covers are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'covers');

-- an upload has to be signed in, and has to land in a folder named for an event.
-- storage.foldername() splits the path; [1] is the first segment. This does not
-- check that the account hosts that event: the events table is the authority on
-- that, and a cover only ever becomes visible by being written into a document the
-- events policies already guard.
drop policy if exists "signed-in accounts may add covers" on storage.objects;
create policy "signed-in accounts may add covers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'covers' and coalesce((storage.foldername(name))[1], '') <> '');

-- replacing and deleting are for the account that uploaded it. storage.objects
-- records the uploader in `owner`, so this needs no bookkeeping of our own.
drop policy if exists "accounts may replace their own covers" on storage.objects;
create policy "accounts may replace their own covers"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'covers' and owner = auth.uid())
  with check (bucket_id = 'covers' and owner = auth.uid());

drop policy if exists "accounts may remove their own covers" on storage.objects;
create policy "accounts may remove their own covers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers' and owner = auth.uid());

-- Nothing migrates the covers already inside existing documents. They keep working
-- exactly as they did, and the app offers to move each one the next time its host
-- opens the cover editor. There is no rush, and no way to do it from here: the
-- bytes are in people's browsers, not in this database.
