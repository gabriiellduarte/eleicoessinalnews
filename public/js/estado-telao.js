// Estado do telão (cena, estado, cidade, destaques...). Fica no localStorage e é
// sincronizado de dois jeitos: entre janelas do mesmo navegador (BroadcastChannel) e,
// com o server.js rodando, entre aparelhos da mesma rede (o celular comanda o telão).
// O servidor separa o estado por rede (IP de internet): de outra rede não se comanda este telão.
import { CONFIG, UFS_GOVERNADOR } from './config.js';
import { UF_POR_SIGLA, CARGOS, REGIOES } from './ufs.js';

// 2º turno: Presidente, o mapa e uma cena de Governador para cada estado com 2º turno
// (a cena de governador mostra sempre o seu estado, qualquer que seja o estado escolhido no painel).
export const CENAS = [
  { id: 'presidente', nome: 'Presidente', tipo: 'majoritario', cargo: 'presidente' },
  { id: 'mapa', nome: 'Mapa Brasil', tipo: 'mapa', cargo: 'presidente' },
  ...UFS_GOVERNADOR.map((uf) => ({ id: `gov-${uf.toLowerCase()}`, nome: `Governador ${uf}`, tipo: 'majoritario', cargo: 'governador', uf })),
];

// Chave nova no 2º turno: o estado salvo no 1º turno tinha outras cenas.
const CHAVE = 'sinal-telao-estado-2t';
const PADRAO = {
  cena: 'presidente',
  rodizio: false, // o telão abre parado; o operador liga o rodízio pelo controle
  tempo: CONFIG.telao.segundosPorCena,
  cenasAtivas: CENAS.map((c) => c.id),
  uf: CONFIG.ufDestaque,
  // De onde vêm os votos: 'br' = Brasil todo (Presidente soma o país; os outros cargos, o estado)
  // | 'uf' = só o estado escolhido, inclusive Presidente | 'cidade' = só a cidade
  // | 'regiao' = Presidente soma só os estados da região (os outros cargos mostram o estado)
  abrangencia: 'br',
  regiao: UF_POR_SIGLA[CONFIG.ufDestaque]?.regiao || 'NE',
  // Cenas de deputados: 'top' = 10 mais votados | 'top20' | 'top30' | 'top50' | 'vagas' = todas as
  // cadeiras do estado | 'todos' | 'escolhidos' = só os candidatos em destaque
  deputados: 'top',
  // Lista com mais de 10 nomes: 'paginas' | 'rolagem' (sobe sozinha) | 'manual' (setas do controle)
  lista: 'paginas',
  listaPos: 0, // linha no topo da tela na rolagem manual
  // Presidente, Governador e Senador: 'destaque' = dois grandes + demais | 'lista' = lista completa
  formato: 'destaque',
  cidade: CONFIG.destaques.cidade,
  destaques: {
    titulo: CONFIG.destaques.titulo,
    // um texto "número, número" por cargo
    ...Object.fromEntries(Object.keys(CARGOS).map((c) => [c, (CONFIG.destaques[c] || []).join(', ')])),
  },
};

// O que veio na URL vale mais que o que ficou salvo (e que o estado de outros aparelhos).
function daUrl() {
  const p = new URLSearchParams(location.search);
  const u = {};
  if (p.get('uf') && UF_POR_SIGLA[p.get('uf').toUpperCase()]) u.uf = p.get('uf').toUpperCase();
  if (p.get('cidade')) Object.assign(u, { cidade: p.get('cidade'), abrangencia: 'cidade' });
  if (Number(p.get('tempo')) > 0) u.tempo = Number(p.get('tempo'));
  if (CENAS.some((c) => c.id === p.get('cena'))) Object.assign(u, { cena: p.get('cena'), rodizio: false });
  return u;
}
const pedidoDaUrl = daUrl();

// Algo que esta página impõe ao abrir (ex.: o telão começa com o rodízio pausado).
// Vale mais que o estado salvo e que o dos outros aparelhos, e segue para eles.
export function pedirAoEntrar(alteracao) {
  Object.assign(pedidoDaUrl, alteracao);
  Object.assign(estado, alteracao);
}

function carregar() {
  let salvo = {};
  try {
    salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
  } catch {}
  const e = { ...PADRAO, ...salvo, destaques: { ...PADRAO.destaques, ...salvo.destaques }, ...pedidoDaUrl };
  if (!UF_POR_SIGLA[e.uf]) e.uf = PADRAO.uf;
  if (!REGIOES[e.regiao]) e.regiao = PADRAO.regiao;
  if (!CENAS.some((c) => c.id === e.cena)) e.cena = PADRAO.cena;
  return e;
}

// Lista de cenas do rodízio vinda de um aparelho ainda no 1º turno (senador, deputados...): volta ao padrão.
const cenasValidas = (ids) => (Array.isArray(ids) && ids.every((id) => CENAS.some((c) => c.id === id)) ? ids : PADRAO.cenasAtivas);

