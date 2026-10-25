# CapacitaTE — Definição passo a passo dos formulários públicos

> **Para o agente:** este arquivo é a **fonte oficial** da estrutura dos 3 formulários públicos (Inscrição, Lista de presença e Avaliação). Ele substitui a leitura dos PDFs em `.agents/specs/referencias/`, que são capturas de tela com OCR, servem só para conferência visual e podem ter textos truncados ou repetidos por erro do OCR. **Em caso de divergência, vale este arquivo.**
>
> Os formulários são **genéricos**: nada de capacitação específica (número, cidade, datas, municípios) fica fixo no código. Tudo vem da capacitação (`trainings`) e de `forms.config`, por meio das variáveis da seção 0.

---

## 0. Convenções

### 0.1 Variáveis (preenchidas a partir da capacitação)

| Variável | Origem | Exemplo (16ª CTE) |
|---|---|---|
| `{numero}` | número da capacitação | `16` |
| `{sigla}` | `{numero}CTE` | `16CTE` |
| `{polo}` | município polo | `Pontes e Lacerda` |
| `{uf}` | UF do polo | `MT` |
| `{local}` | local do evento | `Campus de Pontes e Lacerda do Instituto Federal do Mato Grosso (IFMT)` |
| `{datas_extenso}` | datas por extenso | `23 e 24 de junho de 2026` |
| `{qtd_municipios}` | total de municípios convocados | `22` |
| `{estado_extenso}` | nome do estado | `Mato Grosso` |
| `{municipios}` | lista de municípios convocados (Etapa 3 do Relatório), em ordem alfabética | `Araputanga, Campos de Júlio, ...` |
| `{contato_whatsapp}` / `{contato_site}` / `{contato_instagram}` | Configurações | `(62) 3209-6723` / `https://cecate.fct.ufg.br/` / `@cecate.co` |
| `{sessao_label}` | rótulo da sessão de presença | `23/06/2026` ou `23/06/2026 — Manhã` |

### 0.2 Tipos de campo

| Tipo | Componente | Observações |
|---|---|---|
| `cpf` | texto com máscara `000.000.000-00`, `inputmode="numeric"` | valida os dígitos verificadores; rejeita todos os dígitos iguais |
| `texto` | `<input type="text">` | corrigir espaços duplos e espaços nas pontas ao salvar |
| `texto_longo` | `<textarea>` | até 2.000 caracteres |
| `email` | `<input type="email">` | minúsculas, sem espaços |
| `telefone` | máscara `(DD)XXXXX-XXXX`; aceita 10 ou 11 dígitos | salva só os dígitos; exporta formatado |
| `data` | `<input type="date">` | data de nascimento: entre 1920 e (hoje − 14 anos) |
| `lista` | `<select>` | opções exibidas numeradas: `1. Araputanga` |
| `escolha_unica` | botões de opção (radio) | |
| `multipla_escolha` | caixas de seleção (checkbox) | opção "Outro" abre um campo de texto |
| `nota_1a5` | 5 botões grandes (1 a 5) por item | no celular: um item por linha, nunca tabela larga |
| `aceite` | checkbox obrigatório | |

### 0.3 Regras de exibição

- `*` = obrigatório. O erro aparece **abaixo do campo**, em vermelho, e o foco vai para o primeiro campo com erro.
- **Etapas:** cada "Seção" abaixo é uma tela, com barra de progresso, botão **Voltar** e botão **Continuar** (na última, **Enviar**).
- **Condicionais:** uma seção marcada com "Exibir se" só aparece quando a condição é verdadeira. Se o usuário voltar e mudar a resposta, os campos da seção que deixou de valer são **limpos**.
- **Ordem dos campos:** exatamente a ordem destas tabelas.
- **Rótulos (labels):** use o **texto exibido**. O **cabeçalho de exportação** é outro texto, definido na seção 12 da especificação; não misture os dois.

### 0.4 Etapa comum aos 3 formulários: identificação pelo CPF

Esta é sempre a **primeira tela**, antes das seções de cada formulário.

