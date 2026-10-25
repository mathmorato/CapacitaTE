-- CapacitaTE - Migração 0004b: "Meu perfil" (nome, foto e e-mail), limite de tentativas da data de nascimento
--                              e nome do papel "Administrador Chefe" nas mensagens
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0002, 0002b, 0003 e 0004.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.

-- 1. O próprio usuário altera o seu nome (nomes de outras pessoas continuam só com o superadministrador)
create or replace function public.update_my_name(p_full_name text) returns text
language plpgsql security definer set search_path = public as $$
declare v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then raise exception 'Login necessário.'; end if;
  if length(v_name) < 3 then raise exception 'Informe o nome completo.'; end if;
  update profiles set full_name = v_name where user_id = auth.uid();
  insert into audit_log(user_id, action, target, details)
  values (auth.uid(), 'profile.name', auth.uid()::text, jsonb_build_object('full_name', v_name));
  return v_name;
end $$;
grant execute on function public.update_my_name(text) to authenticated;

-- 2. Foto do perfil: imagem pequena (160x160, JPEG) guardada como data URL; limite de 200 KB
alter table public.profiles add column if not exists avatar text;

create or replace function public.update_my_avatar(p_avatar text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Login necessário.'; end if;
  if p_avatar is not null and (p_avatar !~ '^data:image/(jpeg|png|webp);base64,' or length(p_avatar) > 200000) then
    raise exception 'Foto inválida ou grande demais.';
  end if;
  update profiles set avatar = p_avatar where user_id = auth.uid();
  insert into audit_log(user_id, action, target, details)
  values (auth.uid(), 'profile.avatar', auth.uid()::text, jsonb_build_object('removed', p_avatar is null));
end $$;
grant execute on function public.update_my_avatar(text) to authenticated;

-- 3. Troca de e-mail: feita pelo Supabase Auth (confirmação por link). Quando confirmar, o perfil acompanha.
create or replace function public.handle_auth_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = coalesce(new.email, '') where user_id = new.id;
    insert into audit_log(user_id, action, target, details)
    values (new.id, 'profile.email', new.id::text, jsonb_build_object('from', old.email, 'to', new.email));
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- 4. Limite de tentativas da data de nascimento: a tentativa errada precisa ficar registrada.
--    Antes, o erro desfazia a contagem (rollback) e o limite de 3 tentativas nunca era atingido.
--    Agora a resposta "não confere" volta como {ok:false}, sem erro, e a contagem permanece.
create or replace function public.public_unlock_profile(p_token text, p_cpf text, p_birth_date date default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f forms; v_cpf text := public._digits(p_cpf); p people; r registrations;
begin
  f := public._form_by_token(p_token);
  if not public._cpf_valid(v_cpf) then raise exception 'CPF inválido.'; end if;
  perform public._rate_hit('unlock:' || v_cpf, 3);
  select * into p from people where cpf = v_cpf;
  if p.cpf is null or (p.birth_date is null and p.email is null) or not public._second_factor_ok(p, p_birth_date, p_email) then
    return jsonb_build_object('ok', false, 'message', 'Os dados não conferem. Confira e tente novamente ou preencha manualmente.');
  end if;
  select * into r from registrations where training_id = f.training_id and cpf = v_cpf and status = 'valida';
  return jsonb_build_object(
    'ok', true,
    'full_name', p.full_name, 'email', p.email, 'birth_date', p.birth_date, 'phone', p.phone,
    'municipality', coalesce(r.municipality, p.municipality), 'category', coalesce(r.category, p.category),
    'role_gestao', coalesce(r.role_gestao, p.role_gestao), 'role_cacs', coalesce(r.role_cacs, p.role_cacs),
    'institution', p.institution);
end $$;
grant execute on function public.public_unlock_profile(text, text, date, text) to anon;

-- 5. Papel exibido como "Administrador Chefe" (a coluna continua is_superadmin)
create or replace function public.protect_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_superadmin and (not new.is_admin or not new.is_active) then
    raise exception 'O Administrador Chefe não pode ser rebaixado nem desativado.';
  end if;
  if new.is_superadmin is distinct from old.is_superadmin and current_user in ('authenticated', 'anon') then
    raise exception 'O papel de Administrador Chefe só pode ser alterado no SQL Editor.';
  end if;
  if old.is_admin and old.is_active and (not new.is_admin or not new.is_active) then
    if not exists (select 1 from profiles where is_admin and is_active and user_id <> old.user_id) then
      raise exception 'Não é possível rebaixar ou desativar o último admin ativo.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.admin_update_profile(p_user uuid, p_is_admin boolean default null,
                                                       p_is_active boolean default null, p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente admins podem alterar usuários.'; end if;
  if p_full_name is not null and not public.is_superadmin() then
    raise exception 'Somente o Administrador Chefe pode alterar o nome de usuários.';
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

create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_super boolean;
begin
  if not public.is_superadmin() then raise exception 'Somente o Administrador Chefe pode excluir usuários.'; end if;
  if p_user = auth.uid() then raise exception 'Você não pode excluir a sua própria conta.'; end if;
  select email, is_superadmin into v_email, v_super from public.profiles where user_id = p_user;
  if v_email is null then raise exception 'Usuário não encontrado.'; end if;
  if v_super then raise exception 'Não é possível excluir o Administrador Chefe.'; end if;
  insert into public.audit_log(user_id, action, target, details)
  values (auth.uid(), 'user.delete', p_user::text, jsonb_build_object('email', v_email));
  delete from auth.users where id = p_user;
end $$;
grant execute on function public.admin_delete_user(uuid) to authenticated;

notify pgrst, 'reload schema';
