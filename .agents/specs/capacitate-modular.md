# CapacitaTE — Especificação para o agente: plataforma modular

> **Para o agente:** este documento é a ordem de serviço completa. Antes de começar, leia `CLAUDE.md`, `.agents/rules/guidelines.md` e `.agents/rules/AGENTSparaword`. As regras desses arquivos valem integralmente, principalmente **versionamento `v.X.Y.Z`** (Y e Z de 0 a 9), **tema dark padrão + validação dark/light**, **ícones de linha** e **menor impacto possível**. Execute fase por fase (seção 14). Cada fase gera **uma nova versão**, um commit no padrão do projeto e só é concluída depois de validada.

Versão de partida: **v.3.7.6**. A primeira entrega desta especificação (Fase 0) será **v.3.7.7**, seguindo a regra de incremento. Não pule números para "marcar" a mudança de nome.

---

## Sumário

1. Objetivo
2. Decisões de arquitetura (resumo)
3. Renomeação AutoReport CECATE → CapacitaTE
4. Estrutura modular de pastas e o registro de módulos
5. Autenticação, usuários, admins e permissões
6. Modelo de dados no Supabase (SQL completo)
7. Cadastro único de pessoas por CPF (auto-preenchimento)
8. Módulo A: Formulário de inscrição
9. Módulo B: Lista de presença
10. Módulo C: Avaliação da capacitação
11. Páginas públicas e QR Code
12. Exportação de planilhas (formato idêntico ao Google Forms)
13. Integração com o módulo Relatório (existente)
14. Plano de execução por fases, com critérios de aceite
15. Segurança, LGPD e privacidade
16. Validações obrigatórias e testes
17. Como adicionar um módulo futuro (contrato)
18. Pendências que dependem do usuário

---

## 1. Objetivo

Transformar o app atual (gerador do relatório Word) em uma **plataforma modular chamada CapacitaTE**, com:

| Módulo | Chave (`module_key`) | Situação |
|---|---|---|
| Relatório automático | `relatorio` | Já existe. Deve ser encapsulado como módulo **sem mudar o comportamento**. |
| Formulário de inscrição | `inscricao` | Novo |
| Lista de presença | `presenca` | Novo |
| Avaliação da capacitação | `avaliacao` | Novo |
| Administração | `admin` | Novo (usuários, permissões, base de pessoas) |

Requisitos centrais:

- Os três módulos novos ficam **integrados à capacitação** (`trainings`) que já existe. Uma capacitação (ex.: 16ª CTE, Pontes e Lacerda/MT, 23 e 24/06/2026) tem um formulário de inscrição, uma lista de presença e uma avaliação.
- O público responde por **links públicos com QR Code**, sem login.
- O **primeiro campo é sempre o CPF**. Se o CPF já existir na base, os dados são puxados automaticamente (com confirmação, ver seção 7).
- **Admins** gerenciam usuários e definem, por módulo, quem pode ver, editar, exportar e gerar relatório.
- Tudo grava no **Supabase (Postgres)**.
- A exportação gera **planilhas .xlsx com as mesmas colunas, ordem e formatos** das planilhas do Google Forms usadas hoje (seção 12). Assim, o importador atual (`js/excelParser.js`) continua lendo os arquivos sem mudança.
- A estrutura deve permitir **novos módulos no futuro** apenas registrando um módulo novo (seção 17).

---

## 2. Decisões de arquitetura (resumo)

Escolhas obrigatórias, que seguem a regra de menor impacto:

1. **Continua sem build e sem framework.** JavaScript puro, classes, `<script>` na ordem certa, como hoje. Não introduzir React, Vite, TypeScript ou npm no front-end.
2. **Bibliotecas locais em `js/vendor/`**, como hoje. Só entra uma nova: um gerador de QR Code em arquivo único (recomendado: `qrcode-generator` 1.4.4, licença MIT, salvo como `js/vendor/qrcode.min.js`). Não carregar de CDN em tempo de execução.
3. **Duas superfícies:**
   - **Painel interno** (`index.html`): exige login. Contém todos os módulos.
   - **Páginas públicas** (`publico/*.html`): leves, mobile-first, sem login. Não carregam `app.js`, `docx`, `chart`, `pdf` nem nada do painel.
4. **Supabase Auth** (e-mail + senha) para os usuários internos. O público **nunca** acessa tabelas diretamente: ele só chama **funções RPC `security definer`** que validam tudo no servidor.
5. **Fonte da verdade dos módulos novos = Supabase.** O IndexedDB continua como cache e como armazenamento do módulo Relatório, como hoje.
6. **Hospedagem estática obrigatória** para as páginas públicas, porque um QR Code precisa de uma URL pública HTTPS. Opção padrão: GitHub Pages do próprio repositório (o projeto já está no GitHub). A URL base fica na configuração `PUBLIC_BASE_URL` (seção 11.4).
7. O roteamento interno usa **hash** (`#/inscricao/<trainingId>`), para funcionar em hospedagem estática e ao abrir o arquivo localmente.

---

## 3. Renomeação AutoReport CECATE → CapacitaTE

### 3.1 O que muda

- Nome exibido em todos os lugares: `<title>`, cabeçalho, menu lateral, tela inicial, rodapé, mensagens, `README`/`CLAUDE.md`/`guidelines.md`, cabeçalho de todos os `js/*.js` e `css/*.css`, `supabase/schema.sql` e os scripts `.bat`/`.ps1`/`.js`.
  - Padrão dos cabeçalhos: `CapacitaTE - <descrição do arquivo>` e `Versão: v.X.Y.Z`.
- Grafia oficial: **CapacitaTE** (C e TE maiúsculos; "TE" = Transporte Escolar). Subtítulo sugerido no painel: "Plataforma de Gestão de Capacitações em Transporte Escolar — CECATE Centro-Oeste".
- A identidade visual (cores, logos em `assets/`, tipografia) **não muda**. As logos do CECATE continuam. Não crie logo nova para "CapacitaTE". Use o nome em texto, com a tipografia atual.
- O relatório Word **não muda de conteúdo** por causa do nome. Ele é um documento do CECATE e não deve citar "CapacitaTE" em nenhum lugar.

### 3.2 O que NÃO pode mudar (para não perder dados)

- O nome do banco IndexedDB (`this.dbName` em `js/db.js`) e as chaves `localStorage` com prefixo `autoreport_` **ficam como estão**. Renomear apagaria, na prática, os dados salvos no navegador dos usuários.
  - Se quiser padronizar, crie em `js/core/storage.js` um helper `storageGet(key)` que lê primeiro `capacitate_<key>` e, se não existir, `autoreport_<key>`, copiando o valor para a chave nova. **Nunca apague as chaves antigas.**
- As tabelas `trainings` e `master_team` no Supabase **mantêm o nome**.
- A pasta do repositório (`auto-report-cecate-co`) e o nome do repositório no GitHub só podem ser renomeados pelo usuário. Deixe a instrução no resumo final.

### 3.3 Verificação

`grep -rni "autoreport\|auto-report\|AutoReport" --exclude-dir=.git --exclude-dir=.claude --exclude-dir=vendor .` deve retornar **somente** as chaves de armazenamento preservadas de propósito (cada uma com um comentário `// chave legada mantida para compatibilidade`).

---

## 4. Estrutura modular de pastas e o registro de módulos

