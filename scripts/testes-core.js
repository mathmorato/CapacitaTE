// Testes do núcleo (js/core/cpf.js, formats.js, router.js, moduleRegistry.js).
// No navegador: abra scripts/testes-core.html. No terminal: node scripts/testes-core.js
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const cpf = isNode ? require('../js/core/cpf.js') : root.CapacitaTE.cpf;
  const formats = isNode ? require('../js/core/formats.js') : root.CapacitaTE.formats;

  const results = [];
  const eq = (name, actual, expected) => results.push({ name, ok: actual === expected, actual, expected });

  // CPF: válidos (com e sem máscara, número sem zeros à esquerda)
  eq('cpf válido sem máscara', cpf.isValid('52998224725'), true);
  eq('cpf válido com máscara', cpf.isValid('529.982.247-25'), true);
  eq('cpf válido iniciado por zero', cpf.isValid('012.345.678-90'), true);
  eq('cpf válido como número', cpf.isValid(52998224725), true);
  // CPF: inválidos
  eq('cpf dígito verificador errado', cpf.isValid('529.982.247-24'), false);
  eq('cpf segundo dígito errado', cpf.isValid('52998224715'), false);
  eq('cpf curto', cpf.isValid('5299822472'), false);
  eq('cpf longo', cpf.isValid('529982247250'), false);
  eq('cpf vazio', cpf.isValid(''), false);
  eq('cpf nulo', cpf.isValid(null), false);
  ['000.000.000-00', '111.111.111-11', '222.222.222-22', '999.999.999-99'].forEach(v => eq(`cpf todos iguais ${v}`, cpf.isValid(v), false));
  // CPF: normalizar, formatar e mascarar
  eq('cpf normalize', cpf.normalize(' 529.982.247-25 '), '52998224725');
  eq('cpf format sem máscara', cpf.format('52998224725'), '529.982.247-25');
  eq('cpf format já formatado', cpf.format('529.982.247-25'), '529.982.247-25');
  eq('cpf format zeros perdidos (número)', cpf.format(12345678909), '123.456.789-09');
  eq('cpf format 10 dígitos completa zero', cpf.format('1234567890'), '012.345.678-90');
  eq('cpf format texto inválido mantém', cpf.format('abc'), 'abc');
  eq('cpf mask', cpf.mask('529.982.247-25'), '***.982.247-**');
  eq('cpf mask inválido', cpf.mask('123'), '');
  eq('cpf inputMask parcial', cpf.inputMask('5299822'), '529.982.2');
  eq('cpf inputMask completo', cpf.inputMask('52998224725999'), '529.982.247-25');

  // Formatos
  eq('telefone celular', formats.formatPhone('65 99999-1234'), '(65)99999-1234');
  eq('telefone fixo', formats.formatPhone('6533331234'), '(65)3333-1234');
  eq('telefone com +55', formats.formatPhone('+55 (65) 99999-1234'), '(65)99999-1234');
  eq('telefone fora do padrão', formats.formatPhone('1234'), '1234');
  eq('data ISO pura', formats.formatDate('2026-06-23'), '23/06/2026');
  eq('data de Date em Brasília', formats.formatDate(new Date('2026-06-24T01:30:00Z')), '23/06/2026');
  eq('data/hora Google Forms', formats.formatDateTime('2026-06-23T19:42:05Z'), '23/06/2026 16:42:05');
  eq('data/hora inválida', formats.formatDateTime('xx'), '');
  eq('parseBrDate', formats.parseBrDate('23/06/2026 16:42:05'), '2026-06-23');
  eq('parseBrDate inválida', formats.parseBrDate('31/02/2026'), '');

  // Roteador e registro (somente no navegador, onde window existe)
  if (!isNode && root.CapacitaTE.router) {
    const r = root.CapacitaTE.router;
    eq('router hash novo', r.parseHash('#/inscricao/abc').join('|'), 'inscricao|abc');
    eq('router hash legado', r.parseHash('#wizard/abc/3').join('|'), 'wizard|abc|3');
    eq('router match', JSON.stringify(r.match('relatorio/:id', ['relatorio', 'x1'])), '{"id":"x1"}');
    eq('router sem match', r.match('relatorio/:id', ['inscricao', 'x1']), null);
    let erro = '';
    try { root.CapacitaTE.registerModule({ key: 'teste' }); } catch (e) { erro = e.message; }
    eq('registro rejeita módulo incompleto', erro.startsWith('Módulo inválido'), true);
    root.CapacitaTE.registerModule({ key: 'zz_teste', title: 'Teste', icon: '<svg></svg>', order: 500, actions: ['view'], perTraining: false, mount() {} });
    const views = root.CapacitaTE.getMenuItems().map(i => i.view).join('|');
    eq('menu ordenado pelo registro', views, 'dashboard|zz_teste|settings');
    const saved = root.CapacitaTE.can;
    root.CapacitaTE.can = (key) => key !== 'zz_teste';
    eq('menu filtra por permissão', root.CapacitaTE.getMenuItems().some(i => i.view === 'zz_teste'), false);
    root.CapacitaTE.can = saved;
  }

  // Permissões (somente no navegador): usuário comum logado com relatorio.edit
  if (!isNode && root.CapacitaTE.permissions) {
    const C = root.CapacitaTE;
    const savedAuth = C.auth;
    C.auth = { mode: 'transition' };
    eq('perm modo transição libera tudo', C.can('inscricao', 'view'), true);
    C.auth = { mode: 'authenticated', profile: { is_admin: false }, permissions: [{ module_key: 'relatorio', action: 'edit', training_id: null }, { module_key: 'presenca', action: 'view', training_id: 'cap_1' }] };
    eq('perm edit implica view', C.can('relatorio', 'view'), true);
    eq('perm edit não implica generate', C.can('relatorio', 'generate'), false);
    eq('perm sem inscricao.view', C.can('inscricao', 'view'), false);
    eq('perm escopo da capacitação certa', C.can('presenca', 'view', 'cap_1'), true);
    eq('perm escopo de outra capacitação', C.can('presenca', 'view', 'cap_2'), false);
    eq('perm comum sem admin', C.can('admin', 'view'), false);
    eq('menu esconde módulo sem permissão', C.getMenuItems().some(i => i.view === 'zz_teste'), false);
    C.auth = { mode: 'authenticated', profile: { is_admin: true }, permissions: [] };
    eq('perm admin libera tudo', C.can('inscricao', 'export') && C.can('admin', 'view'), true);
    C.auth = savedAuth;
  }

  const failed = results.filter(r => !r.ok);
  if (isNode) {
    failed.forEach(r => console.log(`FALHOU: ${r.name} (obtido ${JSON.stringify(r.actual)}, esperado ${JSON.stringify(r.expected)})`));
    console.log(`${results.length - failed.length}/${results.length} testes passaram`);
    if (failed.length) process.exitCode = 1;
  } else {
    root.CORE_TEST_RESULTS = results;
  }
})(typeof window !== 'undefined' ? window : null);