1. Mostrar o cabeçalho do formulário (título e subtítulo).
2. Campo único: **CPF \*** (`cpf`). Botão **Continuar**.
3. Validar o CPF no navegador. Se for inválido: "CPF inválido. Confira os números."
4. Chamar `public_lookup_cpf(token, cpf)`:
   - **`already_submitted = true`** → tela "Você já respondeu este formulário em DD/MM/AAAA às HH:MM." Se `allowEdit` estiver ativo, mostrar o botão "Atualizar minha resposta" (segue para o passo 5). Na presença: "Presença já registrada em {sessao_label} às HH:MM." (fim).
   - **`exists = false`** → segue para a Seção 1 do formulário com todos os campos vazios e o CPF preenchido e travado.
   - **`exists = true`** → passo 5.
5. Mostrar: "Encontramos um cadastro em nome de **{nome mascarado}**. Para carregar seus dados, confirme sua data de nascimento." Campo **Data de nascimento** e botões **Confirmar** / **Não sou eu, preencher manualmente**.
   - Data correta (`public_unlock_profile`) → Seção 1 com os campos **pré-preenchidos e editáveis**.
   - Data errada → "Os dados não conferem." Após 3 erros: "Tente novamente em 15 minutos ou preencha manualmente."
   - "Não sou eu" → Seção 1 em branco (o CPF continua travado).
6. Em todas as telas seguintes, mostrar no topo: "CPF: ***.794.758-** — trocar" (o link "trocar" volta ao passo 2 e limpa tudo).

### 0.5 Etapa comum: envio e comprovante

1. Na última seção, antes do botão **Enviar**, mostrar sempre o campo **Consentimento LGPD \*** (`aceite`, texto em Configurações).
2. Ao enviar: desabilitar o botão e mostrar "Enviando...".
3. Em caso de sucesso, mostrar a tela de comprovante: ícone de linha de confirmação, título (ver cada formulário), nome, capacitação, data/hora do envio e protocolo. Apagar o rascunho do `sessionStorage`.
4. Em caso de erro de rede: manter tudo preenchido e mostrar "Não foi possível enviar. Verifique sua conexão e tente novamente." com o botão **Tentar novamente**.
5. Em caso de erro de validação do servidor: mostrar a mensagem dele e levar à seção do campo com problema.

### 0.6 Bloco reutilizável "DADOS DO PARTICIPANTE"

Usado na Inscrição e reaproveitado na Presença (para quem não é inscrito). Implementar **uma vez** em `js/core/formSchema.js` e reutilizar.

| # | id | Rótulo exibido | Tipo | Obrig. | Regras |
|---|---|---|---|---|---|
| P1 | `birth_date` | Data de Nascimento | `data` | \* | |
| P2 | `phone` | Telefone (XX)XXXXX-XXXX | `telefone` | \* | |
| P3 | `municipality` | Município que representa: | `lista` | \* | opções = `{municipios}` numeradas |
| P4 | `category` | Você faz parte do: | `escolha_unica` | \* | opções exatas: `CACS-FUNDEB` / `Gestão municipal` |

Seções condicionais do bloco:

- **Exibir se `category = Gestão municipal`** — título da seção: **Gestores**
  | id | Rótulo exibido | Tipo | Obrig. |
  |---|---|---|---|
  | `role_gestao` | Que cargo você ocupa na gestão municipal? | `texto` | \* |
  | `success_case` | Prezado(a) Gestor(a), se existe algum caso de sucesso da gestão do transporte escolar no seu município, gostaríamos de conhecer mais um pouco a respeito. Por favor, relate de forma sucinta o caso de sucesso no espaço a seguir: | `texto_longo` | não |
- **Exibir se `category = CACS-FUNDEB`** — título da seção: **CACS-FUNDEB**
  | id | Rótulo exibido | Tipo | Obrig. |
  |---|---|---|---|
  | `role_cacs` | Que cargo você ocupa no CACS-FUNDEB? | `texto` | \* |

> Os textos exibidos podem ter a ortografia corrigida ("conhecer mais um pouco a respeito"), mas os **cabeçalhos de exportação** devem manter o texto original do Google Forms, mesmo com erros (ver seção 12 da especificação).

---

## 1. Formulário de INSCRIÇÃO (`module_key = inscricao`)

**Título:** Capacitação em Transporte Escolar
**Arquivo público:** `publico/inscricao.html?t=<token>`
**Regra de unicidade:** 1 inscrição por CPF por capacitação.

### Passo 1 — Identificação pelo CPF
Seção 0.4.

