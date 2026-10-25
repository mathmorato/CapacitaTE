/**
 * CapacitaTE - Módulo Inscrição (formulário, painel de vagas por município e inscrições)
 * Versão: v.4.0.1
 */

(function () {
  const F = CapacitaTE.formModules;

  F.register({
    key: 'inscricao',
    title: 'Inscrição',
    stage: 1,
    order: 40,
    iconPaths: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line>',

    async render(body, c) {
      const { el, training } = c;
      const form = c.forms.find(f => f.session_key === 'unico') || c.forms[0];
      const canEdit = c.can('inscricao', 'edit', training.id);

      if (!form) {
        body.append(el('div', { class: 'glass-card' }, [
          el('h3', { style: 'margin:0 0 0.5rem; font-size:1rem;', text: 'Ainda não há formulário de inscrição para esta capacitação.' }),
          el('p', { class: 'admin-muted', text: 'Ele é criado como rascunho, com os municípios convocados (Etapa 3 do Relatório) e o texto de apresentação já preenchidos.' }),
          canEdit ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Criar formulário de inscrição', onclick: async (e) => {
            e.currentTarget.disabled = true;
            try { await c.createForm('inscricao', training, 'unico'); c.toast('Formulário criado em rascunho.', 'success'); c.rerender(); }
            catch (err) { c.toast(c.errMsg(err), 'error'); e.currentTarget.disabled = false; }
          } }) : el('p', { class: 'admin-muted', text: 'Peça a quem tem permissão de edição para criar o formulário.' })
        ]));
        return;
      }

      body.append(c.formCard(form, c));

      const { data, error } = await c.client().from('registrations').select('*').eq('training_id', training.id).order('submitted_at');
      if (error) throw error;
      const regs = data || [];
      const valid = regs.filter(r => r.status === 'valida');

      // Painel de vagas (igual à aba "Inscritos" da planilha do Google Forms)
      const muns = ((form.config && form.config.municipalities) || []).map(m => m.name);
      const extra = [...new Set(valid.map(r => r.municipality).filter(m => m && !muns.includes(m)))];
      const count = (m, cat) => valid.filter(r => r.municipality === m && (!cat || r.category === cat)).length;
      const vagasRows = [...muns, ...extra].map(m => {
        const total = count(m);
        return el('tr', { class: total === 0 ? 'forms-row-empty' : null }, [
          el('td', { text: m }), el('td', { class: 'perm-col', text: String(total) }),
          el('td', { class: 'perm-col', text: String(count(m, 'CACS-FUNDEB')) }), el('td', { class: 'perm-col', text: String(count(m, 'Gestão municipal')) })
        ]);
      });
      vagasRows.push(el('tr', { class: 'forms-row-total' }, [
        el('td', { text: 'Total' }), el('td', { class: 'perm-col', text: String(valid.length) }),
        el('td', { class: 'perm-col', text: String(valid.filter(r => r.category === 'CACS-FUNDEB').length) }),
        el('td', { class: 'perm-col', text: String(valid.filter(r => r.category === 'Gestão municipal').length) })
      ]));
      const semInscritos = muns.filter(m => count(m) === 0).length;
      body.append(el('div', { class: 'glass-card forms-section' }, [
        el('h3', { class: 'forms-section-title', text: `Painel de vagas · ${valid.length} inscrições válidas` }),
        semInscritos ? el('p', { class: 'admin-muted', text: `${semInscritos} município(s) ainda sem inscritos (destacados).` }) : null,
        canEdit ? c.addMunicipalityBox(form) : null,
        c.table(['Município', 'Inscritos', 'CACS-FUNDEB', 'Gestão municipal'], vagasRows)
      ]));

      // Inscrições
      const listBox = el('div');
      let term = '';
      const draw = () => {
        listBox.textContent = '';
        const rows = regs
          .filter(r => r.status !== 'cancelada')
          .filter(r => !term || `${r.full_name} ${r.municipality} ${r.email}`.toLowerCase().includes(term))
          .map(r => el('tr', { class: r.status === 'cancelada' ? 'forms-row-cancelled' : null }, [
            el('td', { text: r.full_name || '—' }),
            el('td', { text: c.maskCpf(r.cpf) }),
            el('td', { text: r.municipality || '—' }),
            el('td', { text: r.category || '—' }),
            el('td', { text: r.role_gestao || r.role_cacs || '—' }),
            el('td', { text: c.fmtPhone(r.phone) }),
            el('td', { text: c.fmtDateTime(r.submitted_at) }),
            el('td', {}, [
              r.answers && r.answers.waitlist ? el('span', { class: 'admin-chip', text: 'lista de espera' }) : null,
              r.answers && r.answers.manual ? el('span', { class: 'admin-chip', text: 'manual' }) : null,
              r.answers && r.answers.email_sent_at ? el('span', { class: 'admin-chip', title: `E-mail de confirmação enviado em ${c.fmtDateTime(r.answers.email_sent_at)}`, text: 'e-mail enviado' }) : null,
              r.status === 'cancelada' ? el('span', { class: 'admin-chip', text: 'cancelada' }) : null
            ]),
            el('td', { class: 'perm-col' }, canEdit ? c.deleteButton('registrations', r, 'inscrição') : null),
          ]));
        listBox.append(c.table(['Nome', 'CPF', 'Município', 'Categoria', 'Cargo', 'Telefone', 'Enviada em', '', ''], rows, term ? 'Nada encontrado.' : 'Nenhuma inscrição ainda.'));
      };
      body.append(el('div', { class: 'glass-card forms-section' }, [
        el('div', { class: 'forms-toolbar' }, [
          el('h3', { class: 'forms-section-title', text: `Inscrições (${valid.length})` }),
          c.searchBox(v => { term = v; draw(); })
        ]),
        listBox
      ]));
      draw();
      const trash = await c.trashSection('registrations', 'inscrições');
      if (trash) body.append(trash);
    }
  });
})();
