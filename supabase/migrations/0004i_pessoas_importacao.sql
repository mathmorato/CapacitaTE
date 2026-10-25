-- CapacitaTE - Migração 0004i: importação da base de pessoas e histórico por pessoa (Admin > Importar base / Pessoas)
-- Execute em: Supabase > SQL Editor > New query > colar > Run. Depende da 0003. Idempotente.

-- Importa pessoas em lote (o front envia no máximo 500 linhas por chamada).
-- p_policy: 'vazios' (preenche só campos vazios) ou 'sobrescrever' (o arquivo vale). Devolve contagens.
create or replace function public.admin_import_people(p_rows jsonb, p_policy text default 'vazios') returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; v_cpf text; v_new int := 0; v_upd int := 0; v_same int := 0; v_bad int := 0; v_old people; v_n people;
begin
  if not (public.is_admin() or public.has_perm('pessoas', 'edit')) then raise exception 'Sem permissão para importar pessoas.'; end if;
  if p_policy not in ('vazios', 'sobrescrever') then raise exception 'Política inválida.'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'Envie no máximo 500 linhas por vez.'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_cpf := regexp_replace(coalesce(r->>'cpf', ''), '\D', '', 'g');
    if v_cpf !~ '^[0-9]{11}$' or coalesce(trim(r->>'full_name'), '') = '' then v_bad := v_bad + 1; continue; end if;
    select * into v_old from people where cpf = v_cpf;
    if v_old.cpf is null then
      insert into people(cpf, full_name, email, birth_date, phone, municipality, uf, category, role_gestao, role_cacs, institution, source)
      values (v_cpf, trim(r->>'full_name'), nullif(trim(r->>'email'), ''), nullif(r->>'birth_date', '')::date,
              nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''), nullif(trim(r->>'municipality'), ''), nullif(upper(trim(r->>'uf')), ''),
              case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end,
              nullif(trim(r->>'role_gestao'), ''), nullif(trim(r->>'role_cacs'), ''), nullif(trim(r->>'institution'), ''), 'importacao');
      v_new := v_new + 1;
    else
      v_n := v_old;
      if p_policy = 'sobrescrever' then
        v_n.full_name := coalesce(nullif(trim(r->>'full_name'), ''), v_old.full_name);
        v_n.email := coalesce(nullif(trim(r->>'email'), ''), v_old.email);
        v_n.birth_date := coalesce(nullif(r->>'birth_date', '')::date, v_old.birth_date);
        v_n.phone := coalesce(nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''), v_old.phone);
        v_n.municipality := coalesce(nullif(trim(r->>'municipality'), ''), v_old.municipality);
        v_n.uf := coalesce(nullif(upper(trim(r->>'uf')), ''), v_old.uf);
        v_n.category := coalesce(case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end, v_old.category);
        v_n.role_gestao := coalesce(nullif(trim(r->>'role_gestao'), ''), v_old.role_gestao);
        v_n.role_cacs := coalesce(nullif(trim(r->>'role_cacs'), ''), v_old.role_cacs);
      else
        v_n.email := coalesce(v_old.email, nullif(trim(r->>'email'), ''));
        v_n.birth_date := coalesce(v_old.birth_date, nullif(r->>'birth_date', '')::date);
        v_n.phone := coalesce(v_old.phone, nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''));
        v_n.municipality := coalesce(v_old.municipality, nullif(trim(r->>'municipality'), ''));
        v_n.uf := coalesce(v_old.uf, nullif(upper(trim(r->>'uf')), ''));
        v_n.category := coalesce(v_old.category, case when r->>'category' in ('CACS-FUNDEB', 'Gestão municipal') then r->>'category' end);
        v_n.role_gestao := coalesce(v_old.role_gestao, nullif(trim(r->>'role_gestao'), ''));
        v_n.role_cacs := coalesce(v_old.role_cacs, nullif(trim(r->>'role_cacs'), ''));
      end if;
      if to_jsonb(v_n) = to_jsonb(v_old) then v_same := v_same + 1;
      else
        update people set full_name = v_n.full_name, email = v_n.email, birth_date = v_n.birth_date, phone = v_n.phone, municipality = v_n.municipality,
          uf = v_n.uf, category = v_n.category, role_gestao = v_n.role_gestao, role_cacs = v_n.role_cacs, updated_at = now() where cpf = v_cpf;
        v_upd := v_upd + 1;
      end if;
    end if;
  end loop;
  insert into audit_log(user_id, module_key, action, details)
  values (auth.uid(), 'admin', 'people.import', jsonb_build_object('novos', v_new, 'atualizados', v_upd, 'iguais', v_same, 'invalidos', v_bad, 'politica', p_policy));
  return jsonb_build_object('novos', v_new, 'atualizados', v_upd, 'iguais', v_same, 'invalidos', v_bad);
end $$;

-- Histórico de uma pessoa: capacitações em que se inscreveu, esteve presente e avaliou
create or replace function public.staff_person_history(p_cpf text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if not public.can_view_people() then raise exception 'Sem permissão.'; end if;
  return jsonb_build_object(
    'inscricoes', coalesce((select jsonb_agg(jsonb_build_object('training_id', training_id, 'em', submitted_at, 'status', status) order by submitted_at) from registrations where cpf = v_cpf), '[]'::jsonb),
    'presencas',  coalesce((select jsonb_agg(jsonb_build_object('training_id', training_id, 'dia', session_key, 'em', submitted_at) order by submitted_at) from attendance where cpf = v_cpf), '[]'::jsonb),
    'avaliacoes', coalesce((select jsonb_agg(jsonb_build_object('training_id', training_id, 'em', submitted_at) order by submitted_at) from evaluations where cpf = v_cpf), '[]'::jsonb));
end $$;

revoke execute on function public.admin_import_people(jsonb, text) from public, anon;
revoke execute on function public.staff_person_history(text) from public, anon;
grant execute on function public.admin_import_people(jsonb, text) to authenticated;
grant execute on function public.staff_person_history(text) to authenticated;
notify pgrst, 'reload schema';
