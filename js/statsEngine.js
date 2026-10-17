/**
 * AutoReport CECATE - Motor de Estatísticas e Análise de Dados
 * Versão: v.3.4.1
 */

class StatsEngine {
  constructor() {
    this.criteriaLabels = [
      'Inscrição',
      'Divulgação',
      'Data da Formação',
      'Horário da Formação',
      'Local da Formação',
      'Duração da Formação',
      'Como você avalia a Formação'
    ];
  }

  /**
   * Consolida métricas gerais e tabelas a partir dos dados brutos de uma capacitação
   */
  calculateAllMetrics(training) {
    if (!training) return null;

    const municipalities = training.municipalities || [];
    const attendance = training.attendance || [];
    const evaluations = training.evaluations || [];
    const courseModules = training.courseModules || [];

    // 1. Métricas de Municípios e Participação
    const totalSummonedMunicipalities = municipalities.filter(m => m.isSummoned).length;
    const distances = municipalities.map(m => parseFloat(m.distanceKm) || 0).filter(d => d > 0);
    const avgDistance = distances.length > 0 ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1) : 0;

    // Calcular inscritos e presentes agregando dos municípios e da lista de presença
    let totalInscribedCACS = 0;
    let totalInscribedGestores = 0;
    let totalInscribed = 0;

    let totalPresentCACS = 0;
    let totalPresentGestores = 0;
    let totalPresent = 0;

    // Municípios presentes e inscritos
    const presentMunSet = new Set();
    const inscribedMunSet = new Set();

    let bothCategoriesInscribedMunicipalities = 0;
    let bothCategoriesPresentMunicipalities = 0;
    let onlyGestoresInscribedMunicipalities = 0;
    let onlyCACSInscribedMunicipalities = 0;
    let onlyGestoresPresentMunicipalities = 0;
    let onlyCACSPresentMunicipalities = 0;

    municipalities.forEach(m => {
      const insC = parseInt(m.inscribedCACS) || 0;
      const insG = parseInt(m.inscribedGestores) || 0;
      const preC = parseInt(m.presentCACS) || 0;
      const preG = parseInt(m.presentGestores) || 0;

      totalInscribedCACS += insC;
      totalInscribedGestores += insG;
      totalInscribed += (insC + insG);

      totalPresentCACS += preC;
      totalPresentGestores += preG;
      totalPresent += (preC + preG);

      if ((insC + insG) > 0) inscribedMunSet.add(m.name);
      if ((preC + preG) > 0) presentMunSet.add(m.name);

      if (insC > 0 && insG > 0) bothCategoriesInscribedMunicipalities++;
      else if (insG > 0 && insC === 0) onlyGestoresInscribedMunicipalities++;
      else if (insC > 0 && insG === 0) onlyCACSInscribedMunicipalities++;

      if (preC > 0 && preG > 0) bothCategoriesPresentMunicipalities++;
      else if (preG > 0 && preC === 0) onlyGestoresPresentMunicipalities++;
      else if (preC > 0 && preG === 0) onlyCACSPresentMunicipalities++;
    });

    // Se attendance list tiver dados detalhados e município tiver 0, sincronizar
    if (attendance.length > 0 && totalPresent === 0) {
      attendance.forEach(att => {
        if (att.isPresent) {
          totalPresent++;
          if (att.representation === 'CACS-FUNDEB') totalPresentCACS++;
          else totalPresentGestores++;
          if (att.municipality) presentMunSet.add(att.municipality);
        }
      });
    }

    // Taxas de Participação (%) = Presentes / Inscritos * 100
    const participationRateGeneral = totalInscribed > 0 ? ((totalPresent / totalInscribed) * 100).toFixed(1) : (totalPresent > 0 ? 100 : 0);
    const participationRateCACS = totalInscribedCACS > 0 ? ((totalPresentCACS / totalInscribedCACS) * 100).toFixed(1) : (totalPresentCACS > 0 ? 100 : 0);
    const participationRateGestores = totalInscribedGestores > 0 ? ((totalPresentGestores / totalInscribedGestores) * 100).toFixed(1) : (totalPresentGestores > 0 ? 100 : 0);
    const participationRateMunicipalities = inscribedMunSet.size > 0 ? ((presentMunSet.size / inscribedMunSet.size) * 100).toFixed(1) : (presentMunSet.size > 0 ? 100 : 0);

    // 2. Análise de Avaliação
    const evalStatsGeneral = this.calculateEvaluationStats(evaluations);
    const evalStatsCACS = this.calculateEvaluationStats(evaluations.filter(e => e.representation === 'CACS-FUNDEB'));
    const evalStatsGestores = this.calculateEvaluationStats(evaluations.filter(e => e.representation !== 'CACS-FUNDEB'));

    // 3. Auditoria & Validação Cruzada
    const auditIssues = [];
    if (attendance.length > 0 && evaluations.length > 0 && attendance.length !== evaluations.length) {
      auditIssues.push({
        type: 'warning',
        message: `Divergência numérica: ${attendance.length} participantes na lista de presença vs ${evaluations.length} respostas na avaliação.`
      });
    }

