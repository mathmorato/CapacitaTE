# CapacitaTE — Backlog e estado do projeto

> **Para o agente que continuar:** leia este arquivo depois de `CLAUDE.md`, `.agents/rules/guidelines.md` e
> `.agents/specs/capacitate-modular.md`. Ele registra o que já foi feito, o que está aplicado no Supabase,
> o que falta e as decisões tomadas com o usuário. **Atualize-o a cada versão.**

Última atualização: 25/10/2026 · versão **v.3.8.9** · branch de trabalho `develop` (cada versão também é
sincronizada na `main`, que é o site publicado no GitHub Pages).

---

## 1. Decisões combinadas com o usuário

- **develop e main juntas:** toda versão concluída vai para a `develop` e, em seguida, merge `--no-ff` na `main`
  com a mensagem `v.X.Y.Z: sincroniza branch main com a develop (...)`. A `main` é o site no ar:
  https://mathmorato.github.io/CapacitaTE/
- **Senhas:** o admin **não** vê nem define senhas de outros (removido na v.3.8.2). Cada pessoa cria a senha pelo
  link do convite ou por "Esqueci minha senha". Criar/trocar senha exige digitar duas vezes e força mínima
  "Razoável" (v.3.8.9).
- **Administrador Chefe** (coluna `profiles.is_superadmin`): só `morato@ufg.br`. Só ele exclui usuários e altera
  nomes de outros. Não pode ser rebaixado, desativado nem excluído. O papel só muda pelo SQL Editor.
- **Admins:** `morato@ufg.br` (Administrador Chefe), `jose.souza@discente.ufg.br` e a conta de testes
  `morato+robo@ufg.br` (admin, criada pelo usuário para os testes automatizados do agente; a senha fica com o
  usuário — peça a ele se precisar, nunca grave em arquivo).
- **E-mails:** enviados pelo SMTP do Gmail da conta `morato@ufg.br`, com remetente `cecate@ufg.br` (alias já
  autorizado no Gmail). Resend e domínio próprio foram descartados (sem custo e sem depender da TI).
  Modelos em português em `supabase/templates/` (os seis foram colados no Supabase pelo usuário).
- **Segundo fator** dos formulários públicos: data de nascimento (ou e-mail, se não houver data). Não remover sem
  decisão explícita do usuário (LGPD).
- **Sem domínio próprio por enquanto**; Site URL = GitHub Pages.

## 2. Configuração do Supabase (projeto `tjvhbkhttxbjajcznfrp`, organização CECATE-CO)

| Item | Situação |
|---|---|
| Migração 0002 (login, perfis, permissões, auditoria) | ✅ aplicada |
| Migração 0002b (Administrador Chefe) | ✅ aplicada |
| Migração 0003 (pessoas, formulários, respostas) | ✅ aplicada |
| Migração 0004 (funções públicas dos formulários) | ✅ aplicada |
| Migração 0004b (Meu perfil, foto, limite de tentativas, textos "Administrador Chefe") | ✅ aplicada (25/10) |
| Migração **0004c** (notas da avaliação com itens padrão) | ⏳ **pendente** — o usuário precisa rodar |
| Migração 0005 (RLS endurecida: tirar acesso anônimo de `trainings`/`master_team`) | ⏳ não escrita (Fase 6) |
| Edge Function `admin-invite-user` (só ação `invite`) | ✅ publicada pelo painel, "Verify JWT" desligado |
| SMTP Gmail (smtp.gmail.com:465, user morato@ufg.br, remetente cecate@ufg.br) | ✅ |
| Site URL `https://mathmorato.github.io/CapacitaTE/` + Redirect URLs (Pages, localhost:*, 127.0.0.1:*) | ✅ |
| Modelos de e-mail em português (6) | ✅ |
| Desligar "Enable sign ups" | ⚠️ confirmar com o usuário |

Ordem para um projeto novo: `supabase/schema.sql` contém tudo (idempotente). Depois, primeiro admin com
`select public.bootstrap_admin('email');` e `update public.profiles set is_superadmin = true where email = '...';`.

## 3. Fases da especificação (seção 14)

| Fase | Situação | Versões |
|---|---|---|
| 0. Renomeação | ✅ | v.3.7.7 |
| 1. Núcleo modular (core, registro de módulos, router, menu gerado) | ✅ docx da 16ª CTE idêntico ao da v.3.7.6 | v.3.7.8 |
| 2. Login e permissões | ✅ testado no Supabase real | v.3.8.0 – v.3.8.5, v.3.8.7 |
| 3. Pessoas e formulários | 🔶 em andamento | v.3.8.6 – v.3.8.9 |
| 4. Exportação .xlsx no formato Google Forms | ⏳ | |
| 5. Integração com o Relatório + importação da base | ⏳ | |
| 6. Segurança final (0005, checklist) | ⏳ | |

