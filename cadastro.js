// Cadastro oficial do TSE: candidatos de 2026 (Portal de Dados Abertos, conferidos
// com o DivulgaCandContas) e municípios. Serve em /api/cadastro/* já resumido, com
// cache em memória e em disco (pasta cache/): se o TSE ficar fora do ar, o último
// dado bom continua valendo.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORIGEM = process.env.CAND_ORIGEM || 'https://divulgacandcontas.tse.jus.br/divulga/rest';
const ANO = process.env.CAND_ANO || '2026';
const ELEICAO = process.env.CAND_ELEICAO || '20322002026'; // Eleição Geral Federal 2026
// Eleição geral não lista municípios; a lista (com o código TSE) vem da municipal de 2024.
const ELEICAO_MUNICIPIOS = process.env.CAND_ELEICAO_MUNICIPIOS || '2045202024';
// Na Vercel só /tmp aceita escrita (e é temporário); o cache durável lá é o da rede (s-maxage).
const PASTA = process.env.VERCEL ? '/tmp/apuracao-cache' : path.join(__dirname, 'cache');

const CARGOS = { presidente: 1, governador: 3, senador: 5, depfederal: 6, depestadual: 7 };
const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;

// O TSE recusa requisições sem cara de navegador.
const CABECALHOS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Referer: 'https://divulgacandcontas.tse.jus.br/divulga/',
};