### 4.1 Pastas novas (o que existe hoje continua no lugar)

```
index.html                      ← painel interno (shell + módulo Relatório, como hoje)
publico/
  inscricao.html                ← página pública do formulário de inscrição
  presenca.html                 ← página pública da lista de presença
  avaliacao.html                ← página pública da avaliação
  publico.css                   ← estilo das páginas públicas (mesmos tokens de cor/tipografia)
  publico.js                    ← motor do formulário público (renderiza a partir de config)
js/
  core/
    config.js                   ← SUPABASE_URL, chave pública, PUBLIC_BASE_URL (lê env.local.js)
    supabaseClient.js           ← cria um único client (extraído de db.js, sem mudar db.js por fora)
    auth.js                     ← login, logout, sessão, perfil e permissões do usuário atual
    permissions.js              ← can(moduleKey, action), guarda de rota e de botão
    router.js                   ← roteador por hash
    moduleRegistry.js           ← registro de módulos (seção 4.2)
    cpf.js                      ← validar, normalizar e formatar CPF (compartilhado com publico/)
    formats.js                  ← telefone, data, data/hora no padrão Google Forms
    formSchema.js               ← tipos de campo e validação dos formulários (compartilhado)
    qr.js                       ← gerar QR (PNG/SVG) e cartaz para impressão
    xlsxExport.js               ← exportadores (seção 12)
    audit.js                    ← grava eventos em audit_log
  modules/
    relatorio/module.js         ← adaptador fino que registra o app atual como módulo
    inscricao/module.js  inscricao/view.js  inscricao/export.js
    presenca/module.js   presenca/view.js   presenca/export.js
    avaliacao/module.js  avaliacao/view.js  avaliacao/export.js
    admin/module.js  admin/usuarios.js  admin/permissoes.js  admin/pessoas.js  admin/importarBase.js
  vendor/qrcode.min.js          ← nova dependência local
supabase/
  schema.sql                    ← continua idempotente; passa a incluir tudo (pode rodar de novo)
  migrations/
    0001_base_existente.sql     ← cópia do schema atual (referência)
    0002_auth_permissoes.sql
    0003_pessoas_formularios.sql
    0004_rpc_publicas.sql
    0005_rls_endurecida.sql     ← remove o acesso anônimo às tabelas (só depois do login funcionar)
.agents/specs/
  capacitate-modular.md         ← este documento
  referencias/                  ← PDFs dos formulários do Google Forms (estrutura das perguntas)
```

`js/app.js` (11,7 mil linhas) **não deve ser reescrito**. O módulo Relatório é só um adaptador que chama o que já existe. Extraia código de `app.js` apenas quando for estritamente necessário para compartilhar (ex.: client do Supabase), sempre preservando a API usada hoje.

### 4.2 Contrato do registro de módulos

```js
// js/core/moduleRegistry.js
window.CapacitaTE = window.CapacitaTE || {};
CapacitaTE.modules = new Map();

/**
 * @typedef {Object} ModuleDef
 * @property {string}   key           'inscricao' (igual a module_key no banco)
 * @property {string}   title         'Formulário de Inscrição'
 * @property {string}   icon          SVG de linha (fill="none", stroke="currentColor")
 * @property {number}   order         posição no menu lateral
 * @property {string[]} actions       ações de permissão do módulo, ex.: ['view','edit','export']
 * @property {boolean}  perTraining   true se o módulo atua dentro de uma capacitação
 * @property {Function} mount         (container, ctx) => void | Promise   ctx = { trainingId, user, can }
 * @property {Function} [unmount]     () => void
 * @property {Function} [trainingTab] devolve o card/aba exibido dentro da página da capacitação
 */
CapacitaTE.registerModule = (def) => { /* valida campos, guarda no Map, ordena por order */ };
```

O menu lateral, o painel inicial e as abas da capacitação são **gerados a partir do registro**, filtrando por `permissions.can(key, 'view')`. Nenhum módulo aparece no menu sem permissão. Reutilize o destaque deslizante do menu (v.3.7.5) e o seletor de abas que já existem.

### 4.3 Navegação do painel

- `#/` — Início: cards dos módulos que o usuário pode ver e lista de capacitações.
- `#/capacitacao/<id>` — página da capacitação, com abas **Relatório | Inscrição | Presença | Avaliação** (somente as permitidas). Cada aba mostra o status (aberto/fechado), o contador de respostas, o QR e o link.
- `#/relatorio/<id>` — assistente atual de 12 etapas (sem mudanças).
- `#/inscricao/<id>`, `#/presenca/<id>`, `#/avaliacao/<id>` — gestão do módulo: configurar formulário, abrir/fechar, ver respostas, editar/excluir, exportar.
- `#/admin/usuarios`, `#/admin/permissoes`, `#/admin/pessoas`, `#/admin/importar`, `#/admin/auditoria`.
- `#/configuracoes` — tela que já existe (conexão com a nuvem), mais o campo `PUBLIC_BASE_URL`.

---

## 5. Autenticação, usuários, admins e permissões

### 5.1 Login

- Tela de login no padrão visual atual (card central, tema dark, logo CECATE), com **e-mail + senha** (`supabase.auth.signInWithPassword`) e "Esqueci minha senha" (`resetPasswordForEmail`).
- **Sem cadastro aberto.** Usuários são criados por um admin (seção 5.3). No painel do Supabase, desative "Enable sign ups" (Authentication > Providers > Email). Registre isso na pendência do usuário.
- Sessão persistida pelo próprio supabase-js. Ao expirar, volta para o login sem perder o rascunho local do Relatório (que fica no IndexedDB).
- **Modo transição:** até a Fase 5 (RLS endurecida), o app precisa continuar funcionando. Mostre o login, mas mantenha as políticas antigas. Só remova o acesso anônimo depois que o primeiro admin existir e o login for validado.

### 5.2 Papéis e ações

- **Admin** (`profiles.is_admin = true`): faz tudo, inclusive gerenciar usuários, permissões, a base de pessoas, ver a auditoria e excluir capacitações.
- **Usuário comum**: recebe permissões por módulo. Matriz de ações:

| module_key | ações possíveis | significado |
|---|---|---|
| `relatorio` | `view`, `edit`, `generate` | ver capacitações e o assistente; editar etapas; gerar/baixar o .docx |
| `inscricao` | `view`, `edit`, `export` | ver respostas; configurar formulário, abrir/fechar, gerar QR, corrigir/excluir respostas; exportar .xlsx |
| `presenca` | `view`, `edit`, `export` | idem para presença |
| `avaliacao` | `view`, `edit`, `export` | idem para avaliação |
| `pessoas` | `view`, `edit` | consultar/editar a base de pessoas (CPF) |

- `edit` implica `view`. `export` e `generate` implicam `view`. Isso é aplicado tanto na UI quanto no SQL.
- **Escopo opcional por capacitação:** a tabela de permissões tem `training_id` anulável. Quando é `null`, a permissão vale para todas as capacitações. Quando preenchido, vale só para aquela capacitação. A UI da Fase 2 só precisa do escopo global, mas o banco e a função `has_perm` já suportam os dois.
- **O primeiro admin** é criado manualmente: o usuário cria a conta em Authentication > Users e roda `select public.bootstrap_admin('email@ufg.br');` (função da seção 6). Documente isso na tela Configurações quando não existir nenhum admin.

