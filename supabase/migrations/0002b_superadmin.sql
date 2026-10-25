-- CapacitaTE - Migração 0002b: superadministrador (exclui usuários e altera nomes)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0002.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.

-- 1. Papel de superadministrador (acima de admin). Só se define por SQL, nunca pela tela.
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

update public.profiles set is_superadmin = true, is_admin = true, is_active = true
where lower(email) = 'morato@ufg.br';

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and is_superadmin and is_admin and is_active);
$$;
grant execute on function public.is_superadmin() to authenticated;

-- 2. O superadministrador não pode ser rebaixado nem desativado pela tela; o papel não muda por update comum
create or replace function public.protect_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_superadmin and (not new.is_admin or not new.is_active) then
    raise exception 'O superadministrador não pode ser rebaixado nem desativado.';
  end if;
  if new.is_superadmin is distinct from old.is_superadmin and current_user in ('authenticated', 'anon') then
    raise exception 'O papel de superadministrador só pode ser alterado no SQL Editor.';
  end if;
  if old.is_admin and old.is_active and (not new.is_admin or not new.is_active) then
    if not exists (select 1 from profiles where is_admin and is_active and user_id <> old.user_id) then
      raise exception 'Não é possível rebaixar ou desativar o último admin ativo.';
    end if;
  end if;
  return new;
end $$;

-- 3. Alterar nome: só o superadministrador
create or replace function public.admin_update_profile(p_user uuid, p_is_admin boolean default null,
                                                       p_is_active boolean default null, p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente admins podem alterar usuários.'; end if;
  if p_full_name is not null and not public.is_superadmin() then
    raise exception 'Somente o superadministrador pode alterar o nome de usuários.';
  end if;
  if p_full_name is not null and length(btrim(p_full_name)) = 0 then
    raise exception 'O nome não pode ficar vazio.';
  end if;
  update profiles set
    is_admin  = coalesce(p_is_admin, is_admin),
    is_active = coalesce(p_is_active, is_active),
    full_name = coalesce(regexp_replace(btrim(p_full_name), '\s+', ' ', 'g'), full_name)
  where user_id = p_user;
  insert into audit_log(user_id, action, target, details)
  values (auth.uid(), 'user.update', p_user::text,
          jsonb_strip_nulls(jsonb_build_object('is_admin', p_is_admin, 'is_active', p_is_active, 'full_name', p_full_name)));
end $$;
grant execute on function public.admin_update_profile(uuid, boolean, boolean, text) to authenticated;

-- 4. Excluir usuário: só o superadministrador; não exclui a si mesmo nem outro superadministrador.
--    Remove a conta (auth.users); perfil e permissões saem em cascata. A auditoria guarda o e-mail.
alter table public.module_permissions drop constraint if exists module_permissions_granted_by_fkey;
alter table public.module_permissions add constraint module_permissions_granted_by_fkey
  foreign key (granted_by) references public.profiles(user_id) on delete set null;

create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_super boolean;
begin
  if not public.is_superadmin() then raise exception 'Somente o superadministrador pode excluir usuários.'; end if;
  if p_user = auth.uid() then raise exception 'Você não pode excluir a sua própria conta.'; end if;
  select email, is_superadmin into v_email, v_super from public.profiles where user_id = p_user;
  if v_email is null then raise exception 'Usuário não encontrado.'; end if;
  if v_super then raise exception 'Não é possível excluir um superadministrador.'; end if;
  insert into public.audit_log(user_id, action, target, details)
  values (auth.uid(), 'user.delete', p_user::text, jsonb_build_object('email', v_email));
  delete from auth.users where id = p_user;
end $$;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

notify pgrst, 'reload schema';
