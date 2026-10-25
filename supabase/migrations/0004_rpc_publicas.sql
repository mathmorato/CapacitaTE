-- CapacitaTE - Migração 0004: funções públicas dos formulários (inscrição, presença e avaliação)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0002, 0002b e 0003.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
-- O público (chave anon) só executa as funções public_*; toda validação é feita aqui, no servidor.

-- 1. Controle de tentativas (rate limit simples por janela de tempo)
create table if not exists public.public_rate_limit (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);
alter table public.public_rate_limit enable row level security;
revoke all on public.public_rate_limit from anon, authenticated;

-- 2. Auxiliares (internas; não ficam disponíveis para anon)
create or replace function public._digits(p text) returns text
language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

create or replace function public._txt(p jsonb, k text) returns text
language sql immutable as $$ select nullif(regexp_replace(btrim(coalesce(p->>k, '')), '\s+', ' ', 'g'), '') $$;

create or replace function public._cpf_valid(p text) returns boolean
language plpgsql immutable as $$
declare d text := public._digits(p); s int; dv int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  for t in 9..10 loop
    s := 0;
    for i in 1..t loop s := s + substr(d, i, 1)::int * (t + 2 - i); end loop;
    dv := (s * 10) % 11 % 10;
    if dv <> substr(d, t + 1, 1)::int then return false; end if;
  end loop;
  return true;
end $$;

-- "Fabiano Dias" → "Fa*** D***s"
create or replace function public._mask_name(p text) returns text
language sql immutable as $$
  select string_agg(case when n = 1 then left(w, 2) || '***' else left(w, 1) || '***' || right(w, 1) end, ' ' order by n)
  from unnest(regexp_split_to_array(btrim(coalesce(p, '')), '\s+')) with ordinality as x(w, n)
  where w <> '';
$$;

-- "fabiano@gmail.com" → "fab***@gmail.com"
create or replace function public._mask_email(p text) returns text
language sql immutable as $$
  select case when p is null or position('@' in p) = 0 then null
              else left(split_part(p, '@', 1), 3) || '***@' || split_part(p, '@', 2) end;
$$;

