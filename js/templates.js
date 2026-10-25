/**
 * AutoReport CECATE - Modelos de Estrutura de Curso & Módulos
 * Versão: v.3.4.10
 */

const REPORT_TEMPLATES = [
  {
    id: "audit_compliance",
    title: "Auditoria & Conformidade CECATE",
    category: "Auditoria",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    badge: "Oficial",
    description: "Avaliação rigorosa de conformidade regulatória, mapeamento de não-conformidades, riscos e plano de ação corretivo.",
    defaultMeta: {
      orgName: "CECATE Soluções Tecnológicas",
      reportTitle: "Relatório de Auditoria e Conformidade de Processos",
      responsible: "Dr. Carlos Eduardo Mendonça",
      department: "Gerência de Governança e Risco",
      date: new Date().toISOString().split('T')[0],
      referenceCode: "AUD-2026-089"
    },
    defaultKpis: [
      { label: "Índice de Conformidade", value: "94.2%", status: "success" },
      { label: "Itens Auditados", value: "148", status: "neutral" },
      { label: "Apontamentos Críticos", value: "2", status: "warning" }
    ],
    blocks: [
      {
        id: "b_exec_summary",
        type: "executive_summary",
        title: "1. Sumário Executivo",
        content: "O presente relatório consolida os resultados da auditoria de conformidade realizada no âmbito dos processos operacionais e tecnológicos da **{empresa}**. O objetivo principal consistiu em validar a aderência às normas internas e diretrizes regulatórias vigentes durante o ciclo **{periodo}**."
      },
      {
        id: "b_kpis",
        type: "kpi_metrics",
        title: "2. Indicadores Chave de Avaliação",
        kpis: [
          { label: "Índice de Conformidade", value: "94.2%", change: "+2.4%" },
          { label: "Itens Auditados", value: "148", change: "100% escopo" },
          { label: "Não Conformidades", value: "2", change: "-4 vs ciclo ant." }
        ]
      },
      {
        id: "b_diagnostic",
        type: "ai_diagnostic",
        title: "3. Diagnóstico e Parecer Técnico Automatizado",
        content: "Com base nas evidências coletadas pelo time de {departamento}, constatou-se que a infraestrutura e os fluxos críticos operam em patamar de alta segurança. Os 2 apontamentos registrados foram classificados como de severidade média/baixa, com mitigação imediata recomendada nos protocolos de retenção de logs."
      },
      {
        id: "b_findings_table",
        type: "data_table",
        title: "4. Mapeamento de Itens e Não-Conformidades",
        headers: ["ID", "Processo / Requisito", "Status", "Risco", "Prazo de Resolução"],
        rows: [
          ["NC-01", "Controle de Acessos Privilegiados", "Em Adequação", "Médio", "15 dias"],
          ["NC-02", "Validação de Backup Quizenal", "Corrigido", "Baixo", "Concluído"],
          ["NC-03", "Revisão de Políticas de Terceiros", "Em Adequação", "Baixo", "30 dias"]
        ]
      },
      {
        id: "b_recommendations",
        type: "recommendations",
        title: "5. Recomendações e Próximos Passos",
        items: [
          "Implementar rotina automatizada de revogação de acessos temporários.",
          "Realizar treinamento de conscientização sobre segurança da informação no início do próximo trimestre.",
          "Formalizar a matriz de responsabilidades junto aos líderes de cada squad."
        ]
      },
      {
        id: "b_signatures",
        type: "signatures",
        title: "6. Validação e Assinaturas",
        signers: [
          { name: "{responsavel}", role: "Auditor Líder" },
          { name: "Diretoria de Operações", role: "Aprovador Institucional" }
        ]
      }
    ]
  },
  {
    id: "monthly_performance",
    title: "Performance & Métricas Mensais",
    category: "Operacional",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    badge: "Popular",
    description: "Análise quantitativa de desempenho, metas alcançadas, faturamento, eficiência e gargalos operacionais.",
    defaultMeta: {
      orgName: "CECATE Analytics",
      reportTitle: "Relatório Mensal de Performance Operacional",
      responsible: "Mariana Vasconcelos",
      department: "Operações e Inteligência de Negócios",
      date: new Date().toISOString().split('T')[0],
      referenceCode: "PERF-2026-M08"
    },
    defaultKpis: [
      { label: "SLA Global", value: "99.4%", status: "success" },
      { label: "Volume de Entregas", value: "1.420", status: "success" },
      { label: "NPS / Satisfação", value: "88", status: "success" }
    ],
    blocks: [
      {
        id: "b_exec_summary",
        type: "executive_summary",
        title: "1. Visão Geral do Período",
        content: "Durante o período de **{periodo}**, a unidade **{departamento}** demonstrou estabilidade de alto rendimento, ultrapassando as metas de eficiência operacional estipuladas para a **{empresa}**."
      },
      {
        id: "b_kpis",
        type: "kpi_metrics",
        title: "2. Principais Indicadores de Desempenho",
        kpis: [
          { label: "SLA Médio de Resolução", value: "99.4%", change: "+0.8%" },
          { label: "Demandas Concluídas", value: "1.420", change: "+14.2%" },
          { label: "Índice de Retrabalho", value: "1.2%", change: "-0.5%" }
        ]
      },
      {
        id: "b_diagnostic",
        type: "ai_diagnostic",
        title: "3. Análise Crítica e Diagnóstico de Produtividade",
        content: "A automação de fluxos repetitivos implementada no ciclo anterior reduziu o tempo médio de ciclo em 18%. Identificou-se uma ligeira sobrecarga na equipe de suporte nível 2 nos horários de pico, compensada pelo bom desempenho do autoatendimento."
      },
      {
        id: "b_findings_table",
        type: "data_table",
        title: "4. Detalhamento por Linha de Serviço",
        headers: ["Serviço / Projeto", "Meta", "Realizado", "Desvio", "Status"],
        rows: [
          ["Processamento de Dados Lote", "1.000 un.", "1.150 un.", "+15%", "Superada"],
          ["Atendimento a Incidentes P1", "< 30 min", "18 min", "-40%", "Excelente"],
          ["Disponibilidade de Plataforma", "99.0%", "99.85%", "+0.85%", "Excelente"]
        ]
      },
      {
        id: "b_recommendations",
        type: "recommendations",
        title: "5. Iniciativas para o Próximo Ciclo",
        items: [
          "Expandir os gatilhos automáticos de alerta precoce de volumetria.",
          "Homologar a nova versão dos dashboards analíticos para o corpo diretivo.",
          "Otimizar as consultas SQL no banco de relatórios para acelerar a geração em lote."
        ]
      },
      {
        id: "b_signatures",
        type: "signatures",
        title: "6. Homologação",
        signers: [
          { name: "{responsavel}", role: "Gestor de Operações" },
          { name: "Superintendência Executiva", role: "Diretoria" }
        ]
      }
    ]
  },
  {
    id: "incident_rca",
    title: "Incidente Técnico & Causa Raiz (RCA)",
    category: "Engenharia",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    badge: "Técnico",
    description: "Documentação pós-incidente (Post-Mortem), linha do tempo cronológica, causa raiz e plano de prevenção definitiva.",
    defaultMeta: {
      orgName: "CECATE Cloud Engineering",
      reportTitle: "Relatório de Análise de Causa Raiz (RCA)",
      responsible: "Eng. Rafael Barreto",
      department: "Infraestrutura Crítica e SRE",
      date: new Date().toISOString().split('T')[0],
      referenceCode: "RCA-2026-INC404"
    },
    defaultKpis: [
      { label: "Tempo de Indisponibilidade", value: "24 min", status: "warning" },
      { label: "Clientes Impactados", value: "1.2%", status: "neutral" },
      { label: "Severidade", value: "P1 Crítico", status: "danger" }
    ],
    blocks: [
      {
        id: "b_exec_summary",
        type: "executive_summary",
        title: "1. Síntese do Incidente",
        content: "Em **{data}**, às 14h22, observou-se degradação de conectividade no cluster principal da **{empresa}**. O protocolo de contingência foi acionado pelo time de **{departamento}**, restabelecendo a normalidade dos serviços em 24 minutos."
      },
      {
        id: "b_kpis",
        type: "kpi_metrics",
        title: "2. Métricas de Impacto e Resolução",
        kpis: [
          { label: "MTTR (Tempo de Reparo)", value: "24 min", change: "Meta < 30 min" },
          { label: "MTTD (Detecção)", value: "2 min", change: "Alerta automático" },
          { label: "Perda de Dados", value: "Zero", change: "RPO = 0" }
        ]
      },
      {
        id: "b_diagnostic",
        type: "ai_diagnostic",
        title: "3. Investigação Técnica da Causa Raiz",
        content: "A análise dos dumps de memória e logs distribuídos revelou exaustão de conexões no pool de réplicas de leitura, ocasionada por consulta analítica não indexada executada em paralelo a pico de tráfego. Não houve comprometimento de integridade nem violação de segurança."
      },
      {
        id: "b_findings_table",
        type: "data_table",
        title: "4. Linha do Tempo dos Fatos",
        headers: ["Horário", "Fato / Ação", "Ator / Sistema", "Impacto"],
        rows: [
          ["14:22", "Disparo do alarme de latência do banco", "Monitoramento SRE", "Alerta Amarelo"],
          ["14:25", "Isolamento da rota instável e início do failover", "Engenharia de Plantão", "Mitigação"],
          ["14:38", "Sincronização do nó reserva e restabelecimento", "Equipe de Banco", "Normalização"],
          ["14:46", "Testes de integridade validados e incidente encerrado", "Supervisão Técnica", "Operação Normal"]
        ]
      },
      {
        id: "b_recommendations",
        type: "recommendations",
        title: "5. Ações Corretivas e Preventivas (CAPA)",
        items: [
          "Impor limite estrito de timeout (15s) para queries de relatórios na réplica secundária.",
          "Dimensionar autoescala preditiva com antecedência mínima de 10 minutos em janelas de fechamento.",
          "Atualizar o playbook de resposta rápida da equipe de operações."
        ]
      },
      {
        id: "b_signatures",
        type: "signatures",
        title: "6. Aprovação Técnica do Relatório",
        signers: [
          { name: "{responsavel}", role: "Líder Técnico de SRE" },
          { name: "Diretoria de Tecnologia e Operações", role: "CTO" }
        ]
      }
    ]
  },
  {
    id: "executive_status",
    title: "Status Executivo de Projeto",
    category: "Gestão",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
    badge: "Estratégico",
    description: "Visão consolidada para diretores e patrocinadores: cronograma, entregas, orçamento e riscos mapeados.",
    defaultMeta: {
      orgName: "CECATE Inovação & Projetos",
      reportTitle: "Status Report Executivo do Projeto Estratégico",
      responsible: "Juliana Andrade, PMP",
      department: "PMO Corporativo",
      date: new Date().toISOString().split('T')[0],
      referenceCode: "PMO-2026-Q3"
    },
    defaultKpis: [
      { label: "Progresso Geral", value: "78%", status: "success" },
      { label: "Consumo Orçamentário", value: "71%", status: "success" },
      { label: "Índice de Desempenho (SPI)", value: "1.04", status: "success" }
    ],
    blocks: [
      {
        id: "b_exec_summary",
        type: "executive_summary",
        title: "1. Resumo Executivo",
        content: "O projeto sob coordenação do **{departamento}** na **{empresa}** mantém ritmo acelerado e saudável no ciclo **{periodo}**, com 78% do cronograma físico realizado e aderência financeira positiva."
      },
      {
        id: "b_kpis",
        type: "kpi_metrics",
        title: "2. Saúde do Projeto",
        kpis: [
          { label: "Aderência a Prazos (SPI)", value: "1.04", change: "+0.02 no mês" },
          { label: "Eficiência de Custo (CPI)", value: "1.08", change: "Dentro do teto" },
          { label: "Marcos Concluídos", value: "18 / 22", change: "81.8%" }
        ]
      },
      {
        id: "b_diagnostic",
        type: "ai_diagnostic",
        title: "3. Parecer da Liderança e Gestão de Riscos",
        content: "Os principais entregáveis da Fase 3 foram homologados sem ressalvas técnicas. O risco moderado identificado no fornecimento de componentes em nuvem foi mitigado com a contratação de redundância multi-região antecipada."
      },
      {
        id: "b_findings_table",
        type: "data_table",
        title: "4. Status dos Próximos Marcos (Milestones)",
        headers: ["Marco / Entregável", "Responsável", "Data Prevista", "Status"],
        rows: [
          ["Lançamento da Versão Beta 2.0", "Engenharia de Software", "15/09/2026", "No Prazo"],
          ["Treinamento dos Usuários Chave", "Gestão de Mudança", "22/09/2026", "Planejado"],
          ["Go-Live em Produção", "Diretoria e PMO", "30/09/2026", "No Prazo"]
        ]
      },
      {
        id: "b_recommendations",
        type: "recommendations",
        title: "5. Decisões Solicitadas ao Comitê",
        items: [
          "Aprovação do aditivo de expansão de capacidade de storage para o Q4.",
          "Definição da data oficial da cerimônia de encerramento da Fase 3."
        ]
      },
      {
        id: "b_signatures",
        type: "signatures",
        title: "6. Homologação do Comitê",
        signers: [
          { name: "{responsavel}", role: "Gerente de Projeto (PMO)" },
          { name: "Sponsor Executivo", role: "Comitê Diretor" }
        ]
      }
    ]
  },
  {
    id: "training_capacity",
    title: "Capacitação & Treinamento CECATE",
    category: "Capacitação",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`,
    badge: "Oficial",
    description: "Relatório consolidado de execução de curso ou capacitação técnica: ementa, frequência, taxa de conclusão e avaliação.",
    defaultMeta: {
      orgName: "CECATE Academia & Treinamentos",
      reportTitle: "Relatório de Conclusão e Avaliação de Capacitação Técnica",
      responsible: "Prof. Dr. Marcos Souza",
      department: "Desenvolvimento de Talentos & Capacitação",
      date: new Date().toISOString().split('T')[0],
      referenceCode: "CAP-2026-001"
    },
    defaultKpis: [
      { label: "Taxa de Conclusão", value: "95.8%", status: "success" },
      { label: "Total de Capacitados", value: "24 alunos", status: "success" },
      { label: "Carga Horária Cumprida", value: "40 horas", status: "success" },
      { label: "Satisfação (NPS)", value: "9.6 / 10", status: "success" }
    ],
    blocks: [
      {
        id: "b_exec_summary",
        type: "executive_summary",
        title: "1. Sumário Executivo da Capacitação",
        content: "O presente relatório técnico atesta a realização da capacitação **{titulo}** promovida pela **{empresa}** no período de **{periodo}**, sob a facilitação e coordenação de **{responsavel}** ({departamento}). O curso teve como propósito nivelar competências técnicas e alinhar padrões metodológicos operacionais."
      },
      {
        id: "b_kpis",
        type: "kpi_metrics",
        title: "2. Indicadores de Desempenho do Treinamento",
        kpis: [
          { label: "Taxa de Conclusão", value: "95.8%", change: "Meta: >90%" },
          { label: "Participantes Concluintes", value: "24", change: "De 25 inscritos" },
          { label: "Carga Horária Total", value: "40h", change: "100% ministrado" },
          { label: "Índice de Satisfação", value: "9.6 / 10", change: "+0.4 vs média" }
        ]
      },
      {
        id: "b_diagnostic",
        type: "ai_diagnostic",
        title: "3. Parecer Pedagógico e Avaliação de Aprendizado",
        content: "A turma demonstrou engajamento exemplar durante as atividades práticas e workshops interativos. As métricas de absorção conceitual e testes de fixação superaram os benchmarks institucionais, habilitando os participantes a aplicarem as diretrizes de automação e boas práticas em seus respectivos departamentos."
      },
      {
        id: "b_findings_table",
        type: "data_table",
        title: "4. Módulos Ministrados e Controle de Frequência",
        headers: ["Módulo", "Conteúdo Abordado", "Carga Horária", "Frequência Média", "Status"],
        rows: [
          ["Módulo 01", "Fundamentos, Normas e Arquitetura de Processos", "08h", "100%", "Concluído"],
          ["Módulo 02", "Práticas de Automação de Documentos & Relatórios", "12h", "96%", "Concluído"],
          ["Módulo 03", "Análise de Indicadores e Governança Operacional", "10h", "96%", "Concluído"],
          ["Módulo 04", "Laboratório Prático e Apresentação de Projetos", "10h", "100%", "Concluído"]
        ]
      },
      {
        id: "b_recommendations",
        type: "recommendations",
        title: "5. Recomendações e Próximos Passos",
        items: [
          "Disponibilizar o repositório de materiais complementares e gravações aos alunos no portal CECATE.",
          "Aplicar pesquisa de eficácia do treinamento (Follow-up de 60 dias) para mensurar impacto prático no dia a dia.",
          "Emitir certificados digitais autenticados para os 24 participantes concluintes."
        ]
      },
      {
        id: "b_signatures",
        type: "signatures",
        title: "6. Homologação e Emissão de Certificação",
        signers: [
          { name: "{responsavel}", role: "Instrutor / Especialista Responsável" },
          { name: "Coordenação de Capacitação CECATE", role: "Superintendência Educacional" }
        ]
      }
    ]
  }
];

// Tipos de blocos modulares que podem ser adicionados dinamicamente
const AVAILABLE_BLOCK_TYPES = [
  { type: "executive_summary", name: "Sumário Executivo", icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`, desc: "Texto introdutório com escopo e resumo dos pontos centrais" },
  { type: "kpi_metrics", name: "Grid de Indicadores (KPIs)", icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`, desc: "Painel com 3 a 4 cartões numéricos e tendências" },
  { type: "ai_diagnostic", name: "Diagnóstico e Parecer Técnico", icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`, desc: "Análise profunda com parágrafos gerados e refinados" },
  { type: "data_table", name: "Tabela de Dados e Evidências", icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`, desc: "Estrutura tabular com colunas e linhas editáveis" },
  { type: "recommendations", name: "Recomendações e Próximos Passos", icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`, desc: "Lista de itens acionáveis e diretrizes futuras" },
  { type: "signatures", name: "Bloco de Assinaturas e Validação", icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`, desc: "Linhas para validação de autoridade e homologação" }
];
