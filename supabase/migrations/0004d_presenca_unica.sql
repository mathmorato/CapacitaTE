-- CapacitaTE - Migração 0004d: formulário de presença único (um link para todos os dias da capacitação)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0004 e da 0004c.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
-- Com o formulário de presença único (session_key = 'unico'), cada envio é registrado no dia em que foi feito
-- (fuso America/Sao_Paulo, ex.: '2026-06-23'). Assim a mesma pessoa registra presença em cada dia, e um segundo envio
-- no mesmo dia continua respondendo "Presença já registrada às HH:MM". Formulários por sessão continuam funcionando.

create or replace function public._attendance_session(f public.forms) returns text
language sql stable as $$
  select case when f.session_key = 'unico' then to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') else f.session_key end;
$$;
revoke execute on function public._attendance_session(public.forms) from public, anon;

create or replace function public._submit_attendance(f public.forms, d jsonb, p_staff boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := public._digits(d->>'cpf');
  v_reg registrations; v_person people; v_prev attendance; v_row attendance; v_trusted boolean;
  v_session text := public._attendance_session(f);
begin
  if f.module_key <> 'presenca' then raise exception 'Este link não é de lista de presença.'; end if;
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  if not p_staff then
    if public._form_state(f) <> 'aberto' then raise exception 'A lista de presença desta sessão não está aberta.'; end if;
    if coalesce((d->>'consent')::boolean, false) is not true then raise exception 'É preciso autorizar o tratamento dos dados (LGPD).'; end if;
  end if;

  select * into v_prev from attendance where training_id = f.training_id and session_key = v_session and cpf = v_cpf;
  if v_prev.id is not null then
    return jsonb_build_object('already', true, 'submitted_at', v_prev.submitted_at, 'full_name', v_prev.full_name,
                              'message', 'Presença já registrada às ' || to_char(v_prev.submitted_at at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;

  select * into v_reg from registrations where training_id = f.training_id and cpf = v_cpf and status = 'valida';
  select * into v_person from people where cpf = v_cpf;

  if v_reg.id is not null then
    -- Inscrito: nome, telefone e e-mail vêm da tela (pré-preenchidos) ou, se faltarem, da inscrição
    d := jsonb_build_object('full_name', coalesce(public._txt(d, 'full_name'), v_reg.full_name),
                            'email', coalesce(public._txt(d, 'email'), v_reg.email),
                            'phone', coalesce(nullif(public._digits(d->>'phone'), ''), v_reg.phone),
                            'birth_date', public._txt(d, 'birth_date'), 'cpf', v_cpf);
    d := public._check_person(f, d, false, false);
    v_trusted := p_staff or public._second_factor_ok(v_person, (public._txt(d, 'birth_date'))::date, public._txt(d, 'email'));
  else
    -- Não inscrito: exige também o bloco "Inscrição" (os mesmos campos da seção 1 do formulário de inscrição)
    d := public._check_person(f, d, true, true);
    v_trusted := p_staff or public._second_factor_ok(v_person, (public._txt(d, 'birth_date'))::date, public._txt(d, 'email'));
  end if;

  perform public._save_person(v_cpf, d, v_trusted, case when p_staff then 'manual' else 'formulario' end);

  insert into attendance(form_id, training_id, session_key, cpf, full_name, phone, email, was_registered,
                         birth_date, phone2, municipality, ibge_code, category, role_gestao, success_case, role_cacs, answers)
  values (f.id, f.training_id, v_session, v_cpf, public._txt(d, 'full_name'), public._digits(d->>'phone'), lower(public._txt(d, 'email')),
          v_reg.id is not null,
          case when v_reg.id is null then (public._txt(d, 'birth_date'))::date end,
          case when v_reg.id is null then nullif(public._digits(coalesce(d->>'phone2', d->>'phone')), '') end,
          coalesce(v_reg.municipality, public._txt(d, 'municipality')), coalesce(v_reg.ibge_code, public._txt(d, 'ibge_code')),
          coalesce(v_reg.category, public._txt(d, 'category')),
          case when v_reg.id is null and public._txt(d, 'category') = 'Gestão municipal' then public._txt(d, 'role_gestao') end,
          case when v_reg.id is null and public._txt(d, 'category') = 'Gestão municipal' then public._txt(d, 'success_case') end,
          case when v_reg.id is null and public._txt(d, 'category') = 'CACS-FUNDEB' then public._txt(d, 'role_cacs') end,
          jsonb_strip_nulls(jsonb_build_object('consent_at', case when not p_staff then now() end,
                                               'manual', case when p_staff then true end,
                                               'registered_by', case when p_staff then auth.uid() end)))
  returning * into v_row;

  perform public._audit_submission(f, v_cpf, 'submission.create', jsonb_build_object('was_registered', v_row.was_registered, 'manual', p_staff));
  return jsonb_build_object('already', false, 'submitted_at', v_row.submitted_at, 'full_name', v_row.full_name,
                            'was_registered', v_row.was_registered,
                            'protocolo', upper(left(replace(v_row.id::text, '-', ''), 8)));
end $$;

create or replace function public.public_lookup_cpf(p_token text, p_cpf text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f forms; v_cpf text := public._digits(p_cpf); p people; v_at timestamptz; v_reg boolean;
begin
  f := public._form_by_token(p_token);
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  perform public._rate_hit('lookup:' || f.public_token || ':' || v_cpf, 10);
  perform public._rate_hit('lookup-ip:' || f.public_token || ':' || public._client_ip(), 120);
  select * into p from people where cpf = v_cpf;
  v_at := case f.module_key
    when 'inscricao' then (select submitted_at from registrations where training_id = f.training_id and cpf = v_cpf and status = 'valida')
    when 'presenca'  then (select submitted_at from attendance where training_id = f.training_id and session_key = public._attendance_session(f) and cpf = v_cpf)
    when 'avaliacao' then (select submitted_at from evaluations where training_id = f.training_id and cpf = v_cpf) end;
  v_reg := exists (select 1 from registrations where training_id = f.training_id and cpf = v_cpf and status = 'valida');
  return jsonb_build_object(
    'exists', p.cpf is not null,
    'masked_name', public._mask_name(p.full_name),
    'needs_birth_date', p.birth_date is not null,
    'needs_email', p.cpf is not null and p.birth_date is null and p.email is not null,
    'masked_email', case when p.birth_date is null then public._mask_email(p.email) end,
    'already_submitted', v_at is not null,
    'submitted_at', v_at,
    'submitted_when', case when v_at is not null then public._when(v_at) end,
    'has_registration', v_reg,
    'allow_edit', coalesce((f.config->>'allowEdit')::boolean, false));
end $$;

revoke execute on function public._submit_attendance(public.forms, jsonb, boolean) from public, anon;
grant execute on function public.public_lookup_cpf(text, text) to anon;

notify pgrst, 'reload schema';
