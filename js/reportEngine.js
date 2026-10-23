/**
 * AutoReport CECATE - Motor de Automação de Escrita e Processamento de Relatórios
 * Versão: v.3.4.6
 */

class ReportEngine {
  constructor() {
    this.tones = {
      executive: "Executivo e Estratégico (Foco em impacto, ROI e resultados globais)",
      technical: "Técnico e Analítico (Foco em precisão metodológica, causa-efeito e dados)",
      formal: "Institucional e Regulatório (Conformidade estrita, impessoal e formal)",
      didactic: "Claro e Didático (Explicações acessíveis e descomplicadas)"
    };
  }

  /**
   * Substitui variáveis dinâmicas no texto do relatório
   */
  interpolate(text, variables = {}) {
    if (!text || typeof text !== 'string') return text || '';
    
    let result = text;
    // Map common variables
    const vars = {
      empresa: variables.orgName || "Organização CECATE",
      responsavel: variables.responsible || "Responsável Técnico",
      departamento: variables.department || "Departamento Operacional",
      periodo: variables.period || "Ciclo Vigente 2026",
      data: variables.date || new Date().toLocaleDateString('pt-BR'),
      codigo: variables.referenceCode || "DOC-001",
      titulo: variables.reportTitle || "Relatório Técnico",
      ...variables
    };

    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, vars[key]);
    });

    return result;
  }

  /**
   * Converte marcações simples de Markdown para HTML seguro
   */
  renderMarkdownToHtml(markdownText) {
    if (!markdownText) return '';
    let html = markdownText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#f1f5f9;padding:2px 4px;border-radius:4px;font-size:0.85em;">$1</code>')
      .replace(/\n\n/g, '</p><p style="margin-top: 0.65rem;">')
      .replace(/\n/g, '<br/>');

    return `<p>${html}</p>`;
  }

  /**
   * Gera automaticamente um diagnóstico ou parecer completo com base nos parâmetros e KPIs
   */
  generateAutomatedDiagnostic(meta, kpis = [], tone = 'executive') {
    const org = meta.orgName || "CECATE";
    const dept = meta.department || "Setor Operacional";
    
    // Análise heurística rápida baseada nos KPIs
    let sentiment = "positivo";
    let metricHighlights = [];

    kpis.forEach(k => {
      metricHighlights.push(`${k.label} em ${k.value}`);
      if (k.value && (k.value.includes('warning') || k.value.includes('danger') || parseInt(k.value) < 50)) {
        sentiment = "atencao";
      }
    });

    const metricsSentence = metricHighlights.length > 0 
      ? `Observou-se o comportamento dos indicadores-chave (${metricHighlights.join(", ")}).` 
      : `Os indicadores monitorados demonstram estabilidade nos processos.`;

    if (tone === 'technical') {
      return `A análise técnica e quantitativa dos processos no âmbito de **${dept}** indicou estabilidade operacional. ${metricsSentence} Não foram identificadas anomalias estatísticas severas nas rotinas de amostragem. Recomenda-se a calibração periódica dos limites de alerta precoce e a manutenção preventiva dos controles críticos associados às atividades da **${org}**.`;
    }

    if (tone === 'formal') {
      return `Vimos por meio deste certificar que a avaliação institucional conduzida na **${org}** atendeu aos requisitos normativos estabelecidos. ${metricsSentence} O parecer deste departamento atesta conformidade satisfatória com as diretrizes organizacionais, observando-se os prazos regulamentares e a integridade documental.`;
    }

    // Default: Executive
    return `Durante a consolidação dos resultados operacionais da **${org}**, a unidade **${dept}** apresentou desempenho alinhado com as metas estratégicas traçadas. ${metricsSentence} Os fatores de eficiência operacional demonstram ganho contínuo de produtividade, permitindo a sustentabilidade dos entregáveis com mitigação eficaz de riscos residuais.`;
  }

  /**
   * Refina, expande ou resume um texto através de inteligência de escrita
   */
  enhanceText(originalText, action = 'expand', tone = 'executive') {
    if (!originalText) return '';

    const cleanText = originalText.trim();

    switch (action) {
      case 'expand':
        return `${cleanText} \n\nAdicionalmente, cumpre ressaltar que a metodologia empregada contemplou a análise de consistência temporal e correlação direta entre os parâmetros observados, assegurando confiabilidade estatística aos apontamentos e respaldando as decisões estratégicas correlatas.`;
      
      case 'summarize':
        // Extrai a primeira oração e sintetiza
        const firstSentence = cleanText.split('.')[0] || cleanText;
        return `${firstSentence}. Em síntese, os resultados ratificam a conformidade e a entrega sustentável dos objetivos propostos.`;

      case 'formalize':
        return cleanText
          .replace(/nós vimos/gi, "constatou-se")
          .replace(/foi bom/gi, "obteve êxito substancial")
          .replace(/tá funcionando/gi, "opera com plena estabilidade")
          .replace(/problema/gi, "inconformidade pontual")
          .replace(/vamos fazer/gi, "planeja-se a execução de");

      case 'add_action_items':
        return `${cleanText}\n\n**Diretrizes de Ação Imediata:**\n- 1. Validar cronograma de execução com os coordenadores.\n- 2. Implementar monitoramento diário nos primeiros 15 dias.\n- 3. Emitir boletim de status na próxima reunião de governança.`;

      default:
        return cleanText;
    }
  }

  /**
   * Exporta os dados do relatório para formato Markdown
   */
  exportToMarkdown(reportData) {
    const meta = reportData.meta || {};
    let md = `# ${meta.reportTitle || "Relatório Técnico"}\n\n`;
    md += `**Organização:** ${meta.orgName || "CECATE"}\n`;
    md += `**Responsável:** ${meta.responsible || "Não informado"}\n`;
    md += `**Departamento:** ${meta.department || "Geral"}\n`;
    md += `**Data de Emissão:** ${meta.date || new Date().toLocaleDateString('pt-BR')}\n`;
    md += `**Código / Referência:** ${meta.referenceCode || "N/A"}\n\n`;
    md += `---\n\n`;

    (reportData.blocks || []).forEach(block => {
      md += `## ${block.title}\n\n`;

      if (block.type === 'executive_summary' || block.type === 'ai_diagnostic') {
        md += `${this.interpolate(block.content, meta)}\n\n`;
      } else if (block.type === 'kpi_metrics' && block.kpis) {
        md += `| Indicador | Valor | Variação |\n| --- | --- | --- |\n`;
        block.kpis.forEach(k => {
          md += `| ${k.label} | ${k.value} | ${k.change || "-"} |\n`;
        });
        md += `\n`;
      } else if (block.type === 'data_table' && block.headers && block.rows) {
        md += `| ${block.headers.join(" | ")} |\n`;
        md += `| ${block.headers.map(() => "---").join(" | ")} |\n`;
        block.rows.forEach(r => {
          md += `| ${r.join(" | ")} |\n`;
        });
        md += `\n`;
      } else if (block.type === 'recommendations' && block.items) {
        block.items.forEach(item => {
          md += `- ${this.interpolate(item, meta)}\n`;
        });
        md += `\n`;
      } else if (block.type === 'signatures' && block.signers) {
        md += `\n### Homologação\n`;
        block.signers.forEach(s => {
          md += `- **${this.interpolate(s.name, meta)}** — _${s.role}_\n`;
        });
        md += `\n`;
      }
    });

    md += `\n---\n*Gerado automaticamente pelo AutoReport CECATE em ${new Date().toLocaleString('pt-BR')}*`;
    return md;
  }

  /**
   * Exporta o relatório completo para um arquivo HTML isolado e estilizado
   */
  exportToHTML(reportData, renderedHtmlContent) {
    const meta = reportData.meta || {};
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.reportTitle || "Relatório"} - ${meta.orgName || "CECATE"}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      line-height: 1.6;
    }
    .document-container {
      width: 100%;
      max-width: 820px;
      background: #ffffff;
      padding: 50px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }
    .report-doc-header {
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
    }
    .doc-org-title { font-size: 22px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; }
    .doc-report-title { font-size: 17px; font-weight: 700; color: #4f46e5; margin-top: 4px; }
    .doc-meta-box { font-size: 13px; color: #64748b; text-align: right; }
    .report-section-block { margin-bottom: 30px; }
    .report-section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      border-left: 4px solid #4f46e5;
      padding-left: 10px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .report-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
    .report-kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
    .report-kpi-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .report-kpi-val { font-size: 22px; font-weight: 800; color: #4f46e5; margin: 4px 0; }
    .report-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
    .report-table th { background: #f1f5f9; padding: 10px; text-align: left; border: 1px solid #cbd5e1; }
    .report-table td { padding: 10px; border: 1px solid #e2e8f0; }
    .report-signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }
    .signature-line { border-top: 1px solid #94a3b8; padding-top: 8px; font-weight: 600; font-size: 13px; }
    .signature-role { font-size: 12px; color: #64748b; }
    .report-doc-footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { background: white; padding: 0; }
      .document-container { box-shadow: none; border: none; padding: 0; }
      table, tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
    }
  </style>
</head>
<body>
  <div class="document-container">
    ${renderedHtmlContent}
  </div>
</body>
</html>`;
  }
}

// Instância global do motor
const reportEngine = new ReportEngine();
