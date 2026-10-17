/**
 * AutoReport CECATE - Gerador de Nuvens de Palavras Qualitativas
 * Versão: v.3.4.1
 */

class WordCloudEngine {
  constructor() {
    // Dicionário mestre de stopwords em português
    this.defaultStopwords = new Set([
      'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'até',
      'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois', 'do',
      'dos', 'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era', 'eram', 'éramos',
      'essa', 'essas', 'esse', 'esses', 'esta', 'estamos', 'estão', 'estas', 'estava',
      'estavam', 'estávamos', 'este', 'esteja', 'estejam', 'estejamos', 'estes', 'esteve',
      'estive', 'estivemos', 'estiver', 'estivera', 'estiveram', 'estivéramos', 'estiverem',
      'estivermos', 'estivesse', 'estivessem', 'estivéssemos', 'estou', 'eu', 'foi', 'fomos',
      'for', 'fora', 'foram', 'fôramos', 'forem', 'formos', 'fosse', 'fossem', 'fôssemos',
      'fui', 'há', 'haja', 'hajam', 'hajamos', 'hão', 'havemos', 'hei', 'houve', 'houvemos',
      'houver', 'houvera', 'houverá', 'houveram', 'houvéramos', 'houverão', 'houverei',
      'houverem', 'houveremos', 'houveria', 'houveriam', 'houveríamos', 'houvesse',
      'houvessem', 'houvéssemos', 'isso', 'isto', 'já', 'lhe', 'lhes', 'mais', 'mas', 'me',
      'mesmo', 'meu', 'meus', 'minha', 'minhas', 'muito', 'muitos', 'na', 'não', 'nas',
      'nem', 'no', 'nos', 'nós', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa',
      'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quando',
      'que', 'quem', 'são', 'se', 'seja', 'sejam', 'sejamos', 'sem', 'ser', 'será',
      'serão', 'serei', 'seremos', 'seria', 'seriam', 'seríamos', 'seu', 'seus', 'só',
      'somos', 'sou', 'sua', 'suas', 'também', 'te', 'tem', 'tém', 'temos', 'tenha',
      'tenham', 'tenhamos', 'tenho', 'ter', 'terá', 'terão', 'terei', 'teremos', 'teria',
      'teriam', 'teríamos', 'teu', 'teus', 'teve', 'tinha', 'tinham', 'tínhamos', 'tive',
      'tivemos', 'tiver', 'tivera', 'tiveram', 'tivéramos', 'tiverem', 'tivermos',
      'tivesse', 'tivessem', 'tivéssemos', 'tu', 'tua', 'tuas', 'um', 'uma', 'você',
      'vocês', 'vos', 'tudo', 'todos', 'todas', 'todo', 'toda', 'nada', 'bem', 'bom',
      'boa', 'outro', 'outra', 'outros', 'outras', 'assim', 'onde', 'sobre', 'pois',
      // Termos contextuais genéricos que devem ser desconsiderados se vazios
      'curso', 'formação', 'capacitação', 'forma', 'aplica', 'nenhum', 'nada', 'obrigado',
      'parabéns', 'dia', 'dias', 'parte', 'geral', 'sendo', 'sobre', 'vez', 'vezes'
    ]);

    this.customStopwords = new Set();
    this.synonymMap = {
      'conteudos': 'conteúdo',
      'conteudo': 'conteúdo',
      'didatica': 'didática',
      'explicacao': 'explicação',
      'explicacoes': 'explicação',
      'conhecimentos': 'conhecimento',
      'aprendizado': 'aprendizado',
      'aprendizagem': 'aprendizado',
      'informacoes': 'informação',
      'informacao': 'informação',
      'praticas': 'prática',
      'pratica': 'prática',
      'horarios': 'horário',
      'horario': 'horário',
      'duracao': 'duração',
      'municipios': 'municípios',
      'municipio': 'municípios',
      'tempo': 'tempo',
      'material': 'material didático',
      'materiais': 'material didático'
    };

    this.colorPalettes = {
      positive: {
        dark: ['#818cf8', '#22d3ee', '#34d399', '#60a5fa', '#a78bfa', '#4ade80', '#2dd4bf'],
        light: ['#4338ca', '#0891b2', '#059669', '#2563eb', '#7c3aed', '#16a34a', '#0d9488']
      },
      improve: {
        dark: ['#fbbf24', '#f472b6', '#fb923c', '#c084fc', '#38bdf8', '#facc15', '#a5b4fc'],
        light: ['#d97706', '#db2777', '#ea580c', '#7c3aed', '#0284c7', '#ca8a04', '#4f46e5']
      }
    };
  }

