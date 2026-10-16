alter table public."CodexRun"
  add column if not exists "retryCount" integer not null default 0 check ("retryCount" >= 0),
  add column if not exists "attemptNumber" integer not null default 1 check ("attemptNumber" > 0),
  add column if not exists "failureStage" text,
  add column if not exists "failureCode" text,
  add column if not exists retryable boolean not null default false;