create or replace function public._when(p timestamptz) returns text
language sql stable as $$ select to_char(p at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') $$;

create or replace function public._client_ip() returns text
language sql stable as $$
  select coalesce(split_part(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ',', 1), 'desconhecido');
$$;

-- Conta uma tentativa; erro quando passa do limite dentro da janela
create or replace function public._rate_hit(p_key text, p_limit int, p_window interval default interval '15 minutes')
returns void language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public_rate_limit(key, window_start, hits) values (md5(p_key), now(), 1)
  on conflict (key) do update set
    hits = case when public_rate_limit.window_start < now() - p_window then 1 else public_rate_limit.hits + 1 end,
    window_start = case when public_rate_limit.window_start < now() - p_window then now() else public_rate_limit.window_start end
  returning hits into v_hits;
  if v_hits > p_limit then
    raise exception 'Muitas tentativas. Aguarde 15 minutos e tente novamente.';
  end if;
end $$;

-- Situação efetiva do formulário: rascunho | agendado | aberto | encerrado
create or replace function public._form_state(f public.forms) returns text
language sql stable as $$
  select case
    when f.status = 'rascunho' then 'rascunho'
    when f.status = 'fechado' then 'encerrado'
    when f.opens_at is not null and now() < f.opens_at then 'agendado'
    when f.closes_at is not null and now() >= f.closes_at then 'encerrado'
    else 'aberto' end;
$$;

create or replace function public._form_by_token(p_token text) returns public.forms
language plpgsql stable security definer set search_path = public as $$
declare f forms;
begin
  select * into f from forms where public_token = btrim(coalesce(p_token, ''));
  if f.id is null then raise exception 'Formulário não encontrado. Confira o link ou o QR Code.'; end if;
  return f;
end $$;

-- Segundo fator: data de nascimento (preferencial) ou e-mail do cadastro
create or replace function public._second_factor_ok(p public.people, p_birth date, p_email text) returns boolean
language sql immutable as $$
  select case
    when p.cpf is null then true
    when p.birth_date is not null then p_birth is not null and p_birth = p.birth_date
    when p.email is not null then lower(btrim(coalesce(p_email, ''))) = p.email
    else false end;
$$;

-- Cria a pessoa ou, se o segundo fator conferir (ou for a equipe), atualiza só com valores não vazios
create or replace function public._save_person(p_cpf text, d jsonb, p_trusted boolean, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into people(cpf, full_name, email, birth_date, phone, municipality, ibge_code, uf, category, role_gestao, role_cacs, institution, source)
  values (p_cpf, coalesce(public._txt(d, 'full_name'), ''), lower(public._txt(d, 'email')), (public._txt(d, 'birth_date'))::date,
          nullif(public._digits(d->>'phone'), ''), public._txt(d, 'municipality'), public._txt(d, 'ibge_code'), public._txt(d, 'uf'),
          public._txt(d, 'category'), public._txt(d, 'role_gestao'), public._txt(d, 'role_cacs'), public._txt(d, 'institution'), p_source)
  on conflict (cpf) do update set
    full_name    = coalesce(nullif(excluded.full_name, ''), people.full_name),
    email        = coalesce(excluded.email, people.email),
    birth_date   = coalesce(excluded.birth_date, people.birth_date),
    phone        = coalesce(excluded.phone, people.phone),
    municipality = coalesce(excluded.municipality, people.municipality),
    ibge_code    = coalesce(excluded.ibge_code, people.ibge_code),
    uf           = coalesce(excluded.uf, people.uf),
    category     = coalesce(excluded.category, people.category),
    role_gestao  = coalesce(excluded.role_gestao, people.role_gestao),
    role_cacs    = coalesce(excluded.role_cacs, people.role_cacs),
    institution  = coalesce(excluded.institution, people.institution)
  where p_trusted;
end $$;

-- Validações comuns dos dados pessoais; devolve o payload normalizado (com ibge e uf do município)
create or replace function public._check_person(f public.forms, d jsonb, p_need_birth boolean, p_need_municipality boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mun jsonb; v_phone text := public._digits(d->>'phone');
begin
  if public._txt(d, 'full_name') is null or length(public._txt(d, 'full_name')) < 3 then raise exception 'Informe o nome completo.'; end if;
  if coalesce(public._txt(d, 'email'), '') !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if length(v_phone) not in (10, 11) then raise exception 'Informe o telefone com DDD: (XX)XXXXX-XXXX.'; end if;
  if p_need_birth then
    if public._txt(d, 'birth_date') is null then raise exception 'Informe a data de nascimento.'; end if;
    if (public._txt(d, 'birth_date'))::date not between date '1900-01-01' and current_date - interval '14 years' then
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

create or replace function public._audit_submission(f public.forms, p_cpf text, p_action text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log(user_id, module_key, training_id, action, target, details)
  values (auth.uid(), f.module_key, f.training_id, p_action, '***.' || substr(p_cpf, 4, 3) || '.' || substr(p_cpf, 7, 3) || '-**',
          p_details || jsonb_build_object('form', f.id, 'session', f.session_key));
$$;

-- 3. Núcleo das submissões (usado pelo público e pela equipe; p_staff = inclusão manual pelo painel)
create or replace function public._submit_registration(f public.forms, d jsonb, p_staff boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := public._digits(d->>'cpf');
  v_person people; v_prev registrations; v_trusted boolean; v_wait boolean := false; v_max int; v_row registrations;
begin
  if f.module_key <> 'inscricao' then raise exception 'Este link não é de inscrição.'; end if;
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  if not p_staff then
    if public._form_state(f) <> 'aberto' then raise exception 'Este formulário não está recebendo inscrições.'; end if;
    if coalesce((d->>'consent')::boolean, false) is not true then raise exception 'É preciso autorizar o tratamento dos dados (LGPD).'; end if;
    if coalesce((d->>'truth_confirmed')::boolean, false) is not true then raise exception 'Confirme a veracidade dos dados.'; end if;
    if lower(coalesce(public._txt(d, 'email'), '')) <> lower(coalesce(public._txt(d, 'email_confirm'), '')) then
      raise exception 'Os e-mails informados não são iguais.';
    end if;
  end if;
  d := public._check_person(f, d, true, true);

  select * into v_person from people where cpf = v_cpf;
  v_trusted := p_staff or public._second_factor_ok(v_person, (public._txt(d, 'birth_date'))::date, public._txt(d, 'email'));

  select * into v_prev from registrations where training_id = f.training_id and cpf = v_cpf;
  if v_prev.id is not null and v_prev.status = 'valida' and not p_staff then
    if not (coalesce((f.config->>'allowEdit')::boolean, false) and v_trusted) then
      raise exception 'Você já se inscreveu nesta capacitação em %.', public._when(v_prev.submitted_at);
    end if;
  end if;

  v_max := nullif(f.config->>'maxPerMunicipalityPerCategory', '')::int;
  if v_max is not null then
    v_wait := (select count(*) from registrations r where r.training_id = f.training_id and r.status = 'valida'
               and r.cpf <> v_cpf and r.municipality = public._txt(d, 'municipality') and r.category = public._txt(d, 'category')) >= v_max;
  end if;

  perform public._save_person(v_cpf, d, v_trusted, case when p_staff then 'manual' else 'formulario' end);

  insert into registrations(form_id, training_id, cpf, email, full_name, birth_date, phone, municipality, ibge_code, category,
                            role_gestao, success_case, role_cacs, truth_confirmed, answers, status)
  values (f.id, f.training_id, v_cpf, lower(public._txt(d, 'email')), public._txt(d, 'full_name'), (public._txt(d, 'birth_date'))::date,
          public._digits(d->>'phone'), public._txt(d, 'municipality'), public._txt(d, 'ibge_code'), public._txt(d, 'category'),
          case when public._txt(d, 'category') = 'Gestão municipal' then public._txt(d, 'role_gestao') end,
          case when public._txt(d, 'category') = 'Gestão municipal' then public._txt(d, 'success_case') end,
          case when public._txt(d, 'category') = 'CACS-FUNDEB' then public._txt(d, 'role_cacs') end,
          p_staff or coalesce((d->>'truth_confirmed')::boolean, false),
          jsonb_strip_nulls(jsonb_build_object('waitlist', case when v_wait then true end,
                                               'consent_at', case when not p_staff then now() end,
                                               'manual', case when p_staff then true end,
                                               'registered_by', case when p_staff then auth.uid() end)),
          'valida')
  on conflict (training_id, cpf) do update set
    form_id = excluded.form_id, email = excluded.email, full_name = excluded.full_name, birth_date = excluded.birth_date,
    phone = excluded.phone, municipality = excluded.municipality, ibge_code = excluded.ibge_code, category = excluded.category,
    role_gestao = excluded.role_gestao, success_case = excluded.success_case, role_cacs = excluded.role_cacs,
    truth_confirmed = excluded.truth_confirmed, answers = registrations.answers || excluded.answers, status = 'valida'
  returning * into v_row;

  perform public._audit_submission(f, v_cpf, case when v_prev.id is null then 'submission.create' else 'submission.update' end,
                                   jsonb_build_object('waitlist', v_wait, 'manual', p_staff));
  return jsonb_build_object('protocolo', upper(left(replace(v_row.id::text, '-', ''), 8)),
                            'submitted_at', v_row.submitted_at, 'updated', v_prev.id is not null, 'waitlist', v_wait,
                            'full_name', v_row.full_name);
end $$;

create or replace function public._submit_attendance(f public.forms, d jsonb, p_staff boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := public._digits(d->>'cpf');
  v_reg registrations; v_person people; v_prev attendance; v_row attendance; v_trusted boolean;
begin
  if f.module_key <> 'presenca' then raise exception 'Este link não é de lista de presença.'; end if;
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  if not p_staff then
    if public._form_state(f) <> 'aberto' then raise exception 'A lista de presença desta sessão não está aberta.'; end if;
    if coalesce((d->>'consent')::boolean, false) is not true then raise exception 'É preciso autorizar o tratamento dos dados (LGPD).'; end if;
  end if;

  select * into v_prev from attendance where training_id = f.training_id and session_key = f.session_key and cpf = v_cpf;
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
  values (f.id, f.training_id, f.session_key, v_cpf, public._txt(d, 'full_name'), public._digits(d->>'phone'), lower(public._txt(d, 'email')),
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

create or replace function public._submit_evaluation(f public.forms, d jsonb, p_staff boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := public._digits(d->>'cpf');
  v_person people; v_prev evaluations; v_row evaluations; v_trusted boolean;
  v_item jsonb; v_ratings jsonb := '{}'::jsonb; v_val int; v_heard text[];
begin
  if f.module_key <> 'avaliacao' then raise exception 'Este link não é de avaliação.'; end if;
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  if not p_staff then
    if public._form_state(f) <> 'aberto' then raise exception 'Esta avaliação não está recebendo respostas.'; end if;
    if coalesce((d->>'consent')::boolean, false) is not true then raise exception 'É preciso autorizar o tratamento dos dados (LGPD).'; end if;
  end if;
  if coalesce((f.config->>'onlyForAttendees')::boolean, false) and not p_staff
     and not exists (select 1 from attendance a where a.training_id = f.training_id and a.cpf = v_cpf) then
    raise exception 'A avaliação é exclusiva para quem registrou presença nesta capacitação.';
  end if;
  d := public._check_person(f, d, false, true);

  -- Notas inteiras de 1 a 5 para todos os itens da config
  for v_item in select * from jsonb_array_elements(coalesce(f.config->'ratingItems', '[]'::jsonb)) loop
    begin
      v_val := (d->'ratings'->>(v_item->>'key'))::int;
    exception when others then v_val := null;
    end;
    if v_val is null or v_val not between 1 and 5 then
      raise exception 'Dê uma nota de 1 a 5 para "%".', v_item->>'label';
    end if;
    v_ratings := v_ratings || jsonb_build_object(v_item->>'key', v_val);
  end loop;
  if public._txt(d, 'liked') is null then raise exception 'Indique os aspectos de que você mais gostou.'; end if;
  if public._txt(d, 'improve') is null then raise exception 'Indique os aspectos que poderiam ser melhorados.'; end if;
  if public._txt(d, 'institution_name') is null then raise exception 'Mencione a instituição vinculada.'; end if;
  select array_agg(btrim(x)) into v_heard from jsonb_array_elements_text(coalesce(d->'heard_from', '[]'::jsonb)) x where btrim(x) <> '';
  if public._txt(d, 'heard_other') is not null then v_heard := coalesce(v_heard, '{}') || public._txt(d, 'heard_other'); end if;
  if coalesce(array_length(v_heard, 1), 0) = 0 then raise exception 'Informe como ficou sabendo da capacitação.'; end if;

  select * into v_person from people where cpf = v_cpf;
  v_trusted := p_staff or public._second_factor_ok(v_person, null, public._txt(d, 'email'));

  select * into v_prev from evaluations where training_id = f.training_id and cpf = v_cpf;
  if v_prev.id is not null and not p_staff and not (coalesce((f.config->>'allowEdit')::boolean, false) and v_trusted) then
    raise exception 'Você já respondeu esta avaliação em %.', public._when(v_prev.submitted_at);
  end if;

  perform public._save_person(v_cpf, d || jsonb_build_object('institution', public._txt(d, 'institution_name')), v_trusted,
                              case when p_staff then 'manual' else 'formulario' end);

  insert into evaluations(form_id, training_id, cpf, full_name, email, phone, municipality, ibge_code, category, ratings,
                          liked, improve, institution_type, institution_name, topics_suggestion, heard_from, comments, answers)
  values (f.id, f.training_id, v_cpf, public._txt(d, 'full_name'), lower(public._txt(d, 'email')), public._digits(d->>'phone'),
          public._txt(d, 'municipality'), public._txt(d, 'ibge_code'), public._txt(d, 'category'), v_ratings,
          public._txt(d, 'liked'), public._txt(d, 'improve'), public._txt(d, 'institution_type'), public._txt(d, 'institution_name'),
          public._txt(d, 'topics_suggestion'), v_heard, public._txt(d, 'comments'),
          jsonb_strip_nulls(jsonb_build_object('consent_at', case when not p_staff then now() end,
                                               'manual', case when p_staff then true end,
                                               'registered_by', case when p_staff then auth.uid() end)))
  on conflict (training_id, cpf) do update set
    form_id = excluded.form_id, full_name = excluded.full_name, email = excluded.email, phone = excluded.phone,
    municipality = excluded.municipality, ibge_code = excluded.ibge_code, category = excluded.category, ratings = excluded.ratings,
    liked = excluded.liked, improve = excluded.improve, institution_type = excluded.institution_type,
    institution_name = excluded.institution_name, topics_suggestion = excluded.topics_suggestion, heard_from = excluded.heard_from,
    comments = excluded.comments, answers = evaluations.answers || excluded.answers
  returning * into v_row;

  perform public._audit_submission(f, v_cpf, case when v_prev.id is null then 'submission.create' else 'submission.update' end,
                                   jsonb_build_object('manual', p_staff));
  return jsonb_build_object('protocolo', upper(left(replace(v_row.id::text, '-', ''), 8)),
                            'submitted_at', v_row.submitted_at, 'updated', v_prev.id is not null, 'full_name', v_row.full_name);
end $$;

-- 4. Funções públicas (anon)
create or replace function public.public_get_form(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f forms; t trainings;
begin
  f := public._form_by_token(p_token);
  select * into t from trainings where id = f.training_id;
  return jsonb_build_object(
    'module_key', f.module_key, 'session_key', f.session_key, 'state', public._form_state(f),
    'opens_at', f.opens_at, 'closes_at', f.closes_at,
    'config', f.config - 'internal',
    'training', jsonb_build_object(
      'number', t.number, 'polo', t.polo, 'uf', t.uf,
      'startDate', t.data->>'startDate', 'endDate', t.data->>'endDate', 'datesFormatted', t.data->>'datesFormatted',
      'locationVenue', t.data->>'locationVenue', 'locationAddress', t.data->>'locationAddress'));
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
    when 'presenca'  then (select submitted_at from attendance where training_id = f.training_id and session_key = f.session_key and cpf = v_cpf)
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

create or replace function public.public_unlock_profile(p_token text, p_cpf text, p_birth_date date default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f forms; v_cpf text := public._digits(p_cpf); p people; r registrations;
begin
  f := public._form_by_token(p_token);
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  perform public._rate_hit('unlock:' || v_cpf, 3);
  select * into p from people where cpf = v_cpf;
  if p.cpf is null or (p.birth_date is null and p.email is null) or not public._second_factor_ok(p, p_birth_date, p_email) then
    raise exception 'Os dados não conferem. Confira e tente novamente ou preencha manualmente.';
  end if;
  select * into r from registrations where training_id = f.training_id and cpf = v_cpf and status = 'valida';
  return jsonb_build_object(
    'full_name', p.full_name, 'email', p.email, 'birth_date', p.birth_date, 'phone', p.phone,
    'municipality', coalesce(r.municipality, p.municipality), 'category', coalesce(r.category, p.category),
    'role_gestao', coalesce(r.role_gestao, p.role_gestao), 'role_cacs', coalesce(r.role_cacs, p.role_cacs),
    'institution', p.institution);
end $$;

create or replace function public.public_submit_registration(p_token text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._rate_hit('submit-ip:' || btrim(coalesce(p_token, '')) || ':' || public._client_ip(), 60);
  return public._submit_registration(public._form_by_token(p_token), coalesce(p_payload, '{}'::jsonb), false);
end $$;

create or replace function public.public_submit_attendance(p_token text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._rate_hit('submit-ip:' || btrim(coalesce(p_token, '')) || ':' || public._client_ip(), 120);
  return public._submit_attendance(public._form_by_token(p_token), coalesce(p_payload, '{}'::jsonb), false);
end $$;

create or replace function public.public_submit_evaluation(p_token text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._rate_hit('submit-ip:' || btrim(coalesce(p_token, '')) || ':' || public._client_ip(), 60);
  return public._submit_evaluation(public._form_by_token(p_token), coalesce(p_payload, '{}'::jsonb), false);
end $$;

-- 5. Funções da equipe (painel): inclusão manual e troca do link público
create or replace function public.staff_submit(p_form uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f forms;
begin
  select * into f from forms where id = p_form;
  if f.id is null then raise exception 'Formulário não encontrado.'; end if;
  if not public.has_perm(f.module_key, 'edit', f.training_id) then raise exception 'Você não tem permissão para incluir respostas neste módulo.'; end if;
  return case f.module_key
    when 'inscricao' then public._submit_registration(f, coalesce(p_payload, '{}'::jsonb), true)
    when 'presenca'  then public._submit_attendance(f, coalesce(p_payload, '{}'::jsonb), true)
    else public._submit_evaluation(f, coalesce(p_payload, '{}'::jsonb), true) end;
end $$;

create or replace function public.staff_rotate_token(p_form uuid) returns text
language plpgsql security definer set search_path = public as $$
declare f forms; v_token text := encode(extensions.gen_random_bytes(12), 'hex');
begin
  select * into f from forms where id = p_form;
  if f.id is null then raise exception 'Formulário não encontrado.'; end if;
  if not public.has_perm(f.module_key, 'edit', f.training_id) then raise exception 'Você não tem permissão para trocar o link.'; end if;
  update forms set public_token = v_token where id = p_form;
  insert into audit_log(user_id, module_key, training_id, action, target)
  values (auth.uid(), f.module_key, f.training_id, 'form.token', f.id::text);
  return v_token;
end $$;

-- 6. Permissões de execução: anon só executa public_* e auth_setup_status
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.bootstrap_admin(text) from authenticated;
grant execute on function public.auth_setup_status() to anon;
grant execute on function public.public_get_form(text) to anon;
grant execute on function public.public_lookup_cpf(text, text) to anon;
grant execute on function public.public_unlock_profile(text, text, date, text) to anon;
grant execute on function public.public_submit_registration(text, jsonb) to anon;
grant execute on function public.public_submit_attendance(text, jsonb) to anon;
grant execute on function public.public_submit_evaluation(text, jsonb) to anon;
-- Funções criadas no futuro não ficam disponíveis para anon automaticamente
alter default privileges in schema public revoke execute on functions from anon;

notify pgrst, 'reload schema';
