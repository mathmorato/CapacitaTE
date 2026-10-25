-- CapacitaTE - Migração 0004f: limite de tentativas desligado por padrão e regras iguais às da tela
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0004 e da 0004e.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
--
-- 1. Limite de tentativas (consulta de CPF, data de nascimento e envios): DESLIGADO por decisão do usuário
--    (25/10/2026, fase de testes). Para religar quando a plataforma estiver em uso:
--      update public.app_settings set value = 'true' where key = 'rate_limit_enabled';
--    Atenção: sem o limite, alguém com o CPF de outra pessoa pode tentar várias datas de nascimento.
-- 2. Regras iguais às da tela (.agents/specs/formularios.md): nome com nome e sobrenome; nascimento a partir de 1920.

insert into public.app_settings(key, value) values ('rate_limit_enabled', 'false')
on conflict (key) do nothing;

-- Libera quem estava bloqueado agora
delete from public.public_rate_limit;

create or replace function public._rate_hit(p_key text, p_limit int, p_window interval default interval '15 minutes')
returns void language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  if coalesce((select value from app_settings where key = 'rate_limit_enabled'), 'false') <> 'true' then
    return;
  end if;
  insert into public_rate_limit(key, window_start, hits) values (md5(p_key), now(), 1)
  on conflict (key) do update set
    hits = case when public_rate_limit.window_start < now() - p_window then 1 else public_rate_limit.hits + 1 end,
    window_start = case when public_rate_limit.window_start < now() - p_window then now() else public_rate_limit.window_start end
  returning hits into v_hits;
  if v_hits > p_limit then
    raise exception 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  end if;
end $$;
revoke execute on function public._rate_hit(text, int, interval) from public, anon;

create or replace function public._check_person(f public.forms, d jsonb, p_need_birth boolean, p_need_municipality boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mun jsonb; v_phone text := public._digits(d->>'phone');
begin
  if public._txt(d, 'full_name') is null or array_length(regexp_split_to_array(public._txt(d, 'full_name'), '\s+'), 1) < 2 then
    raise exception 'Informe o nome completo (nome e sobrenome).';
  end if;
  if coalesce(public._txt(d, 'email'), '') !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if length(v_phone) not in (10, 11) then raise exception 'Informe o telefone com DDD: (XX)XXXXX-XXXX.'; end if;
  if p_need_birth then
    if public._txt(d, 'birth_date') is null then raise exception 'Informe a data de nascimento.'; end if;
    if (public._txt(d, 'birth_date'))::date not between date '1920-01-01' and current_date - interval '14 years' then
      raise exception 'Data de nascimento inválida.';
    end if;
  end if;
  if p_need_municipality then
    select m.value into v_mun from jsonb_array_elements(coalesce(f.config->'municipalities', '[]'::jsonb)) as m(value)
    where lower(m.value->>'name') = lower(coalesce(public._txt(d, 'municipality'), '')) limit 1;
    if v_mun is null then raise exception 'Escolha um município da lista.'; end if;
    if coalesce(public._txt(d, 'category'), '') not in ('CACS-FUNDEB', 'Gestão municipal') then
      raise exception 'Informe se você faz parte do CACS-FUNDEB ou da Gestão municipal.';
    end if;
    if public._txt(d, 'category') = 'Gestão municipal' and public._txt(d, 'role_gestao') is null then
      raise exception 'Informe o cargo que você ocupa na gestão municipal.';
    end if;
    if public._txt(d, 'category') = 'CACS-FUNDEB' and public._txt(d, 'role_cacs') is null then
      raise exception 'Informe o cargo que você ocupa no CACS-FUNDEB.';
    end if;
    d := d || jsonb_build_object('municipality', v_mun->>'name', 'ibge_code', v_mun->>'ibge', 'uf', v_mun->>'uf');
  end if;
  return d;
end $$;

revoke execute on function public._check_person(public.forms, jsonb, boolean, boolean) from public, anon;

notify pgrst, 'reload schema';
