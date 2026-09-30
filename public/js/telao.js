// Modo telão: cenas em rodízio, pensado para 16:9 em tela cheia.
// Comandado pelo painel (tecla C) ou pela página controle.html em outra janela.
// URL: ?uf=CE · ?cidade=Aracati (só os votos da cidade) · ?tempo=15
//      ?cena=presidente|mapa|governador|senador|depfederal|depestadual|destaques (fixa a cena)
import { CONFIG } from './config.js';
import { UFS, CARGOS, nomeLocal, tituloCargo } from './ufs.js';
import { fonte } from './fontes/index.js';
import { CENAS, estado, definir, aoMudar, cidadeAtiva, tituloDestaques } from './estado-telao.js';
import { carregarDestaques, lerNumeros, rotuloCargo, textoPosicao } from './destaques.js';
import { montarPainel } from './painel.js';
import { montarLogo, coresPara, corDaPaleta, corDoPartido, criarLista, criarMapa, preencherStats, avatarHtml, classeSituacao, esc, fmt } from './ui.js';

const $ = (id) => document.getElementById(id);
const SECAO = { majoritario: 'cena-cargo', mapa: 'cena-mapa', proporcional: 'cena-lista', destaques: 'cena-destaques' };
const NO_RANKING = 10;

let cenaNoAr = estado.cena;
let pedido = 0;
let listas = {};
const atualizarMapa = criarMapa($('t-mapa'));

montarLogo($('logo'));
$('turno').textContent = CONFIG.turno;
$('selo-sim').hidden = fonte.id !== 'sim';
$('ajuda-sim').hidden = fonte.id !== 'sim';

const cenaAtual = () => CENAS.find((c) => c.id === cenaNoAr);

// De onde vêm os votos de cada cena, conforme estado/cidade escolhidos no painel.
function escopo(cena) {
  const cidade = cidadeAtiva();
  if (cena.tipo === 'mapa') return { uf: 'BR', cidade: '' };
  if (cena.tipo === 'destaques') return { uf: estado.uf, cidade: estado.cidade };
  if (CARGOS[cena.cargo].nacional && estado.abrangencia === 'br') return { uf: 'BR', cidade: '' };
  return { uf: estado.uf, cidade };
}

// --- cartões grandes dos primeiros colocados --------------------------------
function atualizarDuelo(candidatos, cor) {
  const duelo = $('duelo');
  const teto = Math.max(50, candidatos[0]?.pct || 0);
  candidatos.forEach((c, i) => {
    let el = duelo.children[i];
    if (!el || el.dataset.n !== String(c.numero)) {
      const novo = document.createElement('article');
      novo.className = 'destaque';
      novo.dataset.n = c.numero;
      novo.innerHTML = `
        <div class="avatar">${avatarHtml(c)}</div>
        <div>
          <div class="destaque-nome">${esc(c.nome)}</div>
          <div class="destaque-sub"></div>
          <div class="barra"><i></i></div>
          <div class="destaque-votos"></div>
        </div>
        <div class="destaque-dir"><div class="destaque-pct"></div><span class="sit"></span></div>`;
      if (el) el.replaceWith(novo);
      else duelo.appendChild(novo);
      el = novo;
    }
    el.style.setProperty('--cor', cor(c.numero));
    el.querySelector('.barra i').style.width = `${Math.min(100, (c.pct / teto) * 100)}%`;
    el.querySelector('.destaque-sub').textContent = `${c.partido} · ${c.numero}${c.vice ? ` · Vice: ${c.vice}` : ''}`;
    el.querySelector('.destaque-pct').textContent = fmt.pct(c.pct);
    el.querySelector('.destaque-votos').textContent = `${fmt.int(c.votos)} votos`;
    const sit = el.querySelector('.sit');
    sit.textContent = c.situacao || '';
    sit.className = `sit ${classeSituacao(c)}`;
  });
  while (duelo.children.length > candidatos.length) duelo.lastChild.remove();
}

