// Fonte de dados SIMULADA. Os candidatos e as cidades são os oficiais do TSE
// (cadastro.js); os VOTOS são fictícios, sorteados a partir do número de cada
// candidato — não são resultado, pesquisa nem previsão.
// A simulação é função do relógio: todos os aparelhos veem o mesmo estado.
// Entrega o mesmo formato que a fonte do TSE.
import { CONFIG } from '../config.js';
import { UFS, UF_POR_SIGLA, CARGOS, vagasDe, nomeLocal, semAcento } from '../ufs.js';
import { cadastro } from './cadastro.js';

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function rng(semente) {
  let a = hash(semente);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Número entre 0 e 1, sempre o mesmo para a mesma chave.
const sorteio = (chave) => rng(chave)();

// --- candidatos de reserva (só se o cadastro do TSE estiver inacessível) -------
const PARTIDOS = ['PAB', 'PDN', 'MUB', 'PLS', 'UNP', 'PRV', 'PVS', 'FDB'];
const NOMES = ['Adriana', 'Bruno', 'Camila', 'Dênis', 'Elaine', 'Fábio', 'Glória', 'Heitor', 'Ivone', 'Júlio', 'Karina', 'Leandro', 'Marta', 'Nélson', 'Olívia', 'Paulo', 'Raquel', 'Sérgio', 'Tânia', 'Vítor', 'Wanda', 'Xavier', 'Yara', 'Zeca'];
const SOBRENOMES = ['Albuquerque', 'Bezerra', 'Cavalcante', 'Dantas', 'Esteves', 'Fontenele', 'Gurgel', 'Holanda', 'Ibiapina', 'Jucá', 'Lacerda', 'Mesquita', 'Nóbrega', 'Oliveira', 'Pinheiro', 'Queiroz', 'Rangel', 'Sampaio', 'Teles', 'Uchoa', 'Valente', 'Ximenes', 'Zanetti', 'Moreira'];

function ficticios(cargo, uf) {
  const r = rng(`ficticios|${cargo}|${uf}`);
  const pares = NOMES.flatMap((n) => SOBRENOMES.map((s) => `${n} ${s}`))
    .map((v) => [r(), v])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
  const total = CARGOS[cargo].proporcional ? Math.min(320, vagasDe(cargo, uf) * 5) : { presidente: 6, governador: 5, senador: 7 }[cargo];
  const primeiro = { presidente: 11, governador: 11, senador: 101, depfederal: 1001, depestadual: 10001 }[cargo];
  const passo = { presidente: 9, governador: 9, senador: 111, depfederal: 7, depestadual: 13 }[cargo];
  return Array.from({ length: total }, (_, i) => ({
    numero: String(primeiro + i * passo),
    nome: pares[i],
    partido: PARTIDOS[Math.floor(r() * PARTIDOS.length)],
    foto: '',
  }));
}

// --- cenário: o resultado final sorteado para cada disputa ------------------
const cenarios = new Map();
const chave = (cargo, uf) => `${cargo}|${uf}`;

function cenario(cargo, uf) {
  const k = chave(cargo, uf);
  if (!cenarios.has(k)) {
    const promessa = montarCenario(cargo, uf);
    cenarios.set(k, promessa);
    // Sem o cadastro do TSE o cenário sai com nomes fictícios: tenta de novo em 30 s.
    promessa.then((c) => c.oficial || setTimeout(() => cenarios.delete(k), 30000));
  }
  return cenarios.get(k);
}

async function montarCenario(cargo, uf) {
  const nacional = CARGOS[cargo].nacional;
  let lista = await cadastro.candidatos(cargo, nacional ? 'BR' : uf).catch(() => []);
  const oficial = lista.length > 0;
  if (!oficial) lista = ficticios(cargo, nacional ? 'BR' : uf);

  const regiao = UF_POR_SIGLA[uf].regiao;
  const proporcional = CARGOS[cargo].proporcional;
  // Peso sorteado de cada candidato. Deputados: poucos puxadores de voto e uma cauda longa.
  // Majoritários: disputa mais concentrada.
  const base = lista.map((c) => {
    const u = sorteio(`peso|${cargo}|${nacional ? 'BR' : uf}|${c.numero}`);
    return proporcional ? Math.exp(4.5 * u * u) : Math.exp(3 * u);
  });
  // Roteiro do ensaio (config.js → sim.roteiro): percentuais fixados à mão para alguns números;
  // os demais candidatos dividem o restante conforme o sorteio.
  const roteiro = CONFIG.sim.roteiro?.[cargo] || {};
  const fixados = lista.map((c) => Number(roteiro[c.numero]) / 100 || 0);
  const somaFixada = Math.min(0.95, fixados.reduce((a, b) => a + b, 0));
  const somaLivre = base.reduce((s, p, i) => s + (fixados[i] ? 0 : p), 0) || 1;
  const cands = lista.map((c, i) => {
    const n = c.numero;
    let peso = fixados[i] || (base[i] / somaLivre) * (1 - somaFixada);
    // Presidente varia por região e por estado, para o mapa não ficar de uma cor só.
    if (nacional) peso *= Math.exp((sorteio(`regiao|${regiao}|${n}`) - 0.5) * 1.6 + (sorteio(`uf|${uf}|${n}`) - 0.5) * 0.5);
    // Viés de início de apuração: faz a liderança oscilar nos primeiros boletins.
    return { ...c, final: peso, vies: (sorteio(`vies|${cargo}|${uf}|${n}`) - 0.5) * 0.5 };
  });
  const soma = cands.reduce((s, c) => s + c.final, 0);
  cands.forEach((c) => (c.final /= soma));

  const r = rng(`sinal2026|${chave(cargo, uf)}`);
  return { oficial, cands, comparecimento: 0.76 + r() * 0.06, brancos: 0.015 + r() * 0.015, nulos: 0.025 + r() * 0.02, porCidade: new Map() };
}

// Vices vêm de uma consulta mais lenta: entram na tela quando chegarem.
const vices = new Map();
function vicesDe(cargo, uf) {
  const k = chave(cargo, uf);
  if (!vices.has(k)) {
    vices.set(k, {});
    cadastro.vices(cargo, uf).then((v) => vices.set(k, v)).catch(() => vices.delete(k));
  }
  return vices.get(k) || {};
}

// --- cidades -----------------------------------------------------------------
// Eleitorado aproximado das cidades mais acompanhadas; as demais recebem um valor sorteado.
const ELEITORADO = {
  CE: { fortaleza: 1800000, caucaia: 250000, 'juazeiro do norte': 190000, maracanau: 160000, sobral: 150000, aracati: 58000, russas: 55000, cascavel: 52000, 'morada nova': 48000, 'limoeiro do norte': 45000, beberibe: 42000, jaguaruana: 26000, icapui: 17000, fortim: 14000, palhano: 8000, itaicaba: 7000 },
};

function eleitoradoDaCidade(uf, cidade) {
  const alvo = semAcento(cidade);
  if (ELEITORADO[uf]?.[alvo]) return ELEITORADO[uf][alvo];
  if (alvo === semAcento(UF_POR_SIGLA[uf].capital)) return Math.round(UF_POR_SIGLA[uf].eleitorado * 0.22);
  return 6000 + (hash(`${uf}|${alvo}`) % 45000);
}

// Variação local de cada candidato dentro de uma cidade.
function pesosDaCidade(cen, cidade) {
  const alvo = semAcento(cidade);
  if (!cen.porCidade.has(alvo)) cen.porCidade.set(alvo, cen.cands.map((c) => Math.exp((sorteio(`${alvo}|${c.numero}`) - 0.5) * 1.6)));
  return cen.porCidade.get(alvo);
}

const ritmos = new Map();
function progressoUf(uf, g) {
  if (!ritmos.has(uf)) {
    const r = rng(`ritmo|${uf}`);
    ritmos.set(uf, { atraso: r() * 0.12, folga: r() * 0.15, curva: 0.6 + r() * 1.0 });
  }
  const { atraso, folga, curva } = ritmos.get(uf);
  const x = Math.min(1, Math.max(0, (g - atraso) / (1 - atraso - folga)));
  return Math.pow(x, curva);
}

// --- relógio da simulação -------------------------------------------------
const CHAVE_RELOGIO = 'sinal-apuracao-sim';
function lerRelogio() {
  try {
    return { t0: 0, vel: 1, ...JSON.parse(localStorage.getItem(CHAVE_RELOGIO) || '{}') };
  } catch {
    return { t0: 0, vel: 1 };
  }
}
function gravarRelogio(r) {
  try {
    localStorage.setItem(CHAVE_RELOGIO, JSON.stringify(r));
  } catch {}
}
let relogio = lerRelogio();
// Outra janela (ex.: o controle) mexeu no relógio da simulação.
addEventListener('storage', (e) => {
  if (e.key === CHAVE_RELOGIO) relogio = lerRelogio();
});

function fracaoGlobal() {
  const duracao = CONFIG.sim.duracaoMin * 60000;
  const ciclo = duracao + CONFIG.sim.pausaFinalSeg * 1000;
  const decorrido = ((Date.now() - relogio.t0) * relogio.vel) % ciclo;
  return Math.min(1, decorrido / duracao);
}

// --- montagem dos resultados ----------------------------------------------
function parcial(cen, cargo, uf, g, cidade) {
  const eleitorado = cidade ? eleitoradoDaCidade(uf, cidade) : UF_POR_SIGLA[uf].eleitorado;
  let p = progressoUf(uf, g);
  if (cidade) p = Math.pow(p, 0.6 + (hash(semAcento(cidade)) % 100) / 100);
  const secoes = Math.max(1, Math.round(eleitorado / 330));
  // Senador: dois votos por eleitor. Deputados: parte dos válidos vai para a legenda.
  const fator = cargo === 'senador' ? 1.8 : CARGOS[cargo].proporcional ? 0.9 : 1;
  const validosDe = (frac) => {
    const comp = Math.round(eleitorado * cen.comparecimento * frac);
    const brancos = Math.round(comp * cen.brancos);
    const nulos = Math.round(comp * cen.nulos);
    return { comp, brancos, nulos, validos: (comp - brancos - nulos) * fator };
  };
  const agora = validosDe(p);
  const locais = cidade ? pesosDaCidade(cen, cidade) : null;
  const pesos = cen.cands.map((c, i) => c.final * Math.exp(c.vies * (1 - p)) * (locais ? locais[i] : 1));
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const eleitoradoApurado = Math.round(eleitorado * p);
  return {
    secoes,
    secoesTotalizadas: Math.round(secoes * p),
    eleitorado,
    eleitoradoApurado,
    comparecimento: agora.comp,
    abstencao: eleitoradoApurado - agora.comp,
    brancos: agora.brancos,
    nulos: agora.nulos,
    validosFinais: validosDe(1).validos,
    candidatos: cen.cands.map((c, i) => ({
      numero: c.numero,
      nome: c.nome,
      partido: c.partido,
      vice: c.vice || '',
      foto: c.foto,
      votos: Math.round((agora.validos * pesos[i]) / somaPesos),
    })),
  };
}

function somar(partes) {
  const total = { ...partes[0], candidatos: partes[0].candidatos.map((c) => ({ ...c })) };
  for (const parte of partes.slice(1)) {
    for (const k of ['secoes', 'secoesTotalizadas', 'eleitorado', 'eleitoradoApurado', 'comparecimento', 'abstencao', 'brancos', 'nulos', 'validosFinais']) total[k] += parte[k];
    parte.candidatos.forEach((c, i) => (total.candidatos[i].votos += c.votos));
  }
  return total;
}

const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);

