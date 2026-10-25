-- CapacitaTE - Migração 0004g: lixeira de respostas (excluir e restaurar inscrições, presenças e avaliações)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0003 e da 0004.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
--
-- Excluir: a resposta é copiada inteira para public.deleted_responses e removida da tabela original.
-- Restaurar: a cópia volta para a tabela original com o mesmo id e as mesmas datas, e sai da lixeira.
-- Só quem tem permissão de edição no módulo exclui e restaura; tudo vai para a auditoria.
-- Restaurar não reenvia o e-mail de confirmação (answers.email_sent_at volta junto com o registro).

create table if not exists public.deleted_responses (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null check (table_name in ('registrations', 'attendance', 'evaluations')),
  module_key  text not null,
  record_id   uuid not null,
  training_id text,
  record      jsonb not null,
  deleted_by  uuid,
  deleted_at  timestamptz not null default now()
);
create index if not exists deleted_responses_training_idx on public.deleted_responses (training_id, table_name);

alter table public.deleted_responses enable row level security;
revoke all on public.deleted_responses from anon, authenticated;
grant select on public.deleted_responses to authenticated;
drop policy if exists "deleted_responses_select" on public.deleted_responses;
create policy "deleted_responses_select" on public.deleted_responses for select to authenticated
  using (public.has_perm(module_key, 'view', training_id));

create or replace function public._response_module(p_table text) returns text
language sql immutable as $$
  select case p_table when 'registrations' then 'inscricao' when 'attendance' then 'presenca' when 'evaluations' then 'avaliacao' end;
$$;

-- Exclui uma resposta, guardando a cópia na lixeira
create or replace function public.staff_delete_response(p_table text, p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_module text := public._response_module(p_table); v_row jsonb; v_training text; v_bin uuid;
begin
  if v_module is null then raise exception 'Tabela inválida.'; end if;
  execute format('select to_jsonb(t) from public.%I t where id = $1', p_table) into v_row using p_id;
  if v_row is null then raise exception 'Resposta não encontrada (talvez já tenha sido excluída).'; end if;
  v_training := v_row->>'training_id';
  if not public.has_perm(v_module, 'edit', v_training) then raise exception 'Você não tem permissão para excluir respostas deste módulo.'; end if;
  insert into deleted_responses(table_name, module_key, record_id, training_id, record, deleted_by)
  values (p_table, v_module, p_id, v_training, v_row, auth.uid())
  returning id into v_bin;
  execute format('delete from public.%I where id = $1', p_table) using p_id;
  insert into audit_log(user_id, module_key, training_id, action, target, details)
  values (auth.uid(), v_module, v_training, 'submission.delete',
          '***.' || substr(v_row->>'cpf', 4, 3) || '.' || substr(v_row->>'cpf', 7, 3) || '-**', jsonb_build_object('lixeira', v_bin));
  return v_bin;
end $$;

-- Restaura uma resposta da lixeira (mesmo id e mesmas datas)
create or replace function public.staff_restore_response(p_deleted uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d deleted_responses; v_exists boolean;
begin
  select * into d from deleted_responses where id = p_deleted;
  if d.id is null then raise exception 'Item não encontrado na lixeira.'; end if;
  if not public.has_perm(d.module_key, 'edit', d.training_id) then raise exception 'Você não tem permissão para restaurar respostas deste módulo.'; end if;
  -- Uma resposta é única por CPF (inscrição/avaliação) ou por CPF e dia (presença)
  if d.table_name = 'attendance' then
    select exists (select 1 from attendance where training_id = d.training_id and cpf = d.record->>'cpf' and session_key = d.record->>'session_key') into v_exists;
  else
    execute format('select exists (select 1 from public.%I where training_id = $1 and cpf = $2)', d.table_name) into v_exists using d.training_id, d.record->>'cpf';
  end if;
  if v_exists then raise exception 'Já existe uma resposta ativa deste CPF. Exclua-a antes de restaurar esta.'; end if;
  if not exists (select 1 from forms where id = (d.record->>'form_id')::uuid) then
    raise exception 'O formulário desta resposta foi excluído; não é possível restaurar.';
  end if;
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', d.table_name, d.table_name) using d.record;
  delete from deleted_responses where id = p_deleted;
  insert into audit_log(user_id, module_key, training_id, action, target, details)
  values (auth.uid(), d.module_key, d.training_id, 'submission.restore',
          '***.' || substr(d.record->>'cpf', 4, 3) || '.' || substr(d.record->>'cpf', 7, 3) || '-**', jsonb_build_object('lixeira', p_deleted));
  return d.record_id;
end $$;

revoke execute on function public._response_module(text) from public, anon;
revoke execute on function public.staff_delete_response(text, uuid) from public, anon;
revoke execute on function public.staff_restore_response(uuid) from public, anon;
grant execute on function public.staff_delete_response(text, uuid) to authenticated;
grant execute on function public.staff_restore_response(uuid) to authenticated;

notify pgrst, 'reload schema';