// --- candidatos em destaque (deputados da cidade) ---------------------------
function atualizarLocais({ itens, naoEncontrados }, uf, cidade) {
  const el = $('locais');
  el.dataset.qtd = Math.min(itens.length, 9);
  if (!itens.length) {
    el.innerHTML = `<p class="t-vazio">Nenhum candidato em destaque encontrado${naoEncontrados.length ? ` (números: ${esc(naoEncontrados.join(', '))})` : ''}.<br>Escolha os candidatos no painel de controle (tecla C).</p>`;
    return;
  }
  el.innerHTML = itens
    .slice(0, 9)
    .map((item, i) => {
      const { cargo, cand, onde, naCidade, cidadeDisponivel } = item;
      const votosCidade = naCidade
        ? `<b>${fmt.int(naCidade.votos)}</b><span>votos em ${esc(cidade)} · ${fmt.pct(naCidade.pct)} dos válidos</span>`
        : `<b>–</b><span>${cidadeDisponivel ? `sem votos em ${esc(cidade)}` : `votos em ${esc(cidade)} indisponíveis`}</span>`;
      return `
      <article class="local" style="--cor:${corDoPartido(cand.partido) || corDaPaleta(i)}">
        <div class="avatar">${avatarHtml(cand)}</div>
        <div class="local-info">
          <div class="local-cargo">${esc(rotuloCargo(cargo))} · ${esc(cand.partido)} · ${esc(cand.numero)}</div>
          <div class="local-nome">${esc(cand.nome)}</div>
          <span class="sit ${classeSituacao(cand)}">${esc(cand.situacao || '')}</span>
        </div>
        <div class="local-nums">
          <div><b>${fmt.int(cand.votos)}</b><span>votos · ${esc(onde)} · ${textoPosicao(item)}</span></div>
          ${cidade ? `<div>${votosCidade}</div>` : ''}
        </div>
      </article>`;
    })
    .join('');
}

// --- placar de estados liderados (cena do mapa) -----------------------------
function atualizarLideres(mapa, nacional, cor) {
  const estados = {};
  let semVotos = 0;
  for (const u of UFS) {
    const lider = mapa[u.sigla]?.candidatos[0];
    if (lider?.votos > 0) estados[lider.numero] = (estados[lider.numero] || 0) + 1;
    else semVotos++;
  }
  const blocos = Object.entries(estados)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([numero, total]) => {
      const c = nacional.candidatos.find((x) => String(x.numero) === numero);
      return `<div class="lider" style="--cor:${cor(numero)}"><b>${total}</b><span>${esc(c?.nome || numero)}<small>${total === 1 ? 'estado' : 'estados'}</small></span></div>`;
    });
  if (semVotos) blocos.push(`<div class="lider sem"><b>${semVotos}</b><span>Aguardando<small>sem votos apurados</small></span></div>`);
  $('t-lideres').innerHTML = blocos.join('');
}

// --- cenas -------------------------------------------------------------------
function montarCena() {
  const cena = cenaAtual();
  const { uf, cidade } = escopo(cena);
  let titulo = tituloCargo(cena.cargo, uf);
  let complemento = nomeLocal(uf, cidade);
  if (cena.tipo === 'mapa') titulo = 'Mapa da apuração';
  if (cena.tipo === 'destaques') [titulo, complemento] = [tituloDestaques(), uf];
  $('t-titulo').innerHTML = `${esc(titulo)} <span>· ${esc(complemento)}</span>`;
  Object.entries(SECAO).forEach(([tipo, id]) => ($(id).hidden = tipo !== cena.tipo));
  // Listas novas a cada montagem: os candidatos mudam com a cena, o estado e a cidade.
  for (const id of ['duelo', 'demais', 't-legenda', 'ranking', 'locais']) $(id).innerHTML = '';
  listas = { demais: criarLista($('demais')), legenda: criarLista($('t-legenda')), ranking: criarLista($('ranking')) };
}

