/**
 * AutoReport CECATE - Motor de Geração de Gráficos (Chart.js)
 * Versão: v.3.4.3
 */

class ChartEngine {
  constructor() {
    this.chartInstances = {};
  }

  /**
   * Destrói instância anterior de um canvas para evitar vazamentos e conflitos
   */
  destroyIfExists(canvasId) {
    if (window.Chart) {
      try {
        const existing = window.Chart.getChart(canvasId);
        if (existing) existing.destroy();
      } catch (e) {}
    }
    if (this.chartInstances[canvasId]) {
      try {
        this.chartInstances[canvasId].destroy();
      } catch (e) {}
      delete this.chartInstances[canvasId];
    }
  }

  /**
   * Figura 3: Gráfico de Participação segundo tipo de representação (CACS vs Gestores)
   */
  renderFig3Participation(canvasId, presentCACS = 0, presentGestores = 0, isDark = true) {
    this.destroyIfExists(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const total = presentCACS + presentGestores;
    const hasData = total > 0;

    if (!hasData) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.fillText('Nenhuma avaliação importada no momento', canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }
      return null;
    }

    if (!window.Chart) return null;
    const ctx = canvas.getContext('2d');

    const percCACS = ((presentCACS / total) * 100).toFixed(1);
    const percGest = ((presentGestores / total) * 100).toFixed(1);

    const chartData = [presentCACS, presentGestores];
    const bgColors = ['#06b6d4', '#6366f1'];
    const labels = [
      `Conselheiros CACS-FUNDEB (${presentCACS} - ${percCACS}%)`,
      `Gestores Municipais (${presentGestores} - ${percGest}%)`
    ];

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: chartData,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: isDark ? '#111827' : '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#e2e8f0' : '#1e293b',
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
              padding: 15
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw} participantes`
            }
          }
        },
        cutout: '62%'
      }
    });

    return this.chartInstances[canvasId];
  }

  /**
   * Figuras 4, 5 e 6: Gráfico de Avaliação em Barras Horizontais Empilhadas (100%)
   * Legendas: 1 - Ruim, 2 - Regular, 3 - Neutro, 4 - Muito Bom, 5 - Excelente
   */
  renderEvaluationStackedBarChart(canvasId, criterionPercentMatrix = [], title = 'Avaliação da Capacitação', isDark = true) {
    this.destroyIfExists(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const hasAnyData = Array.isArray(criterionPercentMatrix) && criterionPercentMatrix.some(row => Array.isArray(row) && row.some(val => val > 0));

    if (!hasAnyData) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.fillText('Nenhuma avaliação importada no momento', canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }
      return null;
    }

    if (!window.Chart) return null;
    const ctx = canvas.getContext('2d');
    const labels = [
      'Inscrição',
      'Divulgação',
      'Data da Formação',
      'Horário da Formação',
      'Local da Formação',
      'Duração da Formação',
      'Como você avalia a Formação'
    ];

    // Utilizar a matriz real calculada dos dados brutos
    const safeMatrix = labels.map((_, i) => {
      if (criterionPercentMatrix && criterionPercentMatrix[i] && criterionPercentMatrix[i].length === 5) {
        return criterionPercentMatrix[i];
      }
      return [0, 0, 0, 0, 0];
    });

    const datasetLabels = ['1 - Ruim', '2 - Regular', '3 - Neutro', '4 - Muito Bom', '5 - Excelente'];
    const datasetColors = [
      '#dc2626', // Vermelho (1 - Ruim)
      '#f59e0b', // Laranja (2 - Regular)
      '#78716c', // Cinza (3 - Neutro)
      '#facc15', // Amarelo (4 - Muito Bom)
      '#10b981'  // Verde (5 - Excelente)
    ];

    const datasets = datasetLabels.map((lbl, starIdx) => ({
      label: lbl,
      data: safeMatrix.map(row => row[starIdx] || 0),
      backgroundColor: datasetColors[starIdx],
      borderWidth: 0,
      barPercentage: 0.7,
      categoryPercentage: 0.8
    }));

    const stackedPercentagePlugin = {
      id: 'stackedBarPercentage',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        chart.data.datasets.forEach((dataset, dsIdx) => {
          const meta = chart.getDatasetMeta(dsIdx);
          if (meta.hidden) return;

          meta.data.forEach((element, idx) => {
            const val = dataset.data[idx];
            if (val && val >= 3) {
              const { x, y, base } = element;
              const width = Math.abs(x - base);
              const centerX = (x + base) / 2;
              if (width > 20) {
                ctx.fillStyle = dsIdx === 3 ? '#1e293b' : '#ffffff';
                ctx.fillText(`${val}%`, centerX, y);
              }
            }
          });
        });
        ctx.restore();
      }
    };

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      plugins: [stackedPercentagePlugin],
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + '%',
              color: isDark ? '#94a3b8' : '#64748b',
              font: { family: 'Inter', size: 11 }
            },
            grid: {
              color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
            }
          },
          y: {
            stacked: true,
            ticks: {
              color: isDark ? '#e2e8f0' : '#1e293b',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              crossAlign: 'start' // Alinha os rótulos do eixo Y à esquerda
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: isDark ? '#e2e8f0' : '#1e293b',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'rect'
            }
          },
          title: {
            display: false // Desativado no canvas para evitar duplicidade de título com as legendas do relatório e da UI
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.raw}%`
            }
          }
        }
      }
    });

    return this.chartInstances[canvasId];
  }

  /**
   * Compatibilidade legado
   */
  renderEvaluationBarChart(canvasId, matrixOrAverages = [], title = 'Avaliação da Capacitação', isDark = true) {
    return this.renderEvaluationStackedBarChart(canvasId, matrixOrAverages, title, isDark);
  }

  /**
   * Exporta qualquer gráfico como imagem Base64
   */
  exportChartAsDataURL(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  }
}

window.chartEngine = new ChartEngine();
