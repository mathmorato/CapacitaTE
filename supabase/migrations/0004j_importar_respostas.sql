-- CapacitaTE - Migração 0004j: importar respostas históricas (Admin > Importar base > "Importar também como respostas")
-- Execute em: Supabase > SQL Editor > New query > colar > Run. Depende da 0003 e da 0004i. Idempotente.
--
-- Grava inscrições, presenças ou avaliações de capacitações antigas a partir das planilhas do Google Forms, mantendo o
-- carimbo de data/hora original. Quem já tem resposta (mesmo CPF, ou CPF e dia na presença) é contado como "repetida" e
-- não é alterado. A pessoa entra em people (só preenche campos vazios). Não envia e-mail de confirmação.
-- Exige is_admin() ou edição no módulo da capacitação. Máximo de 500 linhas por chamada.

create or replace function public.admin_import_responses(p_form uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f forms; r jsonb; v_cpf text; v_at timestamptz; v_ok int := 0; v_dup int := 0; v_bad int := 0; v_rows int;
  v_name text; v_day text; v_reg boolean;
begin
  select * into f from forms where id = p_form;
  if f.id is null then raise exception 'Formulário não encontrado.'; end if;
  if not (public.is_admin() or public.has_perm(f.module_key, 'edit', f.training_id)) then raise exception 'Sem permissão para importar respostas deste módulo.'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'Envie no máximo 500 linhas por vez.'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_cpf := regexp_replace(coalesce(r->>'cpf', ''), '\D', '', 'g');
    v_name := trim(coalesce(r->>'full_name', ''));
    if v_cpf !~ '^[0-9]{11}$' or v_name = '' then v_bad := v_bad + 1; continue; end if;
    v_at := coalesce(nullif(r->>'submitted_at', '')::timestamptz, now());

    insert into people(cpf, full_name, email, birth_date, phone, municipality, category, role_gestao, role_cacs, source)
    values (v_cpf, v_name, nullif(trim(r->>'email'), ''), nullif(r->>'birth_date', '')::date,
            nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''), nullif(trim(r->>'municipality'), ''),
            case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end,
            nullif(trim(r->>'role_gestao'), ''), nullif(trim(r->>'role_cacs'), ''), 'importacao')
    on conflict (cpf) do update set
      email = coalesce(people.email, excluded.email), birth_date = coalesce(people.birth_date, excluded.birth_date),
      phone = coalesce(people.phone, excluded.phone), municipality = coalesce(people.municipality, excluded.municipality),
      category = coalesce(people.category, excluded.category), role_gestao = coalesce(people.role_gestao, excluded.role_gestao),
      role_cacs = coalesce(people.role_cacs, excluded.role_cacs);

    if f.module_key = 'inscricao' then
      insert into registrations(form_id, training_id, cpf, submitted_at, email, full_name, birth_date, phone, municipality, category,
                                role_gestao, success_case, role_cacs, truth_confirmed, answers)
      values (f.id, f.training_id, v_cpf, v_at, nullif(trim(r->>'email'), ''), v_name, nullif(r->>'birth_date', '')::date,
              nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''), nullif(trim(r->>'municipality'), ''),
              case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end,
              nullif(trim(r->>'role_gestao'), ''), nullif(trim(r->>'success_case'), ''), nullif(trim(r->>'role_cacs'), ''), true,
              jsonb_build_object('importado', true, 'email_sent_at', now()))
      on conflict (training_id, cpf) do nothing;
    elsif f.module_key = 'presenca' then
      v_day := coalesce(nullif(r->>'session_key', ''), to_char(v_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'));
      select exists (select 1 from registrations where training_id = f.training_id and cpf = v_cpf and status = 'valida') into v_reg;
      insert into attendance(form_id, training_id, session_key, cpf, submitted_at, full_name, phone, email, was_registered, birth_date,
                             municipality, category, role_gestao, success_case, role_cacs, answers)
      values (f.id, f.training_id, v_day, v_cpf, v_at, v_name, nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''),
              nullif(trim(r->>'email'), ''), v_reg, nullif(r->>'birth_date', '')::date, nullif(trim(r->>'municipality'), ''),
              case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end,
              nullif(trim(r->>'role_gestao'), ''), nullif(trim(r->>'success_case'), ''), nullif(trim(r->>'role_cacs'), ''),
              jsonb_build_object('importado', true, 'email_sent_at', now()))
      on conflict (training_id, session_key, cpf) do nothing;
    else
      insert into evaluations(form_id, training_id, cpf, submitted_at, full_name, email, phone, municipality, category, ratings, liked, improve,
                              institution_type, institution_name, topics_suggestion, heard_from, comments, answers)
      values (f.id, f.training_id, v_cpf, v_at, v_name, nullif(trim(r->>'email'), ''),
              nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''), nullif(trim(r->>'municipality'), ''),
              case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end,
              coalesce(r->'ratings', '{}'::jsonb), nullif(r->>'liked', ''), nullif(r->>'improve', ''), nullif(r->>'institution_type', ''),
              nullif(r->>'institution_name', ''), nullif(r->>'topics_suggestion', ''),
              case when nullif(r->>'heard_from', '') is null then null else string_to_array(r->>'heard_from', ', ') end,
              nullif(r->>'comments', ''), jsonb_build_object('importado', true, 'email_sent_at', now()))
      on conflict (training_id, cpf) do nothing;
    end if;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then v_ok := v_ok + 1; else v_dup := v_dup + 1; end if;
  end loop;

  insert into audit_log(user_id, module_key, training_id, action, details)
  values (auth.uid(), f.module_key, f.training_id, 'responses.import', jsonb_build_object('gravadas', v_ok, 'repetidas', v_dup, 'invalidas', v_bad));
  return jsonb_build_object('gravadas', v_ok, 'repetidas', v_dup, 'invalidas', v_bad);
end $$;

revoke execute on function public.admin_import_responses(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_responses(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
