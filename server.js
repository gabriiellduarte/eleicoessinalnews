// Servidor da apuração para rodar no próprio computador (estúdio): entrega os
// arquivos de /public e atende /api/tse/*, /api/cadastro/* e /api/controle (controle
// do telão por outros aparelhos da rede). Na Vercel o controle remoto fica desligado.
const http = require('http');
const fs = require('fs');
const path = require('path');
const cadastro = require('./cadastro');
const tseProxy = require('./tse-proxy');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const RAIZ = path.join(__dirname, 'public');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// --- controle remoto do telão ---------------------------------------------------
// Guarda o estado do telão (cena, estado, cidade...) para o celular comandar o telão.
// Só aparelhos da mesma rede (mesmo IP de internet) do telão conseguem comandá-lo.
// No computador do estúdio o estado fica na memória e os aparelhos são avisados na hora
// (eventos). Na Vercel não há conexão permanente: os aparelhos consultam de 2 em 2 s,
// e o estado fica num banco Redis (Upstash/Vercel KV) se houver um configurado; sem
// banco ele fica na memória da função, que a Vercel pode reiniciar a qualquer momento.
const NA_VERCEL = !!process.env.VERCEL;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const CHAVE_CONTROLE = 'sinal-telao-controle';

// Cada rede (mesmo IP de internet) tem o seu próprio telão: um aparelho de outra rede
// abre o controle, mas só mexe no estado da rede dele, nunca no telão desta.
const redes = new Map(); // rede -> { versao, estado, origem, clientes }
const MAX_REDES = 500;

function controleDa(rede) {
  let c = redes.get(rede);
  if (!c) {
    if (redes.size >= MAX_REDES) {
      // Esquece a rede mais antiga sem telão conectado.
      for (const [k, v] of redes) if (!v.clientes.size) { redes.delete(k); break; }
    }
    c = { versao: 0, estado: {}, origem: '', clientes: new Set() };
    redes.set(rede, c);
  }
  return c;
}

const ehPrivado = (ip) =>
  !ip || ip === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip);

// IPv6: aparelhos da mesma rede compartilham os primeiros 64 bits do endereço.
function prefixoIpv6(ip) {
  const [ini, fim = ''] = ip.split('::');
  const a = ini ? ini.split(':') : [];
  const b = fim ? fim.split(':') : [];
  const partes = ip.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  return partes.slice(0, 4).map((x) => parseInt(x || '0', 16).toString(16)).join(':') + '::/64';
}

// Identifica a rede de quem fez o pedido pelo IP público. Atrás de um proxy (Vercel,
// Hostinger...) o IP do aparelho vem nos cabeçalhos; no computador do estúdio todos os
// aparelhos da rede local (192.168.x.x etc.) contam como a mesma rede.
function redeDe(req) {
  const limpar = (ip) => String(ip || '').trim().replace(/^::ffff:/i, '').replace(/^\[|\]$/g, '');
  let ip = limpar(req.socket.remoteAddress);
  if (NA_VERCEL || ehPrivado(ip)) {
    const h = req.headers;
    const via = h['cf-connecting-ip'] || h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0];
    if (limpar(via)) ip = limpar(via);
  }
  if (ehPrivado(ip)) return 'local';
  return ip.includes(':') ? prefixoIpv6(ip.toLowerCase()) : ip;
}

// Identificador da rede que vai para o navegador (sem expor o IP).
const idDaRede = (rede) => crypto.createHash('sha256').update(rede).digest('hex').slice(0, 12);

async function redis(comando) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comando),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Redis respondeu ${r.status}`);
  return (await r.json()).result;
}

// Com banco, a verdade está nele (várias funções da Vercel compartilham o mesmo estado).
async function lerControle(rede) {
  const controle = controleDa(rede);
  if (!REDIS_URL) return controle;
  try {
    const salvo = JSON.parse((await redis(['GET', `${CHAVE_CONTROLE}:${rede}`])) || 'null');
    if (salvo) Object.assign(controle, { versao: salvo.versao, estado: salvo.estado, origem: salvo.origem });
  } catch (e) {
    console.warn(`[controle] ${e.message}`);
  }
  return controle;
}

async function gravarControle(rede, controle) {
  if (!REDIS_URL) return;
  const { versao, estado, origem } = controle;
  // Some sozinho do banco depois de 3 dias sem uso.
  await redis(['SET', `${CHAVE_CONTROLE}:${rede}`, JSON.stringify({ versao, estado, origem }), 'EX', 259200]).catch((e) => console.warn(`[controle] ${e.message}`));
}

const enderecosNaRede = () =>
  NA_VERCEL
    ? []
    : Object.values(os.networkInterfaces())
        .flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal)
        .map((i) => `http://${i.address}:${PORT}`);

