// Modo telão: cenas em rodízio, pensado para 16:9 em tela cheia.
// Comandado pelo painel (tecla C) ou pela página controle.html em outra janela.
// URL: ?uf=CE · ?cidade=Aracati (só os votos da cidade) · ?tempo=15
//      ?cena=presidente|mapa|governador|senador|depfederal|depestadual|destaques|cidade (fixa a cena)
import { CONFIG } from './config.js';
import { UFS, CARGOS, nomeLocal, tituloCargo } from './ufs.js';
import { fonte } from './fontes/index.js';
import { CENAS, estado, definir, aoMudar, pedirAoEntrar, tituloDestaques } from './estado-telao.js';
import { carregarDestaques, rotuloCargo, textoPosicao } from './destaques.js';
import { tipoDaCena, escopoDaCena, listaDaCena, DESENHO_ROLAGEM } from './lista-telao.js';
import { montarPainel } from './painel.js';
import { montarLogo, coresPara, corDaPaleta, corDoPartido, criarLista, criarMapa, preencherStats, avatarHtml, classeSituacao, esc, fmt, resumoDefinicao } from './ui.js';

// O telão sempre abre com o rodízio pausado: o operador liga pelo controle (ou barra de espaço).
pedirAoEntrar({ rodizio: false });

const $ = (id) => document.getElementById(id);
const SECAO = { majoritario: 'cena-cargo', mapa: 'cena-mapa', proporcional: 'cena-lista', destaques: 'cena-destaques' };

let cenaNoAr = estado.cena;
let pedido = 0;
let listas = {};
const atualizarMapa = criarMapa($('t-mapa'));

montarLogo($('logo'));
$('turno').textContent = CONFIG.turno;

// A cena no ar, já com o tipo de desenho que vale agora (ex.: Governador em "lista completa").
const cenaAtual = () => {
  const cena = CENAS.find((c) => c.id === cenaNoAr);
  return { ...cena, tipo: tipoDaCena(cena) };
};

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
    el.classList.toggle('destaque-eleito', classeSituacao(c) === 'eleito');
    el.classList.toggle('destaque-turno2', classeSituacao(c) === 'turno2');
  });
  while (duelo.children.length > candidatos.length) duelo.lastChild.remove();
}