export const estado = carregar();

const canal = 'BroadcastChannel' in window ? new BroadcastChannel('sinal-telao') : null;
const ouvintes = new Set();

// f(estado, alteracao, remoto) é chamada a cada mudança, local ou vinda de outro aparelho/janela.
export const aoMudar = (f) => ouvintes.add(f);

function aplicar(alteracao, remoto) {
  if ('cenasAtivas' in alteracao) alteracao = { ...alteracao, cenasAtivas: cenasValidas(alteracao.cenasAtivas) };
  Object.assign(estado, alteracao);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {}
  ouvintes.forEach((f) => f(estado, alteracao, remoto));
}

export function definir(alteracao) {
  canal?.postMessage(alteracao);
  enviarAoServidor(alteracao);
  aplicar(alteracao, false);
}

export function restaurarPadrao() {
  definir(structuredClone(PADRAO));
}

if (canal) canal.onmessage = (e) => aplicar(e.data, true);

// --- controle por outros aparelhos (celular) ---------------------------------------
// O servidor guarda o estado do telão. No computador do estúdio ele avisa os aparelhos
// na hora (eventos); na Vercel cada aparelho consulta de 2 em 2 segundos.
const API = '/api/controle';
const MEU_ID = Math.random().toString(36).slice(2);
const CONSULTA_MS = 2000;
export const rede = { ligada: false, enderecos: [], aoVivo: false, banco: false };
const aoLigarRede = new Set();
export const aoMudarRede = (f) => aoLigarRede.add(f);
let versaoConhecida = 0;
let redeConhecida = '';

function enviarAoServidor(alteracao) {
  if (!rede.ligada) return;
  fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alteracao, origem: MEU_ID, versaoConhecida }) })
    .then((r) => r.json())
    .then((d) => (versaoConhecida = Math.max(versaoConhecida, d.versao || 0)))
    .catch(() => {});
}

// O que veio do servidor ao entrar: o pedido da URL deste aparelho vale mais (e segue para os outros).
let primeira = true;
function receber(alteracao) {
  if (primeira && Object.keys(pedidoDaUrl).length) {
    alteracao = { ...alteracao, ...pedidoDaUrl };
    enviarAoServidor(pedidoDaUrl);
  }
  primeira = false;
  if (alteracao && Object.keys(alteracao).length) aplicar(alteracao, true);
}

async function consultar() {
  try {
    const d = await (await fetch(API, { cache: 'no-store' })).json();
    if (d.rede !== redeConhecida) {
      // O aparelho trocou de rede (ex.: Wi-Fi → 4G): passa a seguir o telão da rede nova,
      // sem levar para ela o estado da rede antiga.
      redeConhecida = d.rede;
      versaoConhecida = d.versao || 0;
      if (d.versao) receber(d.estado);
    } else if (d.versao > versaoConhecida) {
      versaoConhecida = d.versao;
      if (d.origem !== MEU_ID) receber(d.estado);
    } else if (d.versao < versaoConhecida) {
      // O servidor perdeu o estado (função reiniciada): este aparelho devolve o que sabe.
      enviarAoServidor(estado);
    }
  } catch {}
}

async function ligarRede() {
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    Object.assign(rede, { ligada: true, enderecos: d.enderecos || [], aoVivo: !!d.eventos, banco: !!d.banco });
    versaoConhecida = d.versao || 0;
    redeConhecida = d.rede;
    // Primeiro aparelho a chegar: o estado dele vira o do servidor.
    if (!d.versao) enviarAoServidor(estado);
    // Consulta periódica: usada na Vercel e quando a hospedagem segura os eventos (alguns proxies fazem isso).
    let consultando = false;
    const consultarSempre = () => {
      if (consultando) return;
      consultando = true;
      rede.aoVivo = false;
      setInterval(consultar, CONSULTA_MS);
      aoLigarRede.forEach((f) => f(rede));
    };
    if (d.eventos) {
      const eventos = new EventSource(`${API}/eventos`);
      let chegou = false;
      eventos.onmessage = (e) => {
        chegou = true;
        const m = JSON.parse(e.data);
        versaoConhecida = Math.max(versaoConhecida, m.versao || 0);
        receber(m.origem === MEU_ID ? null : m.alteracao);
      };
      // Se a primeira mensagem não chegar em 8 s, os eventos não passam por esta hospedagem.
      setTimeout(() => {
        if (chegou) return;
        eventos.close();
        if (d.versao) receber(d.estado);
        consultarSempre();
      }, 8000);
    } else {
      if (d.versao) receber(d.estado);
      consultarSempre();
    }
    aoLigarRede.forEach((f) => f(rede));
  } catch {}
}
ligarRede();

export const cidadeAtiva = () => (estado.abrangencia === 'cidade' && estado.cidade ? estado.cidade : '');
export const tituloDestaques = () => estado.destaques.titulo || `Candidatos de ${estado.cidade || UF_POR_SIGLA[estado.uf].nome}`;