function fechar(cargo, uf, cidade, bruto, comVice) {
  const vagas = vagasDe(cargo, uf);
  const validos = bruto.candidatos.reduce((s, c) => s + c.votos, 0);
  const nomesVice = comVice ? vicesDe(cargo, uf) : {};
  const candidatos = bruto.candidatos
    .map((c) => ({ ...c, vice: nomesVice[c.numero] || c.vice, pct: pct(c.votos, validos), situacao: '', eleito: false }))
    .sort((a, b) => b.votos - a.votos);
  candidatos.forEach((c, i) => (c.pos = i + 1));
  const encerrada = bruto.secoesTotalizadas >= bruto.secoes;
  // Ninguém é eleito "na cidade": situação só existe na abrangência da disputa.
  if (cidade || validos <= 0) {
    // sem situação
  } else if (vagas === 1) {
    const lider = candidatos[0];
    if (lider.votos > bruto.validosFinais / 2) {
      lider.eleito = true;
      lider.situacao = encerrada ? 'Eleito' : 'Matematicamente eleito';
    } else if (encerrada && candidatos[1]) {
      candidatos[0].situacao = candidatos[1].situacao = '2º turno';
    }
  } else if (encerrada) {
    // Simplificação: nos deputados a eleição real depende do quociente partidário.
    candidatos.slice(0, vagas).forEach((c) => {
      c.eleito = true;
      c.situacao = 'Eleito';
    });
  }
  return {
    fonte: 'sim',
    cargo,
    uf,
    cidade: cidade || '',
    local: nomeLocal(uf, cidade),
    vagas,
    pctSecoes: pct(bruto.secoesTotalizadas, bruto.secoes),
    secoes: bruto.secoes,
    secoesTotalizadas: bruto.secoesTotalizadas,
    eleitorado: bruto.eleitorado,
    comparecimento: bruto.comparecimento,
    pctComparecimento: pct(bruto.comparecimento, bruto.eleitoradoApurado),
    abstencao: bruto.abstencao,
    pctAbstencao: pct(bruto.abstencao, bruto.eleitoradoApurado),
    brancos: bruto.brancos,
    pctBrancos: pct(bruto.brancos, bruto.comparecimento),
    nulos: bruto.nulos,
    pctNulos: pct(bruto.nulos, bruto.comparecimento),
    validos,
    encerrada,
    atualizadoEm: new Date(),
    candidatos,
  };
}

