-- Training Studio: initial schema
-- Roles, assets (icons / backgrounds / outlines), tags, collections, and RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles & profiles
-- ---------------------------------------------------------------------------

create type user_role as enum ('admin', 'developer', 'viewer');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- New auth.users rows get a profile automatically. First user in an empty
-- org becomes admin so there's always someone who can promote others.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when (select count(*) from public.profiles) = 0
      then 'admin'::public.user_role
      else 'viewer'::public.user_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create function is_developer_or_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'developer')
  );
$$;

alter table profiles enable row level security;

create policy "profiles are readable by every authenticated user"
  on profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile, admins can update any"
  on profiles for update
  to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- Only admins may change a profile's role; a self-update that tries to
-- change it is silently reverted rather than rejected outright.
create function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role <> old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_self_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- Assets (icons, backgrounds, outlines/lesson plans)
-- ---------------------------------------------------------------------------

create type asset_type as enum ('icon', 'background', 'outline');
create type asset_visibility as enum ('private', 'org');

create table assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  type asset_type not null,
  title text not null,
  description text,
  prompt text,
  generation_params jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  storage_path text,
  visibility asset_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_owner_id_idx on assets (owner_id);
create index assets_type_idx on assets (type);
create index assets_visibility_idx on assets (visibility);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_set_updated_at
  before update on assets
  for each row execute function set_updated_at();

alter table assets enable row level security;

create policy "read own, org-shared, or as admin"
  on assets for select
  to authenticated
  using (owner_id = auth.uid() or visibility = 'org' or is_admin());

create policy "developers and admins can create assets"
  on assets for insert
  to authenticated
  with check (owner_id = auth.uid() and is_developer_or_admin());

create policy "owner or admin can update"
  on assets for update
  to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create policy "owner or admin can delete"
  on assets for delete
  to authenticated
  using (owner_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table asset_tags (
  asset_id uuid not null references assets (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (asset_id, tag_id)
);

alter table tags enable row level security;
alter table asset_tags enable row level security;

create policy "tags are readable by every authenticated user"
  on tags for select to authenticated using (true);

create policy "developers and admins can create tags"
  on tags for insert to authenticated with check (is_developer_or_admin());

create policy "asset_tags follow the parent asset's visibility"
  on asset_tags for select
  to authenticated
  using (
    exists (
      select 1 from assets a
      where a.id = asset_id
        and (a.owner_id = auth.uid() or a.visibility = 'org' or is_admin())
    )
  );

create policy "asset owner or admin manages asset_tags"
  on asset_tags for all
  to authenticated
  using (
    exists (
      select 1 from assets a
      where a.id = asset_id and (a.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from assets a
      where a.id = asset_id and (a.owner_id = auth.uid() or is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Collections (projects / groupings of assets)
-- ---------------------------------------------------------------------------

create table collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  visibility asset_visibility not null default 'private',
  created_at timestamptz not null default now()
);

create table collection_assets (
  collection_id uuid not null references collections (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  primary key (collection_id, asset_id)
);

alter table collections enable row level security;
alter table collection_assets enable row level security;

create policy "read own, org-shared, or as admin collections"
  on collections for select
  to authenticated
  using (owner_id = auth.uid() or visibility = 'org' or is_admin());

create policy "developers and admins can create collections"
  on collections for insert
  to authenticated
  with check (owner_id = auth.uid() and is_developer_or_admin());

create policy "owner or admin manages collection"
  on collections for update
  to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create policy "owner or admin deletes collection"
  on collections for delete
  to authenticated
  using (owner_id = auth.uid() or is_admin());

create policy "collection_assets follow the parent collection"
  on collection_assets for all
  to authenticated
  using (
    exists (
      select 1 from collections c
      where c.id = collection_id and (c.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from collections c
      where c.id = collection_id and (c.owner_id = auth.uid() or is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for rasterized/exported files (PNG backgrounds, PNG exports)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Objects are stored under `${owner_id}/${asset_id}/...`. Access mirrors the
-- assets table: owner, org-visibility, or admin. Reads/writes go through the
-- server (service role) after an authorization check, but these policies
-- also let clients read directly when appropriate.
create policy "read storage objects for accessible assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from assets a
      where a.storage_path = storage.objects.name
        and (a.owner_id = auth.uid() or a.visibility = 'org' or is_admin())
    )
  );

create policy "owners can upload storage objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners or admins can delete storage objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
    )
  );
