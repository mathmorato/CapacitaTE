---
trigger: always_on
---

# Diretrizes para Desenvolvimento e Manutenção do Projeto

## 1. Regra geral de execução

Estas diretrizes constituem **autorização prévia para realizar todas as modificações necessárias no projeto**, desde que estejam relacionadas à solicitação apresentada e respeitem integralmente as regras deste documento.

### 1.1 Execução autônoma

O agente deverá:

* Executar diretamente as alterações necessárias para atender à solicitação.
* Não solicitar autorização, confirmação ou aprovação antes de modificar arquivos.
* Não interromper a execução para perguntar se deve criar, editar, remover ou substituir arquivos que sejam tecnicamente necessários para realizar a tarefa.
* Tomar decisões técnicas de implementação de forma autônoma.
* Escolher a solução mais adequada com base na estrutura existente do projeto.
* Preservar funcionalidades, configurações e componentes que não estejam relacionados à solicitação.
* Fazer as alterações necessárias até que a tarefa esteja efetivamente concluída.
* Corrigir automaticamente erros encontrados durante a implementação ou validação, sempre que a correção estiver dentro do escopo da tarefa.
* Não considerar uma tarefa concluída apenas após alterar o código. A implementação deverá ser validada.

### 1.2 Limite da autonomia

A autonomia para modificar o projeto não autoriza:

* Remover funcionalidades sem necessidade.
* Alterar funcionalidades não relacionadas à solicitação.
* Modificar a identidade visual sem necessidade.
* Trocar tecnologias ou dependências sem necessidade.
* Alterar configurações de infraestrutura sem avaliar o impacto.
* Apagar dados, arquivos ou configurações importantes sem necessidade técnica.
* Introduzir alterações que contrariem as demais regras deste documento.

Quando houver mais de uma solução tecnicamente possível, escolher a solução que produza **menor impacto no projeto existente**, mantendo compatibilidade e consistência com a arquitetura atual.

---

# 2. Referência visual e identidade do projeto

## 2.1 Projeto de referência

Utilize como referência visual e estrutural o projeto localizado em:

`C:\Antigravity\automatizador-preenchimento-de-planilha-fnde`

O objetivo é reproduzir e preservar o padrão visual e estrutural estabelecido nesse projeto.

Antes de realizar alterações visuais, analisar a implementação existente no projeto de referência e utilizar seus padrões como base.

## 2.2 Tema visual e validação obrigatória (Modo Escuro e Claro)

A aplicação deverá:

* Manter o tema dark como padrão.
* Preservar a identidade visual existente.
* Manter padrões semelhantes de:

  * Tipografia.
  * Espaçamentos.
  * Bordas.
  * Cards.
  * Botões.
  * Campos de entrada.
  * Menus.
  * Cabeçalhos.
  * Rodapés.
  * Estados de interação.
  * Ícones (obrigatoriamente ícones de linha / line icons).
  * Hierarquia visual.

Evitar alterações visuais que descaracterizem o projeto.

Não criar uma nova identidade visual quando já existir uma solução equivalente no projeto de referência.

### Validação Obrigatória em Modo Escuro e Modo Claro (Dark & Light Mode)

Sempre que for realizada qualquer alteração de design, layout, componente visual, modal, botão, texto, tabela ou formulário:

* **É obrigatório validar a visualização e legibilidade tanto no modo escuro (*dark mode*) quanto no modo claro (*light mode*)**.
* Garantir alto contraste e perfeita legibilidade dos textos, botões e elementos interativos em ambos os modos.
* Evitar fundos transparentes acidentais que comprometam a legibilidade de textos sobre o plano de fundo em qualquer um dos temas.
* Assegurar que botões secundários, primários e de destaque mantenham nitidez e distinção visual imediata tanto no tema claro quanto no escuro.

## 2.3 Logos e assets

As logos e demais recursos visuais já foram disponibilizados na pasta:

