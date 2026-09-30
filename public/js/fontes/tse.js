// Fonte de dados OFICIAL: arquivos JSON de resultados do TSE.
// Converte os dois layouts conhecidos para o formato usado pelas telas:
//   2024: {raiz}/dados/{uf}/{uf}{mun}-c{cargo}-e{eleicao}-u.json
//   2022: {raiz}/dados-simplificados/{uf}/{uf}{mun}-c{cargo}-e{eleicao}-r.json
//   ({mun} = código TSE do município; vazio para o resultado do estado/país)
// O layout de 2026 só pode ser confirmado quando o TSE publicar os arquivos;
// se mudar, o ajuste fica restrito a `urls()` e `normalizar()`.
import { CONFIG } from '../config.js';
import { UFS, vagasDe, nomeLocal, semAcento } from '../ufs.js';
import { cadastro, nomeProprio } from './cadastro.js';

const T = CONFIG.tse;

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
}

function dataHora(dg, hg) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dg || '');
  if (!m) return new Date();
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${hg || '00:00:00'}`);
  return isNaN(d) ? new Date() : d;
}

const codigoCargo = (cargo, uf) => (cargo === 'depestadual' && uf === 'DF' ? T.cargo.depdistrital : T.cargo[cargo]);

function codigos(cargo) {
  const ele = String(T.eleicao[cargo] || '');
  if (!ele) throw new Error(`Código da eleição de ${cargo} não configurado (config.js → tse.eleicao).`);
  return { ele, ele6: ele.padStart(6, '0'), raiz: `${T.base}/${T.ambiente}/${T.ciclo}/${ele}` };
}

// Endereços a tentar, em ordem: a eleição configurada para o cargo e, depois, as outras
// (o TSE pode publicar senador/deputados na eleição federal ou na estadual).
function urls(cargo, uf, codMunicipio) {
  const u = uf.toLowerCase();
  const eleicoes = [...new Set([codigos(cargo).ele, ...Object.values(T.eleicao).filter(Boolean).map(String)])];
  return eleicoes.flatMap((ele) => {
    const raiz = `${T.base}/${T.ambiente}/${T.ciclo}/${ele}`;
    const arq = `${u}${codMunicipio}-c${codigoCargo(cargo, uf)}-e${ele.padStart(6, '0')}`;
    const f2024 = `${raiz}/dados/${u}/${arq}-u.json`;
    const f2022 = `${raiz}/dados-simplificados/${u}/${arq}-r.json`;
    return T.formato === '2024' ? [f2024] : T.formato === '2022' ? [f2022] : [f2024, f2022];
  });
}

// --- municípios ---------------------------------------------------------------
// Códigos TSE vindos do cadastro oficial; `tse.municipios` (config.js) tem prioridade.
async function municipios(uf) {
  const manual = Object.entries(T.municipios[uf] || {}).map(([nome, codigo]) => ({ nome, codigo: String(codigo) }));
  const oficiais = await cadastro.municipios(uf).catch(() => []);
  const vistos = new Set(manual.map((m) => semAcento(m.nome)));
  return [...manual, ...oficiais.filter((m) => !vistos.has(semAcento(m.nome)))];
}

async function codigoMunicipio(uf, cidade) {
  const alvo = semAcento(cidade);
  const achado = (await municipios(uf)).find((m) => semAcento(m.nome) === alvo);
  if (!achado) throw new Error(`Município "${cidade}" não encontrado na lista do TSE (config.js → tse.municipios).`);
  return achado.codigo;
}

// --- conversão ------------------------------------------------------------------
function listaCandidatos(d, cargo, uf) {
  if (!d.carg) return (d.cand || []).map((c) => ({ ...c, _partido: String(c.cc || '').split(' - ')[0] }));
  const cargos = Array.isArray(d.carg) ? d.carg : [d.carg];
  const alvo = cargos.find((c) => String(c.cd).padStart(4, '0') === codigoCargo(cargo, uf)) || cargos[0];
  const saida = [];
  for (const agr of alvo?.agr || []) {
    for (const par of agr.par || []) {
      for (const c of par.cand || []) saida.push({ ...c, _partido: par.sg || '' });
    }
  }
  return saida;
}

function normalizar(d, cargo, uf, cidade) {
  // No layout de 2022 `s` e `e` são números soltos; no de 2024 são objetos.
  const grupo = (x) => (x && typeof x === 'object' ? x : d);
  const s = grupo(d.s);
  const e = grupo(d.e);
  const v = grupo(d.v);
  const { raiz } = codigos(cargo);
  const candidatos = listaCandidatos(d, cargo, uf)
    .map((c) => {
      // Na abrangência de cidade a situação do TSE continua sendo a da disputa inteira.
      const situacao = c.st || '';
      return {
        numero: String(c.n),
        nome: c.nmu || c.nm || '',
        partido: c._partido,
        // `vs` traz vice (tp "v") ou suplentes de senador; só o vice vai para a tela.
        vice: c.nv || (c.vs || []).find((x) => x.tp === 'v')?.nmu || '',
        votos: num(c.vap),
        pct: num(c.pvap),
        situacao,
        eleito: String(c.e || '').toLowerCase() === 's' || /^eleit/i.test(situacao),
        foto: c.sqcand ? `${raiz}/fotos/${uf.toLowerCase()}/${c.sqcand}.jpeg` : '',
      };
    })
    // Empate (inclusive todos zerados antes da apuração): ordem alfabética.
    .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR'));
  candidatos.forEach((c, i) => (c.pos = i + 1));
  const pctSecoes = num(s.pst);
  const vagasNoArquivo = num((Array.isArray(d.carg) ? d.carg[0] : d.carg)?.nv);
  return {
    fonte: 'tse',
    // O TSE publica os arquivos zerados antes do início da totalização.
    aguardando: num(s.st) === 0,
    cargo,
    uf,
    cidade: cidade || '',
    local: nomeLocal(uf, cidade),
    vagas: vagasNoArquivo || vagasDe(cargo, uf),
    pctSecoes,
    secoes: num(s.ts ?? d.s),
    secoesTotalizadas: num(s.st),
    eleitorado: num(e.te ?? d.e),
    comparecimento: num(e.c),
    pctComparecimento: num(e.pc),
    abstencao: num(e.a),
    pctAbstencao: num(e.pa),
    brancos: num(v.vb),
    pctBrancos: num(v.pvb),
    nulos: num(v.tvn ?? v.vn),
    pctNulos: num(v.ptvn ?? v.pvn),
    validos: num(v.vv ?? v.vvc),
    encerrada: pctSecoes >= 100,
    atualizadoEm: dataHora(d.dg, d.hg),
    candidatos,
  };
}

const candidatosOficiais = (cargo, uf) => cadastro.candidatos(cargo, cargo === 'presidente' ? 'BR' : uf).catch(() => []);

// Nome em grafia normal e foto vêm do cadastro oficial, casados pelo número de urna.
async function enriquecer(r) {
  const porNumero = new Map((await candidatosOficiais(r.cargo, r.uf)).map((c) => [c.numero, c]));
  for (const c of r.candidatos) {
    const oficial = porNumero.get(c.numero);
    if (oficial) Object.assign(c, { nome: oficial.nome, foto: oficial.foto, partido: c.partido || oficial.partido });
    else c.nome = nomeProprio(c.nome);
  }
  r.candidatos.forEach((c) => (c.vice = nomeProprio(c.vice)));
  return r;
}

// Antes de o TSE publicar os arquivos: candidatos oficiais com zero voto.
async function aguardando(cargo, uf, cidade) {
  const lista = await candidatosOficiais(cargo, uf);
  if (!lista.length) throw new Error(`TSE ainda sem dados para ${cargo} em ${nomeLocal(uf, cidade)}.`);
  const zero = { pctSecoes: 0, secoes: 0, secoesTotalizadas: 0, eleitorado: 0, comparecimento: 0, pctComparecimento: 0, abstencao: 0, pctAbstencao: 0, brancos: 0, pctBrancos: 0, nulos: 0, pctNulos: 0, validos: 0 };
  return {
    fonte: 'tse',
    aguardando: true,
    cargo,
    uf,
    cidade: cidade || '',
    local: nomeLocal(uf, cidade),
    vagas: vagasDe(cargo, uf),
    ...zero,
    encerrada: false,
    atualizadoEm: new Date(),
    candidatos: lista
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((c, i) => ({ numero: c.numero, nome: c.nome, partido: c.partido, vice: c.vice, foto: c.foto, votos: 0, pct: 0, situacao: '', eleito: false, pos: i + 1 })),
  };
}

// Lembra qual endereço respondeu para cada cargo, para tentá-lo primeiro nas próximas vezes.
const indiceBom = {};
const ultimos = new Map();

async function buscar(cargo, uf, cidade = '') {
  const chave = `${cargo}|${uf}|${cidade}`;
  const lista = urls(cargo, uf, cidade ? await codigoMunicipio(uf, cidade) : '');
  const ordem = lista.map((_, i) => i).sort((a, b) => (b === indiceBom[cargo]) - (a === indiceBom[cargo]));
  for (const i of ordem) {
    const r = await fetch(lista[i], { cache: 'no-store' }).catch(() => null);
    if (r?.ok) {
      indiceBom[cargo] = i;
      const resultado = await enriquecer(normalizar(await r.json(), cargo, uf, cidade));
      ultimos.set(chave, resultado);
      return resultado;
    }
  }
  // Falha passageira no meio da apuração: mantém o último resultado bom, nunca volta a zero.
  return ultimos.get(chave) || aguardando(cargo, uf, cidade);
}

export const tse = {
  id: 'tse',
  intervaloMs: CONFIG.atualizacao.tseMs,
  resultado: buscar,
  async mapa(cargo) {
    const res = await Promise.allSettled(UFS.map((u) => buscar(cargo, u.sigla)));
    const saida = {};
    res.forEach((r, i) => {
      if (r.status === 'fulfilled') saida[UFS[i].sigla] = r.value;
    });
    if (!Object.keys(saida).length) throw new Error('TSE ainda sem dados por estado.');
    return saida;
  },
  async cidades(uf) {
    return (await municipios(uf)).map((m) => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },
};