### Passo 2 — Seção 1: Apresentação e dados pessoais

Texto de apresentação no topo (gerado, editável em `config.intro`):

> O Fundo Nacional de Desenvolvimento da Educação (FNDE), em parceria com o Centro Colaborador de Apoio ao Transporte Escolar da Região Centro-Oeste (CECATE-CO), convida gestores municipais e conselheiros do CACS-FUNDEB de {qtd_municipios} municípios do Estado de {estado_extenso} para a Capacitação em Transporte Escolar, que será realizada no {local}, nos dias {datas_extenso}.
>
> A formação visa aprimorar a gestão do Programa Caminho da Escola e do Programa Nacional de Apoio ao Transporte do Escolar (PNATE) nos municípios. Em um ambiente de troca e diálogo, os participantes inscritos terão acesso às informações sobre os normativos dos programas federais de transporte escolar e orientações sobre execução dos recursos e prestação de contas.
>
> Caso surja alguma nova dúvida, entre em contato através dos seguintes canais de comunicação:
> WhatsApp: {contato_whatsapp} · Site: {contato_site} · Instagram: {contato_instagram}

Campos:

| # | id | Rótulo exibido | Tipo | Obrig. | Regras |
|---|---|---|---|---|---|
| 1 | `full_name` | Nome Completo: | `texto` | \* | mínimo 2 palavras |
| 2 | `email` | E-mail | `email` | \* | |
| 3 | `email_confirm` | Confirme o E-mail | `email` | \* | deve ser igual a `email` (sem diferenciar maiúsculas); erro: "Os e-mails não conferem." Não é salvo à parte. |
| 4–7 | — | **Bloco DADOS DO PARTICIPANTE** (P1 a P4) | | | seção 0.6 |

### Passo 3 — Seção 2 condicional: Gestores **ou** CACS-FUNDEB
Conforme a seção 0.6.

### Passo 4 — Seção final: Confirmação

| id | Rótulo exibido | Tipo | Obrig. |
|---|---|---|---|
| `truth_confirmed` | Declaro que revisei e confirmo a veracidade de todas as informações prestadas neste formulário. | `aceite` | \* |
| `consent` | (texto LGPD) | `aceite` | \* |

Antes do botão **Enviar**, mostrar um **resumo** de tudo o que foi preenchido, com links "editar" para cada seção.

### Passo 5 — Envio e comprovante
Seção 0.5. Título do comprovante: **"Inscrição realizada!"** Se a vaga do município/categoria estiver esgotada (`maxPerMunicipalityPerCategory`): **"Inscrição recebida em lista de espera"**.

**Fluxo:** CPF → Seção 1 → (Gestores | CACS-FUNDEB) → Confirmação → Comprovante.

---

## 2. LISTA DE PRESENÇA (`module_key = presenca`)

**Título:** {sigla} - Lista de Presença
**Subtítulo:** {polo} - {uf} · {datas_extenso} · **Sessão: {sessao_label}**
**Texto:** Seja bem-vindo ao curso de Capacitação em Transporte Escolar (CTE). Este curso tem como objetivo aprimorar os conhecimentos em transporte escolar dos gestores municipais, apresentando os programas do governo federal, mostrando os principais aspectos de planejamento e regulação na área e ensinando o Sistema Eletrônico de Gestão do Transporte Escolar (SETE).
**Arquivo público:** `publico/presenca.html?t=<token>` (um token por sessão)
**Regra de unicidade:** 1 presença por CPF por sessão.

### Passo 1 — Identificação pelo CPF
Seção 0.4. Depois do CPF, o sistema verifica se existe **inscrição válida** desse CPF nesta capacitação e escolhe o caminho A ou B. **A pergunta "Você já está inscrito...?" NÃO é exibida.**

### Caminho A — CPF já inscrito na capacitação (`was_registered = true`)

**Passo A1 — Seção 1: Confirmar dados**

| # | id | Rótulo exibido | Tipo | Obrig. |
|---|---|---|---|---|
| 1 | `full_name` | Nome Completo: | `texto` | \* |
| 2 | `phone` | Telefone: (DD)XXXXX-XXXX | `telefone` | \* |
| 3 | `email` | E-mail: | `email` | \* |

