/**
 * CapacitaTE - Módulo Avaliação (formulário, taxa de resposta, médias por item e respostas)
 * Versão: v.3.9.0
 */

(function () {
  const F = CapacitaTE.formModules;

  F.register({
    key: 'avaliacao',
    title: 'Avaliação',
    stage: 2,
    order: 60,
    iconPaths: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',

    async render(body, c) {
      const { el, training } = c;
      const form = c.forms.find(f => f.session_key === 'unico') || c.forms[0];
      const canEdit = c.can('avaliacao', 'edit', training.id);

      if (!form) {
        body.append(el('div', { class: 'glass-card' }, [
          el('h3', { style: 'margin:0 0 0.5rem; font-size:1rem;', text: 'Ainda não há formulário de avaliação para esta capacitação.' }),
          el('p', { class: 'admin-muted', text: 'Ele é criado como rascunho, com os 7 itens de nota e as opções do formulário do Google usados hoje.' }),
          canEdit ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Criar formulário de avaliação', onclick: async (e) => {
            e.currentTarget.disabled = true;
            try { await c.createForm('avaliacao', training, 'unico'); c.toast('Formulário criado em rascunho.', 'success'); c.rerender(); }
            catch (err) { c.toast(c.errMsg(err), 'error'); e.currentTarget.disabled = false; }
          } }) : null
        ]));
        return;
      }

      body.append(c.formCard(form, c));

      const [ev, att] = await Promise.all([
        c.client().from('evaluations').select('*').eq('training_id', training.id).order('submitted_at'),
        c.client().from('attendance').select('cpf').eq('training_id', training.id)
      ]);
      if (ev.error) throw ev.error;
      if (att.error) throw att.error;
      const evals = ev.data || [];
      const presentes = new Set((att.data || []).map(a => a.cpf)).size;
      const items = (form.config && form.config.ratingItems && form.config.ratingItems.length) ? form.config.ratingItems : CapacitaTE.formSchema.DEFAULTS.ratingItems;

      // Prévia dos resultados: médias por item, geral e separação CACS × Gestão
      const avg = (list, key) => {
        const vals = list.map(e => Number(e.ratings && e.ratings[key])).filter(v => v >= 1 && v <= 5);
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      };
      const fmtAvg = (v) => (v === null ? '—' : v.toFixed(2).replace('.', ','));
      const cacs = evals.filter(e => e.category === 'CACS-FUNDEB');
      const gest = evals.filter(e => e.category === 'Gestão municipal');
      const rows = items.map(it => el('tr', {}, [
        el('td', { text: it.label }),
        el('td', { class: 'perm-col', text: fmtAvg(avg(evals, it.key)) }),
        el('td', { class: 'perm-col', text: fmtAvg(avg(cacs, it.key)) }),
        el('td', { class: 'perm-col', text: fmtAvg(avg(gest, it.key)) })
      ]));
      const rate = presentes ? Math.round((evals.length / presentes) * 100) : null;
      body.append(el('div', { class: 'glass-card forms-section' }, [
        el('h3', { class: 'forms-section-title', text: 'Prévia dos resultados' }),
        el('div', { class: 'forms-stats' }, [
          el('div', {}, [el('strong', { text: String(evals.length) }), el('span', { text: 'avaliações' })]),
          el('div', {}, [el('strong', { text: String(presentes) }), el('span', { text: 'presentes (CPFs distintos)' })]),
          el('div', {}, [el('strong', { text: rate === null ? '—' : `${rate}%` }), el('span', { text: 'taxa de resposta' })])
        ]),
        c.table(['Item', 'Média geral', 'CACS-FUNDEB', 'Gestão municipal'], rows),
        el('p', { class: 'admin-muted', style: 'margin-top:0.6rem;', text: 'Os gráficos e nuvens de palavras completos continuam no Relatório (etapas 8 e 12).' })
      ]));

      // Respostas
      const listBox = el('div');
      let term = '';
      const draw = () => {
        listBox.textContent = '';
        const rs = evals
          .filter(e => !term || `${e.full_name} ${e.municipality} ${e.institution_name}`.toLowerCase().includes(term))
          .map(e => el('tr', {}, [
            el('td', { text: e.full_name || '—' }),
            el('td', { text: c.maskCpf(e.cpf) }),
            el('td', { text: e.municipality || '—' }),
            el('td', { text: e.category || '—' }),
            el('td', { class: 'perm-col', text: String((e.ratings && e.ratings.geral) || '—') }),
            el('td', { text: e.institution_name || '—' }),
            el('td', { text: c.fmtDateTime(e.submitted_at) }),
            el('td', { class: 'perm-col' }, canEdit ? el('button', { type: 'button', class: 'btn btn-secondary btn-sm admin-danger-btn', text: 'Excluir', onclick: () => window.app.openConfirmModal({
              title: 'Excluir avaliação?', msg: `A avaliação de ${e.full_name || 'esta pessoa'} será removida.`, btnText: 'Sim, excluir',
              successTitle: 'Avaliação excluída', successMsg: 'A prévia será atualizada.',
              onConfirm: async () => {
                const { error } = await c.client().from('evaluations').delete().eq('id', e.id);
                if (error) return c.toast(c.errMsg(error), 'error');
                await c.audit('submission.delete', 'avaliacao', training.id, c.maskCpf(e.cpf));
                c.rerender();
              }
            }) }) : null)
          ]));
        listBox.append(c.table(['Nome', 'CPF', 'Município', 'Categoria', 'Nota geral', 'Instituição', 'Enviada em', ''], rs, term ? 'Nada encontrado.' : 'Nenhuma avaliação ainda.'));
      };
      body.append(el('div', { class: 'glass-card forms-section' }, [
        el('div', { class: 'forms-toolbar' }, [el('h3', { class: 'forms-section-title', text: `Respostas (${evals.length})` }), c.searchBox(v => { term = v; draw(); })]),
        listBox
      ]));
      draw();
    }
  });
})();
