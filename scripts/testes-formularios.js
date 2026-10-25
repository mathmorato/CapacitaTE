/**
 * CapacitaTE - Testes das regras dos formulários públicos (js/core/formSchema.js)
 * Rodam no navegador (scripts/testes-formularios.html) e no Node: node scripts/testes-formularios.js
 */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  if (isNode) {
    root.window = root;
    root.CapacitaTE = root.CapacitaTE || {};
    require('../js/core/cpf.js');
    require('../js/core/formSchema.js');
  }
  const S = root.CapacitaTE.formSchema;
  const results = [];
  const test = (name, fn) => {
    try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
  };
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
  const field = (schema, sectionId, fieldId) => S.FORM_SCHEMAS[schema].sections.find(s => s.id === sectionId).fields.find(f => f.id === fieldId);
  const cfg = S.withDefaults({});

  test('os 4 modelos de formulário existem', () => eq(Object.keys(S.FORM_SCHEMAS).sort(), ['avaliacao', 'inscricao', 'presenca_inscrito', 'presenca_nao_inscrito']));
  test('campo obrigatório vazio dá erro', () => eq(S.validateField(field('inscricao', 'dados', 'full_name'), {}, cfg), 'Campo obrigatório.'));
  test('nome com uma palavra só é recusado', () => eq(S.validateField(field('inscricao', 'dados', 'full_name'), { full_name: 'Maria' }, cfg), 'Informe o nome completo (nome e sobrenome).'));
  test('nome completo é aceito', () => eq(S.validateField(field('inscricao', 'dados', 'full_name'), { full_name: 'Maria da Silva' }, cfg), ''));
  test('e-mail inválido é recusado', () => eq(S.validateField(field('inscricao', 'dados', 'email'), { email: 'maria@x' }, cfg), 'Informe um e-mail válido.'));
  test('confirmação de e-mail diferente é recusada', () => {
    const f = field('inscricao', 'dados', 'email_confirm');
    if (S.validateField(f, { email: 'a@x.com', email_confirm: 'b@x.com' }, cfg) === '') throw new Error('aceitou e-mails diferentes');
    eq(S.validateField(f, { email: 'a@x.com', email_confirm: 'A@x.com' }, cfg), '');
  });
  test('telefone exige DDD', () => {
    const f = S.FORM_SCHEMAS.inscricao.sections[0].fields.find(x => x.type === 'telefone');
    eq(S.validateField(f, { [f.id]: '99999' }, cfg), 'Informe o telefone com DDD: (XX)XXXXX-XXXX.');
    eq(S.validateField(f, { [f.id]: '(62) 99999-0000' }, cfg), '');
  });
  test('data de nascimento anterior a 1920 é recusada', () => {
    const f = S.FORM_SCHEMAS.inscricao.sections[0].fields.find(x => x.type === 'data');
    eq(S.validateField(f, { [f.id]: '1900-01-01' }, cfg), 'Data inválida.');
    eq(S.validateField(f, { [f.id]: '1990-05-01' }, cfg), '');
  });
  test('menor de 14 anos é recusado', () => {
    const f = S.FORM_SCHEMAS.inscricao.sections[0].fields.find(x => x.type === 'data');
    const y = new Date().getFullYear() - 10;
    eq(S.validateField(f, { [f.id]: `${y}-01-01` }, cfg), 'Data inválida.');
  });
  test('aceite obrigatório não marcado dá erro', () => {
    const f = field('inscricao', 'confirmacao', 'consent');
    eq(S.validateField(f, { consent: false }, cfg), 'É preciso marcar esta opção para continuar.');
  });
  test('avaliação: nota faltando é apontada pelo nome do item', () => {
    const f = field('avaliacao', 'avaliar', 'ratings');
    const msg = S.validateField(f, { ratings: {} }, cfg);
    if (!/^Dê uma nota de 1 a 5 para "/.test(msg)) throw new Error(msg);
  });
  test('avaliação: todas as notas dadas passam', () => {
    const f = field('avaliacao', 'avaliar', 'ratings');
    const ratings = {};
    cfg.ratingItems.forEach(it => { ratings[it.key] = 5; });
    eq(S.validateField(f, { ratings }, cfg), '');
  });
  test('texto longo acima de 2000 caracteres é recusado', () => {
    const f = field('avaliacao', 'avaliar', 'liked');
    eq(S.validateField(f, { liked: 'a'.repeat(2001) }, cfg), 'Use no máximo 2.000 caracteres.');
  });
  test('showIf mostra o campo só quando o valor bate', () => {
    eq(S.isVisible({ showIf: { field: 'category', equals: 'CACS-FUNDEB' } }, { category: 'CACS-FUNDEB' }), true);
    eq(S.isVisible({ showIf: { field: 'category', equals: 'CACS-FUNDEB' } }, { category: 'Gestão municipal' }), false);
    eq(S.isVisible({}, {}), true);
  });
  test('fill troca as variáveis e mantém as que faltam', () => eq(S.fill('{sigla} - Lista', { sigla: '17ª CTE' }) + '|' + S.fill('{x}', {}), '17ª CTE - Lista|{x}'));
  test('CPF: válido e inválido', () => {
    const C = root.CapacitaTE.cpf;
    eq(C.isValid('52998224725'), true);
    eq(C.isValid('11111111111'), false);
    eq(C.isValid('52998224724'), false);
  });

  const failed = results.filter(r => !r.ok);
  root.TESTES_FORMULARIOS = results;
  if (isNode) {
    results.forEach(r => console.log(`${r.ok ? 'OK   ' : 'FALHA'} ${r.name}${r.ok ? '' : ` -> ${r.error}`}`));
    console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
    process.exit(failed.length ? 1 : 0);
  } else {
    const ul = document.getElementById('lista');
    results.forEach(r => {
      const li = document.createElement('li');
      li.className = r.ok ? 'ok' : 'fail';
      li.textContent = `${r.ok ? 'OK' : 'FALHA'} - ${r.name}${r.ok ? '' : `: ${r.error}`}`;
      ul.appendChild(li);
    });
    document.getElementById('resumo').textContent = `${results.length - failed.length}/${results.length} testes passaram.`;
  }
})(typeof window !== 'undefined' ? window : globalThis);
