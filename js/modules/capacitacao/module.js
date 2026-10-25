/**
 * CapacitaTE - Página da Capacitação: as três etapas do trabalho em um só lugar
 *   1. Cadastro e inscrição (dados da capacitação + formulário de inscrição com QR Code)
 *   2. Presença e avaliação (sessões de presença e avaliação com QR Code; exportação em Excel)
 *   3. Relatório final (assistente de 12 etapas que já existia)
 * Rota: #capacitacao/<id>[/<etapa>]
 * Versão: v.3.9.3
 */

(function () {
  const F = CapacitaTE.formModules;
  const el = F.el;

  const STAGES = [
    { n: 1, title: 'Cadastro e inscrição', hint: 'Dados da capacitação e formulário de inscrição' },
    { n: 2, title: 'Presença e avaliação', hint: 'Listas de presença por sessão e avaliação' },
    { n: 3, title: 'Relatório final', hint: 'Assistente do relatório em Word' }
  ];

  function summaryCard(training) {
    const muns = F.trainingMunicipalities(training);
    const canEdit = CapacitaTE.can('relatorio', 'edit', training.id);
    const item = (label, value) => el('div', { class: 'cap-summary-item' }, [el('span', { text: label }), el('strong', { text: value || '—' })]);
    return el('div', { class: 'glass-card forms-section' }, [
      el('div', { class: 'forms-toolbar' }, [
        el('h3', { class: 'forms-section-title', text: 'Dados da capacitação' }),
        canEdit ? el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Editar dados', onclick: () => window.app.openWizard(training.id, 1, { mode: 'cadastro' }) }) : null,
        canEdit ? el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Cidades convidadas', onclick: () => window.app.openWizard(training.id, 3, { mode: 'cadastro' }) }) : null
      ]),
      el('div', { class: 'cap-summary' }, [
        item('Polo', `${training.polo || ''}${training.uf ? ` (${training.uf})` : ''}`),
        item('Datas', training.datesFormatted),
        item('Local', [training.locationVenue, training.locationAddress].filter(Boolean).join(' – ')),
        item('Carga horária', training.workload ? (/hora/i.test(String(training.workload)) ? String(training.workload) : `${training.workload} horas`) : ''),
        item('Cidades convidadas', muns.length ? String(muns.length) : 'nenhuma ainda')
      ]),
      !muns.length ? el('p', { class: 'forms-warn', text: 'Cadastre as cidades convidadas antes de criar o formulário de inscrição: elas formam a lista "Município que representa".' }) : null,
      el('p', { class: 'admin-muted', style: 'margin:0.75rem 0 0;', text: 'O cadastro da capacitação tem só a identificação e as cidades convidadas; as demais informações são preenchidas no Relatório final. As cidades podem ser alteradas mesmo depois de gerar o link: o formulário avisa e atualiza a lista sem trocar o link nem o QR Code.' })
    ]);
  }

  function exportCard() {
    return el('div', { class: 'glass-card forms-section' }, [
      el('h3', { class: 'forms-section-title', text: 'Exportar em Excel' }),
      el('p', { class: 'admin-muted', text: 'Planilhas de inscrições, presença e avaliação no mesmo formato do Google Forms, prontas para o Relatório.' }),
      el('div', { class: 'admin-actions' }, ['Inscrições', 'Lista de presença', 'Avaliação'].map(t =>
        el('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled: true, title: 'Disponível na próxima versão', text: `${t} (.xlsx)` }))),
      el('p', { class: 'admin-muted', style: 'margin-top:0.5rem;', text: 'A exportação será liberada na próxima versão (Fase 4 da especificação).' })
    ]);
  }

  function reportCard(training) {
    const pct = Number(training.progressPercent) || 0;
    const canView = CapacitaTE.can('relatorio', 'view', training.id);
    return el('div', { class: 'glass-card forms-section' }, [
      el('h3', { class: 'forms-section-title', text: 'Relatório final' }),
      el('p', { class: 'admin-muted', text: 'O assistente de 12 etapas monta o relatório em Word a partir dos dados da capacitação, das inscrições, da presença e da avaliação.' }),
      el('div', { class: 'cap-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, el('div', { style: `width:${pct}%` })),
      el('p', { class: 'admin-muted', text: `Progresso do relatório: ${pct}%` }),
      canView ? el('div', { class: 'admin-actions' }, [
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Abrir assistente do relatório', onclick: () => window.app.openWizard(training.id, 1) }),
        el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Ir para a geração (etapa 12)', onclick: () => window.app.openWizard(training.id, 12) })
      ]) : el('p', { class: 'admin-muted', text: 'Você não tem permissão para o Relatório.' })
    ]);
  }

  async function open(trainingId, stage) {
    const container = document.getElementById('module-container');
    if (!container || !window.app) return;
    window.app.navigateTo('module', false);
    const nav = document.getElementById('nav-trainings');
    if (nav) nav.classList.add('active');
    container.textContent = '';
    container.append(el('p', { class: 'admin-muted', text: 'Carregando...' }));

    const id = decodeURIComponent(trainingId);
    const training = await F.loadTraining(id);
    container.textContent = '';
    if (!training) {
      container.append(el('div', { class: 'glass-card' }, el('p', { class: 'auth-message-error', text: 'Capacitação não encontrada neste navegador. Use "Sincronizar" e tente de novo.' })));
      return;
    }
    const current = [1, 2, 3].includes(Number(stage)) ? Number(stage) : 1;
    const loggedIn = !CapacitaTE.auth || CapacitaTE.auth.mode === 'authenticated';

    container.append(
      el('div', { class: 'forms-header' }, [
        el('div', {}, [
          el('a', { href: '#trainings', class: 'cap-back', text: '← Capacitações' }),
          el('h2', { style: 'margin:0.25rem 0 0;', text: F.trainingTitle(training) }),
          el('p', { style: 'color:var(--text-secondary); margin:0.25rem 0 0;', text: [training.datesFormatted, training.locationVenue].filter(Boolean).join(' · ') })
        ])
      ]),
      el('nav', { class: 'cap-stages', 'aria-label': 'Etapas da capacitação' }, STAGES.map(s => el('a', {
        href: `#capacitacao/${encodeURIComponent(id)}/${s.n}`,
        class: `cap-stage${s.n === current ? ' active' : ''}`,
        'aria-current': s.n === current ? 'step' : null
      }, [el('span', { class: 'cap-stage-n', text: String(s.n) }), el('span', { class: 'cap-stage-text' }, [el('strong', { text: s.title }), el('small', { text: s.hint })])])))
    );

    const body = el('div', { class: 'cap-body' });
    container.append(body);
    const needLogin = () => body.append(el('div', { class: 'glass-card' }, el('p', { class: 'admin-muted', text: 'Entre com a sua conta para usar os formulários: eles ficam no banco de dados na nuvem.' })));

    if (current === 1) {
      body.append(summaryCard(training));
      const box = el('div');
      body.append(el('h3', { class: 'cap-subtitle', text: 'Formulário de inscrição' }), box);
      if (loggedIn) await F.renderEmbedded('inscricao', box, id); else needLogin();
    } else if (current === 2) {
      const pres = el('div');
      const aval = el('div');
      body.append(el('h3', { class: 'cap-subtitle', text: 'Lista de presença' }), pres, el('h3', { class: 'cap-subtitle', text: 'Avaliação' }), aval, exportCard());
      if (loggedIn) {
        await F.renderEmbedded('presenca', pres, id);
        await F.renderEmbedded('avaliacao', aval, id);
      } else needLogin();
    } else {
      body.append(reportCard(training));
    }
  }

  CapacitaTE.registerModule({
    key: 'capacitacao',
    title: 'Capacitação',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path></svg>',
    order: 15,
    actions: ['view'],
    perTraining: true,
    menu: [],
    mount: (container, ctx = {}) => open(ctx.trainingId, ctx.stage),
    routes: {
      'capacitacao/:id': ({ id }) => open(id, 1),
      'capacitacao/:id/:stage': ({ id, stage }) => open(id, stage)
    }
  });
})();