async function atualizar() {
  const meu = ++pedido;
  const cena = cenaAtual();
  const { uf, cidade } = escopo(cena);
  try {
    let r;
    if (cena.tipo === 'destaques') {
      const d = await carregarDestaques(fonte, { uf, cidade, numeros: estado.destaques });
      if (meu !== pedido) return;
      atualizarLocais(d, uf, cidade);
      r = d.referencia;
    } else {
      const [res, mapa] = await Promise.all([fonte.resultado(cena.cargo, uf, cidade), cena.tipo === 'mapa' ? fonte.mapa(cena.cargo) : null]);
      if (meu !== pedido) return;
      r = res;
      const cor = coresPara(`${cena.cargo}|${uf}`, r.candidatos);
      if (cena.tipo === 'majoritario') {
        // Os dois primeiros ficam nos cartões grandes; a lista segue a partir do 3º.
        atualizarDuelo(r.candidatos.slice(0, 2), cor);
        listas.demais(r.candidatos.slice(2, 6), cor);
      } else if (cena.tipo === 'mapa') {
        atualizarMapa(mapa, { modo: 'lider', cor });
        listas.legenda(r.candidatos.slice(0, 4), cor);
        atualizarLideres(mapa, r, cor);
      } else {
        ranking = { r, cargo: cena.cargo, cor };
        desenharRanking();
      }
    }
    $('t-erro').hidden = true;
    if (r) preencherStats(document, r);
    if (r?.fonte === 'tse') {
      $('selo-sim').hidden = !r.aguardando;
      $('selo-sim').textContent = 'AGUARDANDO O INÍCIO DA TOTALIZAÇÃO · TSE';
    }
    if (r?.fonte === 'sim') $('selo-sim').textContent = r.oficial === false ? 'SIMULAÇÃO · TSE INDISPONÍVEL: NOMES E VOTOS FICTÍCIOS' : 'SIMULAÇÃO · VOTOS FICTÍCIOS';
  } catch (e) {
    if (meu !== pedido) return;
    $('t-erro').hidden = false;
    $('t-erro').textContent = `Aguardando dados do TSE. ${e.message}`;
  }
}

// --- lista de deputados, em páginas de 10 ---------------------------------------
// Quantos entram na lista conforme a opção do painel ("vagas" = todos dentro do número de vagas).
const LIMITE_DEPUTADOS = { top: 10, top20: 20, top30: 30, top50: 50 };
const MS_MINIMO_POR_PAGINA = 5000;
let ranking = null; // último resultado recebido para a cena de deputados
let paginasDaCena = 1;
let cenaDesde = Date.now();

const msPorPagina = () => (estado.rodizio ? Math.max(MS_MINIMO_POR_PAGINA, (estado.tempo * 1000) / paginasDaCena) : 7000);

function desenharRanking() {
  if (!ranking || cenaAtual().tipo !== 'proporcional' || cenaAtual().cargo !== ranking.cargo) return;
  const { r, cargo, cor } = ranking;
  // "Só os escolhidos": apenas os candidatos em destaque deste cargo, com a posição real.
  const numeros = estado.deputados === 'escolhidos' ? lerNumeros(estado.destaques[cargo]) : [];
  const escolhidos = r.candidatos.filter((c) => numeros.includes(String(c.numero)));
  const limite = estado.deputados === 'vagas' ? r.vagas : LIMITE_DEPUTADOS[estado.deputados] || NO_RANKING;
  const lista = escolhidos.length ? escolhidos : r.candidatos.slice(0, limite);
  const paginas = Math.max(1, Math.ceil(lista.length / NO_RANKING));
  if (paginas !== paginasDaCena) {
    // A cena fica no ar o bastante para todas as páginas passarem.
    paginasDaCena = paginas;
    agendarRodizio();
  }
  const pagina = Math.floor((Date.now() - cenaDesde) / msPorPagina()) % paginas;
  const rotulo = escolhidos.length ? `${escolhidos.length} candidato(s) escolhido(s)` : `${lista.length} mais votados`;
  const paginacao = paginas > 1 ? ` · página ${pagina + 1} de ${paginas}` : '';
  $('ranking-titulo').textContent = `${rotulo} · ${r.vagas} vagas · ${fmt.int(r.candidatos.length)} candidatos${paginacao}`;
  listas.ranking(lista.slice(pagina * NO_RANKING, (pagina + 1) * NO_RANKING), cor, { teto: lista[0]?.pct });
}
// Troca de página mesmo quando os dados só chegam de 30 em 30 segundos (fonte TSE).
setInterval(desenharRanking, 1000);

let temporizador;
function agendarRodizio() {
  clearTimeout(temporizador);
  if (!estado.rodizio) return;
  const duracao = Math.max(estado.tempo * 1000, paginasDaCena * msPorPagina());
  const restante = Math.max(1000, duracao - (Date.now() - cenaDesde));
  temporizador = setTimeout(() => mostrar(vizinha(1)), restante);
}

// Próxima (ou anterior) cena. No rodízio automático só entram as marcadas no painel.
function vizinha(passo, soAtivas = true) {
  const i = CENAS.findIndex((c) => c.id === cenaNoAr);
  for (let k = 1; k <= CENAS.length; k++) {
    const c = CENAS[(i + passo * k + CENAS.length * k) % CENAS.length];
    if (!soAtivas || estado.cenasAtivas.includes(c.id)) return c.id;
  }
  return cenaNoAr;
}