// `comVice` só nas telas de resultado: no mapa (27 estados) a consulta de vices seria pesada demais.
async function resultado(cargo, uf, cidade, g, comVice) {
  const temVice = comVice && (cargo === 'presidente' || cargo === 'governador');
  if (uf === 'BR') {
    const cens = await Promise.all(UFS.map((u) => cenario(cargo, u.sigla)));
    return { ...fechar(cargo, 'BR', '', somar(UFS.map((u, i) => parcial(cens[i], cargo, u.sigla, g))), temVice), oficial: cens[0].oficial };
  }
  const cen = await cenario(cargo, uf);
  const bruto = parcial(cen, cargo, uf, g, cidade);
  // Os vices de presidente estão cadastrados no "BR", mesmo vendo os votos de um estado.
  const r = { ...fechar(cargo, uf, cidade, bruto, false), oficial: cen.oficial };
  if (temVice) {
    const nomes = vicesDe(cargo, CARGOS[cargo].nacional ? 'BR' : uf);
    r.candidatos.forEach((c) => (c.vice = nomes[c.numero] || c.vice));
  }
  return r;
}

export const simulador = {
  id: 'sim',
  intervaloMs: CONFIG.atualizacao.simMs,
  resultado: (cargo, uf, cidade = '') => resultado(cargo, uf, cidade, fracaoGlobal(), true),
  async mapa(cargo) {
    const g = fracaoGlobal();
    const lista = await Promise.all(UFS.map((u) => resultado(cargo, u.sigla, '', g, false)));
    return Object.fromEntries(UFS.map((u, i) => [u.sigla, lista[i]]));
  },
  // Todos os municípios do estado, na grafia do TSE.
  async cidades(uf) {
    const lista = await cadastro.municipios(uf).catch(() => []);
    const nomes = lista.length ? lista.map((m) => m.nome) : [UF_POR_SIGLA[uf].capital];
    return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },
  reiniciar() {
    relogio = { ...relogio, t0: Date.now() };
    gravarRelogio(relogio);
  },
  velocidade(fator) {
    // Mantém o ponto atual da apuração ao trocar de velocidade.
    const agora = Date.now();
    const decorrido = (agora - relogio.t0) * relogio.vel;
    const vel = Math.min(16, Math.max(0.25, relogio.vel * fator));
    relogio = { t0: agora - decorrido / vel, vel };
    gravarRelogio(relogio);
    return vel;
  },
  velocidadeAtual: () => relogio.vel,
  // Relógio da simulação, para o controle remoto levar reinício e velocidade ao telão.
  relogio: () => ({ ...relogio }),
  definirRelogio(novo) {
    relogio = { t0: Number(novo.t0) || 0, vel: Number(novo.vel) || 1 };
    gravarRelogio(relogio);
  },
};
