// Configuração central da apuração. Tudo que muda no dia da eleição está aqui.
export const CONFIG = {
  // 'tse' = dados oficiais do TSE (padrão) | 'sim' = votos simulados, só para ensaio.
  // Troca-se pelo painel de controle do telão ou pela URL (?fonte=sim / ?fonte=tse);
  // a escolha fica guardada neste navegador.
  fonte: 'tse',

  // Estado mostrado em Governador/Senador/Deputados por padrão (URL: ?uf=CE)
  ufDestaque: 'CE',
  turno: 1,

  // Candidatos acompanhados de perto, de qualquer cargo (ex.: os deputados da cidade da emissora).
  // Informe o NÚMERO de urna de cada um. No telão, o painel de controle (tecla C)
  // permite buscar os candidatos pelo nome e trocar a cidade sem mexer neste arquivo.
  destaques: {
    titulo: '', // vazio = "Candidatos de <cidade>"
    cidade: 'Aracati',
    presidente: [],
    governador: [],
    senador: [],
    depfederal: [],
    depestadual: [],
  },

  // Tentados em ordem; se nenhum carregar, aparece o nome "SINAL NEWS" em texto.
  logo: [
    'assets/logo-sinal-news.webp',
    'https://sinalnews.com.br/wp-content/uploads/2020/08/SINAL-NEWS-VERMELHO-cor.png',
  ],

  // Candidatos e municípios oficiais (DivulgaCandContas/TSE), servidos pelo server.js.
  // A eleição consultada é definida no servidor (cadastro.js).
  cadastro: { base: '/api/cadastro' },

  sim: {
    duracaoMin: 8, // tempo para a apuração simulada ir de 0% a 100%
    pausaFinalSeg: 60, // tempo parado em 100% antes de recomeçar
    // Roteiro do ensaio: percentual aproximado dos votos válidos, por número de urna.
    // Quem não estiver aqui divide o restante por sorteio. Vale só para a simulação.
    roteiro: {
      presidente: { 22: 46 }, // 22 = Flavio Bolsonaro (PL) na frente
    },
  },

  tse: {
    // Com o server.js rodando, '/api/tse' é o proxy com cache.
    // Em hospedagem estática, use 'https://resultados.tse.jus.br' (depende de CORS do TSE).
    base: '/api/tse',
    ambiente: 'oficial', // 'oficial' no dia; 'simulado' nos testes públicos do TSE
    ciclo: 'ele2026',
    // Códigos de eleição de 2026: 6257 = Eleição Geral Federal, 6259 = Eleições Gerais Estaduais.
    // (Em 2022 eram 544 e 546, e senador e deputados ficavam na estadual.)
    // Os códigos conferem com o arquivo de candidatos dos Dados Abertos do TSE (CD_ELEICAO).
    // Em 30/09/2026 os arquivos de resultado ainda não estavam publicados.
    // Rode `node scripts/sondar-tse.js` para ver o que já está no ar.
    eleicao: { presidente: '6257', governador: '6259', senador: '6259', depfederal: '6259', depestadual: '6259' },
    cargo: { presidente: '0001', governador: '0003', senador: '0005', depfederal: '0006', depestadual: '0007', depdistrital: '0008' },
    // 'auto' tenta o layout de 2024 (dados/...-u.json) e depois o de 2022 (dados-simplificados/...-r.json)
    formato: 'auto',
    // Código TSE dos municípios (NÃO é o do IBGE). Vem sozinho do cadastro do TSE;
    // preencha aqui só se a busca automática falhar. Ex.: { CE: { Aracati: '13218' } }
    municipios: {},
  },

  // De quanto em quanto tempo a tela busca dados novos (o servidor guarda cada arquivo do TSE por 10 s).
  atualizacao: { simMs: 1000, tseMs: 10000 },

  telao: { segundosPorCena: 15 },
};

const p = new URLSearchParams(location.search);
let fonteSalva = null;
try {
  fonteSalva = localStorage.getItem('sinal-fonte');
} catch {}
if (fonteSalva === 'tse' || fonteSalva === 'sim') CONFIG.fonte = fonteSalva;
if (p.get('fonte') === 'tse' || p.get('fonte') === 'sim') CONFIG.fonte = p.get('fonte');
if (/^[a-zA-Z]{2}$/.test(p.get('uf') || '')) CONFIG.ufDestaque = p.get('uf').toUpperCase();
if (Number(p.get('tempo')) > 0) CONFIG.telao.segundosPorCena = Number(p.get('tempo'));
