/**
 * CapacitaTE - Motor dos Formulários Públicos (inscrição, presença e avaliação; sem login)
 * Versão: v.3.8.9
 */

(function () {
  const VERSION = 'v.3.8.9';
  const MODULE = document.body.dataset.module; // inscricao | presenca | avaliacao
  const RPC_SUBMIT = { inscricao: 'public_submit_registration', presenca: 'public_submit_attendance', avaliacao: 'public_submit_evaluation' };
  const MODULE_TITLES = { inscricao: 'Formulário de Inscrição', presenca: 'Lista de Presença', avaliacao: 'Avaliação da Capacitação' };
  const schema = CapacitaTE.formSchema;
  const cpfLib = CapacitaTE.cpf;
  const fmt = CapacitaTE.formats;

  const token = new URLSearchParams(window.location.search).get('t') || '';
  const app = document.getElementById('pub-app');
  const state = { form: null, config: null, training: null, lookup: null, data: {}, steps: [], step: 0, sending: false };

  // ---------- utilidades ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
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

  const draftKey = () => `capacitate_draft_${token}`;
  function saveDraft() {
    try { sessionStorage.setItem(draftKey(), JSON.stringify({ cpf: state.cpf, data: state.data, step: state.step })); } catch (e) { /* sem sessionStorage */ }
  }
  function loadDraft() {
    try { return JSON.parse(sessionStorage.getItem(draftKey()) || 'null'); } catch (e) { return null; }
  }
  function clearDraft() {
    try { sessionStorage.removeItem(draftKey()); } catch (e) { /* sem sessionStorage */ }
  }

  function client() {
    return CapacitaTE.supabaseClient.get();
  }

  /**
   * Chama uma função pública. Distingue erro de rede (mantém os dados) de erro de validação do servidor.
   */
  async function rpc(name, params) {
    let res;
    try {
      res = await client().rpc(name, params);
    } catch (e) {
      throw Object.assign(new Error('Sem conexão com o servidor. Seus dados continuam aqui: verifique a internet e tente novamente.'), { network: true });
    }
    if (res.error) {
      const msg = res.error.message || '';
      if (/fetch|network|Failed to/i.test(msg)) {
        throw Object.assign(new Error('Sem conexão com o servidor. Seus dados continuam aqui: verifique a internet e tente novamente.'), { network: true });
      }
      throw new Error(msg || 'Não foi possível concluir. Tente novamente.');
    }
    return res.data;
  }

  function trainingLabel() {
    const t = state.training || {};
    const parts = [];
    if (t.number) parts.push(`${t.number}ª CTE`);
    if (t.polo) parts.push(`${t.polo}${t.uf ? ` (${t.uf})` : ''}`);
    return parts.join(' – ');
  }

  function sessionLabel() {
    if (MODULE !== 'presenca') return '';
    return state.config.label || '';
  }

  function render(...nodes) {
    app.textContent = '';
    nodes.forEach(n => n && app.appendChild(n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function card(children) {
    return el('section', { class: 'pub-card' }, children);
  }

  function header() {
    const t = state.training || {};
    return [
      el('h1', { class: 'pub-title', text: state.config.title || MODULE_TITLES[MODULE] }),
      el('p', { class: 'pub-subtitle', text: [trainingLabel(), sessionLabel() || t.datesFormatted].filter(Boolean).join(' · ') })
    ];
  }

  function alertBox(text, type = 'error') {
    return el('div', { class: `pub-alert pub-alert-${type}`, role: type === 'error' ? 'alert' : 'status', text });
  }

  // ---------- telas ----------
  function showLoading() {
    render(card(el('p', { class: 'pub-loading', text: 'Carregando formulário...' })));
  }

  function showFatal(message) {
    const c = schema.DEFAULTS.contacts;
    render(card([
      el('h1', { class: 'pub-title', text: MODULE_TITLES[MODULE] || 'Formulário' }),
      alertBox(message),
      el('p', { class: 'pub-help', text: `Dúvidas: WhatsApp ${c.whatsapp} · ${c.instagram} · ${c.site}` })
    ]));
  }

  function showClosed() {
    const c = state.config.contacts || schema.DEFAULTS.contacts;
    const msgs = {
      rascunho: 'Este formulário ainda não está disponível.',
      agendado: `Este formulário abre em ${fmt.formatDateTime(state.form.opens_at).slice(0, 16).replace(' ', ' às ')}.`,
      encerrado: 'Este formulário está encerrado e não recebe mais respostas.'
    };
    render(card([
      ...header(),
      alertBox(msgs[state.form.state] || 'Este formulário não está disponível.', 'info'),
      state.training && state.training.datesFormatted ? el('p', { class: 'pub-help', text: `Capacitação: ${state.training.datesFormatted}${state.training.locationVenue ? ` – ${state.training.locationVenue}` : ''}` }) : null,
      el('p', { class: 'pub-help', text: `Dúvidas: WhatsApp ${c.whatsapp} · Instagram ${c.instagram} · ${c.site}` })
    ]));
  }

  function showCpf(errorText = '') {
    const input = el('input', {
      class: 'pub-input', id: 'f-cpf', type: 'text', inputmode: 'numeric', autocomplete: 'off',
      placeholder: '000.000.000-00', maxlength: '14', 'aria-describedby': 'f-cpf-error', value: state.cpf ? cpfLib.format(state.cpf) : ''
    });
    input.addEventListener('input', () => { input.value = cpfLib.inputMask(input.value); });
    const err = el('span', { class: 'pub-error', id: 'f-cpf-error', role: 'alert', text: errorText });
    const btn = el('button', { type: 'submit', class: 'pub-btn pub-btn-primary', text: 'Continuar' });
    const form = el('form', { novalidate: true }, [
      el('div', { class: `pub-field${errorText ? ' has-error' : ''}` }, [
        el('label', { class: 'pub-label', for: 'f-cpf' }, ['CPF', el('span', { class: 'pub-req', 'aria-hidden': 'true', text: '*' })]),
        input, err
      ]),
      el('div', { class: 'pub-actions' }, btn)
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const digits = cpfLib.normalize(input.value);
      if (!cpfLib.isValid(digits)) {
        err.textContent = 'CPF inválido. Confira os números.';
        input.closest('.pub-field').classList.add('has-error');
        input.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Consultando...';
      try {
        state.cpf = digits;
        state.lookup = await rpc('public_lookup_cpf', { p_token: token, p_cpf: digits });
        afterLookup();
      } catch (ex) {
        btn.disabled = false;
        btn.textContent = 'Continuar';
        err.textContent = ex.message;
        input.closest('.pub-field').classList.add('has-error');
      }
    });
    render(card([
      ...header(),
      state.config.intro ? el('p', { class: 'pub-intro', text: state.config.intro }) : null,
      el('p', { class: 'pub-help', text: 'Comece pelo seu CPF. Se você já participou de outra capacitação, poderemos preencher seus dados automaticamente.' }),
      form
    ]));
    setTimeout(() => input.focus(), 50);
  }

  function afterLookup() {
    const lk = state.lookup;
    if (lk.already_submitted) {
      if (MODULE === 'presenca') return showAttendanceOk({ already: true, submitted_at: lk.submitted_at });
      if (!lk.allow_edit) {
        return render(card([
          ...header(),
          alertBox(`Você já respondeu este formulário em ${lk.submitted_when}.`, 'info'),
          el('p', { class: 'pub-help', text: 'Se precisar corrigir algum dado, fale com a equipe do CECATE.' }),
          el('div', { class: 'pub-actions' }, el('button', { type: 'button', class: 'pub-btn', text: 'Usar outro CPF', onclick: () => { state.cpf = ''; showCpf(); } }))
        ]));
      }
    }
    if (lk.exists) return showSecondFactor();
    startSteps();
  }

  function showSecondFactor(errorText = '') {
    const lk = state.lookup;
    const byBirth = lk.needs_birth_date;
    const input = byBirth
      ? el('input', { class: 'pub-input', id: 'f-factor', type: 'date', 'aria-describedby': 'f-factor-error' })
      : el('input', { class: 'pub-input', id: 'f-factor', type: 'email', autocomplete: 'email', 'aria-describedby': 'f-factor-error' });
    const err = el('span', { class: 'pub-error', id: 'f-factor-error', role: 'alert', text: errorText });
    const btn = el('button', { type: 'submit', class: 'pub-btn pub-btn-primary', text: 'Confirmar' });
    const intro = lk.already_submitted
      ? `Você já respondeu em ${lk.submitted_when}. Para atualizar a sua resposta, confirme`
      : `Encontramos um cadastro em nome de ${lk.masked_name}. Para carregar seus dados, confirme`;
    const form = el('form', { novalidate: true }, [
      el('p', { class: 'pub-intro', text: `${intro} ${byBirth ? 'sua data de nascimento' : `o seu e-mail completo (${lk.masked_email})`}.` }),
      el('div', { class: `pub-field${errorText ? ' has-error' : ''}` }, [
        el('label', { class: 'pub-label', for: 'f-factor', text: byBirth ? 'Data de nascimento' : 'E-mail' }), input, err
      ]),
      el('div', { class: 'pub-actions' }, btn),
      el('button', { type: 'button', class: 'pub-link-btn', text: 'Não sou eu / preencher manualmente', onclick: () => startSteps() })
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!input.value) { err.textContent = 'Preencha para continuar.'; return; }
      btn.disabled = true;
      try {
        const res = await rpc('public_unlock_profile', {
          p_token: token, p_cpf: state.cpf,
          p_birth_date: byBirth ? input.value : null, p_email: byBirth ? null : input.value.trim()
        });
        if (!res || res.ok === false) {
          btn.disabled = false;
          err.textContent = (res && res.message) || 'Os dados não conferem.';
          input.closest('.pub-field').classList.add('has-error');
          return;
        }
        prefill(res);
        startSteps();
      } catch (ex) {
        btn.disabled = false;
        err.textContent = ex.message;
      }
    });
    render(card([...header(), form]));
    setTimeout(() => input.focus(), 50);
  }

  function prefill(p) {
    const d = state.data;
    const put = (k, v) => { if (v !== null && v !== undefined && v !== '' && !d[k]) d[k] = v; };
    put('full_name', p.full_name);
    put('email', p.email);
    if (MODULE === 'inscricao') put('email_confirm', p.email);
    put('birth_date', p.birth_date);
    put('phone', p.phone ? fmt.formatPhone(p.phone) : '');
    const muns = schema.optionsOf({ optionsFrom: 'municipalities' }, state.config);
    if (p.municipality && muns.some(m => m.toLowerCase() === String(p.municipality).toLowerCase())) {
      put('municipality', muns.find(m => m.toLowerCase() === String(p.municipality).toLowerCase()));
    }
    put('category', p.category);
    put('role_gestao', p.role_gestao);
    put('role_cacs', p.role_cacs);
    put('institution_name', p.institution);
    saveDraft();
  }

  function stepsForModule() {
    if (MODULE === 'presenca') return state.lookup && state.lookup.has_registration ? schema.STEPS.presenca_inscrito : schema.STEPS.presenca_nao_inscrito;
    return schema.STEPS[MODULE];
  }

  // Etapas visíveis: some a etapa cujos campos ficaram todos ocultos pelas condições
  function visibleSteps() {
    return state.steps.filter(s => s.fields.some(f => !f.when || f.when(state.data)));
  }

  function startSteps() {
    state.steps = stepsForModule();
    const draft = loadDraft();
    if (draft && draft.cpf === state.cpf) {
      state.data = Object.assign({}, draft.data, state.data);
      state.step = Math.min(draft.step || 0, visibleSteps().length - 1);
    } else {
      state.step = 0;
    }
    showStep();
  }

  // ---------- campos ----------
  function fieldNode(field) {
    const cfg = state.config;
    const id = `f-${field.name}`;
    const errId = `${id}-error`;
    const value = state.data[field.name];
    const label = schema.labelOf(field, cfg);
    const set = (v) => { state.data[field.name] = v; saveDraft(); };
    const reqMark = field.required ? el('span', { class: 'pub-req', 'aria-hidden': 'true', text: '*' }) : null;
    const wrap = el('div', { class: 'pub-field', 'data-field': field.name });
    const err = el('span', { class: 'pub-error', id: errId, role: 'alert' });

    if (['text', 'email', 'tel', 'date'].includes(field.type)) {
      const input = el('input', {
        class: 'pub-input', id, type: field.type, value: value || '', autocomplete: field.autocomplete || null,
        inputmode: field.type === 'tel' ? 'tel' : null, required: field.required, 'aria-describedby': errId,
        maxlength: field.type === 'tel' ? '14' : null, placeholder: field.type === 'tel' ? '(65)99999-1234' : null
      });
      input.addEventListener('input', () => {
        if (field.type === 'tel') {
          const d = input.value.replace(/\D/g, '').slice(0, 11);
          input.value = d.length > 2 ? `(${d.slice(0, 2)})${d.length > 7 ? `${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.slice(2)}` : d;
        }
        set(input.value);
      });
      wrap.append(el('label', { class: 'pub-label', for: id }, [label, reqMark]), input, err);
    } else if (field.type === 'textarea') {
      const ta = el('textarea', { class: 'pub-textarea', id, required: field.required, 'aria-describedby': errId });
      ta.value = value || '';
      ta.addEventListener('input', () => set(ta.value));
      wrap.append(el('label', { class: 'pub-label', for: id }, [label, reqMark]), ta, err);
    } else if (field.type === 'select') {
      const opts = schema.optionsOf(field, cfg).slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const sel = el('select', { class: 'pub-select', id, required: field.required, 'aria-describedby': errId }, [
        el('option', { value: '', text: 'Selecione...' }),
        ...opts.map((o, i) => el('option', { value: o, text: `${i + 1}. ${o}` }))
      ]);
      sel.value = value || '';
      sel.addEventListener('change', () => set(sel.value));
      wrap.append(el('label', { class: 'pub-label', for: id }, [label, reqMark]), sel, err);
    } else if (field.type === 'radio') {
      const opts = schema.optionsOf(field, cfg);
      const group = el('div', { class: 'pub-options', role: 'radiogroup', 'aria-labelledby': `${id}-label`, 'aria-describedby': errId },
        opts.map((o, i) => {
          const input = el('input', { type: 'radio', name: id, id: `${id}-${i}`, value: o, checked: value === o });
          input.addEventListener('change', () => { set(o); if (field.name === 'category') showStep(true); });
          return el('label', { class: 'pub-option', for: `${id}-${i}` }, [input, el('span', { text: o })]);
        }));
      wrap.append(el('span', { class: 'pub-label', id: `${id}-label` }, [label, reqMark]), group, err);
    } else if (field.type === 'checkbox') {
      const input = el('input', { type: 'checkbox', id, checked: !!value, 'aria-describedby': errId });
      input.addEventListener('change', () => set(input.checked));
      wrap.append(el('label', { class: 'pub-option', for: id }, [input, el('span', {}, [label, reqMark])]), err);
    } else if (field.type === 'checkboxes') {
      const opts = schema.optionsOf(field, cfg);
      const selected = Array.isArray(value) ? value : [];
      const group = el('div', { class: 'pub-options', role: 'group', 'aria-labelledby': `${id}-label`, 'aria-describedby': errId },
        opts.map((o, i) => {
          const input = el('input', { type: 'checkbox', id: `${id}-${i}`, value: o, checked: selected.includes(o) });
          input.addEventListener('change', () => {
            const cur = new Set(Array.isArray(state.data[field.name]) ? state.data[field.name] : []);
            if (input.checked) cur.add(o); else cur.delete(o);
            set(opts.filter(x => cur.has(x)));
          });
          return el('label', { class: 'pub-option', for: `${id}-${i}` }, [input, el('span', { text: o })]);
        }));
      wrap.append(el('span', { class: 'pub-label', id: `${id}-label` }, [label, reqMark]), group);
      if (cfg[field.otherFrom]) {
        const other = el('input', { class: 'pub-input', id: `${id}-other`, type: 'text', value: state.data[field.otherName] || '', placeholder: 'Outro (descreva)' });
        other.addEventListener('input', () => { state.data[field.otherName] = other.value; saveDraft(); });
        wrap.append(el('label', { class: 'visually-hidden', for: `${id}-other`, text: 'Outro' }), el('div', { style: 'margin-top:0.5rem;' }, other));
      }
      wrap.append(err);
    } else if (field.type === 'rating') {
      const items = cfg[field.itemsFrom] || [];
      const cur = Object.assign({}, value || {});
      wrap.append(el('p', { class: 'pub-rating-help', id: `${id}-label`, text: label }));
      items.forEach(it => {
        const name = `${id}-${it.key}`;
        wrap.append(el('div', { class: 'pub-rating-item' }, el('fieldset', {}, [
          el('legend', {}, [it.label, reqMark ? el('span', { class: 'pub-req', 'aria-hidden': 'true', text: '*' }) : null]),
          el('div', { class: 'pub-rating-row' }, [1, 2, 3, 4, 5].map(n => {
            const input = el('input', { type: 'radio', name, value: String(n), checked: cur[it.key] === n, 'aria-label': `${it.label}: nota ${n}` });
            input.addEventListener('change', () => { cur[it.key] = n; set(Object.assign({}, cur)); });
            return el('label', {}, [input, el('span', { text: String(n), 'aria-hidden': 'true' })]);
          })),
          el('div', { class: 'pub-rating-scale', 'aria-hidden': 'true' }, [el('span', { text: 'ruim' }), el('span', { text: 'excelente' })])
        ])));
      });
      wrap.append(err);
    }
    return wrap;
  }

  // ---------- etapas ----------
  function showStep(keepScroll = false) {
    const steps = visibleSteps();
    state.step = Math.max(0, Math.min(state.step, steps.length - 1));
    const step = steps[state.step];
    const isLast = state.step === steps.length - 1;
    const pct = Math.round(((state.step + 1) / steps.length) * 100);
    const errorBox = el('div', { id: 'pub-step-error' });
    const fields = step.fields.filter(f => !f.when || f.when(state.data));

    const back = el('button', { type: 'button', class: 'pub-btn', text: 'Voltar' });
    back.addEventListener('click', () => {
      if (state.step === 0) { showCpf(); return; }
      state.step -= 1; saveDraft(); showStep();
    });
    const next = el('button', { type: 'submit', class: 'pub-btn pub-btn-primary', text: isLast ? 'Enviar' : 'Continuar' });

    const form = el('form', { novalidate: true }, [
      el('div', { class: 'pub-progress' }, [
        el('div', { class: 'pub-progress-label' }, [el('span', { text: step.title }), el('span', { text: `Etapa ${state.step + 1} de ${steps.length}` })]),
        el('div', { class: 'pub-progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) },
          el('div', { class: 'pub-progress-bar', style: `width:${pct}%` }))
      ]),
      errorBox,
      el('div', { class: 'pub-field' }, [
        el('label', { class: 'pub-label', for: 'f-cpf-locked', text: 'CPF' }),
        el('input', { class: 'pub-input', id: 'f-cpf-locked', type: 'text', value: cpfLib.format(state.cpf), readOnly: true })
      ]),
      ...fields.map(fieldNode),
      el('div', { class: 'pub-actions' }, [back, next])
    ]);
    // O CPF travado só aparece na primeira etapa
    if (state.step > 0) form.querySelector('#f-cpf-locked').closest('.pub-field').remove();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(form, fields)) return;
      if (!isLast) { state.step += 1; saveDraft(); showStep(); return; }
      await submit(next, errorBox);
    });
    render(card([...header(), form]));
    if (!keepScroll) setTimeout(() => { const first = form.querySelector('input:not([readonly]), select, textarea'); if (first) first.focus(); }, 50);
  }

  function validateStep(form, fields) {
    let firstBad = null;
    fields.forEach(f => {
      const msg = schema.validateField(f, state.data, state.config);
      const wrap = form.querySelector(`[data-field="${f.name}"]`);
      if (!wrap) return;
      wrap.classList.toggle('has-error', !!msg);
      const err = wrap.querySelector('.pub-error');
      if (err) err.textContent = msg;
      if (msg && !firstBad) firstBad = wrap;
    });
    if (firstBad) {
      const target = firstBad.querySelector('input, select, textarea');
      if (target) target.focus();
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  function payload() {
    const d = Object.assign({}, state.data, { cpf: state.cpf });
    if (d.phone) d.phone = String(d.phone).replace(/\D/g, '');
    return d;
  }

  async function submit(btn, errorBox) {
    if (state.sending) return;
    state.sending = true;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    errorBox.textContent = '';
    try {
      const res = await rpc(RPC_SUBMIT[MODULE], { p_token: token, p_payload: payload() });
      clearDraft();
      if (MODULE === 'presenca') showAttendanceOk(res); else showReceipt(res);
    } catch (ex) {
      errorBox.appendChild(alertBox(ex.message));
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.textContent = 'Tentar novamente';
    } finally {
      state.sending = false;
      btn.disabled = false;
    }
  }

  // ---------- comprovantes ----------
  function receiptLines(res) {
    const t = state.training || {};
    return [
      ['Protocolo', res.protocolo],
      ['Nome', res.full_name],
      ['Capacitação', trainingLabel()],
      ['Data', t.datesFormatted || ''],
      ['Local', [t.locationVenue, t.locationAddress].filter(Boolean).join(' – ')],
      ['Enviado em', fmt.formatDateTime(res.submitted_at)]
    ].filter(([, v]) => v);
  }

  function savePng(res) {
    const lines = receiptLines(res);
    const canvas = document.createElement('canvas');
    const w = 900;
    canvas.width = w;
    canvas.height = 260 + lines.length * 56;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, canvas.height);
    ctx.fillStyle = '#F6A800'; ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = '#202020'; ctx.font = 'bold 40px Arial';
    ctx.fillText(state.config.title || MODULE_TITLES[MODULE], 48, 90);
    ctx.fillStyle = '#4D4D4D'; ctx.font = '24px Arial';
    ctx.fillText('Comprovante – CECATE Centro-Oeste', 48, 134);
    lines.forEach(([k, v], i) => {
      const y = 200 + i * 56;
      ctx.fillStyle = '#757575'; ctx.font = '22px Arial'; ctx.fillText(k, 48, y);
      ctx.fillStyle = '#202020'; ctx.font = 'bold 26px Arial'; ctx.fillText(String(v).slice(0, 52), 260, y);
    });
    ctx.fillStyle = '#757575'; ctx.font = '20px Arial';
    ctx.fillText('Guarde este comprovante.', 48, canvas.height - 36);
    const a = el('a', { href: canvas.toDataURL('image/png'), download: `comprovante-${res.protocolo}.png` });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function showReceipt(res) {
    const lines = receiptLines(res);
    render(card(el('div', { class: 'pub-receipt' }, [
      el('div', { class: 'pub-receipt-icon', 'aria-hidden': 'true' }, svgCheck(36)),
      el('h2', { text: res.updated ? 'Resposta atualizada!' : (MODULE === 'inscricao' ? 'Inscrição recebida!' : 'Avaliação recebida!') }),
      res.waitlist ? alertBox('As vagas do seu município nesta categoria já foram preenchidas. Sua inscrição ficou em lista de espera e a equipe do CECATE entrará em contato.', 'info') : null,
      el('dl', {}, lines.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
      el('p', { class: 'pub-help', text: 'Guarde este comprovante.' }),
      el('div', { class: 'pub-actions' }, el('button', { type: 'button', class: 'pub-btn pub-btn-primary', text: 'Salvar comprovante (imagem)', onclick: () => savePng(res) }))
    ])));
  }

  function showAttendanceOk(res) {
    const when = res.submitted_at ? new Date(res.submitted_at) : new Date();
    const date = fmt.formatDate(when);
    const time = fmt.formatDateTime(when).slice(11, 16);
    render(el('section', { class: 'pub-attendance-ok', role: 'status' }, [
      svgCheck(64),
      el('h2', { text: res.already ? 'Presença já registrada' : 'Presença registrada' }),
      el('div', { class: 'pub-attendance-time', text: `${date} ${time}` }),
      res.full_name ? el('p', { text: res.full_name }) : null,
      el('p', { text: [trainingLabel(), sessionLabel()].filter(Boolean).join(' · ') }),
      res.already ? el('p', { text: 'Não é preciso registrar de novo.' }) : null
    ]));
  }

  function svgCheck(size) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS(ns, 'polyline'); p.setAttribute('points', '20 6 9 17 4 12');
    svg.appendChild(p);
    return svg;
  }

  // ---------- início ----------
  async function start() {
    const v = document.getElementById('pub-version');
    if (v) v.textContent = VERSION;
    if (!token) return showFatal('Link incompleto. Use o QR Code ou o link enviado pela equipe do CECATE.');
    showLoading();
    try {
      const form = await rpc('public_get_form', { p_token: token });
      if (form.module_key !== MODULE) return showFatal('Este link pertence a outro formulário. Confira o QR Code.');
      state.form = form;
      state.config = schema.withDefaults(form.config);
      state.training = form.training || {};
      document.title = `${state.config.title || MODULE_TITLES[MODULE]} – CapacitaTE`;
      if (form.state !== 'aberto') return showClosed();
      const draft = loadDraft();
      if (draft && draft.cpf) state.cpf = draft.cpf;
      showCpf();
    } catch (ex) {
      showFatal(ex.message);
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