function mostrar(id) {
  cenaNoAr = id;
  cenaDesde = Date.now();
  paginasDaCena = 1;
  ranking = null;
  if (estado.cena !== id) definir({ cena: id });
  const palco = $('cena');
  palco.classList.add('saindo');
  setTimeout(async () => {
    montarCena();
    await atualizar();
    palco.classList.remove('saindo');
  }, 400);
  agendarRodizio();
}

aoMudar((e, alteracao) => {
  if (alteracao.cena && alteracao.cena !== cenaNoAr) return mostrar(alteracao.cena);
  if (['uf', 'cidade', 'abrangencia', 'destaques', 'deputados'].some((k) => k in alteracao)) {
    montarCena();
    atualizar();
  }
  if (['rodizio', 'tempo', 'cenasAtivas'].some((k) => k in alteracao)) {
    if ('rodizio' in alteracao) cenaDesde = Date.now(); // ao retomar, a cena ganha o tempo inteiro de novo
    agendarRodizio();
  }
});

// --- faixa inferior com os estados --------------------------------------------
let tickerHtml = '';
async function atualizarTicker() {
  try {
    const mapa = await fonte.mapa('presidente');
    const itens = UFS.filter((u) => mapa[u.sigla])
      .sort((a, b) => a.sigla.localeCompare(b.sigla))
      .map((u) => {
        const r = mapa[u.sigla];
        const [a, b] = r.candidatos;
        if (!a || r.pctSecoes <= 0) return `<span><b>${u.sigla}</b> aguardando <em>0% apurado</em></span>`;
        const segundo = b ? ` × ${esc(b.nome)} ${fmt.pct(b.pct, 1)}` : '';
        return `<span><b>${u.sigla}</b> ${esc(a.nome)} ${fmt.pct(a.pct, 1)}${segundo} <em>${fmt.pct(r.pctSecoes, 0)} apurado</em></span>`;
      })
      .join('');
    // Conteúdo duplicado: a animação desloca 50% e emenda sem salto.
    tickerHtml = `<div>${itens}</div><div>${itens}</div>`;
    if (!$('ticker').innerHTML) $('ticker').innerHTML = tickerHtml;
  } catch {}
}
// Troca o texto só ao fim de cada volta, para a faixa não "pular".
$('ticker').addEventListener('animationiteration', () => ($('ticker').innerHTML = tickerHtml));

// --- painel, relógio e teclado --------------------------------------------------
montarPainel($('painel'), fonte);
const alternarPainel = (abrir = $('gaveta').hidden) => ($('gaveta').hidden = !abrir);
$('abrir-painel').addEventListener('click', () => alternarPainel(true));
$('fechar-painel').addEventListener('click', () => alternarPainel(false));

// O botão "Controle" só aparece enquanto o mouse se mexe, para não ir ao ar.
let ocultarMouse;
addEventListener('mousemove', () => {
  document.body.classList.add('mouse');
  clearTimeout(ocultarMouse);
  ocultarMouse = setTimeout(() => document.body.classList.remove('mouse'), 2500);
});

const tique = () => ($('relogio').textContent = fmt.hora(new Date()));
tique();
setInterval(tique, 1000);

addEventListener('keydown', (e) => {
  const tecla = e.key.toLowerCase();
  if (tecla === 'arrowright') mostrar(vizinha(1, false));
  else if (tecla === 'arrowleft') mostrar(vizinha(-1, false));
  else if (/^[1-9]$/.test(tecla) && CENAS[Number(tecla) - 1]) mostrar(CENAS[Number(tecla) - 1].id);
  else if (tecla === ' ') {
    e.preventDefault();
    definir({ rodizio: !estado.rodizio });
  } else if (tecla === 'c') alternarPainel();
  else if (tecla === 'escape') alternarPainel(false);
  else if (tecla === 'f') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  } else if (tecla === 'h') $('ajuda').hidden = !$('ajuda').hidden;
  else if (fonte.id === 'sim' && tecla === 'r') fonte.reiniciar();
  else if (fonte.id === 'sim' && (tecla === '+' || tecla === '=')) fonte.velocidade(2);
  else if (fonte.id === 'sim' && tecla === '-') fonte.velocidade(0.5);
});

montarCena();
atualizar();
agendarRodizio();
setInterval(atualizar, fonte.intervaloMs);
atualizarTicker();
setInterval(atualizarTicker, Math.max(10000, fonte.intervaloMs));