### 5.3 Tela Admin › Usuários

- Lista: nome, e-mail, admin (sim/não), ativo, último acesso, módulos permitidos (chips).
- **Convidar usuário**: nome + e-mail + permissões iniciais. Criar usuários no Auth exige a chave `service_role`, que **nunca pode ir para o front-end**. Implemente uma **Supabase Edge Function** `admin-invite-user` (Deno, em `supabase/functions/admin-invite-user/index.ts`). Ela:
  1. valida o JWT de quem chamou e confirma que `profiles.is_admin = true`;
  2. chama `auth.admin.inviteUserByEmail` (o convidado recebe e-mail e define a senha);
  3. cria `profiles` e as permissões;
  4. grava em `audit_log`.
  - Se o usuário não quiser usar Edge Functions, alternativa documentada: criar a conta no painel do Supabase e só depois atribuir permissões pela tela (a tela lista os perfis existentes).
- **Desativar** usuário (`profiles.is_active = false`). Isso bloqueia o acesso via `has_perm` e não apaga nada. **Não existe exclusão de usuário pela tela.**
- Um admin não pode remover o próprio papel de admin se for o último admin ativo (verifique no SQL).

### 5.4 Tela Admin › Permissões

Matriz com usuários nas linhas e módulos × ações nas colunas (checkboxes). Cada alteração salva na hora com toast de confirmação e entrada em `audit_log`. As colunas vêm do registro de módulos (`actions`), para que módulos futuros apareçam sozinhos.

### 5.5 No front-end

`permissions.can(moduleKey, action, trainingId?)` usa o perfil carregado no login (uma consulta a `my_permissions()`). Esconda botões e rotas sem permissão. **Isso é só usabilidade:** a segurança real é o RLS e as RPCs (seção 6).

---

## 6. Modelo de dados no Supabase (SQL completo)

Escreva as migrações na ordem abaixo. Ao final, `supabase/schema.sql` deve conter tudo de forma **idempotente** (`if not exists`, `create or replace`, `drop policy if exists`) e poder ser executado de novo sem perder dados, como hoje. Comentários do SQL em português.

### 6.1 `0002_auth_permissoes.sql`

```sql
-- Perfis dos usuários internos (1:1 com auth.users)
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

-- Permissões por módulo/ação (training_id null = todas as capacitações)
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

-- Primeiro admin (executar no SQL Editor; só funciona se ainda não houver admin)
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
revoke execute on function public.bootstrap_admin(text) from anon, authenticated;

-- Trilha de auditoria
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid,              -- null = público (via RPC)
  module_key  text,
  training_id text,
  action      text not null,     -- 'login','perm.grant','form.open','submission.edit','export',...
  target      text,
  details     jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
```

Inclua também: trigger que cria `profiles` ao surgir um usuário em `auth.users` (com `is_admin=false`, `is_active=true`); trigger de `updated_at`; e uma função que impede desativar ou rebaixar o último admin ativo.

### 6.2 `0003_pessoas_formularios.sql`

```sql
-- Cadastro único de pessoas (chave natural = CPF só com dígitos)
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

-- Instância de formulário por capacitação e módulo
create table if not exists public.forms (
  id            uuid primary key default gen_random_uuid(),
  training_id   text not null references public.trainings(id) on delete cascade,
  module_key    text not null check (module_key in ('inscricao','presenca','avaliacao')),
  session_key   text not null default 'unico', -- presença: 'dia1-manha', 'dia2' etc.
  public_token  text not null unique default encode(gen_random_bytes(12),'hex'),
  status        text not null default 'rascunho' check (status in ('rascunho','aberto','fechado')),
  opens_at      timestamptz,
  closes_at     timestamptz,
  config        jsonb not null default '{}'::jsonb,  -- título, textos, municípios, perguntas (seção 8–10)
  created_by    uuid references public.profiles(user_id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (training_id, module_key, session_key)
);

-- Respostas (uma tabela por módulo: colunas fixas para o que vira planilha + jsonb para extras)
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
  was_registered boolean not null,     -- "Você já está inscrito...?" (calculado, não perguntado)
  birth_date date, phone2 text, municipality text, ibge_code text, category text,
  role_gestao text, success_case text, role_cacs text,
  answers       jsonb not null default '{}'::jsonb,
  unique (training_id, session_key, cpf)
);

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
  unique (training_id, cpf)
);
```

Índices em `(training_id)` e `(form_id)` das três tabelas de respostas. Trigger de `updated_at` em todas.

**Snapshot × cadastro:** cada resposta guarda uma cópia dos dados pessoais **como foram enviados** (o que vai para a planilha da capacitação). O cadastro em `people` é atualizado com os dados mais recentes. Assim, corrigir o telefone de alguém não altera retroativamente as planilhas de capacitações antigas.

### 6.3 `0004_rpc_publicas.sql` — tudo o que o público pode fazer

O público usa a chave `anon` e **só** executa as funções abaixo (todas `security definer`, `set search_path = public`, com validação completa no servidor). Revogue o `execute` padrão e conceda somente estas a `anon`:

| Função | Entrada | Saída / efeito |
|---|---|---|
| `public_get_form(p_token)` | token do QR | `config` público + dados da capacitação (número, polo, UF, datas) + `status` calculado (aberto/fechado/fora do horário). Nunca devolve respostas. |
| `public_lookup_cpf(p_token, p_cpf)` | token + CPF | `{exists:bool, masked_name:'Fa*** D***s', needs_birth_date:bool, already_submitted:bool}`. **Nunca devolve dados pessoais completos** (seção 7). |
| `public_unlock_profile(p_token, p_cpf, p_birth_date)` | + data de nascimento | Se conferir: devolve os dados para pré-preenchimento (nome, e-mail, telefone, município, categoria, cargos). Se errar: erro genérico, e conta a tentativa. |
| `public_submit_registration(p_token, p_payload jsonb)` | | Valida o formulário aberto, CPF (dígitos verificadores), campos obrigatórios, município pertencente à lista do formulário e duplicidade. Faz upsert em `people` e insere em `registrations`. Devolve o comprovante `{protocolo, submitted_at}`. |
| `public_submit_attendance(p_token, p_payload)` | | Igual. `was_registered` = existe inscrição válida para o CPF na capacitação. Se não existir, exige o bloco "Inscrição" (seção 9). |
| `public_submit_evaluation(p_token, p_payload)` | | Igual. Notas inteiras de 1 a 5 para todas as dimensões da config. |

Regras comuns das RPCs:

- **Rate limiting simples:** tabela `public_rate_limit(key text, window_start timestamptz, hits int)` com chave = hash(token + CPF) e hash(token + IP do header `request.headers`). Limite: no máximo 10 consultas de CPF e 3 tentativas de data de nascimento por CPF a cada 15 minutos.
- Toda submissão grava em `audit_log` (com `user_id` nulo e `details` sem dados pessoais além do CPF mascarado).
- Mensagens de erro em português, prontas para exibir ("Este formulário está encerrado.", "CPF inválido.", "Você já respondeu esta avaliação em 23/06/2026 às 16:42.").
- **Reenvio:** inscrição e avaliação aceitam uma resposta por CPF. Se a config permitir (`allowEdit: true`), um novo envio **atualiza** a resposta enquanto o formulário estiver aberto. Presença: uma por CPF por sessão. Um envio repetido devolve "Presença já registrada às HH:MM" e não dá erro.

