-- CapacitaTE - Migração 0001: estrutura existente até a v.3.7.9 (referência; já aplicada nos projetos em uso)
-- CapacitaTE - estrutura da nuvem (Supabase)
-- Execute uma única vez em: Supabase > SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado novamente sem perder dados (usa "if not exists").

-- 1. Capacitações (cada linha guarda a capacitação completa no campo "data")
create table if not exists public.trainings (
  id            text primary key,
  number        integer,
  polo          text default '',
  uf            text default '',
  status        text default 'in_progress',
  is_historical boolean default false,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists trainings_updated_at_idx on public.trainings (updated_at desc);
create index if not exists trainings_number_idx on public.trainings (number);

-- 2. Catálogo da equipe mestra
create table if not exists public.master_team (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Acesso pelo app (chave pública "publishable/anon")
-- O app não tem login: ele lê, grava e exclui com a chave pública. As políticas abaixo liberam isso
-- para quem tiver a chave do projeto. Não publique a chave em sites abertos se os dados forem sensíveis.
alter table public.trainings enable row level security;
alter table public.master_team enable row level security;

drop policy if exists "app_trainings_select" on public.trainings;
drop policy if exists "app_trainings_insert" on public.trainings;
drop policy if exists "app_trainings_update" on public.trainings;
drop policy if exists "app_trainings_delete" on public.trainings;
create policy "app_trainings_select" on public.trainings for select to anon, authenticated using (true);
create policy "app_trainings_insert" on public.trainings for insert to anon, authenticated with check (true);
create policy "app_trainings_update" on public.trainings for update to anon, authenticated using (true) with check (true);
create policy "app_trainings_delete" on public.trainings for delete to anon, authenticated using (true);

drop policy if exists "app_master_team_select" on public.master_team;
drop policy if exists "app_master_team_write" on public.master_team;
create policy "app_master_team_select" on public.master_team for select to anon, authenticated using (true);
create policy "app_master_team_write" on public.master_team for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.trainings to anon, authenticated;
grant select, insert, update, delete on public.master_team to anon, authenticated;

-- 4. Atualiza o cache da API para as tabelas novas aparecerem imediatamente
notify pgrst, 'reload schema';
