-- CapacitaTE - Migração 0004e: gatilhos que pedem o e-mail de confirmação (substituem os Database Webhooks do painel)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0003.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
--
-- Depois de cada INSERT em registrations, attendance ou evaluations, o banco chama (em segundo plano, via pg_net)
-- a Edge Function enviar-confirmacao com { table, record: { id } }. A função relê o registro e envia o e-mail.
-- Se a chamada falhar, a resposta continua gravada normalmente (o gatilho nunca bloqueia o envio do formulário).
--
-- Projeto novo: troque a URL em public.app_settings (chave 'confirmation_function_url').

create extension if not exists pg_net with schema extensions;

-- Configurações simples do servidor (só leitura pelo próprio banco)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings(key, value)
values ('confirmation_function_url', 'https://tjvhbkhttxbjajcznfrp.supabase.co/functions/v1/enviar-confirmacao')
on conflict (key) do nothing;

create or replace function public._request_confirmation_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text;
begin
  select value into v_url from app_settings where key = 'confirmation_function_url';
  if v_url is not null and v_url <> '' then
    begin
      perform net.http_post(
        url := v_url,
        body := jsonb_build_object('table', tg_table_name, 'record', jsonb_build_object('id', new.id)),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 10000
      );
    exception when others then
      -- Sem rede ou pg_net indisponível: não impede a gravação da resposta
      null;
    end;
  end if;
  return new;
end $$;
revoke execute on function public._request_confirmation_email() from public, anon, authenticated;

drop trigger if exists registrations_confirmation_email on public.registrations;
create trigger registrations_confirmation_email after insert on public.registrations
  for each row execute function public._request_confirmation_email();

drop trigger if exists attendance_confirmation_email on public.attendance;
create trigger attendance_confirmation_email after insert on public.attendance
  for each row execute function public._request_confirmation_email();

drop trigger if exists evaluations_confirmation_email on public.evaluations;
create trigger evaluations_confirmation_email after insert on public.evaluations
  for each row execute function public._request_confirmation_email();

notify pgrst, 'reload schema';
