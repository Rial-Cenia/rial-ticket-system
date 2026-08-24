do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'ticket_app_url') then
    raise exception 'Crea ticket_app_url en Supabase Vault antes de configurar el cron';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'ticket_cron_secret') then
    raise exception 'Crea ticket_cron_secret en Supabase Vault antes de configurar el cron';
  end if;
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'dispatch-ticket-discord-jobs';

select cron.schedule(
  'dispatch-ticket-discord-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ticket_app_url') || '/api/discord/jobs',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ticket_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