// --- candidatos em destaque ---------------------------------------------------
// Os cartões só são refeitos quando muda a lista de candidatos; nas demais atualizações
// trocam-se apenas os números, para fotos e animações não recomeçarem.
let assinaturaLocais = '';
function atualizarLocais({ itens, naoEncontrados }, uf, cidade) {
  const el = $('locais');
  const visiveis = itens.slice(0, 9);
  el.dataset.qtd = visiveis.length;
  if (!visiveis.length) {
    assinaturaLocais = '';
    el.innerHTML = `<p class="t-vazio">Nenhum candidato em destaque encontrado${naoEncontrados.length ? ` (números: ${esc(naoEncontrados.join(', '))})` : ''}.<br>Escolha os candidatos no controle (seção "Candidatos em destaque").</p>`;
    return;
  }
  const assinatura = `${visiveis.map((i) => `${i.cargo}|${i.cand.numero}`).join(',')}|${uf}|${cidade}`;
  if (assinatura !== assinaturaLocais || el.children.length !== visiveis.length) {
    assinaturaLocais = assinatura;
    el.innerHTML = visiveis
      .map(
        ({ cargo, cand }, i) => `
      <article class="local" style="--cor:${corDoPartido(cand.partido) || corDaPaleta(i)}; --ordem:${i}">
        <div class="avatar">${avatarHtml(cand)}</div>
        <div class="local-info">
          <div class="local-cargo">${esc(rotuloCargo(cargo))} · ${esc(cand.partido)} · ${esc(cand.numero)}</div>
          <div class="local-nome">${esc(cand.nome)}</div>
          <span class="sit"></span>
        </div>
        <div class="local-nums">
          <div><b data-f="votos"></b><span data-f="posicao"></span></div>
          ${cidade ? '<div><b data-f="votosCidade"></b><span data-f="textoCidade"></span></div>' : ''}
        </div>
      </article>`,
      )
      .join('');
  }
  visiveis.forEach((item, i) => {
    const { cand, onde, naCidade, cidadeDisponivel } = item;
    const cartao = el.children[i];
    const campo = (nome, texto) => {
      const alvo = cartao.querySelector(`[data-f="${nome}"]`);
      if (alvo && alvo.textContent !== texto) alvo.textContent = texto;
    };
    campo('votos', fmt.int(cand.votos));
    campo('posicao', `votos · ${onde} · ${textoPosicao(item)}`);
    campo('votosCidade', naCidade ? fmt.int(naCidade.votos) : '–');
    campo('textoCidade', naCidade ? `votos em ${cidade} · ${fmt.pct(naCidade.pct)} dos válidos` : cidadeDisponivel ? `sem votos em ${cidade}` : `votos em ${cidade} indisponíveis`);
    const sit = cartao.querySelector('.sit');
    sit.textContent = cand.situacao || '';
    sit.className = `sit ${classeSituacao(cand)}`;
    cartao.classList.toggle('local-eleito', classeSituacao(cand) === 'eleito');
  });
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
  const linhas = Object.entries(estados)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([numero, total]) => ({
      chave: numero,
      cor: cor(numero),
      total,
      nome: nacional.candidatos.find((x) => String(x.numero) === numero)?.nome || numero,
      rotulo: total === 1 ? 'estado' : 'estados',
    }));
  if (semVotos) linhas.push({ chave: 'sem', total: semVotos, nome: 'Aguardando', rotulo: 'sem votos apurados' });

  // Os blocos ficam fixos na tela: só o número e o texto mudam; a ordem só muda se alguém passar à frente.
  const painel = $('t-lideres');
  const blocos = linhas.map((l) => {
    let el = painel.querySelector(`[data-lider="${l.chave}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = `lider${l.chave === 'sem' ? ' sem' : ''}`;
      el.dataset.lider = l.chave;
      el.innerHTML = '<b></b><span><em></em><small></small></span>';
    }
    if (l.cor) el.style.setProperty('--cor', l.cor);
    const texto = (seletor, valor) => {
      const alvo = el.querySelector(seletor);
      if (alvo.textContent !== String(valor)) alvo.textContent = valor;
    };
    texto('b', l.total);
    texto('em', l.nome);
    texto('small', l.rotulo);
    return el;
  });
  [...painel.children].forEach((el) => blocos.includes(el) || el.remove());
  if (blocos.some((el, i) => painel.children[i] !== el)) blocos.forEach((el) => painel.appendChild(el));
}

// --- cenas -------------------------------------------------------------------
function montarCena() {
  const cena = cenaAtual();
  const { uf, cidade } = escopoDaCena(cena);
  let titulo = tituloCargo(cena.cargo, uf);
  let complemento = nomeLocal(uf, cidade);
  if (cena.tipo === 'mapa') titulo = 'Mapa da apuração';
  if (cena.tipo === 'destaques') [titulo, complemento] = [tituloDestaques(), uf];
  $('t-titulo').innerHTML = `${esc(titulo)} <span>· ${esc(complemento)}</span>`;
  Object.entries(SECAO).forEach(([tipo, id]) => ($(id).hidden = tipo !== cena.tipo));
  // Listas novas a cada montagem: os candidatos mudam com a cena, o estado e a cidade.
  for (const id of ['duelo', 'demais', 't-legenda', 'ranking', 'locais']) $(id).innerHTML = '';
  listas = {
    demais: criarLista($('demais')),
    legenda: criarLista($('t-legenda')),
    ranking: criarLista($('ranking')),
  };
  rol = null;
  ranking = null;
}

async function atualizar() {
  const meu = ++pedido;
  const cena = cenaAtual();
  const { uf, cidade } = escopoDaCena(cena);
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
        const demais = r.candidatos.slice(2);
        listas.demais(demais, cor);
        prepararRolagem([$('demais')], demais.length, DESENHO_ROLAGEM.majoritario.naTela);
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
    // Faixa "Eleito no 1º turno" / "2º turno" nas disputas de Presidente, Governador e Senador.
    const definicao = r && !CARGOS[cena.cargo].proporcional && ['majoritario', 'proporcional'].includes(cena.tipo) ? resumoDefinicao(r.candidatos) : null;
    $('faixa-resultado').hidden = !definicao;
    if (definicao) {
      $('faixa-resultado').className = `faixa-resultado ${definicao.classe}`;
      $('faixa-resultado').textContent = definicao.texto;
    }
    if (r) preencherStats(document, r);
    // Selo "Aguardando" até o TSE totalizar a primeira seção.
    if (r) $('selo-status').hidden = !r.aguardando;
  } catch (e) {
    if (meu !== pedido) return;
    $('t-erro').hidden = false;
    $('t-erro').textContent = `Aguardando dados do TSE. ${e.message}`;
  }
}

// --- rolagem das listas (deputados, demais candidatos e resultado da cidade) ------
// Toda lista fica montada inteira dentro de uma "janela" e desliza por ela, conforme a
// opção do painel: páginas (pula de tela em tela), rolagem automática ou manual (controle).
const MS_MINIMO_POR_PAGINA = 5000;
const LINHAS_POR_SEGUNDO = 0.4; // velocidade da rolagem automática
const PAUSA_ROLAGEM_MS = 2500; // parada no início e no fim da lista
let rol = null; // { uls, linhas, naTela } da lista que está no ar
let ranking = null; // último resultado recebido para a cena de deputados
let duracaoMinimaCena = 0; // a cena fica no ar até a lista inteira passar
let cenaDesde = Date.now();

const linhasExtras = () => (rol ? Math.max(0, rol.linhas - rol.naTela) : 0);
const paginas = () => (rol ? Math.max(1, Math.ceil(rol.linhas / rol.naTela)) : 1);
const msPorPagina = () => (estado.rodizio ? Math.max(MS_MINIMO_POR_PAGINA, (estado.tempo * 1000) / paginas()) : 7000);
const paginaAtual = () => Math.floor((Date.now() - cenaDesde) / msPorPagina()) % paginas();

function exigirDuracao(ms) {
  if (Math.abs(ms - duracaoMinimaCena) < 500) return;
  duracaoMinimaCena = ms;
  agendarRodizio();
}

// Registra a lista que está no ar: `linhas` no total, `naTela` visíveis de cada vez.
function prepararRolagem(uls, linhas, naTela) {
  for (const ul of uls) ul.style.setProperty('--linha', `${ul.parentElement.clientHeight / naTela}px`);
  rol = { uls, linhas, naTela };
  const extras = linhasExtras();
  if (!extras || estado.lista === 'manual') return exigirDuracao(0);
  exigirDuracao(estado.lista === 'rolagem' ? 2 * PAUSA_ROLAGEM_MS + (extras / LINHAS_POR_SEGUNDO) * 1000 : paginas() * msPorPagina());
}

// Linha que deve estar no topo da janela agora.
function linhaAtual() {
  const extras = linhasExtras();
  if (!extras) return 0;
  if (estado.lista === 'manual') return Math.min(extras, Math.max(0, estado.listaPos || 0));
  if (estado.lista === 'rolagem') {
    const percurso = (extras / LINHAS_POR_SEGUNDO) * 1000;
    const t = (Date.now() - cenaDesde) % (percurso + 2 * PAUSA_ROLAGEM_MS);
    return Math.min(extras, Math.max(0, ((t - PAUSA_ROLAGEM_MS) / 1000) * LINHAS_POR_SEGUNDO));
  }
  return Math.min(extras, paginaAtual() * rol.naTela);
}

// Quadro a quadro: a rolagem automática desliza contínua; páginas e controle manual deslizam suave.
function rolar() {
  requestAnimationFrame(rolar);
  if (!rol) return;
  const linha = linhaAtual();
  for (const ul of rol.uls) {
    ul.classList.toggle('suave', estado.lista !== 'rolagem');
    ul.style.transform = `translateY(calc(var(--linha) * ${(-linha).toFixed(3)}))`;
  }
}
requestAnimationFrame(rolar);

function desenharRanking() {
  if (!ranking || cenaAtual().tipo !== 'proporcional' || cenaAtual().cargo !== ranking.cargo) return;
  const { r, cargo, cor } = ranking;
  const { lista, titulo } = listaDaCena(r, cargo);
  listas.ranking(lista, cor, { teto: lista[0]?.pct });
  prepararRolagem([$('ranking')], Math.ceil(lista.length / 2), DESENHO_ROLAGEM.proporcional.naTela);
  const pagina = estado.lista === 'paginas' && paginas() > 1 ? ` · página ${paginaAtual() + 1} de ${paginas()}` : '';
  $('ranking-titulo').textContent = titulo + pagina;
}
// Atualiza o "página x de y" mesmo quando os dados só chegam de 10 em 10 segundos (fonte TSE).
setInterval(desenharRanking, 1000);

let temporizador;
function agendarRodizio() {
  clearTimeout(temporizador);
  if (!estado.rodizio) return;
  const duracao = Math.max(estado.tempo * 1000, duracaoMinimaCena);
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
  duracaoMinimaCena = 0;
  ranking = null;
  rol = null;
  if (estado.cena !== id) definir({ cena: id });
  const palco = $('cena');
  palco.classList.add('saindo');
  setTimeout(async () => {
    montarCena();
    await atualizar();
    palco.classList.remove('saindo');
    // Entrada em cascata dos blocos da cena nova.
    palco.classList.remove('entrando');
    void palco.offsetWidth;
    palco.classList.add('entrando');
    // Terminada a entrada, nada mais é animado de novo a cada atualização dos números.
    clearTimeout(mostrar.fimEntrada);
    mostrar.fimEntrada = setTimeout(() => palco.classList.remove('entrando'), 1200);
  }, 400);
  agendarRodizio();
}

aoMudar((e, alteracao) => {
  if (alteracao.cena && alteracao.cena !== cenaNoAr && CENAS.some((c) => c.id === alteracao.cena)) return mostrar(alteracao.cena);
  if (['uf', 'cidade', 'abrangencia', 'destaques', 'deputados', 'lista', 'formato'].some((k) => k in alteracao)) {
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
$('fechar-painel').addEventListener('click', () => alternarPainel(false));

// Tela cheia: só pode ser pedida por clique ou tecla no próprio computador do telão.
function alternarTelaCheia() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}
$('tela-cheia').addEventListener('click', alternarTelaCheia);
document.addEventListener('fullscreenchange', () => {
  const cheia = !!document.fullscreenElement;
  $('tela-cheia').classList.toggle('cheia', cheia);
  $('tela-cheia').title = cheia ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
  $('tela-cheia').setAttribute('aria-label', cheia ? 'Sair da tela cheia' : 'Tela cheia');
});

// O botão de tela cheia só aparece enquanto o mouse se mexe, para não ir ao ar.
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
  else if (tecla === 'f') alternarTelaCheia();
  else if (tecla === 'h') $('ajuda').hidden = !$('ajuda').hidden;
});

montarCena();
atualizar();
agendarRodizio();
setInterval(atualizar, fonte.intervaloMs);
atualizarTicker();
setInterval(atualizarTicker, Math.max(10000, fonte.intervaloMs));