### 6.4 `0005_rls_endurecida.sql` — só depois que o login estiver validado

- Ative o RLS em todas as tabelas novas.
- Políticas para `authenticated` usando `has_perm`. Exemplos:
  - `registrations`: select se `has_perm('inscricao','view',training_id)`; insert/update/delete se `has_perm('inscricao','edit',training_id)`.
  - `forms`: select se tiver `view` no `module_key` da linha; escrita com `edit`.
  - `people`: select com `has_perm('pessoas','view')` **ou** com `view` em qualquer módulo de formulário (para mostrar nomes); escrita com `has_perm('pessoas','edit')`.
  - `profiles` e `module_permissions`: select do próprio registro ou `is_admin()`; escrita só `is_admin()`.
  - `audit_log`: insert por função; select só `is_admin()`.
- **Tabelas existentes** `trainings` e `master_team`: substitua as políticas `to anon ... using (true)` atuais por:
  - `trainings`: select com `has_perm('relatorio','view')` ou `view` em qualquer módulo; insert/update com `has_perm('relatorio','edit')`; delete só `is_admin()`.
  - `master_team`: select com usuário autenticado ativo; escrita com `has_perm('relatorio','edit')`.
- **Revogue de `anon`** todo acesso direto a tabelas. `anon` só executa as RPCs `public_*`.
- Antes de rodar esta migração, a tela Configurações deve mostrar um checklist: "Existe pelo menos 1 admin ativo", "Você está logado como admin", "Sincronização autenticada OK". O botão "Aplicar segurança" apenas mostra o SQL a copiar. O agente **não** executa SQL no projeto do usuário.

---

## 7. Cadastro único de pessoas por CPF (auto-preenchimento)

### 7.1 Fluxo público (igual nos 3 módulos)

1. **Tela 1: CPF.** Campo único com máscara `000.000.000-00`, teclado numérico (`inputmode="numeric"`), validação dos dígitos verificadores no próprio navegador (`js/core/cpf.js`) e de novo no servidor.
2. Chamada a `public_lookup_cpf`:
   - **CPF novo:** segue para o formulário em branco (o CPF já fica preenchido e travado).
   - **CPF existente:** mostra "Encontramos um cadastro em nome de **Fa\*\*\* D\*\*\*s**. Para carregar seus dados, confirme sua data de nascimento." Campo de data e botões "Confirmar" e "Não sou eu / preencher manualmente".
   - **Já respondeu este formulário:** mostra o comprovante anterior (data e hora), sem dados pessoais. Se `allowEdit` estiver ativo, oferece "Atualizar minha resposta" (exige a data de nascimento).
3. Com a data de nascimento correta, `public_unlock_profile` devolve os dados, e o formulário abre **pré-preenchido e editável**. A pessoa revisa, corrige se precisar (ex.: mudou de cargo ou de município) e envia.
4. Se a pessoa não tiver data de nascimento cadastrada (ex.: importada só da lista de presença), use o **e-mail** como segundo fator: confirme os 3 primeiros caracteres do e-mail mascarado ou digite o e-mail completo. A RPC decide e informa em `needs_birth_date`/`needs_email`.

> **Por que não puxar os dados só com o CPF:** CPF não é segredo. Qualquer pessoa com o QR Code poderia digitar o CPF de outra e ver nome, e-mail, telefone e data de nascimento dela, o que é vazamento de dados pessoais (LGPD). O segundo fator custa um campo a mais e evita esse risco. **Não remova essa etapa sem decisão explícita do usuário.**

### 7.2 Regras de atualização de `people`

- Valores enviados não vazios substituem os do cadastro. Valores vazios não apagam nada.
- `full_name`: corrigir espaços duplos e espaços nas pontas. **Não** mudar maiúsculas/minúsculas automaticamente.
- E-mail em minúsculas e sem espaços. Telefone: guardar só os dígitos e exibir/exportar `(DD)XXXXX-XXXX`.
- Município: guardar o nome **e** o código IBGE, usando o mesmo lookup do `ExcelParser.initIbgeLookup()`. Extraia a lógica para `js/core/` se precisar compartilhar, sem mudar o comportamento do parser.

### 7.3 Importação da base existente (Admin › Importar base)

O usuário vai fornecer uma base de pessoas já cadastradas. Implemente um importador genérico:

1. Upload de `.xlsx`/`.csv` (SheetJS, já presente).
2. **Mapeamento de colunas** com sugestão automática por nome de cabeçalho. Reconheça os cabeçalhos das três planilhas do Google Forms (seção 12) e variações ("CPF:  XXX.XXX.XXX-XX", "Nome Completo:", "E-mail: xxxxxxx@xxxmail.com", etc.).
3. **Pré-visualização** com contagens: novos, atualizados, iguais, inválidos (CPF inválido, CPF vazio) e duplicados no arquivo. Para duplicados no arquivo, vale a linha com o carimbo de data/hora mais recente.
4. **Política de conflito** escolhida na tela: "Preencher só campos vazios" (padrão) ou "Sobrescrever com o arquivo".
5. Gravação em lotes de 500 por RPC `admin_import_people(p_rows jsonb, p_policy text)` (`security definer`, exige `is_admin()` ou `has_perm('pessoas','edit')`), com `source='importacao'`.
6. Relatório final para baixar (.xlsx): linhas rejeitadas e motivo.
7. **Importar respostas históricas (opcional, mesma tela):** ao escolher uma capacitação e o tipo (inscrição/presença/avaliação), as linhas também viram respostas daquela capacitação. Com isso, as capacitações antigas (pastas `01-`, `02-`, `03-`) passam a ter os dados no banco.

### 7.4 Admin › Pessoas

Busca por CPF, nome ou município; histórico de participação da pessoa (capacitações em que se inscreveu, esteve presente e avaliou); edição com auditoria. CPF exibido mascarado na lista (`***.794.758-**`) e completo só no detalhe, para quem tem `pessoas.view`.

---

## 8. Módulo A — Formulário de inscrição

Referência: `.agents/specs/referencias/Formulario_de_inscricao.pdf` e a planilha "2026_16_CTE_Formulario (respostas)".

### 8.1 Configuração (`forms.config`, editável por quem tem `inscricao.edit`)

```json
{
  "title": "Capacitação em Transporte Escolar",
  "intro": "O Fundo Nacional de Desenvolvimento da Educação (FNDE), em parceria com o Centro Colaborador ... nos dias 23 e 24 de junho de 2026.",
  "contacts": { "whatsapp": "(62) 3209-6723", "site": "https://cecate.fct.ufg.br/", "instagram": "@cecate.co" },
  "municipalities": [ { "name": "Araputanga", "ibge": "5101308" }, "... (vem da Etapa 3 do Relatório)" ],
  "requireEmailConfirm": true,
  "truthStatement": "Declaro que revisei e confirmo a veracidade de todas as informações prestadas neste formulário.",
  "allowEdit": true,
  "maxPerMunicipalityPerCategory": null
}
```