`assets`

Antes de criar qualquer novo recurso visual:

1. Verificar se o asset necessário já existe.
2. Reutilizar o asset existente sempre que possível.
3. Não criar versões alternativas de logos já existentes.
4. Não substituir logos existentes sem necessidade.
5. Preservar proporções, qualidade e identidade dos assets existentes.

## 2.4 Padrão de ícones (Ícones de linha / Line Icons)

Todos os ícones do projeto deverão obrigatoriamente ser **ícones de linha (*line icons*)**.

* **Definição e conceito:** Ícones de linha (*line icons*) são gráficos minimalistas formados apenas por contornos e traços, muito usados em design de interfaces (UI/UX) para criar uma aparência limpa e moderna.
* **Construção visual e técnica:** Os ícones devem ser compostos por contornos com preenchimento transparente ou nulo (`fill="none"`), cor de traço corrente (`stroke="currentColor"`), espessura de traço uniforme (ex.: `stroke-width="2"`) e junções/terminações suaves (`stroke-linecap="round"` e `stroke-linejoin="round"`).
* **Proibição de ícones sólidos ou preenchidos:** É expressamente vedado o uso de ícones sólidos, com preenchimentos opacos ou blocos pesados (*solid/filled icons*), mantendo a leveza visual, elegância e consistência com a identidade dark moderna da interface.

---

# 3. Sistema de versionamento

## 3.1 Formato obrigatório

A versão deverá seguir obrigatoriamente o formato:

`v.X.Y.Z`

Exemplo:

`v.1.0.0`

A versão deverá estar visível no rodapé da aplicação.

## 3.2 Regra de incremento

A ordem de crescimento será:

`Z → Y → X`

### Incremento de Z

Enquanto Z for menor que 9, incrementar apenas Z.

Exemplo:

`v.1.0.0 → v.1.0.1`

até:

`v.1.0.9`

### Incremento de Y

Quando Z estiver em 9 e uma nova alteração exigir incremento:

`v.1.0.9 → v.1.1.0`

Z retorna para 0 e Y aumenta em 1.

### Incremento de X

Quando Y e Z estiverem em 9:

`v.1.9.9 → v.2.0.0`

Y e Z retornam para 0 e X aumenta em 1.

### Limites

* Z nunca poderá ser maior que 9.
* Y nunca poderá ser maior que 9.
* X não possui limite superior.
* Nunca utilizar `v.1.0.10`.
* Nunca utilizar `v.1.10.0`.

### Tabela de verificação (obrigatória antes de definir a próxima versão)

| Versão atual | Próxima versão correta | Errado (proibido) |
|---|---|---|
| `v.3.4.8` | `v.3.4.9` | — |
| `v.3.4.9` | `v.3.5.0` | `v.3.4.10` |
| `v.3.5.9` | `v.3.6.0` | `v.3.5.10` |
| `v.3.9.9` | `v.4.0.0` | `v.3.10.0` / `v.3.9.10` |

Procedimento para calcular a próxima versão:

1. Ler a versão atual no rodapé (`index.html`, `id="app-footer-version"`).
2. Somar 1 ao Z.
3. Se Z passar de 9: Z = 0 e somar 1 ao Y.
4. Se Y passar de 9: Y = 0 e somar 1 ao X.
5. Conferir que nenhum dos números Y e Z tem dois dígitos antes de gravar.

Se a versão atual já estiver fora do padrão (Y ou Z com dois dígitos), normalize-a antes de incrementar, contando as versões a partir da última versão válida.

### Registro de correção

Em 24/10/2026 foram publicadas, por erro, as versões `v.3.4.10` a `v.3.4.26` (Z com dois dígitos). Elas correspondem, na sequência correta, a `v.3.5.0` a `v.3.6.6`:

* `v.3.4.10` a `v.3.4.19` = `v.3.5.0` a `v.3.5.9`
* `v.3.4.20` a `v.3.4.26` = `v.3.6.0` a `v.3.6.6`

