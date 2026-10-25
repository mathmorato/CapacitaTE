/**
 * CapacitaTE - Módulo Relatório (adaptador fino do assistente de 12 etapas existente em js/app.js)
 * Versão: v.3.8.7
 */

(function () {
  const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  const openReport = (trainingId, step = 1) => {
    if (!window.app || !trainingId) return;
    return window.app.openWizard(trainingId, parseInt(step) || 1);
  };

  CapacitaTE.registerModule({
    key: 'relatorio',
    title: 'Relatório automático',
    icon: `<svg ${ICON_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
    order: 10,
    actions: ['view', 'edit', 'generate'],
    perTraining: true,

    // As telas do relatório continuam em index.html; montar o módulo é abrir o assistente da capacitação
    mount: (container, ctx = {}) => openReport(ctx.trainingId, ctx.step),

    // Mesmos itens, ícones e ordem do menu lateral anterior à plataforma modular
    menu: [
      {
        view: 'trainings', title: 'Capacitações', order: 10,
        icon: `<svg ${ICON_ATTRS}><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`
      },
      {
        view: 'team', title: 'Equipe Técnica', order: 20,
        icon: `<svg ${ICON_ATTRS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
      },
      {
        view: 'course-structure', title: 'Estrutura do Curso', order: 30,
        icon: `<svg ${ICON_ATTRS}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`
      }
    ],

    // #/relatorio/<id> e #/relatorio/<id>/<etapa> abrem o assistente atual (o hash legado #wizard/... continua válido)
    routes: {
      'relatorio/:id': ({ id }) => openReport(id, 1),
      'relatorio/:id/:step': ({ id, step }) => openReport(id, step)
    }
  });
})();
