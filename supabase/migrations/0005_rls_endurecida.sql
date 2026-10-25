-- CapacitaTE - Migração 0005: segurança final (RLS endurecida)
-- ATENÇÃO: só rode depois de conferir o checklist em .agents/specs/publicacao-e-seguranca.md.
-- Depois desta migração o acesso anônimo às tabelas deixa de existir: o painel exige login (o modo "continuar sem
-- login" deixa de funcionar com a nuvem). As páginas públicas continuam funcionando, pois só usam as RPCs public_*.
-- Execute em: Supabase > SQL Editor > New query > colar > Run. Idempotente.
-- Para desfazer, rode o bloco "REVERTER" no fim deste arquivo.

-- 1. trainings: só quem tem acesso a algum módulo lê; relatório.edit grava; só admin apaga
drop policy if exists "app_trainings_select" on public.trainings;
drop policy if exists "app_trainings_insert" on public.trainings;
drop policy if exists "app_trainings_update" on public.trainings;
drop policy if exists "app_trainings_delete" on public.trainings;
create policy "app_trainings_select" on public.trainings for select to authenticated
  using (public.has_perm('relatorio', 'view', id) or public.has_perm('inscricao', 'view', id)
      or public.has_perm('presenca', 'view', id) or public.has_perm('avaliacao', 'view', id));
create policy "app_trainings_insert" on public.trainings for insert to authenticated
  with check (public.has_perm('relatorio', 'edit'));
create policy "app_trainings_update" on public.trainings for update to authenticated
  using (public.has_perm('relatorio', 'edit', id)) with check (public.has_perm('relatorio', 'edit', id));
create policy "app_trainings_delete" on public.trainings for delete to authenticated
  using (public.is_admin());

-- 2. master_team: leitura para qualquer usuário autenticado ativo; escrita com relatório.edit
drop policy if exists "app_master_team_select" on public.master_team;
drop policy if exists "app_master_team_write" on public.master_team;
create policy "app_master_team_select" on public.master_team for select to authenticated
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_active));
create policy "app_master_team_write" on public.master_team for all to authenticated
  using (public.has_perm('relatorio', 'edit')) with check (public.has_perm('relatorio', 'edit'));

-- 3. anon não acessa nenhuma tabela diretamente (só executa as RPCs public_*)
revoke all on public.trainings, public.master_team from anon;
revoke all on all tables in schema public from anon;

-- 4. conferência: com a chave anon, estas consultas via REST devem dar erro ou vir vazias
--    GET /rest/v1/people?select=*        GET /rest/v1/trainings?select=id        GET /rest/v1/registrations?select=id

notify pgrst, 'reload schema';

/* REVERTER (cole só este bloco para voltar ao comportamento anterior):
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
*/
