// Proxy (com cache) dos arquivos de resultado do TSE, servido em /api/tse/*.
// Evita CORS e excesso de requisições ao TSE quando muita gente acessa ao mesmo tempo.
// Usado pelo server.js (computador do estúdio) e pela função api/tse.js (Vercel).
const TSE_ORIGEM = process.env.TSE_ORIGEM || 'https://resultados.tse.jus.br';
const CACHE_JSON_S = Number(process.env.TSE_CACHE_S || 10);
const CACHE_FOTO_S = 24 * 60 * 60;
const JSON_UTF8 = 'application/json; charset=utf-8';
const crypto = require('crypto');

const cache = new Map();
// Consultas ao TSE em andamento: vários pedidos do mesmo arquivo ao mesmo tempo viram um só.
const emCurso = new Map();

async function consultar(caminho, anterior) {
  const agora = Date.now();
  let item = anterior;
  try {
    const r = await fetch(`${TSE_ORIGEM}/${caminho}`, {
      // O TSE recusa requisições sem cara de navegador.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    const tipo = r.headers.get('content-type') || '';
    // O TSE devolve uma página HTML (404) quando o arquivo ainda não existe.
    const ok = r.ok && !tipo.includes('text/html');
    const ehJson = caminho.toLowerCase().endsWith('.json');
    const validade = ok && !ehJson ? CACHE_FOTO_S : CACHE_JSON_S;
    const corpo = ok ? Buffer.from(await r.arrayBuffer()) : Buffer.from('{"erro":"indisponivel no TSE"}');
    item = {
      status: ok ? 200 : 404,
      tipo: ok ? tipo : JSON_UTF8,
      corpo,
      // Identifica o conteúdo: a tela só baixa o arquivo de novo quando ele muda.
      etag: ok ? `"${crypto.createHash('sha1').update(corpo).digest('base64url')}"` : '',
      validade,
      expira: agora + validade * 1000,
    };
  } catch (e) {
    // Falha de rede: mantém o último dado bom, se houver.
    if (item && item.status === 200) {
      item.expira = agora + 5000;
    } else {
      item = { status: 502, tipo: JSON_UTF8, corpo: Buffer.from('{"erro":"falha ao consultar o TSE"}'), etag: '', validade: 5, expira: agora + 5000 };
    }
  }
  if (cache.size > 3000) cache.clear();
  cache.set(caminho, item);
  return item;
}

async function atender(caminho, res, req) {
  // Só caminhos simples terminando em .json ou imagem: o proxy não é aberto.
  if (!/^[a-z0-9/_.-]+\.(json|jpe?g|png)$/i.test(caminho) || caminho.includes('..')) {
    res.writeHead(400, { 'Content-Type': JSON_UTF8 });
    return res.end('{"erro":"caminho invalido"}');
  }
  let item = cache.get(caminho);
  if (!item || item.expira < Date.now()) {
    if (!emCurso.has(caminho)) emCurso.set(caminho, consultar(caminho, item).finally(() => emCurso.delete(caminho)));
    item = await emCurso.get(caminho);
  }
  const cabecalhos = {
    'Content-Type': item.tipo,
    // s-maxage: a rede da Vercel guarda a resposta e atende o público sem chamar o TSE de novo.
    'Cache-Control': `public, max-age=10, s-maxage=${item.validade}, stale-while-revalidate=${item.status === 200 ? 60 : 0}`,
  };
  if (item.etag) {
    cabecalhos.ETag = item.etag;
    // Arquivo igual ao que a tela já tem: responde só "não mudou", sem reenviar o conteúdo.
    if (req?.headers['if-none-match'] === item.etag) {
      res.writeHead(304, cabecalhos);
      return res.end();
    }
  }
  res.writeHead(item.status, cabecalhos);
  res.end(item.corpo);
}

module.exports = { atender };
