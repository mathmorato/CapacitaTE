/**
 * CapacitaTE - Base das telas internas dos formulários (Inscrição, Presença e Avaliação)
 * Escolha da capacitação, criação e configuração do formulário, abrir/encerrar/agendar, link público e QR Code,
 * troca de link e listas de respostas. Cada módulo registra-se com CapacitaTE.formModules.register(...).
 * Versão: v.3.9.9
 */

(function () {
  const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const MODULE_NAMES = { inscricao: 'Inscrição', presenca: 'Lista de Presença', avaliacao: 'Avaliação' };
  const PUBLIC_PAGES = { inscricao: 'inscricao.html', presenca: 'presenca.html', avaliacao: 'avaliacao.html' };
  const STATUS_LABELS = { rascunho: 'Rascunho', aberto: 'Aberto', fechado: 'Encerrado' };
  let refreshTimer = null;
  const registry = {};

  // ---------- utilidades ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v; // somente SVG gerado pelo próprio código (ícones e QR)
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'checked' || k === 'disabled' || k === 'readOnly') node[k] = !!v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  const toast = (msg, type = 'info') => window.app && window.app.showToast(msg, type);
  const client = () => CapacitaTE.supabaseClient.get();
  const can = (key, action, trainingId) => CapacitaTE.can(key, action, trainingId);
  const fmtDateTime = (v) => (v ? CapacitaTE.formats.formatDateTime(v) : '—');
  const maskCpf = (c) => CapacitaTE.cpf.mask(c) || '—';
  const fmtPhone = (p) => (p ? CapacitaTE.formats.formatPhone(p) : '');
  const errMsg = (err) => {
    const m = (err && err.message) || String(err || '');
    if (/relation .* does not exist|schema cache|PGRST20/i.test(m)) return 'As migrações 0003 e 0004 ainda não foram aplicadas no Supabase.';
    if (/row-level security|permission denied/i.test(m)) return 'Você não tem permissão para esta ação.';
    return m || 'Falha inesperada.';
  };

  // datetime-local <-> ISO
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

  function publicUrl(form) {
    const base = CapacitaTE.config.getPublicBaseUrl();
    if (!base) return '';
    return `${base}/publico/${PUBLIC_PAGES[form.module_key]}?t=${form.public_token}`;
  }

  async function audit(action, mod, trainingId, target, details) {
    if (CapacitaTE.audit) await CapacitaTE.audit.log(action, { module: mod, trainingId, target, details });
  }

  // ---------- capacitações ----------
  async function loadTraining(trainingId) {
    const full = window.db && typeof window.db.getTrainingFull === 'function' ? await window.db.getTrainingFull(trainingId) : null;
    return full;
  }

  function trainingTitle(t) {
    if (!t) return 'Capacitação';
    return [t.number ? `${t.number}ª CTE` : null, t.polo ? `${t.polo}${t.uf ? ` (${t.uf})` : ''}` : null].filter(Boolean).join(' – ') || 'Capacitação';
  }

  function trainingMunicipalities(t) {
    return (t && Array.isArray(t.municipalities) ? t.municipalities : [])
      .filter(m => m && m.name)
      .map(m => ({ name: String(m.name).trim(), ibge: String(m.ibgeCode || m.ibge || '').trim(), uf: m.uf || t.uf || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  // Texto de apresentação gerado a partir dos dados da capacitação (editável depois)
  function buildIntro(t) {
    const n = trainingMunicipalities(t).length;
    const ufName = window.reportDocxGenerator && typeof window.reportDocxGenerator.getUfFullName === 'function'
      ? window.reportDocxGenerator.getUfFullName(t.uf) : t.uf;
    const c = CapacitaTE.formSchema.DEFAULTS.contacts;
    return `O Fundo Nacional de Desenvolvimento da Educação (FNDE), em parceria com o Centro Colaborador de Apoio ao Transporte Escolar da Região Centro-Oeste (CECATE-CO), convida gestores municipais e conselheiros do CACS-FUNDEB${n ? ` de ${n} municípios` : ''}${ufName ? ` do Estado de ${ufName}` : ''} para a Capacitação em Transporte Escolar${t.locationVenue ? `, que será realizada no ${t.locationVenue}` : ''}${t.datesFormatted ? `, nos dias ${t.datesFormatted}` : ''}.

A formação visa aprimorar a gestão do Programa Caminho da Escola e do Programa Nacional de Apoio ao Transporte do Escolar (PNATE) nos municípios. Em um ambiente de troca e diálogo, os participantes inscritos terão acesso às informações sobre os normativos dos programas federais de transporte escolar e orientações sobre execução dos recursos e prestação de contas.

Caso surja alguma nova dúvida, entre em contato através dos seguintes canais de comunicação:
WhatsApp: ${c.whatsapp} · Site: ${c.site} · Instagram: ${c.instagram}`;
  }

  // ---------- formulários (Supabase) ----------
  async function loadForms(mod, trainingId) {
    const { data, error } = await client().from('forms').select('*').eq('training_id', trainingId).eq('module_key', mod).order('session_key');
    if (error) throw error;
    return data || [];
  }

  async function createForm(mod, training, sessionKey, extraConfig = {}) {
    const defaults = CapacitaTE.formSchema.DEFAULTS;
    const config = Object.assign({
      title: { inscricao: 'Capacitação em Transporte Escolar', presenca: `${training.number ? `${training.number}CTE - ` : ''}Lista de Presença`, avaliacao: 'Avaliação da Capacitação' }[mod],
      contacts: defaults.contacts,
      municipalities: trainingMunicipalities(training),
      allowEdit: mod === 'inscricao'
    }, mod === 'inscricao' ? { intro: buildIntro(training), truthStatement: defaults.truthStatement, maxPerMunicipalityPerCategory: null } : {},
    mod === 'presenca' ? { intro: CapacitaTE.formSchema.DEFAULTS.attendanceWelcome } : {},
    mod === 'avaliacao' ? {
      subtitle: `${training.number ? `${training.number} CTE - ` : ''}${training.polo || ''}${training.uf ? ` (${training.uf})` : ''} ${training.datesFormatted || ''}`.trim(),
      ratingLabel: defaults.ratingLabel, ratingItems: defaults.ratingItems, institutionOptions: defaults.institutionOptions,
      heardFromOptions: defaults.heardFromOptions, heardFromAllowOther: true, onlyForAttendees: false
    } : {}, extraConfig);
    const user = CapacitaTE.auth && CapacitaTE.auth.user;
    const { data, error } = await client().from('forms').insert({
      training_id: training.id, module_key: mod, session_key: sessionKey, status: 'rascunho', config,
      created_by: user ? user.id : null
    }).select().single();
    if (error) {
      if (/foreign key|trainings/i.test(error.message)) throw new Error('Esta capacitação ainda não está na nuvem. Use "Sincronizar" no topo e tente de novo.');
      throw error;
    }
    await audit('form.create', mod, training.id, data.id, { session: sessionKey });
    return data;
  }

  async function updateForm(form, patch, auditAction) {
    const { data, error } = await client().from('forms').update(patch).eq('id', form.id).select().single();
    if (error) throw error;
    if (auditAction) await audit(auditAction, form.module_key, form.training_id, form.id, patch.status ? { status: patch.status } : null);
    Object.assign(form, data);
    return form;
  }

  // ---------- cartão do formulário ----------
  function formStateBadge(form) {
    const now = Date.now();
    let label = STATUS_LABELS[form.status];
    let cls = form.status === 'aberto' ? 'forms-badge-open' : (form.status === 'fechado' ? 'forms-badge-closed' : 'forms-badge-draft');
    if (form.status === 'aberto' && form.opens_at && now < new Date(form.opens_at).getTime()) { label = 'Agendado'; cls = 'forms-badge-draft'; }
    if (form.status === 'aberto' && form.closes_at && now >= new Date(form.closes_at).getTime()) { label = 'Encerrado (horário)'; cls = 'forms-badge-closed'; }
    return el('span', { class: `forms-badge ${cls}`, text: label });
  }

  /**
   * Cartão com status, agendamento, configuração, link e QR Code do formulário
   */
  function formCard(form, ctx) {
    const { mod, training, rerender } = ctx;
    const canEdit = can(mod, 'edit', form.training_id);
    const url = publicUrl(form);
    const title = (form.config && form.config.label) || (form.session_key === 'unico' ? MODULE_NAMES[mod] : form.session_key);
    const run = (fn) => async (e) => {
      const btn = e && e.currentTarget;
      if (btn) btn.disabled = true;
      try { await fn(); } catch (err) { toast(errMsg(err), 'error'); } finally { if (btn) btn.disabled = false; }
    };

    // Status
    const statusRow = el('div', { class: 'forms-status-row' }, [
      el('h3', { class: 'forms-card-title', text: title }),
      formStateBadge(form),
      el('span', { class: 'admin-muted', text: form.opens_at || form.closes_at ? `Janela: ${fmtDateTime(form.opens_at)} até ${fmtDateTime(form.closes_at)}` : '' })
    ]);
    const actions = el('div', { class: 'admin-actions' });
    if (canEdit) {
      if (form.status !== 'aberto') actions.append(el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Abrir', onclick: run(async () => { await updateForm(form, { status: 'aberto' }, 'form.open'); toast('Formulário aberto.', 'success'); rerender(); }) }));
      if (form.status === 'aberto') actions.append(el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Encerrar', onclick: run(async () => { await updateForm(form, { status: 'fechado' }, 'form.close'); toast('Formulário encerrado.', 'success'); rerender(); }) }));
      if (form.status !== 'rascunho') actions.append(el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Voltar a rascunho', onclick: run(async () => { await updateForm(form, { status: 'rascunho' }, 'form.draft'); rerender(); }) }));
    }

    // Link e QR Code
    const qrBox = el('div', { class: 'forms-qr' });
    const linkBox = el('div', { class: 'forms-link' });
    if (!url) {
      linkBox.append(el('p', { class: 'admin-muted', text: 'Configure o endereço público (ex.: https://<usuario>.github.io/<repo>) em Configurações para gerar o link e o QR Code.' }));
    } else {
      qrBox.append(el('div', { class: 'forms-qr-img', html: CapacitaTE.qr.svg(url, { title: `QR Code: ${title}` }) }));
      const linkInput = el('input', { class: 'form-control', type: 'text', value: url, readOnly: true, 'aria-label': 'Link público' });
      const posterTitle = { inscricao: 'Inscrição', presenca: `Lista de Presença${form.config && form.config.label ? ` — ${form.config.label}` : ''}`, avaliacao: 'Avaliação da Capacitação' }[mod];
      linkBox.append(
        el('label', { class: 'form-label', text: 'Link público' }), linkInput,
        el('div', { class: 'admin-actions', style: 'margin-top:0.6rem;' }, [
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Copiar link', onclick: async () => {
            try { await navigator.clipboard.writeText(url); toast('Link copiado.', 'success'); } catch (e) { linkInput.select(); document.execCommand('copy'); toast('Link copiado.', 'success'); }
          } }),
          el('a', { class: 'btn btn-secondary btn-sm', href: url, target: '_blank', rel: 'noopener', text: 'Abrir' }),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Baixar PNG', onclick: () => CapacitaTE.qr.downloadPng(url, `qr-${mod}-${form.session_key}.png`) }),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Baixar SVG', onclick: () => CapacitaTE.qr.downloadSvg(url, `qr-${mod}-${form.session_key}.svg`) }),
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Imprimir cartaz A4', onclick: () => {
            try { CapacitaTE.qr.printPoster(url, { title: posterTitle, subtitle: `${trainingTitle(training)} · ${training.datesFormatted || ''}` }); } catch (err) { toast(err.message, 'error'); }
          } }),
          canEdit ? el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Gerar novo link', onclick: () => window.app.openConfirmModal({
            title: 'Gerar novo link?',
            msg: 'O link e o QR Code atuais deixam de funcionar. Cartazes já impressos precisarão ser trocados.',
            btnText: 'Sim, gerar novo link',
            successTitle: 'Novo link gerado',
            successMsg: 'Use o novo QR Code a partir de agora.',
            onConfirm: async () => {
              const { error } = await client().rpc('staff_rotate_token', { p_form: form.id });
              if (error) return toast(errMsg(error), 'error');
              rerender();
            }
          }) }) : null
        ])
      );
    }

    // Configuração
    const cfg = form.config || {};
    const cfgBox = el('details', { class: 'forms-config' });
    cfgBox.append(el('summary', { text: 'Configurar formulário' }));
    const fTitle = el('input', { class: 'form-control', type: 'text', value: cfg.title || '', id: `cfg-title-${form.id}` });
    const fOpens = el('input', { class: 'form-control', type: 'datetime-local', value: toLocalInput(form.opens_at), id: `cfg-open-${form.id}` });
    const fCloses = el('input', { class: 'form-control', type: 'datetime-local', value: toLocalInput(form.closes_at), id: `cfg-close-${form.id}` });
    const fields = [
      el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: `cfg-title-${form.id}`, text: 'Título' }), fTitle]),
      el('div', { class: 'admin-form-grid' }, [
        el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: `cfg-open-${form.id}`, text: 'Abre em (opcional)' }), fOpens]),
        el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: `cfg-close-${form.id}`, text: 'Fecha em (opcional)' }), fCloses])
      ])
    ];
    const extraInputs = {};
    if (mod === 'inscricao') {
      extraInputs.intro = el('textarea', { class: 'form-control', rows: '6', id: `cfg-intro-${form.id}` });
      extraInputs.intro.value = cfg.intro || '';
      extraInputs.max = el('input', { class: 'form-control', type: 'number', min: '1', value: cfg.maxPerMunicipalityPerCategory || '', id: `cfg-max-${form.id}`, placeholder: 'sem limite' });
      fields.push(
        el('div', { class: 'form-group', style: 'margin-top:1rem;' }, [el('label', { class: 'form-label', for: `cfg-intro-${form.id}`, text: 'Texto de apresentação' }), extraInputs.intro,
          el('button', { type: 'button', class: 'btn btn-secondary btn-sm', style: 'margin-top:0.4rem;', text: 'Gerar texto a partir da capacitação', onclick: () => { extraInputs.intro.value = buildIntro(training); } })]),
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: `cfg-max-${form.id}`, text: 'Vagas por município e categoria (acima disso, lista de espera)' }), extraInputs.max])
      );
    }
    if (mod === 'presenca' && form.session_key !== 'unico') {
      extraInputs.label = el('input', { class: 'form-control', type: 'text', value: cfg.label || '', id: `cfg-label-${form.id}`, placeholder: '23/06/2026 — Manhã' });
      fields.push(el('div', { class: 'form-group', style: 'margin-top:1rem;' }, [el('label', { class: 'form-label', for: `cfg-label-${form.id}`, text: 'Nome da sessão' }), extraInputs.label]));
    }
    if (mod === 'avaliacao') {
      extraInputs.only = el('input', { type: 'checkbox', checked: !!cfg.onlyForAttendees, id: `cfg-only-${form.id}` });
      fields.push(el('label', { class: 'forms-check', for: `cfg-only-${form.id}` }, [extraInputs.only, 'Aceitar somente quem registrou presença']));
    }
    extraInputs.allowEdit = el('input', { type: 'checkbox', checked: !!cfg.allowEdit, id: `cfg-edit-${form.id}` });
    extraInputs.sendEmail = el('input', { type: 'checkbox', checked: cfg.sendEmail !== false, id: `cfg-mail-${form.id}` });
    fields.push(el('label', { class: 'forms-check', for: `cfg-mail-${form.id}` }, [extraInputs.sendEmail, 'Enviar e-mail de confirmação para quem responder']));
    if (mod !== 'presenca') fields.push(el('label', { class: 'forms-check', for: `cfg-edit-${form.id}` }, [extraInputs.allowEdit, 'Permitir que a pessoa atualize a própria resposta enquanto o formulário estiver aberto']));

    const munCount = (cfg.municipalities || []).length;
    const trainingMuns = trainingMunicipalities(training);
    const munChanged = JSON.stringify((cfg.municipalities || []).map(m => m.name)) !== JSON.stringify(trainingMuns.map(m => m.name));
    fields.push(el('div', { class: 'forms-muns' }, [
      el('span', { text: `${munCount} municípios no formulário.` }),
      munChanged ? el('span', { class: 'forms-warn', text: ` A lista de municípios convocados mudou (${trainingMuns.length} na Etapa 3 do Relatório).` }) : null,
      el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Atualizar a partir dos municípios convocados', onclick: run(async () => {
        await updateForm(form, { config: Object.assign({}, form.config, { municipalities: trainingMuns }) }, 'form.config');
        toast('Municípios atualizados.', 'success'); rerender();
      }) })
    ]));

    if (canEdit) {
      fields.push(el('div', { class: 'admin-actions', style: 'margin-top:1rem;' }, el('button', {
        type: 'button', class: 'btn btn-primary btn-sm', text: 'Salvar configuração', onclick: run(async () => {
          const opens = fromLocalInput(fOpens.value);
          const closes = fromLocalInput(fCloses.value);
          if (opens && closes && new Date(closes) <= new Date(opens)) throw new Error('O fechamento precisa ser depois da abertura.');
          const newCfg = Object.assign({}, form.config, { title: fTitle.value.trim() || form.config.title, allowEdit: extraInputs.allowEdit.checked, sendEmail: extraInputs.sendEmail.checked });
          if (extraInputs.intro) newCfg.intro = extraInputs.intro.value.trim();
          if (extraInputs.max) newCfg.maxPerMunicipalityPerCategory = extraInputs.max.value ? parseInt(extraInputs.max.value, 10) : null;
          if (extraInputs.label) newCfg.label = extraInputs.label.value.trim();
          if (extraInputs.only) newCfg.onlyForAttendees = extraInputs.only.checked;
          await updateForm(form, { config: newCfg, opens_at: opens, closes_at: closes }, 'form.config');
          toast('Configuração salva.', 'success'); rerender();
        })
      })));
    } else {
      cfgBox.append(el('p', { class: 'admin-muted', text: 'Somente leitura: você não tem permissão para editar este módulo.' }));
    }
    cfgBox.append(...fields);

    // Lista de cidades diferente da Etapa 3 do Relatório: aviso em destaque (o link e o QR continuam os mesmos)
    const munAlert = munChanged && mod !== 'avaliacao' ? el('div', { class: 'forms-alert' }, [
      el('span', { text: `As cidades convidadas mudaram: o formulário tem ${munCount} e a capacitação tem ${trainingMuns.length}. Atualize para o público ver a lista nova (o link e o QR Code continuam os mesmos).` }),
      canEdit ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Atualizar cidades no formulário', onclick: run(async () => {
        await updateForm(form, { config: Object.assign({}, form.config, { municipalities: trainingMuns }) }, 'form.config');
        toast('Cidades atualizadas no formulário.', 'success'); rerender();
      }) }) : null
    ]) : null;

    // Rascunho: o link ainda responde "não está disponível" para o público
    const draftAlert = form.status === 'rascunho' ? el('div', { class: 'forms-alert forms-alert-draft' }, [
      el('span', { text: 'Em rascunho: o público ainda não consegue responder (o link mostra "Este formulário ainda não está disponível"). Confira a configuração e clique em Abrir para liberar.' }),
      canEdit ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Abrir agora', onclick: run(async () => { await updateForm(form, { status: 'aberto' }, 'form.open'); toast('Formulário aberto: o link já está funcionando.', 'success'); rerender(); }) }) : null
    ]) : null;

    return el('div', { class: 'glass-card forms-card' }, [
      munAlert, draftAlert, statusRow, actions,
      el('div', { class: 'forms-share' }, [qrBox, linkBox]),
      cfgBox
    ]);
  }

  // ---------- tabelas ----------
  function table(headers, rows, emptyText) {
    if (!rows.length) return el('p', { class: 'admin-muted', text: emptyText || 'Nenhuma resposta ainda.' });
    return el('div', { class: 'data-table-container', style: 'overflow-x:auto;' }, el('table', { class: 'data-table admin-table' }, [
      el('thead', {}, el('tr', {}, headers.map(h => el('th', { text: h })))),
      el('tbody', {}, rows)
    ]));
  }

  function searchBox(onInput, placeholder = 'Buscar por nome ou município') {
    const input = el('input', { class: 'form-control forms-search', type: 'search', placeholder, 'aria-label': placeholder });
    input.addEventListener('input', () => onInput(input.value.trim().toLowerCase()));
    return input;
  }

  // ---------- excluir e lixeira ----------
  // Excluir copia a resposta para public.deleted_responses (0004g) e remove da tabela; restaurar faz o caminho inverso.
  function deleteButton(ctx, tableName, row, what) {
    return el('button', { type: 'button', class: 'btn btn-secondary btn-sm admin-danger-btn', text: 'Excluir', onclick: () => window.app.openConfirmModal({
      title: `Excluir ${what}?`, msg: `${what[0].toUpperCase() + what.slice(1)} de ${row.full_name || 'esta pessoa'} sai da lista e vai para a Lixeira, de onde pode ser restaurada.`, btnText: 'Sim, excluir',
      successTitle: 'Movida para a Lixeira', successMsg: 'Você pode restaurar pela seção Lixeira.',
      onConfirm: async () => {
        const { error } = await client().rpc('staff_delete_response', { p_table: tableName, p_id: row.id });
        if (error) return toast(errMsg(error), 'error');
        ctx.rerender();
      }
    }) });
  }

  async function trashSection(ctx, tableName, whatPlural) {
    const { data, error } = await client().from('deleted_responses').select('*').eq('training_id', ctx.training.id).eq('table_name', tableName).order('deleted_at', { ascending: false });
    if (error) return null; // migração 0004g ainda não aplicada: não mostra a lixeira
    const items = data || [];
    const canEdit = can(ctx.mod, 'edit', ctx.training.id);
    const rows = items.map(d => {
      const r = d.record || {};
      return el('tr', {}, [
        el('td', { text: r.full_name || '—' }),
        el('td', { text: maskCpf(r.cpf) }),
        el('td', { text: r.session_key && tableName === 'attendance' ? r.session_key : (r.municipality || '—') }),
        el('td', { text: fmtDateTime(d.deleted_at) }),
        el('td', { class: 'perm-col' }, canEdit ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Restaurar', onclick: async (e) => {
          e.currentTarget.disabled = true;
          const { error: err } = await client().rpc('staff_restore_response', { p_deleted: d.id });
          if (err) { toast(errMsg(err), 'error'); e.currentTarget.disabled = false; return; }
          toast('Restaurada.', 'success'); ctx.rerender();
        } }) : null)
      ]);
    });
    return el('details', { class: 'glass-card forms-section forms-config' }, [
      el('summary', { text: `Lixeira (${items.length})` }),
      el('p', { class: 'admin-muted', text: `${whatPlural[0].toUpperCase() + whatPlural.slice(1)} excluídas ficam aqui e podem ser restauradas.` }),
      table(['Nome', 'CPF', tableName === 'attendance' ? 'Dia' : 'Município', 'Excluída em', ''], rows, 'A lixeira está vazia.')
    ]);
  }

  // ---------- páginas ----------
  function header(def, training) {
    return el('div', { class: 'forms-header' }, [
      el('div', {}, [
        el('h2', { style: 'margin:0; display:flex; align-items:center; gap:0.5rem;' }, [el('span', { html: def.icon, class: 'forms-header-icon' }), def.title]),
        el('p', { style: 'color:var(--text-secondary); margin:0.25rem 0 0;', text: training ? `${trainingTitle(training)} · ${training.datesFormatted || ''}` : 'Escolha a capacitação.' })
      ]),
      training ? el('a', { class: 'btn btn-secondary btn-sm', href: `#${def.key}`, text: 'Trocar capacitação' }) : null
    ]);
  }

  async function renderTraining(def, container, trainingId, { embedded = false } = {}) {
    const hashAtStart = window.location.hash;
    const training = await loadTraining(trainingId);
    if (!training) {
      container.textContent = '';
      if (!embedded) container.append(header(def, null));
      container.append(el('div', { class: 'glass-card' }, el('p', { class: 'auth-message-error', text: 'Capacitação não encontrada neste navegador. Sincronize e tente de novo.' })));
      return;
    }
    const body = el('div');
    container.textContent = '';
    if (!embedded) container.append(header(def, training));
    container.append(body);
    const rerender = () => renderTraining(def, container, trainingId, { embedded });
    body.append(el('p', { class: 'admin-muted', text: 'Carregando...' }));
    try {
      const forms = await loadForms(def.key, training.id);
      body.textContent = '';
      const ctxRef = {};
      const ctx = { mod: def.key, training, forms, rerender, el, toast, client, can, errMsg, audit, table, searchBox, formCard, createForm, deleteButton: (tbl, row, what) => deleteButton(ctxRef, tbl, row, what), trashSection: (tbl, plural) => trashSection(ctxRef, tbl, plural), maskCpf, fmtPhone, fmtDateTime, trainingTitle };
      Object.assign(ctxRef, ctx);
      await def.render(body, ctx);
    } catch (err) {
      body.textContent = '';
      body.append(el('p', { class: 'auth-message-error', text: errMsg(err) }));
    }
    // Atualiza a cada 30 s enquanto a tela estiver aberta
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (window.location.hash !== hashAtStart || !document.body.contains(container) || document.hidden) return;
      if (container.querySelector('details[open], input:focus, textarea:focus')) return;
      rerender();
    }, 30000);
  }

  CapacitaTE.formModules = {
    el, toast, client, errMsg, publicUrl, trainingMunicipalities, loadTraining,
    /**
     * Registra um módulo de formulário: def = { key, title, icon, order, render(body, ctx) }
     */
    /**
     * Registra um módulo de formulário: def = { key, title, iconPaths, order, stage, render(body, ctx) }.
     * O módulo não tem item próprio no menu: ele aparece dentro da página da capacitação (etapas 1 e 2).
     */
    register(def) {
      const full = Object.assign({}, def, { icon: `<svg ${ICON_ATTRS}>${def.iconPaths}</svg>` });
      registry[def.key] = full;
      CapacitaTE.registerModule({
        key: def.key,
        title: def.title,
        icon: full.icon,
        order: def.order,
        actions: ['view', 'edit', 'export'],
        perTraining: true,
        menu: [],
        mount: (container, ctx = {}) => renderTraining(full, container, ctx.trainingId, { embedded: true }),
        routes: {
          [def.key]: () => { window.location.hash = 'trainings'; },
          [`${def.key}/:id`]: ({ id }) => { window.location.hash = `capacitacao/${id}/${def.stage || 1}`; }
        }
      });
    },

    /**
     * Desenha o módulo dentro de outra tela (página da capacitação)
     */
    renderEmbedded(key, container, trainingId) {
      const def = registry[key];
      if (!def) return;
      if (!can(key, 'view', trainingId)) {
        container.textContent = '';
        container.append(el('p', { class: 'admin-muted', text: `Você não tem permissão para ver ${def.title}.` }));
        return;
      }
      clearInterval(refreshTimer);
      return renderTraining(def, container, trainingId, { embedded: true });
    },

    trainingTitle, buildIntro
  };
})();
