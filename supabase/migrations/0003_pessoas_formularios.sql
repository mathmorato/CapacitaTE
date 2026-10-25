-- CapacitaTE - Migração 0003: cadastro único de pessoas, formulários e respostas (Fase 3)
-- Execute em: Supabase > SQL Editor > New query > colar este arquivo > Run. Depende da 0002.
-- Idempotente: pode ser executada de novo sem erro e sem perder dados.
-- As tabelas novas já nascem fechadas ao público: o acesso anônimo é só pelas funções da 0004.

create extension if not exists pgcrypto with schema extensions;

-- 1. Cadastro único de pessoas (chave natural = CPF só com dígitos)
create table if not exists public.people (
  cpf            char(11) primary key check (cpf ~ '^[0-9]{11}$'),
  full_name      text not null,
  email          text,
  birth_date     date,
  phone          text,                 -- somente dígitos: DDD + número
  municipality   text,                 -- nome como exibido
  ibge_code      text,                 -- código IBGE (window.IBGE_DATA)
  uf             char(2),
  category       text check (category in ('CACS-FUNDEB','Gestão municipal')),
  role_gestao    text,                 -- "Que cargo você ocupa na gestão municipal?"
  role_cacs      text,                 -- "Que cargo você ocupa no CACS-FUNDEB?"
  institution    text,
  source         text not null default 'formulario', -- 'formulario' | 'importacao' | 'manual'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists people_name_idx on public.people using gin (to_tsvector('portuguese', full_name));

-- 2. Instância de formulário por capacitação e módulo (presença: uma por sessão)
create table if not exists public.forms (
  id            uuid primary key default gen_random_uuid(),
  training_id   text not null references public.trainings(id) on delete cascade,
  module_key    text not null check (module_key in ('inscricao','presenca','avaliacao')),
  session_key   text not null default 'unico', -- presença: 'dia1', 'dia1-manha' etc.
  public_token  text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  status        text not null default 'rascunho' check (status in ('rascunho','aberto','fechado')),
  opens_at      timestamptz,
  closes_at     timestamptz,
  config        jsonb not null default '{}'::jsonb,  -- título, textos, municípios, perguntas
  created_by    uuid references public.profiles(user_id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (training_id, module_key, session_key)
);

-- 3. Respostas: colunas fixas para o que vira planilha + jsonb para extras.
--    Cada resposta guarda uma cópia dos dados como foram enviados (snapshot); people guarda o mais recente.
create table if not exists public.registrations (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  training_id   text not null references public.trainings(id) on delete cascade,
  cpf           char(11) not null references public.people(cpf),
  submitted_at  timestamptz not null default now(),
  email         text, full_name text, birth_date date, phone text,
  municipality  text, ibge_code text, category text,
  role_gestao   text, success_case text, role_cacs text,
  truth_confirmed boolean not null default false,
  answers       jsonb not null default '{}'::jsonb,
  status        text not null default 'valida' check (status in ('valida','cancelada')),
  updated_at    timestamptz not null default now(),
  unique (training_id, cpf)
);

create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  training_id   text not null references public.trainings(id) on delete cascade,
  session_key   text not null,
  cpf           char(11) not null references public.people(cpf),
  submitted_at  timestamptz not null default now(),
  full_name text, phone text, email text,
  was_registered boolean not null,     -- calculado: existe inscrição válida (não é perguntado)
  birth_date date, phone2 text, municipality text, ibge_code text, category text,
  role_gestao text, success_case text, role_cacs text,
  answers       jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (training_id, session_key, cpf)
);
alter table public.attendance add column if not exists updated_at timestamptz not null default now();

create table if not exists public.evaluations (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  training_id   text not null references public.trainings(id) on delete cascade,
  cpf           char(11) not null references public.people(cpf),
  submitted_at  timestamptz not null default now(),
  full_name text, email text, phone text, municipality text, ibge_code text, category text,
  ratings       jsonb not null,        -- {"inscricao":5,"divulgacao":5,...} (chaves = config)
  liked text, improve text, institution_type text, institution_name text,
  topics_suggestion text, heard_from text[], comments text,
  answers       jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (training_id, cpf)
);
alter table public.evaluations add column if not exists updated_at timestamptz not null default now();

create index if not exists registrations_training_idx on public.registrations (training_id);
create index if not exists registrations_form_idx on public.registrations (form_id);
create index if not exists attendance_training_idx on public.attendance (training_id);
create index if not exists attendance_form_idx on public.attendance (form_id);
create index if not exists evaluations_training_idx on public.evaluations (training_id);
create index if not exists evaluations_form_idx on public.evaluations (form_id);
create index if not exists forms_training_idx on public.forms (training_id);

-- 4. updated_at automático (função touch_updated_at criada na 0002)
drop trigger if exists people_touch_updated_at on public.people;
create trigger people_touch_updated_at before update on public.people
  for each row execute function public.touch_updated_at();
drop trigger if exists forms_touch_updated_at on public.forms;
create trigger forms_touch_updated_at before update on public.forms
  for each row execute function public.touch_updated_at();
drop trigger if exists registrations_touch_updated_at on public.registrations;
create trigger registrations_touch_updated_at before update on public.registrations
  for each row execute function public.touch_updated_at();
drop trigger if exists attendance_touch_updated_at on public.attendance;
create trigger attendance_touch_updated_at before update on public.attendance
  for each row execute function public.touch_updated_at();
drop trigger if exists evaluations_touch_updated_at on public.evaluations;
create trigger evaluations_touch_updated_at before update on public.evaluations
  for each row execute function public.touch_updated_at();

-- 5. RLS: somente usuários logados com permissão no módulo. Nada para anon.
alter table public.people enable row level security;
alter table public.forms enable row level security;
alter table public.registrations enable row level security;
alter table public.attendance enable row level security;
alter table public.evaluations enable row level security;

-- Pode ver nomes de pessoas quem tem pessoas.view ou view em algum módulo de formulário
create or replace function public.can_view_people() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_perm('pessoas','view') or public.has_perm('inscricao','view')
      or public.has_perm('presenca','view') or public.has_perm('avaliacao','view');
$$;

drop policy if exists "people_select" on public.people;
create policy "people_select" on public.people for select to authenticated using (public.can_view_people());
drop policy if exists "people_write" on public.people;
create policy "people_write" on public.people for update to authenticated
  using (public.has_perm('pessoas','edit')) with check (public.has_perm('pessoas','edit'));

drop policy if exists "forms_select" on public.forms;
create policy "forms_select" on public.forms for select to authenticated
  using (public.has_perm(module_key, 'view', training_id));
drop policy if exists "forms_insert" on public.forms;
create policy "forms_insert" on public.forms for insert to authenticated
  with check (public.has_perm(module_key, 'edit', training_id));
drop policy if exists "forms_update" on public.forms;
create policy "forms_update" on public.forms for update to authenticated
  using (public.has_perm(module_key, 'edit', training_id)) with check (public.has_perm(module_key, 'edit', training_id));
drop policy if exists "forms_delete" on public.forms;
create policy "forms_delete" on public.forms for delete to authenticated
  using (public.has_perm(module_key, 'edit', training_id));

drop policy if exists "registrations_select" on public.registrations;
create policy "registrations_select" on public.registrations for select to authenticated
  using (public.has_perm('inscricao', 'view', training_id));
drop policy if exists "registrations_update" on public.registrations;
create policy "registrations_update" on public.registrations for update to authenticated
  using (public.has_perm('inscricao', 'edit', training_id)) with check (public.has_perm('inscricao', 'edit', training_id));

drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance for select to authenticated
  using (public.has_perm('presenca', 'view', training_id));
drop policy if exists "attendance_delete" on public.attendance;
create policy "attendance_delete" on public.attendance for delete to authenticated
  using (public.has_perm('presenca', 'edit', training_id));

drop policy if exists "evaluations_select" on public.evaluations;
create policy "evaluations_select" on public.evaluations for select to authenticated
  using (public.has_perm('avaliacao', 'view', training_id));
drop policy if exists "evaluations_delete" on public.evaluations;
create policy "evaluations_delete" on public.evaluations for delete to authenticated
  using (public.has_perm('avaliacao', 'edit', training_id));

revoke all on public.people, public.forms, public.registrations, public.attendance, public.evaluations from anon;
grant select, update on public.people to authenticated;
grant select, insert, update, delete on public.forms to authenticated;
grant select, update on public.registrations to authenticated;
grant select, delete on public.attendance, public.evaluations to authenticated;

notify pgrst, 'reload schema';
