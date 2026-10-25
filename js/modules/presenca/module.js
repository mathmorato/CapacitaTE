/**
 * CapacitaTE - Módulo Lista de Presença (sessões com QR próprio, quadro de frequência e registros)
 * Versão: v.3.9.2
 */

(function () {
  const F = CapacitaTE.formModules;

  // Datas da capacitação (yyyy-mm-dd) → uma sessão por dia
  function trainingDays(t) {
    const start = t.startDate && /^\d{4}-\d{2}-\d{2}$/.test(t.startDate) ? new Date(`${t.startDate}T12:00:00`) : null;
    const end = t.endDate && /^\d{4}-\d{2}-\d{2}$/.test(t.endDate) ? new Date(`${t.endDate}T12:00:00`) : start;
    if (!start) return [];
    const days = [];
    for (let d = new Date(start), i = 1; d <= end && i <= 10; d.setDate(d.getDate() + 1), i++) {
      days.push({ key: `dia${i}`, label: CapacitaTE.formats.formatDate(d.toISOString().slice(0, 10)) });
    }
    return days;
  }

  F.register({
    key: 'presenca',
    title: 'Lista de Presença',
    stage: 2,
    order: 50,
    iconPaths: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',

    async render(body, c) {
      const { el, training } = c;
      const canEdit = c.can('presenca', 'edit', training.id);
      const sessions = c.forms.slice().sort((a, b) => a.session_key.localeCompare(b.session_key, 'pt-BR', { numeric: true }));

      // Criação de sessões
      const days = trainingDays(training);
      const missingDays = days.filter(d => !sessions.some(s => s.session_key === d.key));
      const keyInput = el('input', { class: 'form-control', type: 'text', placeholder: 'dia1-manha', id: 'presenca-new-key' });
      const labelInput = el('input', { class: 'form-control', type: 'text', placeholder: '23/06/2026 — Manhã', id: 'presenca-new-label' });
      const createBox = el('div', { class: 'glass-card forms-section' }, [
        el('h3', { class: 'forms-section-title', text: `Sessões de presença (${sessions.length})` }),
        el('p', { class: 'admin-muted', text: 'Cada sessão tem o próprio link e QR Code. Recomendado: abrir no horário da sessão e fechar até 2 h depois do fim.' }),
        canEdit && missingDays.length ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: `Criar ${missingDays.length === days.length ? 'uma sessão por dia' : 'sessões que faltam'} (${missingDays.map(d => d.label).join(', ')})`, onclick: async (e) => {
          e.currentTarget.disabled = true;
          try {
            for (const d of missingDays) await c.createForm('presenca', training, d.key, { label: d.label });
            c.toast('Sessões criadas em rascunho.', 'success'); c.rerender();
          } catch (err) { c.toast(c.errMsg(err), 'error'); e.currentTarget.disabled = false; }
        } }) : null,
        !days.length ? el('p', { class: 'admin-muted', text: 'Preencha as datas de início e fim da capacitação (Etapa 1 do Relatório) para criar as sessões por dia.' }) : null,
        canEdit ? el('details', { class: 'forms-config' }, [
          el('summary', { text: 'Adicionar sessão avulsa (ex.: manhã e tarde)' }),
          el('div', { class: 'admin-form-grid' }, [
            el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: 'presenca-new-key', text: 'Código (sem espaços)' }), keyInput]),
            el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: 'presenca-new-label', text: 'Nome exibido' }), labelInput])
          ]),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', style: 'margin-top:0.75rem;', text: 'Adicionar sessão', onclick: async (e) => {
            const key = keyInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
            if (!key || !labelInput.value.trim()) return c.toast('Informe o código e o nome da sessão.', 'warning');
            if (sessions.some(s => s.session_key === key)) return c.toast('Já existe uma sessão com esse código.', 'warning');
            e.currentTarget.disabled = true;
            try { await c.createForm('presenca', training, key, { label: labelInput.value.trim() }); c.rerender(); }
            catch (err) { c.toast(c.errMsg(err), 'error'); e.currentTarget.disabled = false; }
          } })
        ]) : null
      ]);
      body.append(createBox);
      if (!sessions.length) return;

      const [att, reg] = await Promise.all([
        c.client().from('attendance').select('*').eq('training_id', training.id).order('submitted_at'),
        c.client().from('registrations').select('cpf, full_name, municipality, category').eq('training_id', training.id).eq('status', 'valida')
      ]);
      if (att.error) throw att.error;
      if (reg.error) throw reg.error;
      const attendance = att.data || [];
      const registrations = reg.data || [];

      // Cartões das sessões
      sessions.forEach(s => {
        const present = attendance.filter(a => a.session_key === s.session_key).length;
        const card = c.formCard(s, c);
        card.insertBefore(el('p', { class: 'forms-counter', text: `${present} presentes / ${registrations.length} inscritos` }), card.children[1]);
        body.append(card);
      });

      // Quadro de frequência: inscritos + presentes não inscritos × sessões
      const people = new Map();
      registrations.forEach(r => people.set(r.cpf, { cpf: r.cpf, name: r.full_name, municipality: r.municipality, category: r.category, registered: true }));
      attendance.forEach(a => { if (!people.has(a.cpf)) people.set(a.cpf, { cpf: a.cpf, name: a.full_name, municipality: a.municipality, category: a.category, registered: false }); });
      const presentSet = new Set(attendance.map(a => `${a.cpf}|${a.session_key}`));
      const boardBox = el('div');
      let term = '';
      let filter = 'todos';
      const drawBoard = () => {
        boardBox.textContent = '';
        const rows = [...people.values()]
          .map(p => {
            const marks = sessions.map(s => presentSet.has(`${p.cpf}|${s.session_key}`));
            return { p, marks, pct: Math.round((marks.filter(Boolean).length / sessions.length) * 100) };
          })
          .filter(({ p, pct }) => (filter === 'faltosos' ? pct < 100 && p.registered : filter === 'naoinscritos' ? !p.registered : true))
          .filter(({ p }) => !term || `${p.name} ${p.municipality}`.toLowerCase().includes(term))
          .sort((a, b) => String(a.p.name).localeCompare(String(b.p.name), 'pt-BR'))
          .map(({ p, marks, pct }) => el('tr', {}, [
            el('td', {}, [p.name || '—', !p.registered ? el('span', { class: 'admin-chip', style: 'margin-left:0.4rem;', text: 'não inscrito' }) : null]),
            el('td', { text: p.municipality || '—' }),
            el('td', { text: p.category || '—' }),
            ...marks.map(m => el('td', { class: `perm-col ${m ? 'forms-present' : 'forms-absent'}`, text: m ? '✓' : '—', 'aria-label': m ? 'presente' : 'ausente' })),
            el('td', { class: 'perm-col', text: `${pct}%` })
          ]));
        boardBox.append(c.table(['Nome', 'Município', 'Categoria', ...sessions.map(s => (s.config && s.config.label) || s.session_key), '% presença'], rows, 'Ninguém neste filtro.'));
      };
      const filterSel = el('select', { class: 'form-control forms-filter', 'aria-label': 'Filtro' }, [
        el('option', { value: 'todos', text: 'Todos' }), el('option', { value: 'faltosos', text: 'Somente faltosos' }), el('option', { value: 'naoinscritos', text: 'Somente não inscritos' })
      ]);
      filterSel.addEventListener('change', () => { filter = filterSel.value; drawBoard(); });
      body.append(el('div', { class: 'glass-card forms-section' }, [
        el('div', { class: 'forms-toolbar' }, [el('h3', { class: 'forms-section-title', text: `Quadro de frequência (${people.size} pessoas)` }), c.searchBox(v => { term = v; drawBoard(); }), filterSel]),
        boardBox
      ]));
      drawBoard();

      // Registros por sessão (com exclusão)
      const recRows = attendance.map(a => el('tr', {}, [
        el('td', { text: (sessions.find(s => s.session_key === a.session_key) || {}).config?.label || a.session_key }),
        el('td', { text: a.full_name || '—' }),
        el('td', { text: c.maskCpf(a.cpf) }),
        el('td', { text: a.municipality || '—' }),
        el('td', { text: a.was_registered ? 'Sim' : 'Não' }),
        el('td', { text: c.fmtDateTime(a.submitted_at) }),
        el('td', { class: 'perm-col' }, canEdit ? el('button', { type: 'button', class: 'btn btn-secondary btn-sm admin-danger-btn', text: 'Excluir', onclick: () => window.app.openConfirmModal({
          title: 'Excluir registro de presença?', msg: `${a.full_name || 'Esta pessoa'} deixará de constar como presente nesta sessão.`, btnText: 'Sim, excluir',
          successTitle: 'Registro excluído', successMsg: 'O quadro será atualizado.',
          onConfirm: async () => {
            const { error } = await c.client().from('attendance').delete().eq('id', a.id);
            if (error) return c.toast(c.errMsg(error), 'error');
            await c.audit('submission.delete', 'presenca', training.id, c.maskCpf(a.cpf), { session: a.session_key });
            c.rerender();
          }
        }) }) : null)
      ]));
      body.append(el('details', { class: 'glass-card forms-section forms-config' }, [
        el('summary', { text: `Registros de presença (${attendance.length})` }),
        c.table(['Sessão', 'Nome', 'CPF', 'Município', 'Inscrito?', 'Registrado em', ''], recRows)
      ]));
    }
  });
})();