### Fase 3 — detalhamento

- ✅ Banco: 0003 e 0004 (+ correções 0004b e 0004c).
- ✅ Funções públicas testadas no Supabase real (formulário, CPF, segundo fator, duplicidade, fechado, LGPD,
  bloqueio de leitura anônima, auditoria com CPF mascarado).
- ✅ Páginas públicas `publico/inscricao.html`, `presenca.html`, `avaliacao.html` + `publico.js`/`publico.css` +
  `js/core/formSchema.js`. Teste ponta a ponta no Chrome a 360 px: inscrição, presença de inscrito (tela verde) e
  avaliação funcionam; claro e escuro OK.
- ⏳ **Próximo:** telas internas dos módulos `inscricao`, `presenca`, `avaliacao` (`js/modules/<mod>/`):
  criar/configurar formulário (municípios da Etapa 3 do Relatório, textos padrão de `formSchema.DEFAULTS`),
  abrir/encerrar/agendar, respostas (busca, filtros, editar, cancelar), inclusão manual (`staff_submit`),
  sessões da presença (uma por dia), quadro de frequência, modo recepção, prévia de resultados da avaliação.
- ⏳ QR Code: `js/vendor/qrcode.min.js` (qrcode-generator 1.4.4, MIT) + `js/core/qr.js` (PNG/SVG, cartaz A4),
  botão "Gerar novo link" (`staff_rotate_token`).
- ⏳ Teste em celular real (QR lido pela câmera) — só o usuário pode fazer.
- ⏳ Permissões: os módulos novos devem se registrar com `actions` para aparecerem na matriz de permissões.

## 4. Também entregue (pedidos do usuário fora da especificação)

- Superadmin → "Administrador Chefe"; renomear e excluir usuários (v.3.8.5, v.3.8.7).
- Usuário no menu lateral (foto/iniciais, nome, papel) com menu "Editar perfil" / "Sair" (v.3.8.7).
- "Meu perfil": nome, e-mail (confirmação por link) e foto 160×160 guardada em `profiles.avatar` (v.3.8.7).
- Tela de carregamento ao abrir o painel (v.3.8.9).
- Confirmação de senha e medidor de força (v.3.8.9).
- `input/` e `output/` fora do Git (v.3.7.9) — ainda estão no histórico antigo; reescrever só se o usuário pedir.

## 5. Pendências do usuário

1. Rodar `supabase/migrations/0004c_avaliacao_notas.sql`.
2. Limpar as pessoas de teste (SQL abaixo).
3. Confirmar se "Enable sign ups" está desligado.
4. Testar no celular real e ler o QR (quando existir).
5. Validar o texto de consentimento LGPD com a UFG (`formSchema.DEFAULTS.consentText`).
6. Enviar a base histórica de pessoas (Fase 5).

```sql
-- Limpeza dos dados de teste (pessoas "Teste Automatizado" criadas pelos testes do agente)
delete from public.evaluations  where cpf in (select cpf from public.people where full_name = 'Teste Automatizado');
delete from public.attendance   where cpf in (select cpf from public.people where full_name = 'Teste Automatizado');
delete from public.registrations where cpf in (select cpf from public.people where full_name = 'Teste Automatizado');
delete from public.people where full_name = 'Teste Automatizado';
```

## 6. Como testar (para o agente)

- Os testes rodam com Python + Chrome headless via CDP (scripts temporários no scratchpad da sessão, não versionados):
  login na API com a conta robô, criação de formulários temporários com `session_key = 'teste-e2e'`, navegação
  nas páginas públicas a 360 px e limpeza ao final (apagar os `forms` remove as respostas em cascata; `people`
  só sai pelo SQL acima).
- Regressão do Relatório: gerar o .docx da 16ª CTE com os dados de `input/` na versão atual e na v.3.7.6 e comparar
  `word/document.xml` (deve ser idêntico; duas imagens de páginas de PDF variam a cada execução, normal).
- `scripts/testes-core.html` e `node scripts/testes-core.js`: CPF, formatos, router, registro e permissões.
- SQL: validar com `pglast` (parser do Postgres) antes de entregar; o agente não executa SQL no projeto.

## 7. Problemas conhecidos

- A avaliação gravava notas vazias quando a config do formulário não tinha `ratingItems` (corrigido na 0004c,
  ainda não aplicada).
- O modal de confirmação do app (`openConfirmModal`) mostra "concluído" sem esperar ações assíncronas; na exclusão
  de usuários o resultado real aparece em um toast.
- Topbar pode quebrar o título em telas médias (cosmético).
