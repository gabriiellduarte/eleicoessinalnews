// Componentes de tela compartilhados entre a página pública e o telão.
import { CONFIG } from './config.js';
import { UFS } from './ufs.js';
import { MAPA } from './mapa-brasil.js';

const inteiro = new Intl.NumberFormat('pt-BR');
export const fmt = {
  int: (n) => inteiro.format(Math.round(n || 0)),
  pct: (n, casas = 2) => `${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`,
  hora: (d) => d.toLocaleTimeString('pt-BR'),
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function iniciais(nome) {
  const p = String(nome).trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function montarLogo(img) {
  const fila = [...CONFIG.logo];
  const proximo = () => {
    if (fila.length) return (img.src = fila.shift());
    const texto = document.createElement('span');
    texto.className = 'logo-texto';
    texto.innerHTML = 'SINAL<b>NEWS</b>';
    img.replaceWith(texto);
  };
  img.addEventListener('error', proximo);
  proximo();
}

// Cores fixas por candidato dentro de uma disputa: a do partido ou, sem ela, uma da paleta.
const PALETA = ['#00838F', '#8D6E63', '#6A1B9A', '#2E7D32', '#F2A007', '#1565C0', '#D90404', '#757575'];
const tabelas = new Map();
// Cor de cada partido (aproximada da identidade visual). Partido fora da tabela recebe uma cor da paleta.
const CORES_PARTIDOS = {
  PT: '#D1121F', PL: '#2A63D4', PSDB: '#0072CE', MDB: '#0B9444', PSD: '#E8890C', PSB: '#D9A400', PDT: '#B5352D',
  PP: '#3A8DDE', UNIÃO: '#1497C9', REPUBLICANOS: '#0F6DB5', PODE: '#2BA84A', NOVO: '#F26522', PSOL: '#7B2D8E',
  'PC do B': '#8E1B1B', PCDOB: '#8E1B1B', PV: '#00713D', REDE: '#1FA595', CIDADANIA: '#E0218A', AVANTE: '#E9552F',
  SOLIDARIEDADE: '#F08A24', PRD: '#1C4E9C', PRTB: '#2F7D4F', DC: '#123F8C', AGIR: '#5B4B9A', MOBILIZA: '#C2410C',
  PMB: '#B83280', PCB: '#7F1D1D', PSTU: '#B91C1C', PCO: '#6B1010', UP: '#3F3F46', MISSÃO: '#C99700', DEMOCRATA: '#4B5563',
};
export const corDoPartido = (sigla) => CORES_PARTIDOS[String(sigla || '').toUpperCase()] || CORES_PARTIDOS[sigla] || '';

export function coresPara(chave, candidatos) {
  if (!tabelas.has(chave)) tabelas.set(chave, new Map());
  const tabela = tabelas.get(chave);
  let semPartido = [...tabela.values()].filter((v) => v.daPaleta).length;
  for (const c of candidatos || []) {
    const n = String(c.numero);
    if (tabela.has(n)) continue;
    const doPartido = corDoPartido(c.partido);
    tabela.set(n, doPartido ? { cor: doPartido } : { cor: PALETA[Math.min(semPartido++, PALETA.length - 1)], daPaleta: true });
  }
  return (numero) => tabela.get(String(numero))?.cor || PALETA[PALETA.length - 1];
}

export const corDaPaleta = (i) => PALETA[i % (PALETA.length - 1)];

// Classe visual da situação informada pelo TSE ("Eleito por QP", "Suplente", "2º turno"...).
export function classeSituacao(c) {
  const s = String(c.situacao || '');
  if (c.eleito) return 'eleito';
  if (/2.? turno/i.test(s)) return 'turno2';
  if (/suplente/i.test(s)) return 'suplente';
  if (/n[aã]o eleit/i.test(s)) return 'naoeleito'; // escondido: poluiria listas com centenas de nomes
  return '';
}

// Resumo da disputa majoritária já definida: eleito(s) no 1º turno ou quem vai ao 2º turno.
export function resumoDefinicao(candidatos) {
  const eleitos = candidatos.filter((c) => c.eleito);
  if (eleitos.length) {
    const nomes = eleitos.map((c) => c.nome).join(' e ');
    return { classe: 'eleito', texto: eleitos.length > 1 ? `Eleitos: ${nomes}` : `Eleito no 1º turno: ${nomes}` };
  }
  const segundo = candidatos.filter((c) => classeSituacao(c) === 'turno2');
  if (segundo.length) return { classe: 'turno2', texto: `2º turno: ${segundo.map((c) => c.nome).join(' × ')}` };
  return null;
}

export function avatarHtml(c) {
  const foto = c.foto ? `<img src="${esc(c.foto)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span>${esc(iniciais(c.nome))}</span>${foto}`;
}

// Lista de candidatos com barras. Mantém as linhas entre atualizações para que
// barras e trocas de posição sejam animadas.
const COM_ANIMACAO = !matchMedia('(prefers-reduced-motion: reduce)').matches;

export function criarLista(ul) {
  const linhas = new Map();
  // `teto` = percentual que enche a barra (padrão: 50% ou o do líder, o que for maior).
  return function atualizar(candidatos, cor, { teto = Math.max(50, candidatos[0]?.pct || 0) } = {}) {
    const antes = new Map();
    linhas.forEach((el, n) => antes.set(n, el.getBoundingClientRect()));
    const vistos = new Set();

    candidatos.forEach((c, i) => {
      const n = String(c.numero);
      vistos.add(n);
      let el = linhas.get(n);
      if (!el) {
        el = document.createElement('li');
        el.className = 'cand';
        el.innerHTML = `
          <div class="cand-pos"></div>
          <div class="avatar">${avatarHtml(c)}</div>
          <div class="cand-info">
            <div class="cand-linha"><strong class="cand-nome">${esc(c.nome)}</strong><span class="sit"></span></div>
            <div class="cand-sub"></div>
            <div class="barra"><i></i></div>
          </div>
          <div class="cand-num"><b class="cand-pct"></b><span class="cand-votos"></span></div>`;
        linhas.set(n, el);
        // Entrada suave de quem acabou de aparecer na lista.
        if (COM_ANIMACAO) el.animate([{ opacity: 0, transform: 'translateY(.6rem)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: Math.min(i, 9) * 35, easing: 'ease-out', fill: 'backwards' });
      }
      el.style.setProperty('--cor', cor(n));
      el.querySelector('.cand-pos').textContent = c.pos ?? i + 1;
      // O vice pode chegar depois do titular (consulta separada no cadastro).
      el.querySelector('.cand-sub').textContent = `${c.partido} · ${c.numero}${c.vice ? ` · Vice: ${c.vice}` : ''}`;
      el.querySelector('.barra i').style.width = `${Math.min(100, (c.pct / (teto || 1)) * 100)}%`;
      el.querySelector('.cand-pct').textContent = fmt.pct(c.pct);
      el.querySelector('.cand-votos').textContent = `${fmt.int(c.votos)} votos`;
      const sit = el.querySelector('.sit');
      const classe = classeSituacao(c);
      sit.textContent = c.situacao || '';
      sit.className = `sit ${classe}`;
      // A linha inteira de quem foi eleito (ou vai ao 2º turno) ganha destaque.
      el.classList.toggle('cand-eleito', classe === 'eleito');
      el.classList.toggle('cand-turno2', classe === 'turno2');
    });

    linhas.forEach((el, n) => {
      if (!vistos.has(n)) {
        el.remove();
        linhas.delete(n);
      }
    });

    // Só mexe no DOM quando a ordem muda (mover um nó cancela a animação da barra).
    const ordem = candidatos.map((c) => linhas.get(String(c.numero)));
    const mudou = ordem.length !== ul.children.length || ordem.some((el, i) => ul.children[i] !== el);
    if (!mudou) return;
    ordem.forEach((el) => ul.appendChild(el));
    linhas.forEach((el, n) => {
      const a = antes.get(n);
      if (!a) return;
      const d = el.getBoundingClientRect();
      const dx = a.left - d.left;
      const dy = a.top - d.top;
      if (!dx && !dy) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  };
}

// Mapa do Brasil com o contorno real dos estados (malha do IBGE, em mapa-brasil.js).
// Estados pequenos demais para caber o texto têm a sigla ao lado, ligada por um traço.
const ROTULO_FORA = { RN: [1040, 268], PB: [1046, 318], PE: [1050, 362], AL: [1044, 406], SE: [1030, 450], ES: [935, 668], RJ: [858, 772], DF: [712, 528] };
const MARGEM_DIREITA = 110;

export function criarMapa(el, aoClicar) {
  el.classList.add('mapa');
  const estados = UFS.map((u) => ({ ...u, ...MAPA.estados[u.sigla], fora: ROTULO_FORA[u.sigla] }));
  el.innerHTML = `
    <svg class="mapa-svg${aoClicar ? ' clicavel' : ''}" viewBox="0 0 ${MAPA.largura + MARGEM_DIREITA} ${MAPA.altura}" role="group" aria-label="Mapa do Brasil por estado">
      <g class="mapa-estados">
        ${estados.map((u) => `<path class="uf vazio" data-uf="${u.sigla}" d="${u.d}"${aoClicar ? ' tabindex="0" role="button"' : ''}><title>${u.nome}</title></path>`).join('')}
      </g>
      <g class="mapa-rotulos">
        ${estados.map((u) => {
          const [x, y] = u.fora || u.centro;
          const traco = u.fora ? `<line x1="${u.centro[0]}" y1="${u.centro[1]}" x2="${x - (u.sigla === 'DF' ? -2 : 6)}" y2="${y - 6}"/>` : '';
          // Fora do estado: "RN 45%" numa linha, alinhado à esquerda. Dentro: sigla em cima, percentual embaixo.
          const texto = u.fora
            ? `<text x="${x}" y="${y}" class="fora"><tspan class="sigla">${u.sigla}</tspan> <tspan class="pct"></tspan></text>`
            : `<text x="${x}" y="${y}"><tspan class="sigla" x="${x}">${u.sigla}</tspan><tspan class="pct" x="${x}" dy="1.15em"></tspan></text>`;
          return `<g data-rotulo="${u.sigla}">${traco}${texto}</g>`;
        }).join('')}
      </g>
    </svg>`;
  const svg = el.querySelector('svg');
  const caminho = Object.fromEntries([...el.querySelectorAll('path[data-uf]')].map((p) => [p.dataset.uf, p]));
  const rotulo = Object.fromEntries([...el.querySelectorAll('[data-rotulo]')].map((g) => [g.dataset.rotulo, g]));
  if (aoClicar) {
    const escolher = (e) => {
      const uf = e.target.closest?.('[data-uf]')?.dataset.uf;
      if (uf && (e.type === 'click' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        aoClicar(uf, e);
      }
    };
    el.addEventListener('click', escolher);
    el.addEventListener('keydown', escolher);
  }
  // modo 'lider': cor de quem lidera no estado; 'progresso': intensidade = % apurado.
  // `selecionada`: sigla de um estado ou lista de siglas (os estados de uma região).
  // `foco`: lista de siglas (uma região): o mapa aproxima nelas e apaga os outros estados.
  const inteiro = [0, 0, MAPA.largura + MARGEM_DIREITA, MAPA.altura];
  let vistaAtual = inteiro;
  let focoAtual = '';
  let animacao;
  function enquadrar(foco) {
    const chave = foco.join(',');
    if (chave === focoAtual) return;
    focoAtual = chave;
    let alvo = inteiro;
    if (foco.length) {
      // Caixa que contém os estados e as siglas deles (inclusive as que ficam do lado de fora).
      const caixas = foco.flatMap((uf) => [caminho[uf].getBBox(), rotulo[uf].getBBox()]);
      const x0 = Math.min(...caixas.map((b) => b.x));
      const y0 = Math.min(...caixas.map((b) => b.y));
      const x1 = Math.max(...caixas.map((b) => b.x + b.width));
      const y1 = Math.max(...caixas.map((b) => b.y + b.height));
      // Mapa ainda escondido (ex.: gaveta do telão fechada): não dá para medir; tenta na próxima.
      if (x1 - x0 <= 0) return (focoAtual = '');
      const folga = 0.06 * Math.max(x1 - x0, y1 - y0);
      alvo = [x0 - folga, y0 - folga, x1 - x0 + 2 * folga, y1 - y0 + 2 * folga];
    }
    // Aproximação suave (o viewBox não anima por CSS).
    cancelAnimationFrame(animacao);
    const de = vistaAtual;
    const inicio = performance.now();
    const passo = (t) => {
      const k = COM_ANIMACAO ? Math.min(1, (t - inicio) / 600) : 1;
      const s = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      vistaAtual = de.map((v, i) => v + (alvo[i] - v) * s);
      svg.setAttribute('viewBox', vistaAtual.map((v) => v.toFixed(1)).join(' '));
      if (k < 1) animacao = requestAnimationFrame(passo);
    };
    animacao = requestAnimationFrame(passo);
  }

  return function atualizar(mapa, { modo = 'lider', cor, selecionada, foco = [] } = {}) {
    const escolhidas = new Set([].concat(selecionada ?? []));
    const naRegiao = new Set(foco);
    for (const u of UFS) {
      const apagado = naRegiao.size > 0 && !naRegiao.has(u.sigla);
      caminho[u.sigla].classList.toggle('apagado', apagado);
      rotulo[u.sigla].classList.toggle('apagado', apagado);
    }
    enquadrar(foco);
    for (const u of UFS) {
      const p = caminho[u.sigla];
      const r = mapa?.[u.sigla];
      const lider = r?.candidatos[0];
      const temVoto = !!r && r.pctSecoes > 0 && lider?.votos > 0;
      p.classList.toggle('vazio', !temVoto);
      p.classList.toggle('sel', escolhidas.has(u.sigla));
      // O estado escolhido vai para o fim do grupo, para o contorno ficar por cima dos vizinhos.
      if (escolhidas.has(u.sigla) && p.nextSibling) p.parentNode.appendChild(p);
      p.style.setProperty('--cor', temVoto ? (modo === 'lider' ? cor(lider.numero) : '#D90404') : '');
      p.style.setProperty('--forca', temVoto ? (0.35 + 0.65 * (r.pctSecoes / 100)).toFixed(2) : '');
      p.querySelector('title').textContent = temVoto ? `${u.nome}: ${lider.nome} ${fmt.pct(lider.pct)} · ${fmt.pct(r.pctSecoes)} das seções` : u.nome;
      rotulo[u.sigla].classList.toggle('sobre-cor', temVoto);
      rotulo[u.sigla].querySelector('.pct').textContent = r ? fmt.pct(r.pctSecoes, 0) : '';
    }
  };
}

// Menu que abre sobre o mapa, no ponto clicado (ex.: ver o estado ou a região dele).
// `area` precisa ter position: relative e conter o mapa. abrir(e, titulo, [{ rotulo, valor }]).
export function criarMenuMapa(area, aoEscolher) {
  const menu = document.createElement('div');
  menu.className = 'mapa-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  area.appendChild(menu);
  const fechar = () => (menu.hidden = true);
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    fechar();
    aoEscolher(b.dataset.valor);
  });
  // Clique fora fecha; o clique num estado não, porque é ele que abre o menu.
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !(area.contains(e.target) && e.target.closest?.('[data-uf]'))) fechar();
  });
  const comEsc = (e) => e.key === 'Escape' && fechar();
  area.addEventListener('keydown', comEsc);
  document.addEventListener('keydown', comEsc);

  function abrir(e, titulo, itens) {
    menu.innerHTML = `<strong>${esc(titulo)}</strong>` + itens.map((i) => `<button type="button" role="menuitem" data-valor="${esc(i.valor)}">${esc(i.rotulo)}</button>`).join('');
    const caixa = area.getBoundingClientRect();
    const r = e.target.getBoundingClientRect();
    const alvo = e.type === 'click' && e.clientX ? { x: e.clientX, y: e.clientY } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    menu.hidden = false;
    // Centralizado no ponto clicado, sem sair da área do mapa.
    const x = Math.min(Math.max(alvo.x - caixa.left - menu.offsetWidth / 2, 0), Math.max(0, caixa.width - menu.offsetWidth));
    const y = Math.min(alvo.y - caixa.top + 8, caixa.height - menu.offsetHeight);
    menu.style.left = `${x}px`;
    menu.style.top = `${Math.max(y, 0)}px`;
    menu.querySelector('button').focus();
  }
  return { abrir, fechar };
}

// Preenche elementos marcados com data-s="campo" a partir de um resultado.
export function preencherStats(raiz, r) {
  const valores = {
    pctSecoes: fmt.pct(r.pctSecoes),
    secoes: `${fmt.int(r.secoesTotalizadas)} de ${fmt.int(r.secoes)} seções`,
    eleitorado: fmt.int(r.eleitorado),
    comparecimento: fmt.int(r.comparecimento),
    pctComparecimento: fmt.pct(r.pctComparecimento),
    abstencao: fmt.int(r.abstencao),
    pctAbstencao: fmt.pct(r.pctAbstencao),
    brancos: fmt.int(r.brancos),
    pctBrancos: fmt.pct(r.pctBrancos),
    nulos: fmt.int(r.nulos),
    pctNulos: fmt.pct(r.pctNulos),
    validos: fmt.int(r.validos),
    atualizadoEm: fmt.hora(r.atualizadoEm),
  };
  raiz.querySelectorAll('[data-s]').forEach((el) => {
    if (el.dataset.s in valores) el.textContent = valores[el.dataset.s];
  });
  raiz.querySelectorAll('[data-barra-secoes]').forEach((el) => (el.style.width = `${r.pctSecoes}%`));
}
