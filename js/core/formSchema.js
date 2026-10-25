/**
 * CapacitaTE - Esquema dos Formulários (campos, etapas, textos padrão e validação; compartilhado com publico/)
 * Versão: v.3.9.4
 */

(function (root) {
  const CATEGORIES = ['CACS-FUNDEB', 'Gestão municipal'];

  // Textos e opções padrão (seções 8.1, 10.1 e 15 da especificação). Mantenha a grafia exata das opções:
  // o excelParser.js e o relatório dependem desses valores (inclusive o ";" e "Oficio" sem acento).
  const DEFAULTS = {
    consentText: 'Autorizo o tratamento dos meus dados pessoais pelo CECATE Centro-Oeste/UFG e pelo FNDE exclusivamente para fins de gestão, certificação e avaliação das capacitações em transporte escolar, nos termos da Lei nº 13.709/2018 (LGPD).',
    truthStatement: 'Declaro que revisei e confirmo a veracidade de todas as informações prestadas neste formulário.',
    contacts: { whatsapp: '(62) 3209-6723', site: 'https://cecate.fct.ufg.br/', instagram: '@cecate.co', email: 'cecate@ufg.br' },
    ratingLabel: 'Avaliar de 1 a 5 (1 significa "ruim" e 5 significa "excelente")',
    ratingItems: [
      { key: 'inscricao', label: 'Inscrição' },
      { key: 'divulgacao', label: 'Divulgação' },
      { key: 'data', label: 'Data da Formação' },
      { key: 'horario', label: 'Horário da Formação' },
      { key: 'local', label: 'Local da Formação' },
      { key: 'duracao', label: 'Duração da Formação' },
      { key: 'geral', label: 'Como você avalia a Formação' }
    ],
    institutionOptions: ['Prefeitura;', 'Secretaria Municipal de Educação;', 'Secretaria Estadual de Educação;', 'Conselheira (o) do CACS/Fundeb', 'Outros'],
    heardFromOptions: ['E-mail encaminhado pelo CECATE/CO', 'Oficio de convocação feito pelo FNDE', 'Grupos de WhatsApp', 'Instagram'],
    heardFromAllowOther: true,
    successCaseText: 'Prezado(a) Gestor(a),\n\nSe existe algum caso de sucesso da gestão do transporte escolar no seu município, gostaríamos conhecer mais um pouco ao respeito.\n\nPor favor, relate de forma sucinta o caso de sucesso no espaço a seguir:',
    attendanceWelcome: 'Seja bem-vindo ao curso de Capacitação em Transporte Escolar (CTE).\n\nEste curso tem como objetivo aprimorar os conhecimentos em transporte escolar dos gestores municipais, apresentando os programas do governo federal, mostrando os principais aspectos de planejamento e regulação na área e ensinando o Sistema Eletrônico de Gestão do Transporte Escolar (SETE).'
  };

  const isGestao = (d) => d.category === 'Gestão municipal';
  const isCacs = (d) => d.category === 'CACS-FUNDEB';

  // Campos de pessoa (rótulos iguais aos formulários do Google usados pelo CECATE)
  const F = {
    full_name: { name: 'full_name', type: 'text', label: 'Nome Completo:', required: true, autocomplete: 'name', minLength: 3 },
    email: { name: 'email', type: 'email', label: 'E-mail', required: true, autocomplete: 'email' },
    email_confirm: { name: 'email_confirm', type: 'email', label: 'Confirme o E-mail', required: true, autocomplete: 'off', sameAs: 'email' },
    birth_date: { name: 'birth_date', type: 'date', label: 'Data de Nascimento', required: true },
    phone: { name: 'phone', type: 'tel', label: 'Telefone (XX)XXXXX-XXXX', required: true, autocomplete: 'tel' },
    municipality: { name: 'municipality', type: 'select', label: 'Município que representa:', required: true, optionsFrom: 'municipalities' },
    category: { name: 'category', type: 'radio', label: 'Você faz parte do:', required: true, options: CATEGORIES },
    role_gestao: { name: 'role_gestao', type: 'text', label: 'Que cargo você ocupa na gestão municipal?', required: true, when: isGestao },
    success_case: { name: 'success_case', type: 'textarea', labelFrom: 'successCaseText', required: false, when: isGestao },
    role_cacs: { name: 'role_cacs', type: 'text', label: 'Que cargo você ocupa no CACS-FUNDEB?', required: true, when: isCacs },
    truth_confirmed: { name: 'truth_confirmed', type: 'checkbox', labelFrom: 'truthStatement', required: true },
    consent: { name: 'consent', type: 'checkbox', labelFrom: 'consentText', required: true }
  };

  // Seções no mesmo desenho dos formulários do Google (o CPF é sempre a primeira tela, fora destas etapas).
  // Seções com "when" só aparecem para a categoria correspondente (Gestores × CACS-FUNDEB).
  const gestores = { title: 'Gestores', when: isGestao, fields: [F.role_gestao, F.success_case] };
  const cacs = { title: 'CACS-FUNDEB', when: isCacs, fields: [F.role_cacs] };
  const STEPS = {
    inscricao: [
      { title: 'Dados pessoais', fields: [F.email, F.full_name, F.email_confirm, F.birth_date, F.phone, F.municipality, F.category] },
      gestores,
      cacs,
      { title: 'Confirmação', fields: [F.truth_confirmed, F.consent] }
    ],
    // Presença de quem já está inscrito: só confirma nome, telefone e e-mail
    presenca_inscrito: [
      {
        title: 'Confirme seus dados', fields: [
          F.full_name,
          { ...F.phone, label: 'Telefone: (DD)XXXXX-XXXX' },
          { ...F.email, label: 'E-mail: xxxxxxx@xxxmail.com' },
          F.consent
        ]
      }
    ],
    // Presença de quem não está inscrito: seção 1 do formulário + seção "Inscrição" + Gestores/CACS-FUNDEB
    presenca_nao_inscrito: [
      { title: 'Seus dados', fields: [F.full_name, { ...F.phone, label: 'Telefone: (DD)XXXXX-XXXX' }, { ...F.email, label: 'E-mail: xxxxxxx@xxxmail.com' }] },
      { title: 'Inscrição', fields: [F.birth_date, { ...F.phone, name: 'phone2', label: 'Telefone (XX)XXXXX-XXXX', autocomplete: 'off' }, F.municipality, F.category] },
      gestores,
      cacs,
      { title: 'Confirmação', fields: [F.consent] }
    ],
    avaliacao: [
      { title: 'Avaliação da Capacitação', fields: [F.full_name, { ...F.email, label: 'e-mail' }, F.phone, F.municipality, F.category] },
      {
        title: 'AVALIAR', fields: [
          { name: 'ratings', type: 'rating', labelFrom: 'ratingLabel', required: true, itemsFrom: 'ratingItems' },
          { name: 'liked', type: 'textarea', label: 'Indique dois aspectos que você mais gostou na Formação:', required: true },
          { name: 'improve', type: 'textarea', label: 'Indique dois aspectos que poderiam ser melhorados na Formação (com detalhes);', required: true },
          { name: 'institution_type', type: 'radio', label: 'Instituição vinculada:', required: true, optionsFrom: 'institutionOptions' }
        ]
      },
      { title: 'Instituição vinculada:', fields: [{ name: 'institution_name', type: 'text', label: 'Mencionar a Instituição vinculada', required: true }] },
      {
        title: 'CECATE', fields: [
          { name: 'topics_suggestion', type: 'textarea', label: 'Sugestão de temas para futuras capacitações (Webinar, vídeos de Youtube, postagens de Instagram, etc.)', required: false },
          { name: 'heard_from', type: 'checkboxes', label: 'Como ficou sabendo da Capacitação?', required: true, optionsFrom: 'heardFromOptions', otherFrom: 'heardFromAllowOther', otherName: 'heard_other' },
          { name: 'comments', type: 'textarea', label: 'Comentários e/ou Sugestões:', required: false },
          F.consent
        ]
      }
    ]
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Config efetiva: padrões + o que veio do formulário (forms.config)
   */
  function withDefaults(config) {
    return Object.assign({}, DEFAULTS, config || {});
  }

  function labelOf(field, config) {
    return field.labelFrom ? config[field.labelFrom] : field.label;
  }

  function optionsOf(field, config) {
    if (field.options) return field.options;
    const raw = config[field.optionsFrom] || [];
    return raw.map(o => (typeof o === 'string' ? o : o.name));
  }

  /**
   * Valida um campo; devolve a mensagem de erro ou '' (o servidor valida tudo de novo)
   */
  function validateField(field, data, config) {
    if (field.when && !field.when(data)) return '';
    const v = data[field.name];
    const empty = v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
    if (field.type === 'checkboxes') {
      const other = field.otherName && String(data[field.otherName] || '').trim();
      if (field.required && (!Array.isArray(v) || v.length === 0) && !other) return 'Marque pelo menos uma opção.';
      return '';
    }
    if (field.type === 'rating') {
      const items = config[field.itemsFrom] || [];
      const missing = items.find(it => !(v && v[it.key] >= 1 && v[it.key] <= 5));
      return field.required && missing ? `Dê uma nota de 1 a 5 para "${missing.label}".` : '';
    }
    if (field.required && empty) return field.type === 'checkbox' ? 'É preciso marcar esta opção para continuar.' : 'Campo obrigatório.';
    if (empty) return '';
    if (field.type === 'email' && !EMAIL_RE.test(String(v).trim())) return 'Informe um e-mail válido.';
    if (field.sameAs && String(v).trim().toLowerCase() !== String(data[field.sameAs] || '').trim().toLowerCase()) return 'Os e-mails não são iguais.';
    if (field.type === 'tel' && ![10, 11].includes(String(v).replace(/\D/g, '').length)) return 'Informe o telefone com DDD.';
    if (field.minLength && String(v).trim().length < field.minLength) return 'Informe o nome completo.';
    if (field.type === 'date') {
      const d = new Date(`${v}T12:00:00`);
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() - 14);
      if (isNaN(d.getTime()) || d < new Date('1900-01-01T00:00:00') || d > limit) return 'Data inválida.';
    }
    return '';
  }

  const api = { CATEGORIES, DEFAULTS, STEPS, withDefaults, labelOf, optionsOf, validateField };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.CapacitaTE = root.CapacitaTE || {};
    root.CapacitaTE.formSchema = api;
  }
})(typeof window !== 'undefined' ? window : null);
