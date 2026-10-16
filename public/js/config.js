// Configuração central da apuração. Tudo que muda no dia da eleição está aqui.
export const CONFIG = {
  // Estado mostrado em Governador/Senador/Deputados por padrão (URL: ?uf=CE)
  ufDestaque: 'CE',
  turno: 2,

  // Disputas do 2º turno (25/10/2026), conforme o resultado do 1º turno publicado pelo TSE:
  // números de urna de quem continua na disputa. Governador só tem 2º turno nestes estados.
  segundoTurno: {
    presidente: ['22', '13'], // Flávio Bolsonaro (PL) × Lula (PT)
    governador: {
      AC: ['11', '10'], // Mailza Assis (PP) × Alan Rick (Republicanos)
      AM: ['55', '22'], // Omar Aziz (PSD) × Professora Maria do Carmo (PL)
      DF: ['11', '13'], // Celina Leão (PP) × Leandro Grass (PT)
      ES: ['10', '15'], // Lorenzo Pazolini (Republicanos) × Ricardo Ferraço (MDB)
      RN: ['44', '13'], // Allyson (União) × Cadu de Lula (PT)
      TO: ['44', '45'], // Professora Dorinha (União) × Vicentinho Júnior (PSDB)
    },
  },

  // Candidatos acompanhados de perto, de qualquer cargo (ex.: os deputados da cidade da emissora).
  // Informe o NÚMERO de urna de cada um. No telão, o painel de controle (tecla C)
  // permite buscar os candidatos pelo nome e trocar a cidade sem mexer neste arquivo.
  destaques: {
    titulo: '', // vazio = "Candidatos de <cidade>"
    cidade: 'Aracati',
    presidente: [],
    governador: [],
  },

  // Tentados em ordem; se nenhum carregar, aparece o nome "SINAL NEWS" em texto.
  logo: [
    'assets/logo-sinal-news.webp',
    'https://sinalnews.com.br/wp-content/uploads/2020/08/SINAL-NEWS-VERMELHO-cor.png',
  ],

  // Candidatos e municípios oficiais (DivulgaCandContas/TSE), servidos pelo server.js.
  // A eleição consultada é definida no servidor (cadastro.js).
  cadastro: { base: '/api/cadastro' },

  tse: {
    // Com o server.js rodando, '/api/tse' é o proxy com cache.
    // Em hospedagem estática, use 'https://resultados.tse.jus.br' (depende de CORS do TSE).
    base: '/api/tse',
    ambiente: 'oficial', // 'oficial' no dia; 'simulado' nos testes públicos do TSE
    ciclo: 'ele2026',
    // Códigos de eleição de 2026 (comum/config/ele-c.json do TSE):
    //   1º turno: 6257 = Federal (Presidente), 6259 = Estadual (Governador, Senador, Deputados)
    //   2º turno: 6258 = Federal (Presidente), 6260 = Estadual (Governador)
    // Rode `node scripts/sondar-tse.js` para ver o que já está no ar.
    eleicao: { presidente: '6258', governador: '6260' },
    cargo: { presidente: '0001', governador: '0003', senador: '0005', depfederal: '0006', depestadual: '0007', depdistrital: '0008' },
    // 'auto' tenta o layout de 2024 (dados/...-u.json) e depois o de 2022 (dados-simplificados/...-r.json)
    formato: 'auto',
    // Código TSE dos municípios (NÃO é o do IBGE). Vem sozinho do cadastro do TSE;
    // preencha aqui só se a busca automática falhar. Ex.: { CE: { Aracati: '13218' } }
    municipios: {},
  },

  // De quanto em quanto tempo a tela busca dados novos (o servidor guarda cada arquivo do TSE por 10 s).
  atualizacao: { tseMs: 10000 },

  telao: { segundosPorCena: 15 },
};

// Estados com Governador em disputa no 2º turno.
export const UFS_GOVERNADOR = Object.keys(CONFIG.segundoTurno.governador);
// Números de urna de quem disputa o 2º turno (vazio = sem disputa neste estado).
export const numerosNaDisputa = (cargo, uf) => (cargo === 'presidente' ? CONFIG.segundoTurno.presidente : CONFIG.segundoTurno.governador[uf] || []);
export const temDisputa = (cargo, uf) => cargo === 'presidente' || UFS_GOVERNADOR.includes(uf);

const p = new URLSearchParams(location.search);
if (/^[a-zA-Z]{2}$/.test(p.get('uf') || '')) CONFIG.ufDestaque = p.get('uf').toUpperCase();
if (Number(p.get('tempo')) > 0) CONFIG.telao.segundosPorCena = Number(p.get('tempo'));