Os campos vêm pré-preenchidos (depois do segundo fator) e podem ser editados.

**Passo A2** — Botão grande **Confirmar presença** → Envio (0.5).

### Caminho B — CPF sem inscrição (`was_registered = false`)

**Passo B1 — Seção 1:** os mesmos 3 campos do A1.

**Passo B2 — Seção 2 "Inscrição":** Bloco **DADOS DO PARTICIPANTE** (P1 a P4, seção 0.6), com o aviso no topo: "Não encontramos sua inscrição. Complete seus dados para registrar a presença."

**Passo B3 — Seção 3 condicional:** Gestores **ou** CACS-FUNDEB (seção 0.6).

**Passo B4** — Botão **Confirmar presença** → Envio (0.5). **Não** cria inscrição automaticamente.

### Comprovante (A e B)
Tela de confirmação grande e verde, legível a distância: **"Presença registrada"**, nome, {sessao_label} e o horário (HH:MM).

### Regras extras
- Fora do horário da sessão (`opens_at`/`closes_at`): "A lista de presença desta sessão não está aberta agora. Horário: ..."
- `requireGeolocation` (desligado por padrão): pede a localização antes do envio.

**Fluxo:** CPF → (inscrito? A: confirmar dados | B: dados + Inscrição + Gestores/CACS) → Confirmar presença → Comprovante.

---

## 3. AVALIAÇÃO DA CAPACITAÇÃO (`module_key = avaliacao`)

**Título:** Avaliação da Capacitação
**Subtítulo:** {numero} CTE - {polo} ({uf}) {datas_extenso}
**Arquivo público:** `publico/avaliacao.html?t=<token>`
**Regra de unicidade:** 1 avaliação por CPF por capacitação (`allowEdit` padrão = false).

### Passo 1 — Identificação pelo CPF
Seção 0.4. Se `onlyForAttendees = true` e o CPF não tiver presença: "A avaliação é destinada aos participantes que registraram presença."

### Passo 2 — Seção 1: Identificação

| # | id | Rótulo exibido | Tipo | Obrig. | Regras |
|---|---|---|---|---|---|
| 1 | `full_name` | Nome Completo: | `texto` | \* | |
| 2 | `email` | E-mail | `email` | \* | |
| 3 | `phone` | Telefone (XX)XXXXX-XXXX | `telefone` | \* | |
| 4 | `municipality` | Município que representa: | `lista` | \* | `{municipios}` numerados |
| 5 | `category` | Você faz parte do: | `escolha_unica` | \* | `CACS-FUNDEB` / `Gestão municipal` |

(Não há perguntas de cargo na avaliação.)

### Passo 3 — Seção 2: Avaliar

Enunciado: **Avaliar de 1 a 5 (1 significa "ruim" e 5 significa "excelente")**. Abaixo dos botões, as legendas "1 = ruim" à esquerda e "5 = excelente" à direita.

| # | chave (`ratings.<chave>`) | Item | Tipo | Obrig. |
|---|---|---|---|---|
| 6 | `inscricao` | Inscrição | `nota_1a5` | \* |
| 7 | `divulgacao` | Divulgação | `nota_1a5` | \* |
| 8 | `data` | Data da Formação | `nota_1a5` | \* |
| 9 | `horario` | Horário da Formação | `nota_1a5` | \* |
| 10 | `local` | Local da Formação | `nota_1a5` | \* |
| 11 | `duracao` | Duração da Formação | `nota_1a5` | \* |
| 12 | `geral` | Como você avalia a Formação | `nota_1a5` | \* |

Depois das notas:

| # | id | Rótulo exibido | Tipo | Obrig. | Opções exatas |
|---|---|---|---|---|---|
| 13 | `liked` | Indique dois aspectos que você mais gostou na Formação: | `texto_longo` | \* | |
| 14 | `improve` | Indique dois aspectos que poderiam ser melhorados na Formação (com detalhes); | `texto_longo` | \* | |
| 15 | `institution_type` | Instituição vinculada: | `escolha_unica` | \* | `Prefeitura;` · `Secretaria Municipal de Educação;` · `Secretaria Estadual de Educação;` · `Conselheira (o) do CACS/Fundeb` · `Outros` |

> Os valores das opções são gravados **exatamente** como estão acima, incluindo o ";". Na tela, o ";" pode ser escondido, mas o valor salvo e exportado não muda.

