# CapacitaTE — Publicação no GitHub Pages e checklist de segurança (Fase 6)

## 1. Publicação

- O site publicado é a branch `main` (GitHub Pages: `https://mathmorato.github.io/CapacitaTE/`). Toda versão é feita em `develop` e levada para `main` por um `git worktree` temporário (nunca `git checkout main` na pasta do usuário).
- A conexão com o Supabase vem pronta em `js/core/config.js` (URL e chave pública/publishable). Quem abre o site entra direto, sem digitar nada. A chave pública não é secreta; a proteção está no login e nas políticas RLS.
- Páginas públicas: `publico/inscricao.html`, `publico/presenca.html`, `publico/avaliacao.html`. Elas só chamam as RPCs `public_*`.
- Nunca colocar no código: chave `service_role`, senhas de usuários, senha de app do Gmail. Esses valores ficam em Edge Functions > Secrets.

## 2. Checklist antes de aplicar a 0005 (`0005_rls_endurecida.sql`)

- [ ] Existe pelo menos 1 admin ativo (Administração › Usuários).
- [ ] Você consegue entrar com e-mail e senha (não usando "continuar sem login").
- [ ] A conta de cada pessoa que usa o painel tem as permissões necessárias (`relatorio.view/edit`, `inscricao.view` etc.).
- [ ] Sincronizar funciona logado (botão "Sincronizar" sem erro).
- [ ] Os formulários públicos abrem pelo QR no celular e gravam resposta.
- [ ] O e-mail de confirmação chega (Edge Function `enviar-confirmacao`; segredos `GMAIL_USER` e `GMAIL_APP_PASSWORD`).
- [ ] Você sabe o bloco "REVERTER" no fim da 0005, caso algo pare.

O agente não executa SQL no projeto: o usuário cola a migração no SQL Editor.

## 3. Depois de aplicar a 0005

1. Abra o painel logado: Capacitações, Relatórios, Equipe Técnica e Estrutura do Curso devem carregar.
2. Teste com a chave pública, sem login (ou em janela anônima sem entrar): o site mostra a tela de login e não lista capacitações.
3. Consultas REST com a chave anon devem dar erro ou vir vazias: `/rest/v1/people`, `/rest/v1/trainings`, `/rest/v1/registrations`.
4. As RPCs públicas continuam funcionando (envie uma inscrição de teste).
5. Religar o limite de tentativas dos formulários públicos: `update public.app_settings set value = 'true' where key = 'rate_limit_enabled';`

## 4. Quando mudar para um Supabase local

Seguir `.agents/specs/migracao-supabase-local.md` (inclui 0004g, 0004h, 0004i e 0005 na ordem).
