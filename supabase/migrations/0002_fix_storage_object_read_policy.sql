-- Fixes a chicken-and-egg bug in the `assets` Storage bucket's RLS: the
-- original SELECT policy only allowed reading an object if a matching
-- `assets` row already had `storage_path` set to that object's name. But
-- uploadAssetFile() (src/lib/supabase/storage.ts) uploads a new asset's
-- file BEFORE its row's storage_path is set (POST /api/assets inserts the
-- row, uploads the file, then updates storage_path) — and Supabase
-- Storage's upload does an INSERT ... RETURNING under the hood, so Postgres
-- also applies the SELECT policy to that RETURNING row. With the old
-- policy, no `assets` row could possibly match yet (storage_path was still
-- null), so RLS rejected the RETURNING clause and every first-time upload
-- failed with "new row violates row-level security policy" even though the
-- INSERT's own WITH CHECK passed.
--
-- Fix: owners can always read objects under their own `${auth.uid()}/...`
-- folder, independent of assets-table state. Cross-user reads (org-shared
-- assets, admin) still go through the assets table as before. This does
-- NOT touch RLS enablement or the bucket's public flag — the bucket stays
-- private and RLS stays on.
--
-- Idempotent: safe to run more than once.

drop policy if exists "read storage objects for accessible assets" on storage.objects;

create policy "read storage objects for accessible assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
      or exists (
        select 1 from assets a
        where a.storage_path = storage.objects.name
          and a.visibility = 'org'
      )
    )
  );

-- Belt-and-suspenders: uploadAssetFile() uses upsert:true. Every asset gets
-- a fresh random id so this is always a plain INSERT in practice, but
-- upsert:true resolves to an UPDATE on a path collision, and there was no
-- UPDATE policy at all before this migration.
drop policy if exists "owners can update their own storage objects" on storage.objects;

create policy "owners can update their own storage objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