- **Texto de apresentação gerado automaticamente** a partir dos dados da capacitação (polo, UF, local, datas, número de municípios). Mesma lógica de texto que o relatório já usa, editável depois.
- **Municípios:** vêm da lista de municípios convocados da capacitação (Etapa 3 do Relatório, a Tabela 1). Botão "Atualizar a partir dos municípios convocados". Exibição numerada e em ordem alfabética, como no Google Forms ("1. Araputanga").
- `maxPerMunicipalityPerCategory`: opcional (ex.: 2, pela regra de 2 vagas CACS e 2 de gestores). Quando preenchido, o formulário público avisa quando a vaga estiver esgotada, mas **aceita a inscrição como "lista de espera"** (`answers.waitlist=true`). Decisão final com o usuário (seção 18).

### 8.2 Campos públicos (ordem exata)

Seção 1 — Dados pessoais:
1. CPF (tela inicial, seção 7)
2. Nome completo *
3. E-mail * (corresponde a "Endereço de e-mail" do Google Forms)
4. Confirme o e-mail * (deve ser igual; não é salvo à parte, mas é exportado igual ao e-mail)
5. Data de nascimento * (seletor de data; exportada como data)
6. Telefone (XX)XXXXX-XXXX * (máscara)
7. Município que representa * (lista da config)
8. Você faz parte do: * (`CACS-FUNDEB` | `Gestão municipal`)

Seção 2 — condicional:
- **Gestão municipal:** "Que cargo você ocupa na gestão municipal?" * e o texto "Prezado(a) Gestor(a), se existe algum caso de sucesso..." (resposta longa, opcional).
- **CACS-FUNDEB:** "Que cargo você ocupa no CACS-FUNDEB?" *

Seção final:
- Checkbox obrigatório com o `truthStatement`.
- Checkbox obrigatório de consentimento LGPD (texto na seção 15).
- Enviar → tela de comprovante: protocolo, nome, capacitação, data/local e "Guarde este comprovante". Botão para salvar como imagem (PNG gerado em canvas).

### 8.3 Gestão interna (`#/inscricao/<trainingId>`)

- Cabeçalho: status (Rascunho/Aberto/Fechado), botões **Abrir** e **Encerrar**, agendamento (`opens_at`/`closes_at`), **QR Code e link** (seção 11).
- **Painel de vagas:** a mesma tabela da aba "Inscritos" da planilha (Município | Inscritos | CACS-FUNDEB | Gestão municipal), com totais e destaque para municípios sem inscritos. Atualiza em tempo real (Supabase Realtime em `registrations` filtrado por `training_id`, com fallback para atualizar a cada 30 s).
- **Tabela de respostas:** busca, filtros (município, categoria, status), ordenação, paginação de 50 linhas. Ações por linha (com `edit`): editar, cancelar (soft, `status='cancelada'`), restaurar. Toda edição vai para a auditoria.
- **Inclusão manual** (com `edit`): mesmo formulário dentro do painel, para inscrições recebidas por telefone ou e-mail.
- **Exportar .xlsx** (com `export`, seção 12.1).

---

## 9. Módulo B — Lista de presença

Referência: `Lista_de_Presenca.pdf` e a planilha "16CTE - Lista de presença (respostas)".

### 9.1 Sessões

Uma capacitação tem várias sessões de presença: por padrão, uma por dia (`dia1`, `dia2`), geradas a partir das datas da capacitação. O admin pode dividir em manhã/tarde (`dia1-manha`, ...). **Cada sessão tem o próprio `forms` e o próprio QR Code.** A config de cada sessão tem `label` ("23/06/2026 — Manhã"), `opens_at` e `closes_at`. Recomendado: abrir no horário da sessão e fechar 2 h depois do fim, para não registrar presença de quem está fora do evento.

Opcional (desligado por padrão): `requireGeolocation` com raio em metros a partir das coordenadas do local. Se ligado, pede a localização do navegador e rejeita fora do raio, com a mensagem "Você precisa estar no local da capacitação". Implementar apenas com a flag; o padrão é desligado.

### 9.2 Fluxo público

1. CPF (seção 7).
2. **Se o CPF tem inscrição válida na capacitação:** mostra "Olá, Fabiano! Confirme sua presença em 23/06/2026." com nome, telefone e e-mail pré-preenchidos (após o segundo fator) e o botão **Confirmar presença**. Grava `was_registered=true`.
3. **Se não tem inscrição:** primeiro os campos da seção 1 do Google Forms (Nome completo, Telefone, E-mail). Depois o bloco "Inscrição" (Data de nascimento, Telefone (XX)XXXXX-XXXX, Município que representa, Você faz parte do, e o cargo condicional, igual à seção 8.2). Grava `was_registered=false`. **Não cria inscrição automaticamente**: o gestor decide no painel ("Converter em inscrição").
   - A pergunta "Você já está inscrito no Curso...?" **não é exibida**, porque o sistema já sabe a resposta. Ela só existe na exportação (Sim/Não, a partir de `was_registered`).
4. Tela de confirmação grande, verde, legível de longe: "Presença registrada — 23/06/2026 09:06". Serve para a equipe conferir a tela do celular na entrada.

### 9.3 Gestão interna

- Abas por sessão, cada uma com QR, status e contador "presentes / inscritos".
- **Quadro de frequência:** linhas = inscritos + presentes não inscritos; colunas = sessões; células ✓/—; coluna "% de presença". Filtros: município, categoria, "somente faltosos", "somente não inscritos".
- **Registro manual de presença** (com `edit`): buscar por CPF ou nome entre os inscritos e marcar. Fica gravado `answers.manual=true` e quem registrou.
- **Modo recepção (tela cheia):** mostra o QR da sessão atual em tamanho grande, com o contador de presentes atualizando em tempo real. Serve para projetar no telão.
- **Exportar .xlsx** (seção 12.2): uma planilha por sessão ou todas juntas, com a coluna da sessão.

---

## 10. Módulo C — Avaliação da capacitação

Referência: `Avaliacao_da_capacitacao.pdf` e a planilha "16CTE - Avaliação (respostas)".

### 10.1 Configuração

```json
{
  "title": "Avaliação da Capacitação",
  "subtitle": "16 CTE - Pontes e Lacerda (MT) 23 e 24 de junho de 2026",
  "ratingLabel": "Avaliar de 1 a 5 (1 significa \"ruim\" e 5 significa \"excelente\")",
  "ratingItems": [
    { "key": "inscricao",  "label": "Inscrição" },
    { "key": "divulgacao", "label": "Divulgação" },
    { "key": "data",       "label": "Data da Formação" },
    { "key": "horario",    "label": "Horário da Formação" },
    { "key": "local",      "label": "Local da Formação" },
    { "key": "duracao",    "label": "Duração da Formação" },
    { "key": "geral",      "label": "Como você avalia a Formação" }
  ],
  "institutionOptions": ["Prefeitura;", "Secretaria Municipal de Educação;", "Secretaria Estadual de Educação;", "Conselheira (o) do CACS/Fundeb", "Outros"],
  "heardFromOptions": ["E-mail encaminhado pelo CECATE/CO", "Oficio de convocação feito pelo FNDE", "Grupos de WhatsApp", "Instagram"],
  "heardFromAllowOther": true,
  "onlyForAttendees": false,
  "allowEdit": false
}
```

> Mantenha **exatamente** os textos das opções, incluindo o ";" e a grafia "Oficio" sem acento. O `excelParser.js` e o relatório (Figuras 4 a 6) podem depender desses valores.

### 10.2 Campos públicos