### Passo 4 — Seção 3: Instituição vinculada

| # | id | Rótulo exibido | Tipo | Obrig. |
|---|---|---|---|---|
| 16 | `institution_name` | Mencionar a Instituição vinculada | `texto` | \* |

Exibida sempre, como no Google Forms. Dica no campo: "Ex.: Secretaria Municipal de Educação de {polo}".

### Passo 5 — Seção 4: CECATE

| # | id | Rótulo exibido | Tipo | Obrig. | Opções exatas |
|---|---|---|---|---|---|
| 17 | `topics_suggestion` | Sugestão de temas para futuras capacitações (Webinar, vídeos de Youtube, postagens de Instagram, etc.) | `texto_longo` | não | |
| 18 | `heard_from` | Como ficou sabendo da Capacitação? | `multipla_escolha` | \* (ao menos 1) | `E-mail encaminhado pelo CECATE/CO` · `Oficio de convocação feito pelo FNDE` · `Grupos de WhatsApp` · `Instagram` · `Outro:` (abre texto; salvar só o texto digitado) |
| 19 | `comments` | Comentários e/ou Sugestões: | `texto_longo` | não | |
| 20 | `consent` | (texto LGPD) | `aceite` | \* | |

### Passo 6 — Envio e comprovante
Seção 0.5. Título do comprovante: **"Avaliação enviada. Obrigado!"**

**Fluxo:** CPF → Identificação → Avaliar → Instituição vinculada → CECATE → Comprovante.

---

## 4. Implementação recomendada (para não errar)

1. Descrever os 3 formulários como **dados** (um objeto JSON por formulário em `js/core/formSchema.js`, exportado como `FORM_SCHEMAS.inscricao|presenca|avaliacao`), contendo seções, campos, tipos, obrigatoriedade, condições (`showIf: { field: 'category', equals: 'Gestão municipal' }`) e opções. Os textos com variáveis usam `{variavel}`, substituídas em tempo de execução.
2. **Um único renderizador** (`publico/publico.js`) que lê o schema e desenha as telas. Não escrever HTML fixo para cada formulário.
3. O **mesmo schema** alimenta:
   - a validação no navegador;
   - o formulário de inclusão manual no painel;
   - a lista de colunas da tabela de respostas;
   - o mapeamento para os cabeçalhos de exportação (adicionar `exportHeader` em cada campo, com o texto exato da seção 12 da especificação).
4. A validação do servidor (RPCs `public_submit_*`) deve conferir os mesmos campos obrigatórios e as mesmas listas de opções. Documente no topo do SQL que o schema JS e o SQL devem ser mantidos iguais.
5. Criar `scripts/testes-formularios.html`, que para cada formulário:
   - renderiza todas as seções com dados de exemplo;
   - testa os dois ramos condicionais (Gestão / CACS) e, na presença, os caminhos A e B;
   - confere que cada campo obrigatório vazio gera erro;
   - confere que o payload gerado contém exatamente os ids desta especificação.

---

## 5. Checklist de conferência (marcar no commit)

- [ ] Inscrição: 13 colunas na exportação, na ordem da seção 12.1 da especificação.
- [ ] Inscrição: e-mail e confirmação de e-mail precisam ser iguais.
- [ ] Inscrição: Gestores mostra `role_gestao` + `success_case`; CACS mostra só `role_cacs`.
- [ ] Presença: a pergunta "Você já está inscrito?" não aparece; `was_registered` é calculado.
- [ ] Presença: o caminho A tem só 3 campos; o caminho B tem os 3 campos + o bloco do participante + o cargo.
- [ ] Presença: um token/QR por sessão; presença duplicada na mesma sessão não gera erro, mostra o horário já registrado.
- [ ] Avaliação: 7 notas obrigatórias de 1 a 5, na ordem da tabela.
- [ ] Avaliação: valores das opções gravados exatamente (com ";" e "Oficio" sem acento).
- [ ] Avaliação: "Como ficou sabendo" aceita várias opções e "Outro".
- [ ] Os 3 formulários: o CPF é sempre a primeira tela; o segundo fator funciona; o consentimento LGPD é obrigatório.
- [ ] Os 3 formulários: testados em 360 px, nos temas claro e escuro.