A numeração foi normalizada em `v.3.6.7`. As mensagens dos commits antigos não foram reescritas, porque já estavam publicadas no GitHub.

## 3.3 Regra obrigatória de alteração

Toda alteração que modificar arquivos do projeto deverá gerar uma nova versão.

O agente deverá automaticamente:

1. Identificar a versão atual.
2. Determinar a próxima versão (`v.X.Y.Z`).
3. Realizar as alterações.
4. **Atualizar a versão no rodapé em todos os locais da aplicação (Obrigatório a cada mudança)**:
   - No rodapé principal oficial da aplicação (`index.html`: `<span id="app-footer-version">v.X.Y.Z</span>` dentro de `<footer class="app-main-footer">`).
   - No rodapé do menu lateral (`index.html`: `.sidebar-footer`).
   - No controlador dinâmico em `js/app.js` garantindo sincronia no DOM.
   - É estritamente obrigatório conferir que ambos os rodapés foram atualizados antes de concluir a tarefa.
5. Atualizar os cabeçalhos de versionamento em todos os arquivos JavaScript do projeto (`js/*.js`).
6. Verificar a consistência da versão em todo o projeto.

## 3.4 Persistência Híbrida Obrigatória: Nuvem (Supabase) e Sistema Local (IndexedDB)

A aplicação opera sob arquitetura híbrida de alta disponibilidade e persistência compartilhada em nuvem:

1. **Dualidade Obrigatória em Toda Alteração de Dados:**
   - **Sempre que for realizada qualquer criação, edição, salvamento, exclusão ou atualização de dados** (capacitações, histórico, integrantes da equipe, municípios, presenças, módulos ou configurações), a alteração deve ocorrer **obrigatoriamente tanto no sistema local (IndexedDB) quanto na nuvem (Supabase PostgreSQL)**.
   - É estritamente proibido salvar ou deletar dados exclusivamente no IndexedDB local ou exclusivamente na nuvem. Os dois ambientes devem sempre permanecer perfeitamente sincronizados.
2. **Exclusões Completas e em Cascata:**
   - Ao excluir qualquer registro, o agente e a aplicação devem remover os dados em cascata do IndexedDB local e enviar imediatamente o comando de exclusão correspondente para o Supabase (`deleteTrainingFromCloud` / `DELETE`).
   - Se uma capacitação for excluída na nuvem, as rotinas de sincronização (`syncFromCloud`) devem expurgá-la do banco de dados local dos demais usuários para manter a integridade absoluta da base.
3. **Carregamento Instantâneo e Tolerância Offline (Offline-First):**
   - A aplicação deve inicializar de forma instantânea a partir do cache local do IndexedDB, garantindo que abrir o arquivo `index.html` localmente funcione com velocidade máxima mesmo sem internet.
   - A sincronização em nuvem (`syncFromCloud`) deve rodar em segundo plano de forma não-bloqueante, atualizando o cache local e a interface sempre que houver novidades na nuvem compartilhada.

---

# 4. Fluxo obrigatório de execução

Cada solicitação recebida deverá ser tratada como uma unidade independente de alteração.

## 4.1 Antes da alteração

Executar automaticamente:

1. Verificar o estado atual do projeto.
2. Identificar a versão atual.
3. Verificar a estrutura dos arquivos envolvidos.
4. Identificar componentes e funcionalidades relacionados à solicitação.
5. Analisar o projeto de referência quando houver impacto visual.
6. Determinar automaticamente a próxima versão.
7. Definir os arquivos que precisam ser modificados.

Não solicitar confirmação para executar essas etapas.

## 4.2 Durante a alteração

O agente deverá:

* Modificar diretamente os arquivos necessários.
* Reutilizar componentes existentes sempre que possível.
* Evitar duplicação de código.
* Preservar funcionalidades existentes.
* Seguir os padrões arquiteturais já utilizados.
* Manter o tema dark.
* Reutilizar os assets existentes.
* Manter compatibilidade com a estrutura atual.
* Corrigir problemas encontrados durante a implementação quando forem consequência direta da alteração.
* Não realizar refatorações sem relação com a tarefa.

## 4.3 Após a alteração

Executar automaticamente:

1. Verificar se a aplicação continua funcionando.
2. Executar os testes disponíveis.
3. Executar validações técnicas apropriadas.
4. Validar a visualização e o contraste da interface tanto no **modo escuro** quanto no **modo claro** sempre que houver qualquer alteração de design, layout ou elementos de UI.
5. Verificar os componentes modificados.
6. Verificar a versão exibida no rodapé.
7. Verificar se os assets estão sendo utilizados corretamente.
8. Verificar se não foram introduzidas alterações desnecessárias.
9. Corrigir automaticamente problemas encontrados.
10. Verificar o estado do Git.
11. Criar o commit na branch ativa atual.
12. Enviar o commit para o GitHub na respectiva branch ativa.

Não solicitar autorização para nenhuma dessas etapas.

---

# 5. Git e GitHub

## 5.1 Commit obrigatório

Toda solicitação que modificar arquivos do projeto deverá obrigatoriamente gerar um commit registrado na branch atualmente ativa no repositório.

A tarefa **não poderá ser considerada concluída enquanto a alteração não estiver registrada no Git**.

É estritamente vedado alterar de branch, mesclar ou enviar código para a `main` automaticamente quando o trabalho estiver sendo realizado em uma branch de trabalho ou feature branch. O commit e as alterações pertencem e devem permanecer exclusivamente na branch ativa.

## 5.2 Mensagem do commit

Utilizar obrigatoriamente o formato:

`v.X.Y.Z: descrição das alterações`

Exemplo:

`v.1.2.3: adiciona cadastro de novas capacitações`

## 5.3 Descrição do commit

A descrição deverá informar:

* Versão anterior.
* Nova versão.
* Alterações realizadas.
* Validações realizadas.

Exemplo:

```text
Versão anterior: v.1.2.2
Nova versão: v.1.2.3

Alterações:
- Adicionado cadastro de novas capacitações.
- Implementado salvamento dos dados.
- Mantida a identidade visual existente.

Validações:
- Aplicação executada com sucesso.
- Funcionalidades principais verificadas.
- Versão conferida no rodapé.
```

## 5.4 GitHub

Após criar o commit local na branch ativa, executar automaticamente:

```bash
git push origin HEAD
```

O push deverá ser direcionado à respectiva branch ativa no repositório remoto (`HEAD`) e fazer parte do fluxo normal de conclusão da tarefa.

É expressamente proibido enviar commits ou fazer merge para a branch `main`, a menos que a `main` seja explicitamente a branch ativa em uso pelo usuário.

Não solicitar autorização para realizar o commit ou o push.

Se o push falhar, diagnosticar o problema, corrigir quando possível e tentar novamente.

Se houver uma condição externa que impeça o push, informar claramente o motivo no relatório final.

---

# 6. Preservação do projeto

Durante qualquer alteração:

* Não remover funcionalidades existentes sem necessidade.
* Não alterar funcionalidades que não estejam relacionadas à solicitação.
* Não modificar a identidade visual sem necessidade.
* Não substituir logos existentes sem justificativa técnica.
* Não criar arquivos duplicados desnecessariamente.
* Não alterar dependências sem necessidade.
* Não modificar configurações de infraestrutura sem avaliar o impacto.
* Não alterar banco de dados sem verificar compatibilidade com a aplicação.
* Não apagar dados existentes.
* Não alterar estruturas existentes quando for possível reutilizá-las.
* Não realizar refatorações fora do escopo.
* Não introduzir tecnologias adicionais sem necessidade.