Seção 1: CPF → Nome completo *, e-mail *, Telefone *, Município que representa *, Você faz parte do *.
Seção 2: grade de notas 1–5 para os 7 itens (no celular, um item por linha com 5 botões grandes; nunca uma tabela larga), "Indique dois aspectos que você mais gostou na Formação" *, "Indique dois aspectos que poderiam ser melhorados na Formação (com detalhes)" *, "Instituição vinculada" (opções).
Seção 3: "Mencionar a Instituição vinculada" * (texto curto).
Seção 4: "Sugestão de temas para futuras capacitações (Webinar, vídeos de Youtube, postagens de Instagram, etc.)", "Como ficou sabendo da Capacitação?" * (caixas de seleção + "Outro" com texto), "Comentários e/ou Sugestões".

`onlyForAttendees: true` (opcional) só aceita avaliação de CPF com presença em pelo menos uma sessão.

### 10.3 Gestão interna

- Status, QR, contador de respostas e taxa de resposta (avaliações ÷ presentes).
- **Prévia dos resultados** usando o `statsEngine.js` e o `chartEngine.js` já existentes: médias por item, distribuição de notas e a separação CACS × Gestores, os mesmos gráficos das Figuras 4 a 6 do relatório. Nuvem de palavras com `wordcloud.js` para "gostou" e "melhorar".
- Tabela de respostas e exportação (seção 12.3).

---

## 11. Páginas públicas e QR Code

### 11.1 URLs

```
{PUBLIC_BASE_URL}/publico/inscricao.html?t=<public_token>
{PUBLIC_BASE_URL}/publico/presenca.html?t=<public_token>
{PUBLIC_BASE_URL}/publico/avaliacao.html?t=<public_token>
```

O token é aleatório (24 caracteres hex) e **não revela** o id da capacitação. Botão **"Gerar novo link"** (com `edit`): troca o token e invalida o QR antigo, com confirmação em modal (o mesmo modal de confirmação do projeto, não `confirm()` nativo).

### 11.2 Requisitos das páginas públicas

- **Mobile-first** (a maioria vai responder pelo celular), sem rolagem horizontal, botões de no mínimo 44 px, fonte de no mínimo 16 px nos campos (evita zoom no iOS).
- Visual: mesmos tokens de cor e tipografia de `css/style.css`, cabeçalho com a logo do CECATE (`assets/`), rodapé com as logos do `visualrelatorio/rodape/rodape_5logos.png`. **As páginas públicas abrem em tema claro por padrão** (leitura sob sol e em celulares simples) e respeitam `prefers-color-scheme`. Valide os dois temas, conforme as regras.
- Formulário dividido em etapas com barra de progresso, como as seções do Google Forms. Botões "Voltar" e "Continuar".
- **Rascunho local:** salva as respostas em `sessionStorage` (com try/catch) para não perder nada ao trocar de aba. Apaga após o envio.
- Carregamento leve: só `publico.js`, `publico.css`, `js/core/cpf.js`, `formats.js`, `formSchema.js`, `config.js` e `supabase.umd.js`. Meta: abrir em menos de 2 s em 3G.
- **Formulário fechado ou fora do horário:** mensagem clara, com as datas e o contato do CECATE.
- **Falha de rede no envio:** mantém os dados na tela e oferece "Tentar novamente". Nunca descarta o que foi digitado.
- Acessibilidade: `label` em todos os campos, foco visível, mensagens de erro ligadas ao campo (`aria-describedby`), navegação por teclado.
- A versão `v.X.Y.Z` também aparece discretamente no rodapé público.

### 11.3 Geração do QR (`js/core/qr.js`)

- Biblioteca local `js/vendor/qrcode.min.js`, com correção de erro nível **M**.
- Na aba de cada módulo: QR em tela, link com botão "Copiar" e as opções:
  - **Baixar PNG** (1024×1024, margem de 4 módulos);
  - **Baixar SVG**;
  - **Imprimir cartaz A4**: página de impressão com a logo do CECATE, o título ("Lista de Presença — 23/06/2026"), o QR grande (≥ 12 cm), o link curto embaixo e a instrução "Aponte a câmera do celular". Use `css/print.css`.
- Teste obrigatório: ler o QR gerado com a câmera de um celular real e chegar à página certa (registre na seção "Validações" do commit).

### 11.4 Configuração da URL pública

- Novo campo `PUBLIC_BASE_URL` no `.env`/`.env.example` e no `scripts/atualizar-env.js`, e editável na tela Configurações.
- Se estiver vazio, a geração de QR fica desabilitada, com a mensagem: "Configure o endereço público (ex.: https://<usuario>.github.io/<repo>) em Configurações".
- Documente no `README` como publicar no **GitHub Pages**: Settings > Pages > Deploy from branch `main` / root. Também precisa ser cadastrado em Supabase > Authentication > URL Configuration (Site URL e Redirect URLs, para o link de convite e de redefinição de senha).
- Atenção: o `.env` e o `js/env.local.js` estão no `.gitignore`. Para a versão publicada funcionar, a URL do Supabase e a **chave pública (anon/publishable)** precisam estar no código publicado (`js/core/config.js`). Isso é seguro **somente depois da Fase 5 (RLS endurecida)**. Explique isso ao usuário e **não publique o site antes da Fase 5**.

---

## 12. Exportação de planilhas (formato idêntico ao Google Forms)

Objetivo: o arquivo exportado deve ser **indistinguível, para o `excelParser.js`, das planilhas baixadas do Google Forms**. Nome da aba principal: **`Respostas ao formulário 1`**. Primeira linha = cabeçalhos **exatamente** como abaixo, incluindo espaços duplos, quebras de linha `\n`, dois-pontos e espaços no final, que existem nos originais.

Formatos comuns:

- **Carimbo de data/hora:** célula de **data/hora do Excel** (não texto), formato `dd/mm/yyyy hh:mm:ss`, no fuso America/Sao_Paulo.
- **Data de nascimento:** célula de data, `dd/mm/yyyy`.
- **CPF:** texto `000.000.000-00`.
- **Telefone:** texto `(DD)XXXXX-XXXX` (sem espaço depois do parêntese, como nos originais).
- **Notas:** números (1 a 5).
- Linhas em ordem de `submitted_at`. Respostas canceladas **não** são exportadas (opção "incluir canceladas" com a coluna extra `Status` no final).
- Larguras de coluna razoáveis, cabeçalho congelado e autofiltro. Sem cores ou estilos que o Google não usa.
- Nome do arquivo: `16CTE - Formulario de inscrição (respostas).xlsx`, `16CTE - Lista de presença (respostas).xlsx`, `16CTE - Avaliação (respostas).xlsx` (mesmo padrão da pasta `input/`). Na presença por sessão: `16CTE - Lista de presença (respostas) - Dia 1.xlsx`.

### 12.1 Inscrição — `Respostas ao formulário 1`

