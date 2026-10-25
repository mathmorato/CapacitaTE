-- CapacitaTE - Migração 0004h: excluir permanentemente um item da lixeira (não pode ser desfeito)
-- Execute em: Supabase > SQL Editor > New query > colar > Run. Depende da 0004g. Idempotente.

create or replace function public.staff_purge_response(p_deleted uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d deleted_responses;
begin
  select * into d from deleted_responses where id = p_deleted;
  if d.id is null then raise exception 'Item não encontrado na lixeira.'; end if;
  if not public.has_perm(d.module_key, 'edit', d.training_id) then raise exception 'Você não tem permissão para excluir definitivamente neste módulo.'; end if;
  delete from deleted_responses where id = p_deleted;
  insert into audit_log(user_id, module_key, training_id, action, target, details)
  values (auth.uid(), d.module_key, d.training_id, 'submission.purge',
          '***.' || substr(d.record->>'cpf', 4, 3) || '.' || substr(d.record->>'cpf', 7, 3) || '-**', jsonb_build_object('tabela', d.table_name));
end $$;

revoke execute on function public.staff_purge_response(uuid) from public, anon;
grant execute on function public.staff_purge_response(uuid) to authenticated;
notify pgrst, 'reload schema';