A prioridade deverá ser:

**solicitação do usuário → preservação do projeto → compatibilidade → menor impacto → validação.**

---

# 7. Tratamento de erros

Se uma alteração gerar erro:

1. Identificar a causa.
2. Corrigir o problema.
3. Executar novamente a validação.
4. Repetir o processo até que a aplicação esteja funcionando corretamente ou até que exista uma limitação externa que impeça a correção.
5. Registrar no relatório final qualquer problema que não tenha sido possível solucionar.

Não interromper a execução apenas para solicitar autorização para corrigir erros relacionados à tarefa.

---

# 8. Controle de escopo

O agente deverá diferenciar:

### Alterações necessárias

Podem ser realizadas automaticamente:

* Criação de arquivos necessários.
* Edição de arquivos existentes.
* Ajustes de componentes.
* Ajustes de estilos.
* Ajustes de banco de dados necessários.
* Ajustes de rotas.
* Ajustes de APIs.
* Ajustes de validações.
* Ajustes de configuração diretamente relacionados à tarefa.
* Correções necessárias para funcionamento da implementação.
* Atualização da versão.
* Commit.
* Push.

### Alterações não necessárias

Não devem ser realizadas:

* Reformulação completa da interface.
* Troca de framework.
* Troca de biblioteca sem necessidade.
* Refatoração ampla não relacionada à solicitação.
* Alteração de funcionalidades não envolvidas.
* Mudanças estéticas sem relação com a tarefa.
* Limpeza geral do projeto sem necessidade.

---

# 9. Critérios de conclusão

Uma tarefa somente deverá ser considerada concluída quando:

* A solicitação estiver implementada.
* A aplicação estiver funcionando.
* O padrão visual do projeto de referência tiver sido respeitado.
* A visualização e contraste tiverem sido validados tanto no **modo escuro** quanto no **modo claro** (para qualquer alteração de design, layout ou UI).
* O tema dark tiver sido preservado como padrão.
* O padrão de ícones de linha (line icons) tiver sido respeitado.
* As logos existentes em `assets` tiverem sido utilizadas corretamente.
* A versão tiver sido incrementada corretamente.
* A nova versão estiver visível no rodapé.
* A persistência híbrida (salvamento e exclusão tanto no sistema local IndexedDB quanto na nuvem Supabase) tiver sido assegurada e validada.
* Os testes e validações aplicáveis tiverem sido executados.
* Não existirem erros introduzidos pela alteração.
* O commit tiver sido criado.
* O commit estiver registrado localmente.
* O push para a branch ativa no repositório remoto (ex.: `git push origin HEAD`) tiver sido realizado com sucesso.

---

# 10. Comunicação ao final da execução

Ao concluir cada solicitação, apresentar somente um resumo objetivo contendo:

**Versão:** `v.X.Y.Z`

**Alterações:**
Resumo das alterações realizadas.

**Arquivos principais alterados:**
Lista dos principais arquivos modificados.

**Validação:**
Testes e verificações realizadas e seus respectivos resultados.

**Git:**
Commit realizado, mensagem utilizada e status do push para a respectiva branch remota ativa.

Não solicitar aprovação para considerar a tarefa concluída quando todos os critérios acima tiverem sido atendidos.

---

# 11. Regra final de autonomia

**As instruções fornecidas pelo usuário representam autorização para executar as modificações necessárias no projeto.**

Portanto, o agente deverá trabalhar de forma autônoma, implementando, validando, versionando, registrando e enviando as alterações sem solicitar confirmações intermediárias.

Somente interromper a execução para solicitar informações quando **não houver informação suficiente para determinar corretamente o que o usuário deseja**, ou quando existir uma decisão que dependa obrigatoriamente de uma informação que não possa ser inferida com segurança.

Quando a solicitação puder ser atendida com base nas informações disponíveis, **executar diretamente, sem pedir autorização adicional**.
