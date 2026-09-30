// Componentes de tela compartilhados entre a página pública e o telão.
import { CONFIG } from './config.js';
import { UFS } from './ufs.js';

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

export function classeSituacao(c) {
  if (c.eleito) return 'eleito';
  if (/2.? turno/i.test(c.situacao)) return 'turno2';
  return '';
}

export function avatarHtml(c) {
  const foto = c.foto ? `<img src="${esc(c.foto)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span>${esc(iniciais(c.nome))}</span>${foto}`;
}

// Lista de candidatos com barras. Mantém as linhas entre atualizações para que
// barras e trocas de posição sejam animadas.
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
      }
      el.style.setProperty('--cor', cor(n));
      el.querySelector('.cand-pos').textContent = c.pos ?? i + 1;
      // O vice pode chegar depois do titular (consulta separada no cadastro).
      el.querySelector('.cand-sub').textContent = `${c.partido} · ${c.numero}${c.vice ? ` · Vice: ${c.vice}` : ''}`;
      el.querySelector('.barra i').style.width = `${Math.min(100, (c.pct / (teto || 1)) * 100)}%`;
      el.querySelector('.cand-pct').textContent = fmt.pct(c.pct);
      el.querySelector('.cand-votos').textContent = `${fmt.int(c.votos)} votos`;
      const sit = el.querySelector('.sit');
      sit.textContent = c.situacao || '';
      sit.className = `sit ${classeSituacao(c)}`;
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

// Mapa do Brasil em blocos (um bloco por UF).
export function criarMapa(el, aoClicar) {
  el.classList.add('mapa');
  const blocos = {};
  for (const u of UFS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'uf';
    b.style.gridColumn = u.col + 1;
    b.style.gridRow = u.lin + 1;
    b.innerHTML = `<b>${u.sigla}</b><small></small>`;
    b.title = u.nome;
    if (aoClicar) b.addEventListener('click', () => aoClicar(u.sigla));
    else b.tabIndex = -1;
    el.appendChild(b);
    blocos[u.sigla] = b;
  }
  // modo 'lider': cor de quem lidera no estado; 'progresso': intensidade = % apurado.
  return function atualizar(mapa, { modo = 'lider', cor, selecionada } = {}) {
    for (const u of UFS) {
      const b = blocos[u.sigla];
      const r = mapa?.[u.sigla];
      const lider = r?.candidatos[0];
      const temVoto = r && r.pctSecoes > 0 && lider?.votos > 0;
      b.classList.toggle('vazio', !temVoto);
      b.classList.toggle('sel', u.sigla === selecionada);
      b.style.setProperty('--cor', temVoto ? (modo === 'lider' ? cor(lider.numero) : '#D90404') : '');
      b.style.setProperty('--forca', temVoto ? (0.35 + 0.65 * (r.pctSecoes / 100)).toFixed(2) : '');
      b.querySelector('small').textContent = r ? fmt.pct(r.pctSecoes, 0) : '–';
      b.title = temVoto ? `${u.nome}: ${lider.nome} ${fmt.pct(lider.pct)} · ${fmt.pct(r.pctSecoes)} das seções` : u.nome;
    }
  };
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