| # | Cabeçalho exato | Origem |
|---|---|---|
| A | `Carimbo de data/hora` | `submitted_at` |
| B | `Endereço de e-mail` | `email` |
| C | `Nome Completo:` | `full_name` |
| D | `Confirme o E-mail` | `email` |
| E | `CPF` | `cpf` formatado |
| F | `Data de Nascimento` | `birth_date` |
| G | `Telefone (XX)XXXXX-XXXX` | `phone` |
| H | `Município que representa:` | `municipality` (nome sem o número de ordem) |
| I | `Você faz parte do:` | `category` |
| J | `Que cargo você ocupa na gestão municipal?` | `role_gestao` |
| K | `Prezado(a) Gestor(a), \n\nSe existe algum caso de sucesso da gestão do transporte escolar no seu município, gostaríamos conhecer mais um pouco ao respeito.\n\nPor favor, relate de forma sucinta o caso de sucesso no espaço a seguir:` | `success_case` |
| L | `Que cargo você ocupa no CACS-FUNDEB?` | `role_cacs` |
| M | `Confirmação de veracidade dos dados` | `truthStatement` quando `truth_confirmed` |

**Segunda aba `Inscritos`** (como no original): cabeçalhos `Município | Inscritos | CACS-FUNDEB | Gestão municipal | (vazio) | Registro`, uma linha por município da config, com **fórmulas** iguais às do original, ajustando o intervalo ao número real de linhas:
- B: `=COUNTIF('Respostas ao formulário 1'!$H$2:$H$N,A2)`
- C/D: `=COUNTIFS('Respostas ao formulário 1'!$H$2:$H$N,$A2,'Respostas ao formulário 1'!$I$2:$I$N,C$1)`
- Linha de total no final. Grave também o valor calculado em cache (`v`), para o arquivo mostrar números mesmo sem recálculo.

### 12.2 Lista de presença — `Respostas ao formulário 1`

| # | Cabeçalho exato | Origem |
|---|---|---|
| A | `Carimbo de data/hora` | `submitted_at` |
| B | `Nome Completo:` | `full_name` |
| C | `CPF:  XXX.XXX.XXX-XX` (dois espaços depois de "CPF:") | `cpf` |
| D | `Telefone: (DD)XXXXX-XXXX` | `phone` |
| E | `E-mail: xxxxxxx@xxxmail.com` | `email` |
| F | `Você já está inscrito no Curso de Capacitação em Transporte Escolar?` | `Sim`/`Não` (`was_registered`) |
| G | `Data de Nascimento` | só quando `was_registered=false` |
| H | `Telefone (XX)XXXXX-XXXX` | `phone2`, idem |
| I | `Município que representa:` | idem |
| J | `Você faz parte do:` | idem |
| K | `Que cargo você ocupa na gestão municipal?` | idem |
| L | (mesmo texto longo do "Prezado(a) Gestor(a)..." da 12.1) | idem |
| M | `Que cargo você ocupa no CACS-FUNDEB?` | idem |

Opcional (checkbox "colunas extras do CapacitaTE", desligado por padrão): `Sessão`, `Registro manual`.

> Atenção: no original, as colunas G–M ficam **vazias para quem já era inscrito**. Mantenha isso. Há uma opção separada "Completar com dados da inscrição", desligada por padrão, para não mudar o que o relatório calcula hoje.

### 12.3 Avaliação — `Respostas ao formulário 1`

| # | Cabeçalho exato |
|---|---|
| A | `Carimbo de data/hora` |
| B | `Nome Completo:` |
| C | `CPF` |
| D | `e-mail` |
| E | `Telefone (XX)XXXXX-XXXX` |
| F | `Município que representa:` |
| G | `Você faz parte do:` |
| H–N | `Avaliar de 1 a 5 (1 significa "ruim" e 5 significa "excelente") [<label do item>]`, um por item de `ratingItems`, na ordem: Inscrição, Divulgação, Data da Formação, Horário da Formação, Local da Formação, Duração da Formação, Como você avalia a Formação |
| O | `Indique dois aspectos que você mais gostou na Formação:` |
| P | `Indique dois aspectos que poderiam ser melhorados na Formação (com detalhes);` |
| Q | `Instituição vinculada: ` (com espaço no final) |
| R | `Mencionar a  Instituição vinculada` (dois espaços entre "a" e "Instituição") |
| S | `Sugestão de temas para futuras capacitações \n(Webinar, vídeos de Youtube, postagens de Instagram, etc.) ` (com `\n` e espaço no final) |
| T | `Como ficou sabendo da Capacitação?` (várias opções unidas por `", "`, como faz o Google) |
| U | `Comentários e/ou Sugestões:` |

### 12.4 Teste de equivalência (obrigatório)

Crie `scripts/validar-exportacao.html` (página de teste local, sem build):

1. Carrega as planilhas reais da pasta `input/` (16CTE) com SheetJS.
2. Converte as linhas no formato do banco (o mesmo mapeamento do importador da seção 7.3).
3. Exporta com `xlsxExport.js`.
4. Compara **cabeçalho por cabeçalho** (igualdade de string, incluindo espaços e `\n`) e **valor por valor** (normalizando data/hora com tolerância de 1 s).
5. Passa os dois arquivos pelo `ExcelParser` + `StatsEngine` e confere se as métricas são **idênticas** (total de inscritos, inscritos por categoria, presentes, médias de cada item da avaliação, municípios).

O resultado aparece na página como uma lista verde/vermelha. Esse teste precisa passar antes de concluir a Fase 4.

---

## 13. Integração com o módulo Relatório (existente)

- **Etapa 3 (Municípios convocados)** alimenta a lista de municípios dos formulários (seção 8.1). Se a lista mudar depois de o formulário ser aberto, mostre um aviso no módulo Inscrição: "A lista de municípios convocados mudou. Atualizar o formulário?"
- **Etapa 7 (Inscrições e Lista de presença)** e **Etapa 8 (Avaliação)** ganham, ao lado do upload atual, a opção **"Usar dados do CapacitaTE"**. Ela:
  1. busca as respostas no Supabase;
  2. monta as linhas **no mesmo formato da exportação (seção 12)**;
  3. entrega essas linhas ao **mesmo** `ExcelParser.parseRegistrationRows` / `parseAttendanceRows` / `parseEvaluationRows` usado hoje.

  Assim, o cálculo do relatório não muda. O upload de arquivo continua disponível (para capacitações antigas ou se a nuvem estiver fora do ar). Registre na capacitação qual foi a fonte usada (`data.sources.inscricao = 'capacitate' | 'arquivo'`) e mostre isso no Painel de Conferência (Etapa 11).
- **Etapa 11 (Painel de Conferência)** ganha verificações cruzadas:
  - presentes não inscritos;
  - inscritos de município não convocado;
  - avaliações de quem não esteve presente;
  - CPFs repetidos com nomes diferentes.
- **Etapa 12 (Geração)** exige `relatorio.generate`.
- Criar uma capacitação nova (dashboard atual) exige `relatorio.edit`. Ao criar, pergunte se quer criar os formulários de inscrição, presença (uma sessão por dia) e avaliação em modo rascunho.

---

## 14. Plano de execução por fases

Cada fase: implementar → validar (seção 16) → incrementar a versão em **todos** os lugares exigidos → commit `v.X.Y.Z: resumo`, com as seções "Versão anterior", "Nova versão", "Alterações" e "Validações". Se uma fase for grande, divida em vários commits, **cada um com a sua versão**.