    municipalities.forEach(m => {
      if (!m.ibgeCode) {
        auditIssues.push({
          type: 'warning',
          message: `Município '${m.name}' está sem Código IBGE cadastrado.`
        });
      }
    });

    return {
      totalSummonedMunicipalities,
      avgDistance,
      totalInscribedMunicipalities: inscribedMunSet.size,
      totalPresentMunicipalities: presentMunSet.size,
      totalInscribedCACS,
      totalInscribedGestores,
      totalInscribed,
      totalPresentCACS,
      totalPresentGestores,
      totalPresent,
      bothCategoriesInscribedMunicipalities,
      bothCategoriesPresentMunicipalities,
      onlyGestoresInscribedMunicipalities,
      onlyCACSInscribedMunicipalities,
      onlyGestoresPresentMunicipalities,
      onlyCACSPresentMunicipalities,
      participationRateGeneral,
      participationRateCACS,
      participationRateGestores,
      participationRateMunicipalities,
      evalStatsGeneral,
      evalStatsCACS,
      evalStatsGestores,
      auditIssues
    };
  }

  /**
   * Calcula estatísticas das notas de avaliação
   */
  calculateEvaluationStats(evaluations = []) {
    if (!evaluations || evaluations.length === 0) {
      return {
        totalResponses: 0,
        averages: this.criteriaLabels.map(() => 0),
        overallMean: 0,
        distribution: [0, 0, 0, 0, 0],
        distributionPercent: [0, 0, 0, 0, 0],
        criterionCounts: Array.from({ length: 7 }, () => [0, 0, 0, 0, 0]),
        criterionDistributionPercent: Array.from({ length: 7 }, () => [0, 0, 0, 0, 0])
      };
    }

    const n = evaluations.length;
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const distribution = [0, 0, 0, 0, 0]; // Contagem total de 1, 2, 3, 4, 5
    const criterionCounts = Array.from({ length: 7 }, () => [0, 0, 0, 0, 0]);

    evaluations.forEach(ev => {
      const ratings = ev.ratings || [];
      for (let i = 0; i < 7; i++) {
        const rawVal = ratings[i];
        if (rawVal === undefined || rawVal === null || rawVal === '') continue;
        const val = parseFloat(rawVal);
        if (isNaN(val) || val < 1 || val > 5) continue;

        sums[i] += val;
        const star = Math.min(5, Math.max(1, Math.round(val)));
        distribution[star - 1]++;
        criterionCounts[i][star - 1]++;
      }
    });

    const averages = sums.map((s, i) => {
      const validCount = criterionCounts[i].reduce((a, b) => a + b, 0);
      return validCount > 0 ? parseFloat((s / validCount).toFixed(2)) : 0;
    });

    const validAverages = averages.filter(a => a > 0);
    const overallMean = validAverages.length > 0
      ? parseFloat((validAverages.reduce((a, b) => a + b, 0) / validAverages.length).toFixed(2))
      : 0;

    const totalRatingsCount = distribution.reduce((a, b) => a + b, 0);
    const distributionPercent = distribution.map(count => totalRatingsCount > 0 ? parseFloat(((count / totalRatingsCount) * 100).toFixed(1)) : 0);
    const highRatingsCount = (distribution[3] || 0) + (distribution[4] || 0);
    const highRatingPercent = totalRatingsCount > 0 ? parseFloat(((highRatingsCount / totalRatingsCount) * 100).toFixed(1)) : 0;

    // Matriz de porcentagem 7 critérios x 5 notas (1 a 5)
    const criterionDistributionPercent = criterionCounts.map(countsRow => {
      const rowTotal = countsRow.reduce((a, b) => a + b, 0);
      if (rowTotal === 0) return [0, 0, 0, 0, 0];
      return countsRow.map(cnt => parseFloat(((cnt / rowTotal) * 100).toFixed(1)));
    });

    return {
      totalResponses: n,
      averages,
      overallMean,
      highRatingPercent,
      highRatingsCount,
      distribution,
      distributionPercent,
      criterionCounts,
      criterionDistributionPercent
    };
  }

  /**
   * Gera o HTML da Tabela 1: Municípios Convocados (Modelo Bilateral Oficial de Referência - Idêntico ao Word)
   */
  generateTable1Html(municipalities = []) {
    const sorted = [...municipalities].sort((a, b) => {
      if (a.isSede && !b.isSede) return -1;
      if (!a.isSede && b.isSede) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
    });

    if (sorted.length === 0) {
      return `
        <div class="table-responsive-wrapper">
          <table class="report-data-table" style="width:100%; border-collapse:collapse; font-family:'Times New Roman', serif;">
            <tbody>
              <tr><td style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nenhum município cadastrado.</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const half = Math.ceil(sorted.length / 2);
    const leftList = sorted.slice(0, half);
    const rightList = sorted.slice(half);

    let rowsHtml = '';
    for (let i = 0; i < half; i++) {
      const leftM = leftList[i];
      const rightM = rightList[i] || null;

      const leftDist = leftM.isSede ? '0,0' : (leftM.distanceKm != null ? parseFloat(leftM.distanceKm).toFixed(1).replace('.', ',') : '0,0');
      const rightDist = rightM ? (rightM.isSede ? '0,0' : (rightM.distanceKm != null ? parseFloat(rightM.distanceKm).toFixed(1).replace('.', ',') : '0,0')) : '';

      rowsHtml += `
        <tr>
          <td style="text-align:center; font-family:'Times New Roman', serif; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; padding:4px 6px;">${leftM.ibgeCode || '-'}</td>
          <td style="text-align:left; font-family:'Times New Roman', serif; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; padding:4px 6px;">${leftM.name || ''}</td>
          <td style="text-align:center; font-family:'Times New Roman', serif; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; padding:4px 6px;">${leftDist}</td>
          <td style="width:16px; border:none; background:transparent;"></td>
          <td style="text-align:center; font-family:'Times New Roman', serif; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; padding:4px 6px;">${rightM ? (rightM.ibgeCode || '-') : ''}</td>
          <td style="text-align:left; font-family:'Times New Roman', serif; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; padding:4px 6px;">${rightM ? (rightM.name || '') : ''}</td>
          <td style="text-align:center; font-family:'Times New Roman', serif; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; padding:4px 6px;">${rightDist}</td>
        </tr>
      `;
    }

    return `
      <div class="table-responsive-wrapper" style="overflow-x:auto; margin:1rem 0;">
        <table class="report-data-table" style="font-size:10pt; font-family:'Times New Roman', serif; width:100%; border-collapse:collapse; margin:0 auto;">
          <thead>
            <tr style="background:#D9D9D9;">
              <th style="width:14%; text-align:center; background:#D9D9D9; color:#000; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; font-weight:bold; padding:5px 6px;">Código IBGE</th>
              <th style="width:26%; text-align:center; background:#D9D9D9; color:#000; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; font-weight:bold; padding:5px 6px;">Nome do Município</th>
              <th style="width:10%; text-align:center; background:#D9D9D9; color:#000; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; font-weight:bold; padding:5px 6px;">Distância (km)</th>
              <th style="width:16px; border:none; background:transparent;"></th>
              <th style="width:14%; text-align:center; background:#D9D9D9; color:#000; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; font-weight:bold; padding:5px 6px;">Código IBGE</th>
              <th style="width:26%; text-align:center; background:#D9D9D9; color:#000; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; font-weight:bold; padding:5px 6px;">Nome do Município</th>
              <th style="width:10%; text-align:center; background:#D9D9D9; color:#000; border-top:1px solid #000; border-bottom:1px solid #000; border-left:none; border-right:none; font-weight:bold; padding:5px 6px;">Distância (km)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Gera o HTML da Tabela 2: Estrutura do Curso (com suporte a módulos com múltiplas temáticas e rowspans)
   */
  generateTable2Html(modules = []) {
    const normMods = window.courseStructureHelper ? window.courseStructureHelper.normalize(modules) : modules;
    const sorted = [...normMods].sort((a, b) => (a.order || 0) - (b.order || 0));

    let rowsHtml = '';
    let totalHoursGestor = 0;
    let totalHoursCACS = 0;

    if (sorted.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="5" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.6rem;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.45;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <div style="font-size:0.95rem; font-weight:600; color:var(--text-secondary);">Nenhuma estrutura de curso selecionada no momento.</div>
              <div style="font-size:0.82rem; color:var(--text-muted);">Clique no botão <strong>"Selecionar Estrutura"</strong> acima para aplicar um modelo com seus módulos e cargas horárias.</div>
            </div>
          </td>
        </tr>
      `;
    }

    sorted.forEach(m => {
      const gTopics = Array.isArray(m.gestorTopics) ? m.gestorTopics : [];
      const cTopics = Array.isArray(m.cacsTopics) ? m.cacsTopics : [];

      if (m.isShared) {
        // Módulo compartilhado: mescla as células de Temática e Carga Horária horizontalmente (colspan=2)
        const maxRows = Math.max(gTopics.length, 1);
        for (let i = 0; i < maxRows; i++) {
          const g = gTopics[i] || null;
          rowsHtml += '<tr>';

          if (i === 0) {
            rowsHtml += `<td ${maxRows > 1 ? `rowspan="${maxRows}"` : ''} style="text-align:center; font-weight:700; vertical-align:middle;">${m.moduleNumber || '01'}</td>`;
          }

          if (g) {
            const h = parseFloat(g.hours) || 0;
            totalHoursGestor += h;
            totalHoursCACS += h;
            rowsHtml += `<td colspan="2" style="text-align:center; vertical-align:middle;">${g.topic || '-'}</td>`;
            rowsHtml += `<td colspan="2" style="text-align:center; vertical-align:middle; font-weight:600;">${h.toFixed(1).replace('.', ',')} h</td>`;
          } else {
            rowsHtml += `<td colspan="2" style="text-align:center; color:var(--text-muted);">-</td>`;
            rowsHtml += `<td colspan="2" style="text-align:center; color:var(--text-muted);">-</td>`;
          }

          rowsHtml += '</tr>';
        }
      } else {
        // Módulo não compartilhado (independente): colunas separadas para Gestor e CACS
        const maxRows = Math.max(gTopics.length, cTopics.length, 1);

        for (let i = 0; i < maxRows; i++) {
          const g = gTopics[i] || null;
          const c = cTopics[i] || null;

          rowsHtml += '<tr>';

          // Célula do Módulo (com rowspan se houver múltiplas linhas)
          if (i === 0) {
            rowsHtml += `<td ${maxRows > 1 ? `rowspan="${maxRows}"` : ''} style="text-align:center; font-weight:700; vertical-align:middle;">${m.moduleNumber || '01'}</td>`;
          }

          // Coluna Temática Gestor
          if (g) {
            totalHoursGestor += parseFloat(g.hours) || 0;
            if (gTopics.length === 1 && maxRows > 1 && i === 0) {
              rowsHtml += `<td rowspan="${maxRows}" style="text-align:center; vertical-align:middle;">${g.topic || '-'}</td>`;
            } else if (gTopics.length > 1 || maxRows === 1) {
              rowsHtml += `<td style="text-align:center; vertical-align:middle;">${g.topic || '-'}</td>`;
            }
          } else if (gTopics.length > 1) {
            rowsHtml += `<td style="text-align:center; color:var(--text-muted);">-</td>`;
          }

          // Coluna Temática CACS
          if (c) {
            totalHoursCACS += parseFloat(c.hours) || 0;
            if (cTopics.length === 1 && maxRows > 1 && i === 0) {
              rowsHtml += `<td rowspan="${maxRows}" style="text-align:center; vertical-align:middle;">${c.topic || '-'}</td>`;
            } else if (cTopics.length > 1 || maxRows === 1) {
              rowsHtml += `<td style="text-align:center; vertical-align:middle;">${c.topic || '-'}</td>`;
            }
          } else if (cTopics.length > 1) {
            rowsHtml += `<td style="text-align:center; color:var(--text-muted);">-</td>`;
          }

          // Coluna Carga Horária Gestor
          if (g) {
            const hG = parseFloat(g.hours) || 0;
            if (gTopics.length === 1 && maxRows > 1 && i === 0) {
              rowsHtml += `<td rowspan="${maxRows}" style="text-align:center; vertical-align:middle; font-weight:600;">${hG.toFixed(1).replace('.', ',')} h</td>`;
            } else if (gTopics.length > 1 || maxRows === 1) {
              rowsHtml += `<td style="text-align:center; font-weight:600;">${hG.toFixed(1).replace('.', ',')} h</td>`;
            }
          } else if (gTopics.length > 1) {
            rowsHtml += `<td style="text-align:center; color:var(--text-muted);">-</td>`;
          }

          // Coluna Carga Horária CACS
          if (c) {
            const hC = parseFloat(c.hours) || 0;
            if (cTopics.length === 1 && maxRows > 1 && i === 0) {
              rowsHtml += `<td rowspan="${maxRows}" style="text-align:center; vertical-align:middle; font-weight:600;">${hC.toFixed(1).replace('.', ',')} h</td>`;
            } else if (cTopics.length > 1 || maxRows === 1) {
              rowsHtml += `<td style="text-align:center; font-weight:600;">${hC.toFixed(1).replace('.', ',')} h</td>`;
            }
          } else if (cTopics.length > 1) {
            rowsHtml += `<td style="text-align:center; color:var(--text-muted);">-</td>`;
          }

          rowsHtml += '</tr>';
        }
      }
    });

    return `
      <div class="table-responsive-wrapper">
        <table class="report-data-table report-table-2">
          <thead>
            <tr>
              <th rowspan="2" style="width: 80px; text-align:center; vertical-align:middle;">Módulo</th>
              <th colspan="2" style="text-align:center; vertical-align:middle;">Temática</th>
              <th colspan="2" style="text-align:center; vertical-align:middle;">Carga Horária</th>
            </tr>
            <tr>
              <th style="text-align:center; vertical-align:middle;">Gestor</th>
              <th style="text-align:center; vertical-align:middle;">CACS</th>
              <th style="width: 100px; text-align:center; vertical-align:middle;">Gestor</th>
              <th style="width: 100px; text-align:center; vertical-align:middle;">CACS</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          ${sorted.length > 0 ? `
          <tfoot>
            <tr style="font-weight:700; background:rgba(99, 102, 241, 0.08);">
              <td colspan="3" style="text-align:center; vertical-align:middle;">Total Geral de Carga Horária:</td>
              <td style="text-align:center; vertical-align:middle; font-weight:800; color:var(--accent-blue-text);">${totalHoursGestor.toFixed(1).replace('.', ',')} h</td>
              <td style="text-align:center; vertical-align:middle; font-weight:800; color:var(--accent-emerald-text);">${totalHoursCACS.toFixed(1).replace('.', ',')} h</td>
            </tr>
          </tfoot>
          ` : ''}
        </table>
      </div>
    `;
  }

  /**
   * Gera o HTML da Tabela 3: Inscritos por Município (Modelo Oficial de Referência - Lado a Lado)
   */
  generateTable3Html(municipalities = [], metrics = {}) {
    const sorted = [...municipalities].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );

    if (sorted.length === 0) {
      return `
        <div class="table-responsive-wrapper">
          <table class="report-data-table">
            <tbody>
              <tr><td style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nenhum município cadastrado na lista de inscritos.</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const half = Math.ceil(sorted.length / 2);
    const leftList = sorted.slice(0, half);
    const rightList = sorted.slice(half);

    let sumCACS = 0;
    let sumGestor = 0;
    let sumTotal = 0;
    let munsWithInsc = 0;

    sorted.forEach(m => {
      const c = parseInt(m.inscribedCACS) || 0;
      const g = parseInt(m.inscribedGestores) || 0;
      const tot = parseInt(m.inscribedTotal) || (c + g);
      sumCACS += c;
      sumGestor += g;
      sumTotal += tot;
      if (tot > 0) munsWithInsc++;
    });

    const totalInscMuns = metrics.totalInscribedMunicipalities ?? munsWithInsc;
    const totalInscPersons = metrics.totalInscribed ?? sumTotal;
    const totalCacs = metrics.totalInscribedCACS ?? sumCACS;
    const totalGest = metrics.totalInscribedGestores ?? sumGestor;

    let rowsHtml = '';
    for (let i = 0; i < half; i++) {
      const leftM = leftList[i];
      const rightM = rightList[i] || null;

      const lCacs = parseInt(leftM.inscribedCACS) || 0;
      const lGest = parseInt(leftM.inscribedGestores) || 0;
      const lTot = parseInt(leftM.inscribedTotal) || (lCacs + lGest);

      const rCacs = rightM ? (parseInt(rightM.inscribedCACS) || 0) : '';
      const rGest = rightM ? (parseInt(rightM.inscribedGestores) || 0) : '';
      const rTot = rightM ? (parseInt(rightM.inscribedTotal) || ((parseInt(rightM.inscribedCACS) || 0) + (parseInt(rightM.inscribedGestores) || 0))) : '';

      rowsHtml += `
        <tr>
          <td style="text-align:center; font-family:monospace; font-weight:600;">${leftM.ibgeCode || '-'}</td>
          <td style="text-align:left; font-weight:600;">${leftM.name || ''}</td>
          <td style="text-align:center;">${lCacs}</td>
          <td style="text-align:center;">${lGest}</td>
          <td style="text-align:center; font-weight:700;">${lTot}</td>
          <td style="width:8px; padding:0; background:transparent; border-left:none; border-right:1px solid var(--border-color, #cbd5e1);"></td>
          <td style="text-align:center; font-family:monospace; font-weight:600;">${rightM ? (rightM.ibgeCode || '-') : ''}</td>
          <td style="text-align:left; font-weight:600;">${rightM ? (rightM.name || '') : ''}</td>
          <td style="text-align:center;">${rCacs}</td>
          <td style="text-align:center;">${rGest}</td>
          <td style="text-align:center; font-weight:700;">${rTot}</td>
        </tr>
      `;
    }

    return `
      <div class="table-responsive-wrapper">
        <table class="report-data-table" style="font-size:0.82rem;">
          <thead>
            <tr>
              <th rowspan="2" style="width:11%; text-align:center;">Código IBGE</th>
              <th rowspan="2" style="text-align:left;">Nome do Município</th>
              <th colspan="3" style="width:21%; text-align:center;">Número de Inscritos</th>
              <th rowspan="2" style="width:8px; padding:0; background:transparent; border-left:none; border-right:1px solid var(--border-color, #cbd5e1);"></th>
              <th rowspan="2" style="width:11%; text-align:center;">Código IBGE</th>
              <th rowspan="2" style="text-align:left;">Nome do Município</th>
              <th colspan="3" style="width:21%; text-align:center;">Número de Inscritos</th>
            </tr>
            <tr>
              <th style="width:7%; text-align:center;">CACS</th>
              <th style="width:7%; text-align:center;">Gestor</th>
              <th style="width:7%; text-align:center;">Total</th>
              <th style="width:7%; text-align:center;">CACS</th>
              <th style="width:7%; text-align:center;">Gestor</th>
              <th style="width:7%; text-align:center;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="font-weight:700; background:rgba(99, 102, 241, 0.06); border-top:2px solid var(--border-color);">
              <td colspan="2" style="text-align:right; font-weight:700; padding:0.5rem 0.75rem;">Total de municípios com inscritos:</td>
              <td colspan="9" style="text-align:left; font-weight:700; padding:0.5rem 0.75rem;">${totalInscMuns}</td>
            </tr>
            <tr style="font-weight:700; background:rgba(99, 102, 241, 0.06);">
              <td colspan="2" style="text-align:right; font-weight:700; padding:0.5rem 0.75rem;">Total de pessoas:</td>
              <td colspan="9" style="text-align:left; font-weight:700; padding:0.5rem 0.75rem;">${totalInscPersons} (${totalCacs} CACS + ${totalGest} Gestores)</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  /**
   * Gera o HTML da Tabela 4: Participação por Município (Modelo Oficial de Referência - Lado a Lado)
   */
  generateTable4Html(municipalities = [], metrics = {}) {
    const sorted = [...municipalities].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );

    if (sorted.length === 0) {
      return `
        <div class="table-responsive-wrapper">
          <table class="report-data-table">
            <tbody>
              <tr><td style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nenhum município cadastrado na lista de presença.</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    const half = Math.ceil(sorted.length / 2);
    const leftList = sorted.slice(0, half);
    const rightList = sorted.slice(half);

    let sumPresCACS = 0;
    let sumInscCACS = 0;
    let sumPresGest = 0;
    let sumInscGest = 0;
    let sumPresTotal = 0;
    let sumInscTotal = 0;
    let munsWithPres = 0;

    sorted.forEach(m => {
      const insC = parseInt(m.inscribedCACS) || 0;
      const preC = parseInt(m.presentCACS) || 0;
      const insG = parseInt(m.inscribedGestores) || 0;
      const preG = parseInt(m.presentGestores) || 0;
      const insTot = insC + insG;
      const preTot = preC + preG;

      sumInscCACS += insC;
      sumPresCACS += preC;
      sumInscGest += insG;
      sumPresGest += preG;
      sumInscTotal += insTot;
      sumPresTotal += preTot;
      if (preTot > 0) munsWithPres++;
    });

    const totalPresMuns = metrics.totalPresentMunicipalities ?? munsWithPres;
    const totalPresPersons = metrics.totalPresent ?? sumPresTotal;
    const totalPresC = metrics.totalPresentCACS ?? sumPresCACS;
    const totalPresG = metrics.totalPresentGestores ?? sumPresGest;

    let rowsHtml = '';
    for (let i = 0; i < half; i++) {
      const leftM = leftList[i];
      const rightM = rightList[i] || null;

      const lInsC = parseInt(leftM.inscribedCACS) || 0;
      const lPreC = parseInt(leftM.presentCACS) || 0;
      const lInsG = parseInt(leftM.inscribedGestores) || 0;
      const lPreG = parseInt(leftM.presentGestores) || 0;
      const lInsTot = lInsC + lInsG;
      const lPreTot = lPreC + lPreG;

      const rInsC = rightM ? (parseInt(rightM.inscribedCACS) || 0) : 0;
      const rPreC = rightM ? (parseInt(rightM.presentCACS) || 0) : 0;
      const rInsG = rightM ? (parseInt(rightM.inscribedGestores) || 0) : 0;
      const rPreG = rightM ? (parseInt(rightM.presentGestores) || 0) : 0;
      const rInsTot = rInsC + rInsG;
      const rPreTot = rPreC + rPreG;

      rowsHtml += `
        <tr>
          <td style="text-align:center; font-family:monospace; font-weight:600;">${leftM.ibgeCode || '-'}</td>
          <td style="text-align:left; font-weight:600;">${leftM.name || ''}</td>
          <td style="text-align:center;">${lPreC}/${lInsC}</td>
          <td style="text-align:center;">${lPreG}/${lInsG}</td>
          <td style="text-align:center; font-weight:700;">${lPreTot}/${lInsTot}</td>
          <td style="width:8px; padding:0; background:transparent; border-left:none; border-right:1px solid var(--border-color, #cbd5e1);"></td>
          <td style="text-align:center; font-family:monospace; font-weight:600;">${rightM ? (rightM.ibgeCode || '-') : ''}</td>
          <td style="text-align:left; font-weight:600;">${rightM ? (rightM.name || '') : ''}</td>
          <td style="text-align:center;">${rightM ? `${rPreC}/${rInsC}` : ''}</td>
          <td style="text-align:center;">${rightM ? `${rPreG}/${rInsG}` : ''}</td>
          <td style="text-align:center; font-weight:700;">${rightM ? `${rPreTot}/${rInsTot}` : ''}</td>
        </tr>
      `;
    }

    return `
      <div class="table-responsive-wrapper">
        <table class="report-data-table" style="font-size:0.82rem;">
          <thead>
            <tr>
              <th rowspan="2" style="width:11%; text-align:center;">Código IBGE</th>
              <th rowspan="2" style="text-align:left;">Nome do Município</th>
              <th colspan="3" style="width:21%; text-align:center;">Nº de Participantes / Nº de Inscritos</th>
              <th rowspan="2" style="width:8px; padding:0; background:transparent; border-left:none; border-right:1px solid var(--border-color, #cbd5e1);"></th>
              <th rowspan="2" style="width:11%; text-align:center;">Código IBGE</th>
              <th rowspan="2" style="text-align:left;">Nome do Município</th>
              <th colspan="3" style="width:21%; text-align:center;">Nº de Participantes / Nº de Inscritos</th>
            </tr>
            <tr>
              <th style="width:7%; text-align:center;">CACS</th>
              <th style="width:7%; text-align:center;">Gestor</th>
              <th style="width:7%; text-align:center;">Total</th>
              <th style="width:7%; text-align:center;">CACS</th>
              <th style="width:7%; text-align:center;">Gestor</th>
              <th style="width:7%; text-align:center;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="font-weight:700; background:rgba(99, 102, 241, 0.06); border-top:2px solid var(--border-color);">
              <td colspan="2" style="text-align:right; font-weight:700; padding:0.5rem 0.75rem;">Total de municípios presentes:</td>
              <td colspan="9" style="text-align:left; font-weight:700; padding:0.5rem 0.75rem;">${totalPresMuns}</td>
            </tr>
            <tr style="font-weight:700; background:rgba(99, 102, 241, 0.06);">
              <td colspan="2" style="text-align:right; font-weight:700; padding:0.5rem 0.75rem;">Total de pessoas presentes:</td>
              <td colspan="9" style="text-align:left; font-weight:700; padding:0.5rem 0.75rem;">${totalPresPersons} (${totalPresC} CACS + ${totalPresG} Gestores)</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  /**
   * Gera o comentário padrão para cada gráfico da Etapa 8, fiel aos relatórios oficiais em 02-Relatórios exemplos
   */
  getDefaultEvaluationComment(figKey, training) {
    if (!training) return '';
    const evals = training.evaluations || [];
    const attendance = training.attendance || [];
    const totalResp = evals.length;
    const critLabels = [
      'processo de inscrição',
      'divulgação da formação',
      'data da formação',
      'horário da formação',
      'local da formação',
      'duração da formação',
      'conteúdo e desenvolvimento da formação'
    ];

    if (figKey === 'fig3') {
      if (totalResp === 0) {
        return 'A participação segundo o tipo de representação considera a totalidade dos participantes presentes entre conselheiros do CACS-FUNDEB e equipes de gestão municipal.';
      }
      const cacsCount = evals.filter(e => String(e.representation || '').toUpperCase().includes('CACS')).length;
      const gestCount = totalResp - cacsCount;
      const pctCacs = ((cacsCount / totalResp) * 100).toFixed(1).replace('.', ',');
      const pctGest = ((gestCount / totalResp) * 100).toFixed(1).replace('.', ',');
      const totalPresent = training.metrics?.totalPresent || (attendance.length > 0 ? attendance.length : totalResp);
      const repLead = (totalPresent > 0 && totalResp >= totalPresent)
        ? 'A totalidade dos participantes presentes realizou a avaliação da capacitação, assegurando representatividade integral'
        : `Um número expressivo de participantes (${totalResp} questionários válidos) realizou a avaliação da capacitação, conferindo elevada consistência amostral`;
      return `${repLead}. De forma geral, ${pctGest}% (${gestCount}/${totalResp}) e ${pctCacs}% (${cacsCount}/${totalResp}) dos participantes foram das gestões municipais e dos conselhos CACS-FUNDEB, respectivamente.`;
    }

    if (figKey === 'fig4') {
      if (totalResp === 0) {
        return 'Os resultados consolidados da avaliação do curso de capacitação serão apresentados nas Figuras 4, 5 e 6 a seguir, com distribuição de respostas em escala Likert de 1 a 5.';
      }
      const statsGen = this.calculateEvaluationStats(evals);
      const pctHigh = statsGen.highRatingPercent ? Math.round(statsGen.highRatingPercent) : 90;
      const criterionLowerShare = (statsGen.criterionDistributionPercent || []).map((p, idx) => ({
        idx,
        name: critLabels[idx] || this.criteriaLabels[idx],
        lowerPct: ((p[0] || 0) + (p[1] || 0) + (p[2] || 0))
      }));
      criterionLowerShare.sort((a, b) => b.lowerPct - a.lowerPct);
      const prominentLow = criterionLowerShare.filter(c => c.lowerPct > 0).slice(0, 2);

      if (prominentLow.length > 0) {
        const lowItemsStr = prominentLow.map(c => `a ${c.name}`).join(' e ');
        return `Os resultados da avaliação do curso de capacitação são apresentados nas Figuras 4, 5 e 6. De forma geral, os conceitos 4 e 5 correspondem à expressiva maioria das respostas recebidas (cerca de ${pctHigh}% do total). No entanto, alguns itens apresentaram notas fora da tendência geral, destacando-se ${lowItemsStr}, que registraram avaliações inferiores.`;
      }
      return `Os resultados da avaliação do curso de capacitação são apresentados nas Figuras 4, 5 e 6. De forma geral, os conceitos 4 e 5 (Muito Bom e Excelente) correspondem à quase totalidade das respostas recebidas (${pctHigh}%), evidenciando a plena aceitação metodológica e estrutural do curso em todos os eixos avaliados.`;
    }

    if (figKey === 'fig5') {
      const evalsCacs = evals.filter(e => String(e.representation || '').toUpperCase().includes('CACS'));
      if (evalsCacs.length === 0) {
        return 'Ao avaliar os resultados conforme a instituição representada, observa-se a distribuição das respostas específicas dos conselheiros do CACS-FUNDEB presentes no polo regional.';
      }
      const statsCacs = this.calculateEvaluationStats(evalsCacs);
      const lowCountCacs = (statsCacs.distribution[0] || 0) + (statsCacs.distribution[1] || 0) + (statsCacs.distribution[2] || 0);

      if (lowCountCacs === 0) {
        return 'Ao avaliar os resultados conforme a instituição representada, observa-se que as tendências gerais nos itens avaliados se mantêm. Contudo, os conselheiros dos CACS apresentaram percentuais maiores de respostas com nota 4 e 5 e não apresentaram qualificações com conceitos inferiores, atestando o êxito das temáticas de fiscalização e controle social.';
      }
      const cacsCritLow = (statsCacs.criterionDistributionPercent || []).map((p, idx) => ({
        idx,
        name: critLabels[idx] || this.criteriaLabels[idx],
        lowerPct: ((p[0] || 0) + (p[1] || 0) + (p[2] || 0))
      })).sort((a, b) => b.lowerPct - a.lowerPct)[0];
      return `Ao avaliar os resultados conforme a instituição representada, observa-se que as tendências gerais nos itens avaliados se mantêm. Contudo, os conselheiros dos CACS apresentaram percentuais marcadamente elevados de respostas com nota 4 e 5, com registros pontuais de conceitos inferiores concentrados no item de ${cacsCritLow ? cacsCritLow.name : 'divulgação da formação'}.`;
    }

    if (figKey === 'fig6') {
      const evalsGest = evals.filter(e => !String(e.representation || '').toUpperCase().includes('CACS'));
      if (evalsGest.length === 0) {
        return 'Por outro lado, os gestores municipais apresentaram avaliações positivas, com predominância de respostas nas notas 4 e 5 na maioria dos itens avaliados.';
      }
      const statsGest = this.calculateEvaluationStats(evalsGest);
      const gestPcts = (statsGest.criterionDistributionPercent || []).map(p => ((p[0] || 0) + (p[1] || 0) + (p[2] || 0)));
      const validPcts = gestPcts.filter(p => p > 0);
      const minP = validPcts.length > 0 ? Math.min(...validPcts).toFixed(1).replace('.', ',') : '5,0';
      const maxP = validPcts.length > 0 ? Math.max(...validPcts).toFixed(1).replace('.', ',') : '15,0';
      const gestCritLow = (statsGest.criterionDistributionPercent || []).map((p, idx) => ({
        idx,
        name: critLabels[idx] || this.criteriaLabels[idx],
        lowerPct: ((p[0] || 0) + (p[1] || 0) + (p[2] || 0))
      })).sort((a, b) => b.lowerPct - a.lowerPct)[0];

      return `Por outro lado, os gestores municipais apresentaram avaliações positivas, com predominância de respostas na nota 4 e 5 na maioria dos itens. Ainda assim, conceitos inferiores (menor ou igual a 3) apresentam um percentual entre ${minP}% e ${maxP}%, ressaltando a ${gestCritLow ? gestCritLow.name : 'duração da formação'} que apresentou percentuais maiores das piores notas em comparação aos demais.`;
    }

    if (figKey === 'fig7') {
      const likedTexts = evals.map(e => e.likedAspects).filter(Boolean);
      let topStr = 'Conteúdo", "Didática", "Prática" e "Clareza';
      if (window.wordCloudEngine && likedTexts.length > 0) {
        const wordCounts = window.wordCloudEngine.processTextList(likedTexts);
        const sortedWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]);
        const topW = sortedWords.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1));
        if (topW.length > 0) topStr = topW.join('", "');
      }
      return `De forma sucinta, os resultados das respostas dissertativas quanto aos aspectos que mais agradaram aos participantes evidenciam uma percepção altamente positiva da capacitação, com destaque para termos como "${topStr}", indicando boa aceitação do curso, didática clara e pleno domínio do conteúdo pelos formadores.`;
    }

    if (figKey === 'fig8') {
      const improveTexts = evals.map(e => e.improveAspects).filter(Boolean);
      let topStrImp = 'Tempo", "Internet", "Duração" e "Espaço';
      if (window.wordCloudEngine && improveTexts.length > 0) {
        const wordCountsImp = window.wordCloudEngine.processTextList(improveTexts);
        const sortedWordsImp = Object.keys(wordCountsImp).sort((a, b) => wordCountsImp[b] - wordCountsImp[a]);
        const topWImp = sortedWordsImp.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1));
        if (topWImp.length > 0) topStrImp = topWImp.join('", "');
      }
      return `Em contrapartida, as sugestões de melhoria concentram-se em aspectos logísticos e operacionais, sobressaindo apontamentos como "${topStrImp}", servindo como importantes subsídios para o aperfeiçoamento contínuo dos próximos encontros. Todas as respostas obtidas nesta fase estão disponíveis no Apêndice III para consulta.`;
    }

    return '';
  }
}

window.statsEngine = new StatsEngine();
