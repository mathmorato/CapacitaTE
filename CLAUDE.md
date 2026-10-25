# CapacitaTE — Instruções para agentes (Claude Code e outros)

Antes de qualquer alteração neste projeto, leia e siga as regras em:

- `.agents/rules/guidelines.md` — regras gerais, **versionamento `v.X.Y.Z`**, persistência, identidade visual e commits.
- `.agents/rules/AGENTSparaword` — padrões visuais do relatório Word.
- [`.agents/specs/capacitate-modular.md`](.agents/specs/capacitate-modular.md) — especificação da plataforma modular CapacitaTE (executar fase por fase, seção 14; PDFs de referência em `.agents/specs/referencias/`).
- [`.agents/specs/formularios.md`](.agents/specs/formularios.md) — **estrutura oficial, passo a passo, dos 3 formulários públicos** (vale sobre os PDFs).

## Versionamento (resumo obrigatório)

- Formato `v.X.Y.Z`. **Y e Z vão de 0 a 9**; só o X pode passar de 9.
- Próxima versão: soma 1 ao Z; se Z passar de 9, Z = 0 e soma 1 ao Y; se Y passar de 9, Y = 0 e soma 1 ao X.
- Exemplos: `v.3.4.9 → v.3.5.0` (nunca `v.3.4.10`); `v.3.9.9 → v.4.0.0` (nunca `v.3.10.0`).
- Toda alteração gera uma nova versão: rodapé principal e do menu lateral (`index.html`), `this.version` em `js/app.js` e cabeçalhos de todos os `js/*.js`.
- Mensagem de commit: `v.X.Y.Z: resumo`, com "Versão anterior", "Nova versão", "Alterações" e "Validações".

## Estado atual e backlog

- Antes de continuar qualquer trabalho, leia `.agents/specs/backlog.md`: o que já foi feito, o que está aplicado no Supabase, pendências e decisões combinadas com o usuário. Atualize-o a cada versão.