  /**
   * Normaliza um texto removendo acentos e pontuações para análise
   */
  normalizeWord(word) {
    if (!word) return '';
    let clean = word.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”…\[\]]/g, '')
      .trim();
    
    // Mapeamento de sinônimos/lematização
    const unaccented = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (this.synonymMap[unaccented]) {
      return this.synonymMap[unaccented];
    }
    if (this.synonymMap[clean]) {
      return this.synonymMap[clean];
    }
    return clean;
  }

  /**
   * Processa uma lista de respostas textuais e retorna a contagem ponderada de palavras
   */
  processTextList(texts = []) {
    const wordCounts = {};

    texts.forEach(text => {
      if (!text || typeof text !== 'string') return;

      // Dividir por espaços, quebras de linha e separadores comuns
      const tokens = text.split(/[\s,;\n\r\t\/\+\-]+/);

      tokens.forEach(rawToken => {
        const word = this.normalizeWord(rawToken);
        if (word.length >= 3 && !this.defaultStopwords.has(word) && !this.customStopwords.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    // Converter para array ordenado
    return Object.entries(wordCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Renderiza nuvem de palavras diretamente a partir de lista de textos ou palavras ponderadas
   */
  renderCloud(canvasOrId, textsOrWords = [], options = {}) {
    const canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
    if (!canvas) return null;

    let words = textsOrWords;
    if (Array.isArray(textsOrWords) && textsOrWords.length > 0 && typeof textsOrWords[0] === 'string') {
      words = this.processTextList(textsOrWords);
    } else if (!Array.isArray(textsOrWords)) {
      words = [];
    }

    return this.renderToCanvas(canvas, words, options);
  }

  /**
   * Renderiza uma nuvem de palavras em um elemento HTML Canvas
   */
  renderToCanvas(canvas, words = [], options = {}) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const width = options.width || canvas.width || 550;
    const height = options.height || canvas.height || 320;
    const isDark = options.isDark === true;
    const paletteType = options.palette || 'positive';
    const paletteObj = this.colorPalettes[paletteType] || this.colorPalettes.positive;
    const palette = isDark ? paletteObj.dark : paletteObj.light;
    const maxWords = options.maxWords || 35;

    canvas.width = width;
    canvas.height = height;

    // Fundo
    ctx.fillStyle = isDark ? '#0f172a' : (options.bgColor || '#ffffff');
    ctx.fillRect(0, 0, width, height);

    if (!words || words.length === 0) {
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Nenhuma resposta registrada para gerar a nuvem.', width / 2, height / 2);
      return canvas;
    }

    const slicedWords = words.slice(0, maxWords);
    const maxCount = slicedWords[0]?.count || 1;
    const minCount = slicedWords[slicedWords.length - 1]?.count || 1;

    // Escala de fontes
    const minFontSize = options.minFontSize || 13;
    const maxFontSize = options.maxFontSize || 34;

    const placedBoxes = [];

    // Algoritmo de distribuição em espiral
    slicedWords.forEach((item, index) => {
      // Normalização do tamanho
      let fontSize = minFontSize;
      if (maxCount > minCount) {
        fontSize = minFontSize + ((item.count - minCount) / (maxCount - minCount)) * (maxFontSize - minFontSize);
      } else {
        fontSize = (minFontSize + maxFontSize) / 2;
      }

      ctx.font = `bold ${Math.round(fontSize)}px "Plus Jakarta Sans", Inter, sans-serif`;
      const metrics = ctx.measureText(item.text);
      const textWidth = metrics.width;
      const textHeight = fontSize;

      let placed = false;
      let angle = 0;
      let radius = 0;
      const step = 0.35;
      const centerX = width / 2;
      const centerY = height / 2;

      while (!placed && radius < Math.max(width, height) / 2) {
        const x = centerX + radius * Math.cos(angle) - textWidth / 2;
        const y = centerY + radius * Math.sin(angle) + textHeight / 3;

        // Caixa delimitadora
        const box = { x: x - 4, y: y - textHeight, w: textWidth + 8, h: textHeight + 6 };

        // Testar colisão com palavras já posicionadas
        let collision = false;
        if (box.x < 8 || box.x + box.w > width - 8 || box.y < 8 || box.y + box.h > height - 8) {
          collision = true;
        } else {
          for (const p of placedBoxes) {
            if (!(box.x + box.w < p.x || box.x > p.x + p.w || box.y + box.h < p.y || box.y > p.y + p.h)) {
              collision = true;
              break;
            }
          }
        }

        if (!collision) {
          // Posicionar e desenhar
          ctx.fillStyle = palette[index % palette.length];
          ctx.fillText(item.text, x, y);
          placedBoxes.push(box);
          placed = true;
        }

        angle += step;
        radius += 0.8;
      }
    });

    return canvas;
  }

  /**
   * Exporta a nuvem como imagem PNG em Base64
   */
  exportAsDataURL(canvas) {
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  }
}

window.wordCloudEngine = new WordCloudEngine();
