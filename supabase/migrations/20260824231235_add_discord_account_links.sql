create table public."DiscordAccountLink" (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  "discordUserId" text not null unique check ("discordUserId" ~ '^[0-9]{17,20}$'),
  "discordUsername" text not null check (char_length("discordUsername") between 1 and 100),
  "discordDisplayName" text,
  "discordAvatarHash" text,
  "guildNickname" text,
  "linkedAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger "DiscordAccountLink_set_updated_at"
before update on public."DiscordAccountLink"
for each row execute function public.set_updated_at();

alter table public."DiscordAccountLink" enable row level security;

revoke all on table public."DiscordAccountLink" from anon, authenticated;
grant select, insert, update, delete on table public."DiscordAccountLink" to service_role;