function atenderControle(req, res, url) {
  const rede = redeDe(req);
  const json = (status, dados) => {
    res.writeHead(status, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(dados));
  };

  if (url.pathname === '/api/controle/eventos') {
    if (NA_VERCEL) return json(404, { erro: 'sem eventos nesta hospedagem; use a consulta periódica' });
    const controle = controleDa(rede);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ versao: controle.versao, alteracao: controle.estado })}\n\n`);
    controle.clientes.add(res);
    req.on('close', () => controle.clientes.delete(res));
    return;
  }

  if (req.method === 'GET') {
    return lerControle(rede).then((c) =>
      json(200, { versao: c.versao, estado: c.estado, origem: c.origem, rede: idDaRede(rede), eventos: !NA_VERCEL, banco: !!REDIS_URL, enderecos: enderecosNaRede() }),
    );
  }
  if (req.method !== 'POST') return json(405, { erro: 'método não aceito' });

  let corpo = '';
  req.on('data', (parte) => {
    corpo += parte;
    if (corpo.length > 50000) req.destroy();
  });
  req.on('end', async () => {
    try {
      const { alteracao, origem, versaoConhecida } = JSON.parse(corpo);
      if (!alteracao || typeof alteracao !== 'object' || Array.isArray(alteracao)) throw new Error('alteração inválida');
      const controle = await lerControle(rede);
      Object.assign(controle.estado, alteracao);
      // Se a função reiniciou e perdeu a conta, a versão continua de onde o aparelho sabia.
      controle.versao = Math.max(controle.versao, Number(versaoConhecida) || 0) + 1;
      controle.origem = String(origem || '');
      await gravarControle(rede, controle);
      const aviso = `data: ${JSON.stringify({ versao: controle.versao, alteracao, origem })}\n\n`;
      controle.clientes.forEach((c) => c.write(aviso));
      json(200, { versao: controle.versao });
    } catch (e) {
      json(400, { erro: e.message });
    }
  });
}
// Mantém as conexões de eventos abertas em redes que derrubam conexões paradas.
setInterval(() => redes.forEach((r) => r.clientes.forEach((c) => c.write(': ok\n\n'))), 25000).unref();

function estatico(urlPath, res) {
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith('/')) rel += 'index.html';
  if (rel === '/telao' || rel === '/controle') rel += '.html';
  const arquivo = path.normalize(path.join(RAIZ, rel));
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(arquivo, (err, dados) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(dados);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Aceita /api/<nome>/<caminho> e também /api/<nome>?caminho=<caminho>: na Vercel as
    // regras do vercel.json reescrevem o endereço para a segunda forma antes de chegar aqui.
    const caminhoDe = (nome) => {
      if (url.pathname.startsWith(`/api/${nome}/`)) return url.pathname.slice(`/api/${nome}/`.length);
      return url.pathname === `/api/${nome}` ? url.searchParams.get('caminho') || '' : null;
    };
    if (url.pathname === '/api/controle' || url.pathname.startsWith('/api/controle/')) return atenderControle(req, res, url);
    const doTse = caminhoDe('tse');
    if (doTse !== null) return tseProxy.atender(doTse, res, req);
    const doCadastro = caminhoDe('cadastro');
    if (doCadastro !== null) return cadastro.atender(doCadastro, res);
    estatico(url.pathname, res);
  })
  .on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`A porta ${PORT} já está em uso: o servidor da apuração provavelmente já está rodando.`);
    console.error(`Abra http://localhost:${PORT} ou feche o outro servidor. Para usar outra porta: set PORT=3001 && node server.js`);
    process.exit(1);
  })
  .listen(PORT, () => {
    console.log(`Apuração Sinal News em http://localhost:${PORT}`);
    console.log(`Telão:               http://localhost:${PORT}/telao`);
    for (const e of enderecosNaRede()) console.log(`Controle no celular: ${e}/controle  (mesma rede Wi-Fi)`);
  });
