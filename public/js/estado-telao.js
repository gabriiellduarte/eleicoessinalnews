// Estado do telão (cena, estado, cidade, destaques...). Fica no localStorage e é
// sincronizado entre janelas do MESMO navegador por BroadcastChannel: é assim
// que a página de controle comanda o telão aberto em outro monitor.
import { CONFIG } from './config.js';
import { UF_POR_SIGLA, CARGOS } from './ufs.js';

export const CENAS = [
  { id: 'presidente', nome: 'Presidente', tipo: 'majoritario', cargo: 'presidente' },
  { id: 'mapa', nome: 'Mapa Brasil', tipo: 'mapa', cargo: 'presidente' },
  { id: 'governador', nome: 'Governador', tipo: 'majoritario', cargo: 'governador' },
  { id: 'senador', nome: 'Senador', tipo: 'majoritario', cargo: 'senador' },
  { id: 'depfederal', nome: 'Dep. Federal', tipo: 'proporcional', cargo: 'depfederal' },
  { id: 'depestadual', nome: 'Dep. Estadual', tipo: 'proporcional', cargo: 'depestadual' },
  { id: 'destaques', nome: 'Destaques', tipo: 'destaques', cargo: 'depfederal' },
];

const CHAVE = 'sinal-telao-estado';
const PADRAO = {
  cena: 'presidente',
  rodizio: true,
  tempo: CONFIG.telao.segundosPorCena,
  cenasAtivas: CENAS.map((c) => c.id),
  uf: CONFIG.ufDestaque,
  // De onde vêm os votos: 'br' = Brasil todo (Presidente soma o país; os outros cargos, o estado)
  // | 'uf' = só o estado escolhido, inclusive Presidente | 'cidade' = só a cidade
  abrangencia: 'br',
  // Cenas de deputados: 'top' = 10 mais votados | 'top20' | 'top30' | 'top50' | 'vagas' = todas as
  // cadeiras do estado | 'escolhidos' = só os candidatos em destaque
  deputados: 'top',
  cidade: CONFIG.destaques.cidade,
  destaques: {
    titulo: CONFIG.destaques.titulo,
    // um texto "número, número" por cargo
    ...Object.fromEntries(Object.keys(CARGOS).map((c) => [c, (CONFIG.destaques[c] || []).join(', ')])),
  },
};

function carregar() {
  let salvo = {};
  try {
    salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
  } catch {}
  const e = { ...PADRAO, ...salvo, destaques: { ...PADRAO.destaques, ...salvo.destaques } };
  // A URL tem prioridade sobre o que ficou salvo.
  const p = new URLSearchParams(location.search);
  if (p.get('uf') && UF_POR_SIGLA[p.get('uf').toUpperCase()]) e.uf = p.get('uf').toUpperCase();
  if (p.get('cidade')) Object.assign(e, { cidade: p.get('cidade'), abrangencia: 'cidade' });
  if (Number(p.get('tempo')) > 0) e.tempo = Number(p.get('tempo'));
  if (CENAS.some((c) => c.id === p.get('cena'))) Object.assign(e, { cena: p.get('cena'), rodizio: false });
  if (!UF_POR_SIGLA[e.uf]) e.uf = PADRAO.uf;
  if (!CENAS.some((c) => c.id === e.cena)) e.cena = PADRAO.cena;
  return e;
}

export const estado = carregar();

const canal = 'BroadcastChannel' in window ? new BroadcastChannel('sinal-telao') : null;
const ouvintes = new Set();

// f(estado, alteracao, remoto) é chamada a cada mudança, local ou vinda de outra janela.
export const aoMudar = (f) => ouvintes.add(f);

export function definir(alteracao) {
  Object.assign(estado, alteracao);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {}
  canal?.postMessage(alteracao);
  ouvintes.forEach((f) => f(estado, alteracao, false));
}

export function restaurarPadrao() {
  definir(structuredClone(PADRAO));
}

if (canal) {
  canal.onmessage = (e) => {
    Object.assign(estado, e.data);
    ouvintes.forEach((f) => f(estado, e.data, true));
  };
}

export const cidadeAtiva = () => (estado.abrangencia === 'cidade' && estado.cidade ? estado.cidade : '');
export const tituloDestaques = () => estado.destaques.titulo || `Candidatos de ${estado.cidade || UF_POR_SIGLA[estado.uf].nome}`;
