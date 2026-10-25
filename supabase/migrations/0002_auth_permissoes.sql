-- CapacitaTE - Migração 0002: login, perfis, permissões por módulo e auditoria (Fase 2)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
-- Modo transição: as políticas antigas de trainings e master_team NÃO mudam aqui (isso fica para a 0005).

-- 1. Perfis dos usuários internos (1:1 com auth.users)
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  is_admin    boolean not null default false,
  is_active   boolean not null default true,
  last_seen   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Permissões por módulo/ação (training_id null = todas as capacitações)
create table if not exists public.module_permissions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  module_key  text not null,
  action      text not null,
  training_id text references public.trainings(id) on delete cascade,
  granted_by  uuid references public.profiles(user_id),
  created_at  timestamptz not null default now()
);
-- Nulos não colidem no unique comum; por isso o índice usa coalesce
create unique index if not exists module_permissions_uniq
  on public.module_permissions (user_id, module_key, action, coalesce(training_id, '*'));

-- 3. Trilha de auditoria
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid,              -- null = público (via RPC)
  module_key  text,
  training_id text,
  action      text not null,     -- 'login','perm.grant','perm.revoke','user.admin','user.active','user.invite',...
  target      text,
  details     jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

-- 4. Funções de permissão
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and is_admin and is_active);
$$;

-- p_action 'view' é satisfeita por edit/export/generate
create or replace function public.has_perm(p_module text, p_action text, p_training text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from module_permissions mp
    join profiles p on p.user_id = mp.user_id and p.is_active
    where mp.user_id = auth.uid()
      and mp.module_key = p_module
      and (mp.action = p_action or (p_action = 'view' and mp.action in ('edit','export','generate')))
      and (mp.training_id is null or mp.training_id = p_training)
  );
$$;

create or replace function public.my_permissions()
returns table(module_key text, action text, training_id text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select mp.module_key, mp.action, mp.training_id, p.is_admin
  from profiles p left join module_permissions mp on mp.user_id = p.user_id
  where p.user_id = auth.uid() and p.is_active;
$$;

-- 5. Primeiro admin (executar no SQL Editor; só funciona se ainda não houver admin)
create or replace function public.bootstrap_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if exists (select 1 from profiles where is_admin) then
    return 'Já existe admin; use a tela Admin.';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then return 'Usuário não encontrado em Authentication > Users.'; end if;
  insert into profiles(user_id, email, is_admin) values (v_uid, p_email, true)
    on conflict (user_id) do update set is_admin = true, is_active = true;
  return 'Admin definido: ' || p_email;
end $$;
revoke execute on function public.bootstrap_admin(text) from public, anon, authenticated;

-- Situação da configuração, para a tela de login saber se já existe admin (não expõe dados pessoais)
create or replace function public.auth_setup_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('installed', true, 'has_admin', exists (select 1 from profiles where is_admin and is_active));
$$;
grant execute on function public.auth_setup_status() to anon, authenticated;

-- 6. Triggers: perfil criado junto com o usuário, updated_at e proteção do último admin
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(user_id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Usuários que já existiam antes desta migração também ganham perfil
insert into public.profiles(user_id, email, full_name)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.protect_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_admin and old.is_active and (not new.is_admin or not new.is_active) then
    if not exists (select 1 from profiles where is_admin and is_active and user_id <> old.user_id) then
      raise exception 'Não é possível rebaixar ou desativar o último admin ativo.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_last_admin on public.profiles;
create trigger profiles_protect_last_admin before update on public.profiles
  for each row execute function public.protect_last_admin();

-- 7. RLS: leitura do próprio perfil (ou de todos, para admin). Escritas só pelas funções abaixo.
alter table public.profiles enable row level security;
alter table public.module_permissions enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "module_permissions_select" on public.module_permissions;
create policy "module_permissions_select" on public.module_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.profiles, public.module_permissions, public.audit_log from anon, authenticated;
grant select on public.profiles, public.module_permissions, public.audit_log to authenticated;

-- 8. Funções usadas pelo painel (todas validam o chamador no servidor e gravam auditoria)
create or replace function public.log_event(p_action text, p_module text default null, p_training text default null,
                                            p_target text default null, p_details jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Login necessário.'; end if;
  insert into audit_log(user_id, module_key, training_id, action, target, details)
  values (auth.uid(), p_module, p_training, left(p_action, 60), left(p_target, 200), p_details);
  if p_action = 'login' then
    update profiles set last_seen = now() where user_id = auth.uid();
  end if;
end $$;
grant execute on function public.log_event(text, text, text, text, jsonb) to authenticated;

create or replace function public.admin_set_permission(p_user uuid, p_module text, p_action text, p_grant boolean,
                                                       p_training text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente admins podem alterar permissões.'; end if;
  if p_module !~ '^[a-z][a-z0-9_]*$' or p_action !~ '^[a-z][a-z0-9_]*$' then raise exception 'Módulo ou ação inválidos.'; end if;
  if p_grant then
    insert into module_permissions(user_id, module_key, action, training_id, granted_by)
    values (p_user, p_module, p_action, p_training, auth.uid())
    on conflict (user_id, module_key, action, (coalesce(training_id, '*'))) do nothing;
  else
    delete from module_permissions
    where user_id = p_user and module_key = p_module and action = p_action
      and coalesce(training_id, '*') = coalesce(p_training, '*');
  end if;
  insert into audit_log(user_id, module_key, training_id, action, target, details)
  values (auth.uid(), p_module, p_training, case when p_grant then 'perm.grant' else 'perm.revoke' end,
          p_user::text, jsonb_build_object('action', p_action));
end $$;
grant execute on function public.admin_set_permission(uuid, text, text, boolean, text) to authenticated;

create or replace function public.admin_update_profile(p_user uuid, p_is_admin boolean default null,
                                                       p_is_active boolean default null, p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Somente admins podem alterar usuários.'; end if;
  -- o trigger protect_last_admin impede rebaixar/desativar o último admin ativo
  update profiles set
    is_admin  = coalesce(p_is_admin, is_admin),
    is_active = coalesce(p_is_active, is_active),
    full_name = coalesce(p_full_name, full_name)
  where user_id = p_user;
  insert into audit_log(user_id, action, target, details)
  values (auth.uid(), 'user.update', p_user::text,
          jsonb_strip_nulls(jsonb_build_object('is_admin', p_is_admin, 'is_active', p_is_active, 'full_name', p_full_name)));
end $$;
grant execute on function public.admin_update_profile(uuid, boolean, boolean, text) to authenticated;

-- 9. Atualiza o cache da API
notify pgrst, 'reload schema';
