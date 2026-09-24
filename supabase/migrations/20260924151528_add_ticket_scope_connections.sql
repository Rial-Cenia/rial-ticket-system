create table public."TeamPlatform" (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references public."Team"(id),
  platform public."Platform" not null,
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "TeamPlatform_active_key"
on public."TeamPlatform" ("teamId", platform) where status = 'ACTIVE';
create index "TeamPlatform_platform_idx"
on public."TeamPlatform" (platform, status);

create table public."DiscordRoleConnection" (
  "roleId" text primary key,
  "roleName" text not null,
  platform public."Platform",
  "teamId" uuid references public."Team"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  check (platform is not null or "teamId" is not null)
);

create index "DiscordRoleConnection_team_idx"
on public."DiscordRoleConnection" ("teamId", status);
create index "DiscordRoleConnection_platform_idx"
on public."DiscordRoleConnection" (platform, status);

create trigger "TeamPlatform_set_updated_at"
before update on public."TeamPlatform"
for each row execute function public.set_updated_at();
create trigger "DiscordRoleConnection_set_updated_at"
before update on public."DiscordRoleConnection"
for each row execute function public.set_updated_at();

alter table public."TeamPlatform" enable row level security;
alter table public."DiscordRoleConnection" enable row level security;
revoke all on table public."TeamPlatform", public."DiscordRoleConnection" from anon, authenticated;
grant select, insert, update, delete on table public."TeamPlatform", public."DiscordRoleConnection" to service_role;
