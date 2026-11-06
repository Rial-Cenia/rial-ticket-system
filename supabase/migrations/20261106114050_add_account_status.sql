create type public."AccountStatus" as enum ('ACTIVE', 'DISABLED');

alter table public."AppUser"
add column status public."AccountStatus" not null default 'ACTIVE',
add column "disabledAt" timestamptz,
add column "disabledByUserId" uuid references auth.users(id) on delete set null;

create index "AppUser_status_idx" on public."AppUser" (status);