| Fase | Entrega | Critério de aceite |
|---|---|---|
| **0. Renomeação** | Seção 3 completa. Copiar os PDFs de referência para `.agents/specs/referencias/` e este documento para `.agents/specs/capacitate-modular.md`. Atualizar `CLAUDE.md` com um link para a especificação. | grep da seção 3.3 limpo; app abre, dados antigos do IndexedDB aparecem; dark/light OK. |
| **1. Núcleo modular** | `js/core/*` (config, supabaseClient, router, moduleRegistry, cpf, formats), módulo `relatorio` como adaptador, menu gerado pelo registro. | Assistente de 12 etapas gera um .docx **byte a byte equivalente** (mesmas seções, tabelas e figuras) ao gerado na v.3.7.6 com os mesmos dados de `input/`. |
| **2. Login e permissões** | Migração 0002, tela de login, `auth.js`, `permissions.js`, Admin › Usuários e Permissões, Edge Function de convite, auditoria. RLS **ainda não** endurecida. | Admin consegue dar e tirar permissão; usuário sem `inscricao.view` não vê o módulo; último admin não pode ser rebaixado. |
| **3. Pessoas e formulários** | Migrações 0003 e 0004, `people`, `forms`, RPCs públicas, páginas `publico/*`, os três módulos (configuração, abrir/fechar, respostas, edição manual), QR e cartaz. | Fluxo completo com CPF novo e CPF existente (com segundo fator) nos 3 módulos, em celular real; duplicidade e formulário fechado tratados; rate limit funcionando. |
| **4. Exportação** | `xlsxExport.js` + `scripts/validar-exportacao.html`. | Teste 12.4 verde para as 3 planilhas da 16ª CTE. |
| **5. Integração com o Relatório e importação de base** | Seção 13 + Admin › Importar base e Pessoas. | Relatório gerado com "Usar dados do CapacitaTE" igual ao gerado com upload dos mesmos dados; importação das planilhas históricas sem erros não explicados. |
| **6. Segurança final** | Migração 0005 (RLS endurecida), checklist na tela Configurações, `README` de publicação no GitHub Pages. | Com a chave anon, `select * from people` via REST **retorna erro/vazio**; RPCs públicas funcionam; painel funciona logado. |

---

## 15. Segurança, LGPD e privacidade

- **Chave `service_role`:** nunca no front-end, no repositório ou no `.env` lido pelo navegador. Só em secrets da Edge Function.
- **Consentimento** (checkbox obrigatório nos 3 formulários): "Autorizo o tratamento dos meus dados pessoais pelo CECATE Centro-Oeste/UFG e pelo FNDE exclusivamente para fins de gestão, certificação e avaliação das capacitações em transporte escolar, nos termos da Lei nº 13.709/2018 (LGPD)." O texto fica editável em Configurações e deve ser validado pelo usuário/UFG (seção 18). Grave `answers.consent_at`.
- **Mínimo de exposição:** listas mostram CPF mascarado; dados completos só no detalhe. As RPCs públicas nunca devolvem dados sem o segundo fator.
- **Dados pessoais no Git:** a pasta `input/` está versionada e contém CPFs, e-mails e telefones reais. **Não adicione mais dados pessoais ao repositório.** No resumo final, recomende ao usuário colocar `input/` e `output/` no `.gitignore` e avaliar remover esses arquivos do histórico, já que o repositório está no GitHub. O agente **não** reescreve o histórico por conta própria.
- **Validação dupla:** tudo o que o front-end valida, o servidor valida de novo.
- **Sanitização:** todo texto do usuário exibido no painel passa por escape de HTML (`textContent`, nunca `innerHTML` com dado de usuário). Isso vale principalmente para as respostas longas e as nuvens de palavras.
- Auditoria de: login, mudança de permissão, abrir/fechar formulário, troca de token, edição/cancelamento de resposta, exportação e importação.

---

## 16. Validações obrigatórias e testes

Em **toda** fase, registre na seção "Validações" do commit:

1. `node --check` em todos os `js/**/*.js` alterados (sem erros de sintaxe).
2. O app abre sem erros no console, tanto pelo arquivo local quanto por um servidor local (`npx serve .` ou `python -m http.server`).
3. **Dark e light** conferidos em todas as telas novas e alteradas, incluindo as páginas públicas, os modais e as tabelas.
4. Páginas públicas testadas em largura de 360 px (DevTools) e num celular real.
5. Regressão do Relatório: gerar o .docx da 16ª CTE com os dados de `input/` e comparar com `output/16CTE_Relatório_V01.docx` (mesmo número de tabelas, figuras e seções).
6. SQL: rodar cada migração **duas vezes** num projeto Supabase de teste. A segunda execução não pode dar erro (idempotência).
7. Testes de permissão: um usuário de teste por perfil (admin; só presença; só relatório; sem nada) e conferência de que cada um vê e faz só o permitido, **inclusive via chamadas REST diretas** com o token dele.
8. CPF: casos de teste em `js/core/cpf.js` (página `scripts/testes-core.html`), cobrindo válidos, inválidos, todos os dígitos iguais (`111.111.111-11` é inválido), com e sem máscara.
9. Teste de exportação 12.4 (a partir da Fase 4).

Nunca considere uma fase concluída só porque o código foi escrito. Se algo não pôde ser validado (ex.: não há projeto Supabase de teste), **diga explicitamente** no resumo e no commit.

---

## 17. Como adicionar um módulo futuro (contrato)

Para criar, por exemplo, o módulo "Certificados":

1. Pasta `js/modules/certificados/` com `module.js` chamando `CapacitaTE.registerModule({ key:'certificados', title, icon, order, actions:['view','edit','export'], perTraining:true, mount })`.
2. Incluir o `<script>` em `index.html`, na seção marcada `<!-- MÓDULOS -->`.
3. Se o módulo tiver tabelas: nova migração `supabase/migrations/000N_certificados.sql` com RLS usando `has_perm('certificados', ...)`. Se tiver formulário público, adicionar o `module_key` ao `check` de `forms.module_key` e criar uma RPC `public_submit_<modulo>`.
4. Menu, abas da capacitação e matriz de permissões passam a mostrar o módulo **sem mexer no núcleo**.
5. Documentar em `.agents/specs/` e atualizar a tabela de módulos da seção 1.

O núcleo (`js/core/`) não pode importar nada de `js/modules/`. A dependência é sempre módulo → núcleo.

---

## 18. Pendências que dependem do usuário

O agente deve implementar com os padrões indicados e listar estas pendências no resumo final:

1. **Base de pessoas:** o usuário vai enviar o arquivo. O importador (7.3) já aceita qualquer planilha com mapeamento de colunas.
2. **Primeiro admin:** criar a conta no Supabase e rodar `select public.bootstrap_admin('...');`.
3. **Desativar o cadastro aberto** no Supabase Auth e configurar Site URL e Redirect URLs.
4. **Hospedagem:** confirmar o GitHub Pages (ou outra) e preencher `PUBLIC_BASE_URL`.
5. **Edge Function de convite:** fazer o deploy (`supabase functions deploy admin-invite-user`) ou usar o caminho manual.
6. **Texto de consentimento LGPD:** validar com a UFG.
7. **Segundo fator para o auto-preenchimento:** o padrão é a data de nascimento (seção 7). Se a decisão for outra, registrar aqui.
8. **Limite de vagas por município/categoria:** confirmar se o sistema deve bloquear ou só avisar (padrão: lista de espera).
9. **Renomear o repositório e a pasta** para `capacitate` (opcional, manual).
10. **Dados pessoais versionados em `input/`:** decidir sobre o `.gitignore` e a limpeza do histórico.
