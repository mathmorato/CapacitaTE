-- CapacitaTE - Migração 0004c: notas da avaliação sempre exigidas (itens padrão quando a config não traz a lista)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0004.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
-- Problema corrigido: sem "ratingItems" na config do formulário, a avaliação era aceita e gravada com notas vazias.

-- Itens de nota da avaliação: os da config ou, se faltarem, os 7 itens padrão do Google Forms (seção 10.1)
create or replace function public._rating_items(p_config jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(p_config->'ratingItems') = 'array' and jsonb_array_length(p_config->'ratingItems') > 0
              then p_config->'ratingItems'
              else '[{"key":"inscricao","label":"Inscrição"},{"key":"divulgacao","label":"Divulgação"},
                     {"key":"data","label":"Data da Formação"},{"key":"horario","label":"Horário da Formação"},
                     {"key":"local","label":"Local da Formação"},{"key":"duracao","label":"Duração da Formação"},
                     {"key":"geral","label":"Como você avalia a Formação"}]'::jsonb end;
$$;
revoke execute on function public._rating_items(jsonb) from public, anon;

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
  for v_item in select * from jsonb_array_elements(public._rating_items(f.config)) loop
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

revoke execute on function public._submit_evaluation(public.forms, jsonb, boolean) from public, anon;

notify pgrst, 'reload schema';