async function baixar(caminho, comoJson = true) {
  const r = await fetch(`${ORIGEM}/${caminho}`, { headers: CABECALHOS, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`TSE respondeu ${r.status} para ${caminho}`);
  return comoJson ? r.json() : Buffer.from(await r.arrayBuffer());
}

const memoria = new Map();
const emAndamento = new Map();

// Devolve um Buffer: memória → disco (se ainda válido) → TSE → disco vencido, nessa ordem.
function comCache(nome, validadeMs, produzir) {
  const agora = Date.now();
  const m = memoria.get(nome);
  if (m && m.expira > agora) return Promise.resolve(m.corpo);
  if (emAndamento.has(nome)) return emAndamento.get(nome);
  const arquivo = path.join(PASTA, nome);
  const tarefa = (async () => {
    let doDisco = null;
    try {
      const info = fs.statSync(arquivo);
      doDisco = fs.readFileSync(arquivo);
      if (agora - info.mtimeMs < validadeMs) {
        memoria.set(nome, { corpo: doDisco, expira: info.mtimeMs + validadeMs });
        return doDisco;
      }
    } catch {}
    try {
      const corpo = await produzir();
      try {
        fs.mkdirSync(PASTA, { recursive: true });
        fs.writeFileSync(arquivo, corpo);
      } catch (e) {
        console.warn(`[cadastro] não gravou ${nome} em disco: ${e.message}`);
      }
      memoria.set(nome, { corpo, expira: agora + validadeMs });
      return corpo;
    } catch (e) {
      if (!doDisco) throw e;
      console.warn(`[cadastro] usando cópia em disco de ${nome}: ${e.message}`);
      memoria.set(nome, { corpo: doDisco, expira: agora + MIN });
      return doDisco;
    }
  })().finally(() => emAndamento.delete(nome));
  emAndamento.set(nome, tarefa);
  return tarefa;
}

const codigoCargo = (cargo, uf) => (cargo === 'depestadual' && uf === 'DF' ? 8 : CARGOS[cargo]);
const json = (dados) => Buffer.from(JSON.stringify(dados));

async function listaBruta(uf, cargo) {
  const d = await baixar(`v1/candidatura/listar/${ANO}/${uf}/${ELEICAO}/${codigoCargo(cargo, uf)}/candidatos`);
  return (d.candidatos || []).filter((c) => c.candidatoApto !== false);
}

// --- Dados Abertos do TSE: consulta_cand_2026.zip (um CSV por UF) --------------
// https://dadosabertos.tse.jus.br/dataset/candidatos-2026
const ZIP_CANDIDATOS = process.env.CAND_ZIP || 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip';
const CARGO_VICE = { 1: '2', 3: '4' }; // presidente → vice-presidente, governador → vice-governador

// Leitor mínimo de ZIP: devolve { nomeDoArquivo: () => Buffer }.
function lerZip(buf) {
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('arquivo ZIP inválido');
  const arquivos = {};
  let p = buf.readUInt32LE(fim + 16);
  for (let k = buf.readUInt16LE(fim + 10); k > 0; k--) {
    const metodo = buf.readUInt16LE(p + 10);
    const tamanho = buf.readUInt32LE(p + 20);
    const [nNome, nExtra, nComent] = [buf.readUInt16LE(p + 28), buf.readUInt16LE(p + 30), buf.readUInt16LE(p + 32)];
    const posicao = buf.readUInt32LE(p + 42);
    arquivos[buf.toString('latin1', p + 46, p + 46 + nNome)] = () => {
      const inicio = posicao + 30 + buf.readUInt16LE(posicao + 26) + buf.readUInt16LE(posicao + 28);
      const dados = buf.subarray(inicio, inicio + tamanho);
      return metodo === 0 ? dados : zlib.inflateRawSync(dados);
    };
    p += 46 + nNome + nExtra + nComent;
  }
  return arquivos;
}

// CSV do TSE: latin1, separado por ";", textos entre aspas e números sem aspas.
function lerCsv(buf) {
  const linhas = buf.toString('latin1').split(/\r?\n/).filter(Boolean);
  const partir = (l) => {
    const campos = [];
    let atual = '';
    let entreAspas = false;
    for (const ch of l) {
      if (ch === '"') entreAspas = !entreAspas;
      else if (ch === ';' && !entreAspas) {
        campos.push(atual);
        atual = '';
      } else atual += ch;
    }
    campos.push(atual);
    return campos;
  };
  const colunas = partir(linhas[0]);
  return linhas.slice(1).map((l) => {
    const campos = partir(l);
    return Object.fromEntries(colunas.map((c, i) => [c, campos[i]]));
  });
}

let indice = null; // { zip: Buffer, porUf: { CE: [linhas] } }

// Linhas do CSV de uma UF ('BR' = presidente), só do 1º turno.
async function dadosAbertos(uf) {
  const zip = await comCache('consulta_cand_2026.zip', 6 * 60 * MIN, async () => {
    const r = await fetch(ZIP_CANDIDATOS, { headers: CABECALHOS, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`Dados Abertos do TSE respondeu ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  });
  if (indice?.zip !== zip) indice = { zip, arquivos: lerZip(zip), porUf: {} };
  if (!indice.porUf[uf]) {
    const nome = Object.keys(indice.arquivos).find((n) => n.toUpperCase().endsWith(`_${uf}.CSV`));
    if (!nome) throw new Error(`UF ${uf} não está no arquivo do TSE`);
    indice.porUf[uf] = lerCsv(indice.arquivos[nome]()).filter((l) => l.NR_TURNO === '1');
  }
  return indice.porUf[uf];
}

// Quando um número aparece mais de uma vez (substituição), fica o registro mais recente.
function maisRecentePorNumero(linhas) {
  const porNumero = new Map();
  for (const l of linhas) {
    const atual = porNumero.get(l.NR_CANDIDATO);
    if (!atual || BigInt(l.SQ_CANDIDATO) > BigInt(atual.SQ_CANDIDATO)) porNumero.set(l.NR_CANDIDATO, l);
  }
  return porNumero;
}

// Lista de candidatos: nomes, números e vices dos Dados Abertos; o DivulgaCandContas
// diz quem continua apto (o CSV traz também renúncias e substituídos).
async function montarCandidatos(uf, cargo) {
  const codigo = String(codigoCargo(cargo, uf));
  const [csv, aptos] = await Promise.all([
    dadosAbertos(uf).catch((e) => (console.warn(`[cadastro] Dados Abertos: ${e.message}`), null)),
    listaBruta(uf, cargo).catch((e) => (console.warn(`[cadastro] DivulgaCandContas: ${e.message}`), null)),
  ]);
  if (!csv) {
    if (!aptos) throw new Error('nenhuma fonte de candidatos do TSE respondeu');
    return aptos.map((c) => ({ numero: String(c.numero), nome: c.nomeUrna, partido: c.partido?.sigla || '', id: String(c.id), vice: '' }));
  }
  const doCargo = csv.filter((l) => l.CD_CARGO === codigo);
  const idsAptos = aptos && new Set(aptos.map((c) => String(c.id)));
  const titulares = idsAptos ? doCargo.filter((l) => idsAptos.has(l.SQ_CANDIDATO)) : [...maisRecentePorNumero(doCargo).values()];
  const vices = maisRecentePorNumero(csv.filter((l) => l.CD_CARGO === CARGO_VICE[codigo]));
  return titulares.map((l) => ({
    numero: l.NR_CANDIDATO,
    nome: l.NM_URNA_CANDIDATO,
    partido: l.SG_PARTIDO,
    id: l.SQ_CANDIDATO,
    vice: vices.get(l.NR_CANDIDATO)?.NM_URNA_CANDIDATO || '',
  }));
}

const rotas = {
  // [{ numero, nome, partido, id, vice }] — candidatos aptos a receber votos
  candidatos: (uf, cargo) => comCache(`candidatos-${uf}-${cargo}.json`, 15 * MIN, async () => json(await montarCandidatos(uf, cargo))),

  // { numero: nomeDoVice }
  vices: async (uf, cargo) => {
    const lista = JSON.parse(await rotas.candidatos(uf, cargo));
    return json(Object.fromEntries(lista.filter((c) => c.vice).map((c) => [c.numero, c.vice])));
  },

  // [{ nome, codigo }] — código TSE do município (não é o do IBGE)
  municipios: (uf) =>
    comCache(`municipios-${uf}.json`, 7 * DIA, async () => {
      if (uf === 'DF') return json([{ nome: 'BRASÍLIA', codigo: '97012' }]);
      const d = await baixar(`v1/eleicao/buscar/${uf}/${ELEICAO_MUNICIPIOS}/municipios`);
      const lista = (d.municipios || []).map((m) => ({ nome: m.nome, codigo: String(m.codigo) }));
      if (!lista.length) throw new Error(`lista de municípios de ${uf} veio vazia`);
      return json(lista);
    }),

  foto: (uf, id) => comCache(`foto-${uf}-${id}.jpg`, 7 * DIA, () => baixar(`arquivo/img/${ELEICAO}/${id}/${uf}`, false)),
};

const semFoto = new Map(); // fotos que falharam: não insiste por 10 minutos

// /api/cadastro/candidatos/CE/depfederal · /vices/CE/governador · /municipios/CE · /foto/CE/123
async function atender(caminho, res) {
  const [rota, ufBruta = '', extra = ''] = caminho.split('/');
  const uf = ufBruta.toUpperCase();
  const ufValida = UFS.includes(uf) || (uf === 'BR' && extra === 'presidente') || (uf === 'BR' && rota === 'foto');
  const extraValido = rota === 'municipios' ? uf !== 'BR' : rota === 'foto' ? /^\d{1,20}$/.test(extra) : extra in CARGOS;
  if (!rotas[rota] || !ufValida || !extraValido) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end('{"erro":"caminho invalido"}');
  }
  const foto = rota === 'foto';
  try {
    if (foto && semFoto.get(caminho) > Date.now()) throw new Error('sem foto');
    const corpo = await rotas[rota](uf, extra);
    res.writeHead(200, {
      'Content-Type': foto ? 'image/jpeg' : 'application/json; charset=utf-8',
      'Cache-Control': foto ? 'public, max-age=86400, s-maxage=604800' : 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
    });
    res.end(corpo);
  } catch (e) {
    if (foto) semFoto.set(caminho, Date.now() + 10 * MIN);
    res.writeHead(foto ? 404 : 502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ erro: e.message }));
  }
}

module.exports = { atender };
